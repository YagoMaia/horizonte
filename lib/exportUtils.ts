import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { Transaction } from '@/constants/types';

/**
 * Converte uma lista de transações para uma string no formato CSV (padrão brasileiro com separador ponto e vírgula).
 */
export function convertTransactionsToCSV(transactions: Transaction[]): string {
  // Cabeçalhos padrão do Nubank
  const headers = ['date', 'category', 'title', 'amount'];
  
  const rows = transactions.map(tx => {
    const dateFormatted = tx.date ? tx.date.split('T')[0] : '';
    const descSanitized = tx.description ? `"${tx.description.replace(/"/g, '""')}"` : '""';
    
    // Despesas no cartão no Nubank são representadas com valor negativo.
    // Receitas (estornos/pagamentos) são positivas.
    const amountVal = (tx.type === 'receita' ? tx.amount : -tx.amount).toFixed(2);
    
    // Como o app não possui categoria nativa após remoção de tags, usamos 'outros'
    const category = 'outros';
    
    return [
      dateFormatted,
      category,
      descSanitized,
      amountVal
    ];
  });

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * Executa a exportação do conteúdo CSV, baixando na Web ou compartilhando nativamente no Mobile.
 */
export async function exportCSV(csvContent: string, fileName: string) {
  if (Platform.OS === 'web') {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else {
    // Mobile (Android / iOS)
    const fileUri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(fileUri, csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Exportar Fatura',
        UTI: 'public.comma-separated-values-text',
      });
    } else {
      throw new Error('Compartilhamento não disponível neste dispositivo.');
    }
  }
}
