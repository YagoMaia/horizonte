export type PurchaseMode = 'off' | 'review' | 'auto';
export type PurchaseKind = 'credito' | 'debito';
export interface PurchaseRule { mode: PurchaseMode; accountId: string }
export interface PurchaseBank { packageName: string; name: string; enabled: boolean; credito: PurchaseRule; debito: PurchaseRule }
export interface CapturedPurchase { id: string; packageName: string; title: string; text: string; timestamp: number }
export interface PurchaseCandidate extends CapturedPurchase { kind?: PurchaseKind; amount?: number; description: string; uncertain: boolean }
export interface ImportState { banks: PurchaseBank[]; pending: PurchaseCandidate[]; handled: string[] }
export const IMPORT_KEY = '@horizonte:purchase_import';
export const EMPTY_IMPORT: ImportState = { banks: [], pending: [], handled: [] };

/** Conservative: only explicit purchases; payment, refund and denial alerts are never expenses. */
export function parsePurchase(event: CapturedPurchase): PurchaseCandidate | null {
  if (!event.id || !event.packageName || !Number.isFinite(event.timestamp) || event.timestamp <= 0) return null;
  const text = `${event.title} ${event.text}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (!/\bcompra\b/.test(text) || /negad|recusad|nao (?:foi )?(?:aprovad|autorizad)|estorn|cancelad|reembols|pagamento (?:da|de sua) fatura|tentativa/.test(text)) return null;
  const credit = /\bcredito\b/.test(text), debit = /\bdebito\b/.test(text);
  const kind = credit !== debit ? credit ? 'credito' : 'debito' : undefined;
  const matches = [...text.matchAll(/r\$\s*((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})(?!\d)/g)];
  const amounts = [...new Set(matches.map(match => Number(match[1].replace(/\./g, '').replace(',', '.'))))];
  const amount = amounts.length === 1 && amounts[0] > 0 && Number.isSafeInteger(Math.round(amounts[0] * 100)) ? amounts[0] : undefined;
  const confirmed = /compra (?:aprovada|realizada|efetuada)|(?:fez|realizou) (?:uma )?compra/.test(text);
  return { ...event, kind, amount, description: event.text.trim().slice(0, 200) || event.title, uncertain: !confirmed || !kind || !amount || /parcel|\d+\s*x\b/.test(text) || event.timestamp > Date.now() + 300000 };
}
