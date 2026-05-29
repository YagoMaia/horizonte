import { Account, Transaction } from '@/constants/types';

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateString));
}

export function formatDateShort(dateString: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(dateString));
}

// 👉 NOVA FUNÇÃO: Determina mês/ano da fatura de um lançamento específico baseado nas regras do cartão
export function getInvoiceForTx(dateStr: string, account: any) {
  const closingDay = account?.closingDay || 25;
  const dueDay = account?.dueDay || 5;
  
  // 👉 Extração Robusta (Sênior): Evita que shifts de Timezone alterem o dia/mês pretendido
  const parts = dateStr.split('T')[0].split('-').map(Number);
  let y = parts[0];
  let m = parts[1]; // 1-indexed
  const day = parts[2];

  if (day >= closingDay) m += 1;
  if (dueDay < closingDay) m += 1;

  while (m > 12) {
    m -= 12;
    y += 1;
  }
  // Retorna m-1 para ser compatível com o formato 0-11 do JavaScript
  return { viewMonth: m - 1, viewYear: y, value: y * 100 + m };
}

// Usa a nova função para garantir alinhamento absoluto com a CartaoScreen
// 👉 NOVA FUNÇÃO: Calcula o total de uma fatura específica de um cartão
export function getInvoiceTotal(
  card: Account,
  transactions: Transaction[],
  targetMonth: number,
  targetYear: number
): number {
  if (card.type !== 'cartao_credito') return 0;
  
  const targetValue = targetYear * 100 + (targetMonth + 1);

  return transactions
    .filter((tx) => {
      if (tx.accountId !== card.id || tx.paymentMethod !== 'credito') return false;
      const txInvoice = getInvoiceForTx(tx.date, card);
      return txInvoice.value === targetValue;
    })
    .reduce((sum, tx) => sum + (tx.type === 'receita' ? -tx.amount : tx.amount), 0);
}

// 👉 NOVA FUNÇÃO: Identifica e calcula a fatura "Aberta" atual do cartão
export function getCurrentOpenInvoiceTotal(
  card: Account,
  transactions: Transaction[]
): number {
  if (card.type !== 'cartao_credito') return 0;
  
  // A fatura "Aberta" é aquela correspondente à data de hoje
  const today = new Date().toISOString();
  const currentInvoice = getInvoiceForTx(today, card);
  
  return getInvoiceTotal(card, transactions, currentInvoice.viewMonth, currentInvoice.viewYear);
}

