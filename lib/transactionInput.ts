import { dayKey } from './financialDate';

export const MAX_RECURRENCES = 1000;
let idSequence = 0;
export function createRecordId() {
  idSequence += 1;
  return `tx-${Date.now()}-${idSequence}-${Math.random().toString(36).slice(2, 8)}`;
}

export function parseTransactionDate(value: string) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) throw new Error('Informe uma data no formato DD/MM/AAAA.');
  const [day, month, year] = value.split('/').map(Number);
  const date = new Date(year, month - 1, day, 12);
  if (year < 1900 || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error('Informe uma data válida.');
  }
  return dayKey(date);
}
