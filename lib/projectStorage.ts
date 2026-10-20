import AsyncStorage from '@react-native-async-storage/async-storage';
import { Project, Transaction } from '@/constants/types';

const keys = ['@horizonte:projects', '@horizonte:transactions'] as const;
const journalKey = '@horizonte:project_journal';
type PreviousValues = readonly (readonly [string, string | null])[];

async function restore(previous: PreviousValues) {
  await AsyncStorage.multiSet(previous.filter((entry): entry is [string, string] => entry[1] !== null));
  await AsyncStorage.multiRemove(previous.filter((entry) => entry[1] === null).map(([key]) => key));
  await AsyncStorage.removeItem(journalKey);
}

/** Recupera a última alteração de projeto que foi interrompida antes de finalizar. */
export async function recoverProjectWrite() {
  const raw = await AsyncStorage.getItem(journalKey);
  if (!raw) return;

  const previous: unknown = JSON.parse(raw);
  if (!Array.isArray(previous) || previous.length !== keys.length || !previous.every((entry, index) =>
    Array.isArray(entry) && entry[0] === keys[index] && (entry[1] === null || typeof entry[1] === 'string')
  )) {
    throw new Error('Diário de projetos inválido.');
  }

  await restore(previous as PreviousValues);
}

/** Grava projeto e vínculos de lançamentos como uma única alteração recuperável. */
export async function commitProjectChange(projects: Project[], transactions: Transaction[]) {
  await recoverProjectWrite();
  const previous = await AsyncStorage.multiGet([...keys]);
  await AsyncStorage.setItem(journalKey, JSON.stringify(previous));

  try {
    await AsyncStorage.multiSet([
      [keys[0], JSON.stringify(projects)],
      [keys[1], JSON.stringify(transactions)],
    ]);
    await AsyncStorage.removeItem(journalKey);
  } catch (error) {
    await restore(previous);
    throw error;
  }
}
