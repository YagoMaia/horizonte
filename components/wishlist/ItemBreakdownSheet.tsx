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
import { WishlistItem } from '@/constants/types';

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
                <View style={styles.invoiceRow}>
                  <Text style={[styles.invoiceLabel, { color: colors.foreground }]}>💰 Saldo Atual Contas</Text>
                  <Text style={[styles.invoiceValue, { color: colors.foreground }]}>
                    {initialBalance >= 0 ? '' : '-'}{formatMoney(initialBalance)}
                  </Text>
                </View>

                <View style={styles.invoiceRow}>
                  <Text style={[styles.invoiceLabel, { color: colors.foreground }]}>📈 Entradas Futuras</Text>
                  <Text style={[styles.invoiceValue, { color: '#10B981' }]}>
                    + {formatMoney(projectedRevenues)}
                  </Text>
                </View>

                <View style={styles.invoiceRow}>
                  <Text style={[styles.invoiceLabel, { color: colors.foreground }]}>📉 Saídas e Faturas</Text>
                  <Text style={[styles.invoiceValue, { color: '#EF4444' }]}>
                    - {formatMoney(projectedExpenses)}
                  </Text>
                </View>

                <View style={styles.invoiceRow}>
                  <Text style={[styles.invoiceLabel, { color: colors.foreground }]}>🛡️ Custo de Vida / Margem</Text>
                  <Text style={[styles.invoiceValue, { color: '#F59E0B' }]}>
                    - {formatMoney(totalDailyAllowance + totalSafetyMargin)}
                  </Text>
                </View>

                <View style={[styles.separator, { backgroundColor: colors.border }]} />

                <View style={styles.invoiceRowTotal}>
                  <Text style={[styles.invoiceTotalLabel, { color: colors.foreground }]}>✨ Caixa Livre Projetado</Text>
                  <Text style={[styles.invoiceTotalValue, { color: highlightColor }]}>
                    {rawAvailable >= 0 ? '' : '-'}{formatMoney(rawAvailable)}
                  </Text>
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
});
