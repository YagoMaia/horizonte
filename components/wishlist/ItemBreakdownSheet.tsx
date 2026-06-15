import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { WishlistItem, Transaction } from '@/constants/types';

interface BreakdownData {
  initialBalance: number;
  projectedRevenues: number;
  projectedExpenses: number;
  totalDailyAllowance: number;
  totalSafetyMargin: number;
  rawAvailable: number;
}

interface ItemBreakdownSheetProps {
  isVisible: boolean;
  onClose: () => void;
  item: WishlistItem | null;
  breakdownData: BreakdownData | null;
  targetMonthIndex: number;
  suggestedMessage?: string;
  currentAvailable?: number;
  creditData?: {
    maxCreditSpend: number;
    currentMonthBill: number;
    installmentValue: number;
    installments: number;
    effectiveMaxCreditSpend?: number;
    billTransactions?: Transaction[];
  } | null;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function ItemBreakdownSheet({
  isVisible,
  onClose,
  item,
  breakdownData,
  targetMonthIndex,
  suggestedMessage,
  currentAvailable = 0,
  creditData,
}: ItemBreakdownSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (!item || !breakdownData) return null;

  const {
    initialBalance,
    projectedRevenues,
    projectedExpenses,
    totalDailyAllowance,
    totalSafetyMargin,
    rawAvailable
  } = breakdownData;

  const now = new Date();
  const isCurrentMonth = targetMonthIndex === now.getMonth();
  
  let headerText = '';
  let highlightColor = colors.foreground;

  if (rawAvailable >= item.price) {
    headerText = isCurrentMonth 
      ? 'Por que você pode comprar hoje?' 
      : `Projeção de viabilidade para ${MONTH_NAMES[targetMonthIndex]}`;
    highlightColor = '#10B981'; // VERDE
  } else if (rawAvailable * 3 >= item.price) {
    headerText = `Projeção para o mês de ${MONTH_NAMES[targetMonthIndex]}`;
    highlightColor = '#F59E0B'; // AMARELO
  } else {
    headerText = `Projeção para o mês de ${MONTH_NAMES[targetMonthIndex]}`;
    highlightColor = '#EF4444'; // VERMELHO
  }

  const formatMoney = (val: number) => 
    `R$ ${Math.abs(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[
              styles.sheet, 
              { 
                backgroundColor: colors.card,
                paddingBottom: insets.bottom > 0 ? insets.bottom : 24
              }
            ]}>
              <View style={[styles.dragIndicator, { backgroundColor: colors.border }]} />
              
              <View style={styles.header}>
                <View style={{ flex: 1, paddingRight: 16 }}>
                  <Text style={[styles.itemName, { color: colors.foreground }]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
                    {headerText}
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.background }]}>
                  <Ionicons name="close" size={20} color={colors.foreground} />
                </TouchableOpacity>
              </View>

              <View style={styles.invoiceList}>
                {/* Explanation Box */}
                <View style={[styles.explanationBox, { backgroundColor: currentAvailable >= item.price ? colors.primary + '15' : colors.destructive + '15', borderColor: currentAvailable >= item.price ? colors.primary + '30' : colors.destructive + '30' }]}>
                  <View style={styles.explanationHeader}>
                    <Ionicons name="information-circle" size={20} color={currentAvailable >= item.price ? colors.primary : colors.destructive} />
                    <Text style={[styles.explanationTitle, { color: colors.foreground }]}>O que isso significa?</Text>
                  </View>
                  <Text style={[styles.explanationText, { color: colors.foreground }]}>
                    {suggestedMessage}
                  </Text>
                  
                  <View style={{ marginTop: 8 }}>
                    {creditData && (
                      <>
                        <Text style={[styles.explanationText, { color: colors.mutedForeground, marginTop: 4 }]}>
                          • Valor da parcela ({creditData.installments}x): <Text style={{ fontWeight: '600', color: colors.foreground }}>{formatMoney(creditData.installmentValue)}</Text>
                        </Text>
                        <Text style={[styles.explanationText, { color: colors.mutedForeground }]}>
                          • Teto do Cartão Mensal: <Text style={{ fontWeight: '600', color: colors.foreground }}>{creditData.maxCreditSpend === Infinity ? 'Sem Teto' : formatMoney(creditData.maxCreditSpend)}</Text>
                        </Text>
                        {creditData.creditSafetyMargin > 0 && creditData.maxCreditSpend !== Infinity && (
                          <Text style={[styles.explanationText, { color: colors.mutedForeground }]}>
                            • Margem de Segurança (Reservado): <Text style={{ fontWeight: '600', color: colors.foreground }}>{formatMoney(creditData.creditSafetyMargin)}</Text>
                          </Text>
                        )}
                        <Text style={[styles.explanationText, { color: colors.mutedForeground }]}>
                          • Fatura Mensal Já Comprometida: <Text style={{ fontWeight: '600', color: colors.foreground }}>{formatMoney(creditData.currentMonthBill)}</Text>
                        </Text>
                        {creditData.billTransactions && creditData.billTransactions.length > 0 && (
                          <View style={{ marginLeft: 16, marginTop: 4, marginBottom: 4, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: colors.border }}>
                            {creditData.billTransactions.map(tx => (
                              <Text key={tx.id} style={{ fontSize: 13, color: colors.mutedForeground }}>
                                {tx.description || 'Lançamento sem nome'}: <Text style={{ fontWeight: '500', color: colors.foreground }}>{formatMoney(tx.amount)}</Text>
                              </Text>
                            ))}
                          </View>
                        )}
                        {creditData.currentMonthBill + creditData.installmentValue > creditData.maxCreditSpend && (
                          <Text style={[styles.explanationText, { color: colors.destructive, fontWeight: '600', marginTop: 4 }]}>
                            A parcela de {formatMoney(creditData.installmentValue)} somada à sua fatura ({formatMoney(creditData.currentMonthBill)}) supera o seu Teto de {formatMoney(creditData.maxCreditSpend)}.
                          </Text>
                        )}
                      </>
                    )}
                  </View>
                </View>
              </View>

            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  dragIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  itemName: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invoiceList: {
    gap: 16,
    marginBottom: 16,
  },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invoiceLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  invoiceValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  separator: {
    height: 1,
    width: '100%',
    marginVertical: 4,
  },
  invoiceRowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  invoiceTotalLabel: {
    fontSize: 17,
    fontWeight: '700',
  },
  invoiceTotalValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  explanationBox: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  explanationTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  explanationText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
