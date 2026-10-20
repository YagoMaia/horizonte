import { Account, Transaction } from '@/constants/types';
import { financialDate } from './financialDate';

const typeLabel: Record<Transaction['type'], string> = { receita: 'Receita', despesa: 'Despesa', transferencia: 'Transferência' };

/** Preserva células como texto quando poderiam ser interpretadas como fórmulas por planilhas. */
export function csvCell(value: unknown) {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildTransactionsCsv(transactions: Transaction[], accounts: Account[]) {
  const accountNames = new Map(accounts.map(account => [account.id, account.name]));
  const rows = transactions.map(transaction => {
    const date = financialDate(transaction.date);
    const formattedDate = Number.isFinite(date.getTime())
      ? `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
      : '';
    return [
      formattedDate,
      typeLabel[transaction.type],
      transaction.description,
      transaction.amount.toFixed(2).replace('.', ','),
      accountNames.get(transaction.accountId) || 'Conta removida',
      transaction.tag || '',
      transaction.paid ? 'Pago' : 'Pendente',
    ].map(csvCell).join(';');
  });
  return `\uFEFF${['Data', 'Tipo', 'Descrição', 'Valor', 'Conta', 'Categoria', 'Status'].map(csvCell).join(';')}\n${rows.join('\n')}${rows.length ? '\n' : ''}`;
}
