import AsyncStorage from '@react-native-async-storage/async-storage';
import { Account, Transaction } from '@/constants/types';
const keys = ['@horizonte:transactions', '@horizonte:accounts'];
const journalKey = '@horizonte:ledger_journal';
async function restore(previous: readonly (readonly [
    string,
    string | null
])[]) {
    await AsyncStorage.multiSet(previous.filter((p): p is [
        string,
        string
    ] => p[1] !== null));
    await AsyncStorage.multiRemove(previous.filter(p => p[1] === null).map(p => p[0]));
    await AsyncStorage.removeItem(journalKey);
}
export async function recoverLedgerWrite() {
    const raw = await AsyncStorage.getItem(journalKey);
    if (!raw)
        return;
    const previous = JSON.parse(raw);
    if (!Array.isArray(previous) || previous.length !== 2 || !previous.every((p, i) => Array.isArray(p) && p[0] === keys[i] && (p[1] === null || typeof p[1] === 'string')))
        throw new Error('Diário financeiro inválido.');
    await restore(previous);
}
export async function commitLedger(transactions: Transaction[], accounts: Account[]) {
    await recoverLedgerWrite();
    const previous = await AsyncStorage.multiGet(keys);
    await AsyncStorage.setItem(journalKey, JSON.stringify(previous));
    try {
        await AsyncStorage.multiSet([[keys[0], JSON.stringify(transactions)], [keys[1], JSON.stringify(accounts)]]);
        await AsyncStorage.removeItem(journalKey);
    }
    catch (error) {
        await restore(previous);
        throw error;
    }
}
