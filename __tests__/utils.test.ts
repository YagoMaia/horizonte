import { formatCurrency } from '../lib/utils';
import { getInvoiceForTx } from '../lib/utils';
import { Account } from '../constants/types';

describe('utils.ts', () => {
  describe('formatCurrency', () => {
    it('should format positive values correctly', () => {
      expect(formatCurrency(1500.5)).toContain('1.500,50');
      // Depending on the Node.js environment, the currency symbol might vary slightly in spacing
      // but it should contain the formatted number.
    });

    it('should format zero correctly', () => {
      expect(formatCurrency(0)).toContain('0,00');
    });

    it('should format negative values correctly', () => {
      expect(formatCurrency(-50.25)).toContain('50,25');
      expect(formatCurrency(-50.25)).toContain('-');
    });
  });

  describe('getInvoiceForTx', () => {
    it('should calculate the correct invoice month/year based on closing day', () => {
      const mockCard: Account = {
        id: 'card1',
        name: 'Credit Card',
        balance: 0,
        type: 'cartao_credito',
        color: '#000',
        icon: 'card',
        closingDay: 25,
        dueDay: 5,
      };

      // Transaction before closing day (e.g. Oct 20) -> falls into Next Month (November) if due day < closing day
      // Wait, let's trace the logic in utils:
      // m = txDate.getMonth() + 1
      // if txDate.getDate() >= closingDay => m += 1
      // if dueDay < closingDay => m += 1
      
      const txDate1 = new Date('2024-10-20T12:00:00Z'); // Day 20 < 25. m = 10. dueDay (5) < closingDay (25) => m = 11.
      const invoice1 = getInvoiceForTx(txDate1.toISOString(), mockCard);
      expect(invoice1.viewMonth).toBe(10); // 0-indexed, so 10 is November
      expect(invoice1.viewYear).toBe(2024);

      const txDate2 = new Date('2024-10-26T12:00:00Z'); // Day 26 >= 25. m = 10 + 1 = 11. dueDay (5) < closingDay (25) => m = 12.
      const invoice2 = getInvoiceForTx(txDate2.toISOString(), mockCard);
      expect(invoice2.viewMonth).toBe(11); // 11 is December
      expect(invoice2.viewYear).toBe(2024);
      
      // December rollover
      const txDate3 = new Date('2024-12-26T12:00:00Z'); // Day 26 >= 25. m = 12 + 1 = 13. dueDay(5) < 25 => m = 14.
      // 14 means February next year
      const invoice3 = getInvoiceForTx(txDate3.toISOString(), mockCard);
      expect(invoice3.viewMonth).toBe(1); // 1 is February
      expect(invoice3.viewYear).toBe(2025);
    });
  });
});
