/** Datas sem hora são dias locais; ISO com hora representa um instante localizável. */
export function financialDate(value: string | Date): Date {
  if (value instanceof Date) return new Date(value.getTime());
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day, 12);
  }
  return new Date(value);
}
export function dayKey(value: string | Date): string {
  const date = financialDate(value);
  if (!Number.isFinite(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export const monthKey = (value: string | Date) => dayKey(value).slice(0, 7);

export function goalForecast(remaining: number, contribution: number, today = new Date()): string {
  if (remaining <= 0) return 'Concluída';
  if (!Number.isFinite(contribution) || contribution <= 0) return 'Sem previsão';
  const months = Math.ceil(remaining / contribution);
  const date = new Date(today.getFullYear(), today.getMonth() + months, 1, 12);
  if (!Number.isFinite(date.getTime())) return 'Sem previsão';
  return date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
}
