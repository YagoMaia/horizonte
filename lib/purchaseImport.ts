import type { Account, Transaction } from '@/constants/types';
import { dayKey } from './financialDate';
export type PurchaseMode = 'off' | 'review' | 'auto';
export type PurchaseKind = 'credito' | 'debito';
export interface PurchaseDestination { accountId: string; lastFour: string }
export interface PurchaseRule { mode: PurchaseMode; accountId: string; destinations?: PurchaseDestination[]; allowWithoutIdentifier?: boolean }
export interface PurchaseBank { packageName: string; name: string; enabled: boolean; credito: PurchaseRule; debito: PurchaseRule }
export interface CapturedPurchase { id: string; packageName: string; title: string; text: string; timestamp: number }
export interface PurchaseCandidate extends CapturedPurchase { kind?: PurchaseKind; amount?: number; description: string; uncertain: boolean; lastFour?: string; installments?: number; reason?: string; possibleDuplicate?: boolean }
export interface PurchaseReviewOptions { installments?: number; amountBasis?: 'total' | 'installment'; confirmDuplicate?: boolean }
export interface ImportState { banks: PurchaseBank[]; pending: PurchaseCandidate[]; handled: string[]; reviewBefore?: number }
export const IMPORT_KEY = '@horizonte:purchase_import';
export const MAX_PENDING_IMPORTS = 200;
export const MAX_HANDLED_IMPORTS = 4000;
export const IMPORT_BATCH_SIZE = 25;
export const EMPTY_IMPORT: ImportState = { banks: [], pending: [], handled: [] };

/** Conservative: only explicit purchases; payment, refund and denial alerts are never expenses. */
export function parsePurchase(event: CapturedPurchase): PurchaseCandidate | null {
  if (!event || typeof event.id !== 'string' || !event.id || typeof event.packageName !== 'string' || !event.packageName || typeof event.title !== 'string' || typeof event.text !== 'string' || !Number.isFinite(event.timestamp) || event.timestamp <= 0 || !Number.isFinite(new Date(event.timestamp).getTime())) return null;
  const text = `${event.title} ${event.text}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/negad|recusad|nao (?:foi )?(?:aprovad|autorizad)|estorn|cancelad|reembols|fatura|boleto|\bpix\b|transferencia|tentativa|pagamento recebido/.test(text)) return null;
  const credit = /\bcredito\b/.test(text), debit = /\bdebito\b/.test(text);
  const kind = credit !== debit ? credit ? 'credito' : 'debito' : undefined;
  const explicitPurchase = /\bcompra\b/.test(text);
  if (!explicitPurchase && !(/\bpagamento (?:aprovado|realizado|efetuado)\b/.test(text) && (credit || debit))) return null;
  const matches = [...text.matchAll(/r\$\s*((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})(?!\d)/g)];
  const value = matches.length === 1 ? Number(matches[0][1].replace(/\./g, '').replace(',', '.')) : undefined;
  const amount = value && value > 0 && Number.isSafeInteger(Math.round(value * 100)) ? value : undefined;
  const finals = [...text.matchAll(/(?:\bfinal\s*[:*\-]?\s*|\bterminad[oa] em\s*|\bcartao\s*[*x•]+\s*)(\d{4})(?!\d)/g)].map(match => match[1]);
  const lastFour = new Set(finals).size === 1 ? finals[0] : undefined;
  const count = /\b(?:em\s+)?(\d{1,4})\s*x\b|\b(\d{1,4})\s*parcelas\b/.exec(text);
  const installments = count ? Number(count[1] || count[2]) : undefined;
  const confirmed = explicitPurchase && /compra (?:aprovada|realizada|efetuada)|(?:fez|realizou) (?:uma )?compra/.test(text);
  return { ...event, kind, amount, lastFour, installments, description: event.text.trim().slice(0, 200) || event.title, uncertain: !confirmed || !kind || !amount || /parcel|\d+\s*x\b/.test(text) || new Set(finals).size > 1 || event.timestamp > Date.now() + 300000 };
}

export function destinationFor(candidate: PurchaseCandidate, rule: PurchaseRule | undefined, accounts: Account[]) {
  if (!rule || !candidate.kind) return undefined;
  let id: string | undefined;
  if (candidate.lastFour) {
    const ids = new Set((rule.destinations || []).filter(d => d.lastFour === candidate.lastFour).map(d => d.accountId));
    if (ids.size === 1) id = [...ids][0];
  } else if (rule.allowWithoutIdentifier) id = rule.accountId;
  return accounts.find(a => a.id === id && (candidate.kind === 'credito' ? a.type === 'cartao_credito' : a.type !== 'cartao_credito'));
}

export function validatePurchaseBanks(banks: PurchaseBank[]) {
  const packages = new Set<string>();
  for (const bank of banks) {
    if (!bank.packageName || packages.has(bank.packageName)) throw new Error('Aplicativo duplicado ou inválido.');
    packages.add(bank.packageName);
    for (const kind of ['credito', 'debito'] as const) {
      const rule = bank[kind], seen = new Set<string>();
      if (!rule || !['off', 'review', 'auto'].includes(rule.mode)) throw new Error('Escolha um modo válido.');
      for (const destination of rule.destinations || []) {
        if (!/^\d{4}$/.test(destination.lastFour) || !destination.accountId || seen.has(destination.lastFour)) throw new Error('Informe finais com quatro dígitos, sem repetir o mesmo final na modalidade.');
        seen.add(destination.lastFour);
      }
      if (rule.allowWithoutIdentifier && !rule.accountId) throw new Error('Escolha o destino padrão para compras sem final.');
    }
  }
}

export class PossiblePurchaseDuplicateError extends Error {
  constructor() { super('Existe um lançamento parecido. Confira a possível duplicata antes de confirmar.'); this.name = 'PossiblePurchaseDuplicateError'; }
}

/** Equal purchases are sent to review, never silently merged. Includes manually entered expenses. */
export function findPotentialPurchaseDuplicate(transactions: Transaction[], purchase: { accountId: string; amount: number; date: string; notificationImportId?: string }) {
  const totals = new Map<string, number>();
  for (const item of transactions) if (item.groupId && item.totalInstallments) totals.set(item.groupId, (totals.get(item.groupId) || 0) + Math.round(item.amount * 100));
  const cents = Math.round(purchase.amount * 100), date = Date.parse(dayKey(purchase.date) + 'T12:00:00Z');
  return transactions.find(item => item.type === 'despesa' && !item.isAdjustment && item.accountId === purchase.accountId &&
    (!purchase.notificationImportId || item.notificationImportId !== purchase.notificationImportId) &&
    (item.groupId && item.totalInstallments ? totals.get(item.groupId) : Math.round(item.amount * 100)) === cents &&
    Math.abs(Date.parse(dayKey(item.purchaseDate || item.date) + 'T12:00:00Z') - date) <= 86400000);
}
