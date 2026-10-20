import AsyncStorage from '@react-native-async-storage/async-storage';
import { Goal, Transaction } from '@/constants/types';

const keys = ['@horizonte:goals', '@horizonte:transactions'] as const;
const journalKey = '@horizonte:goal_journal';
type PreviousValues = readonly (readonly [string, string | null])[];

async function restore(previous: PreviousValues) {
  await AsyncStorage.multiSet(previous.filter((entry): entry is [string, string] => entry[1] !== null));
  await AsyncStorage.multiRemove(previous.filter((entry) => entry[1] === null).map(([key]) => key));
  await AsyncStorage.removeItem(journalKey);
}

/** Recupera a exclusão de meta que foi interrompida antes de concluir. */
export async function recoverGoalWrite() {
  const raw = await AsyncStorage.getItem(journalKey);
  if (!raw) return;
  const previous: unknown = JSON.parse(raw);
  if (!Array.isArray(previous) || previous.length !== keys.length || !previous.every((entry, index) =>
    Array.isArray(entry) && entry[0] === keys[index] && (entry[1] === null || typeof entry[1] === 'string')
  )) throw new Error('Diário de metas inválido.');
  await restore(previous as PreviousValues);
}

/** Grava metas e seus vínculos com lançamentos como uma alteração recuperável. */
export async function commitGoalChange(goals: Goal[], transactions: Transaction[]) {
  await recoverGoalWrite();
  const previous = await AsyncStorage.multiGet([...keys]);
  await AsyncStorage.setItem(journalKey, JSON.stringify(previous));
  try {
    await AsyncStorage.multiSet([
      [keys[0], JSON.stringify(goals)],
      [keys[1], JSON.stringify(transactions)],
    ]);
    await AsyncStorage.removeItem(journalKey);
  } catch (error) {
    await restore(previous);
    throw error;
  }
}
