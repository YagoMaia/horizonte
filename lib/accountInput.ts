export function parseAccountAmount(value: string, fieldName: string, allowNegative = true) {
  const input = value.trim();
  if (!input) return 0;

  const sign = input.startsWith('-') ? -1 : 1;
  const unsigned = input.replace(/^[+-]/, '');

  if (!/^\d+(?:[.,]\d{1,2})?$/.test(unsigned) && !/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(unsigned)) {
    throw new Error(`Informe ${fieldName} em reais, por exemplo 1.234,56.`);
  }

  const normalized = unsigned.includes(',')
    ? unsigned.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(?:\.\d{3})+$/.test(unsigned)
      ? unsigned.replace(/\./g, '')
      : unsigned;

  const amount = sign * Number(normalized);
  if (!Number.isFinite(amount) || !Number.isSafeInteger(Math.round(amount * 100)) || (!allowNegative && amount < 0)) {
    throw new Error(`Informe ${fieldName} válido.`);
  }

  return amount;
}

export function parseCardDay(value: string, fieldName: string) {
  if (!/^\d{1,2}$/.test(value.trim())) {
    throw new Error(`${fieldName} é obrigatório.`);
  }

  const day = Number(value);
  if (day < 1 || day > 31) {
    throw new Error(`${fieldName} deve estar entre 1 e 31.`);
  }

  return day;
}

