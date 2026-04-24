// components/screens/HorizonteScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Modal, // 👉 Importação adicionada
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useStoreContext } from '@/context/StoreContext';
import { formatCurrency, formatDateShort } from '@/lib/utils'; // 👉 formatDateShort adicionado

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getWeekDay(year: number, month: number, day: number) {
  return WEEK_DAYS[new Date(year, month, day).getDay()];
}

function formatShort(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function HorizonteScreen() {
  const { colors } = useTheme();
  const { transactions, accounts } = useStoreContext();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  // 👉 NOVO ESTADO: Controla qual dia está selecionado no modal
  const [selectedDay, setSelectedDay] = useState<any | null>(null);

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11); setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) {
      setMonth(0); setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  const days = useMemo(() => {
    const daysCount = getDaysInMonth(year, month);
    const monthTxs = transactions.filter((tx) => {
      const d = new Date(tx.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });

    const thisPlusAfterTxs = transactions.filter((tx) => {
      const d = new Date(tx.date);
      return (d.getFullYear() > year || (d.getFullYear() === year && d.getMonth() >= month));
    });

    let openingBalance = totalBalance;
    thisPlusAfterTxs.forEach((tx) => {
      if (!tx.paid) return;
      if (tx.type === 'receita') openingBalance -= tx.amount;
      else if (tx.type === 'despesa') openingBalance += tx.amount;
    });

    let runningBalance = openingBalance;
    const result = [];

    for (let d = 1; d <= daysCount; d++) {
      const dayTxs = monthTxs.filter((tx) => new Date(tx.date).getDate() === d);
      const income = dayTxs.filter((t) => t.type === 'receita').reduce((s, t) => s + t.amount, 0);
      const expense = dayTxs.filter((t) => t.type === 'despesa').reduce((s, t) => s + t.amount, 0);

      const dayDate = new Date(year, month, d);
      const isPast = dayDate < new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

      let balanceForCurrentPlanning = runningBalance + income;
      const remainingDays = daysCount - d + 1;
      let dailyPlan = balanceForCurrentPlanning > 0 ? balanceForCurrentPlanning / remainingDays : 0;

      if (isPast) {
        runningBalance += income - expense;
      } else {
        runningBalance += income - expense - dailyPlan;
      }

      result.push({
        day: d,
        weekDay: getWeekDay(year, month, d),
        income,
        expense,
        dailyPlan,
        balance: runningBalance,
        isPast,
        isToday,
        fullDate: dayDate.toISOString(), // Adicionamos a data completa para o Modal usar
        transactions: dayTxs, // Adicionamos a lista de transações do dia para o Modal
      });
    }
    return result;
  }, [transactions, accounts, year, month, totalBalance]);

  const totalIncome = days.reduce((s, d) => s + d.income, 0);
  const totalExpense = days.reduce((s, d) => s + d.expense, 0);
  const endBalance = days.length > 0 ? days[days.length - 1].balance : totalBalance;
  const currentDailyPlan = days.find(d => d.isToday || !d.isPast)?.dailyPlan || 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header do Mês */}
      <View style={[styles.monthNav, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={prevMonth}><Ionicons name='chevron-back' size={22} color={colors.foreground} /></TouchableOpacity>
        <Text style={[styles.monthTitle, { color: colors.foreground }]}>{MONTH_NAMES[month]} {year}</Text>
        <TouchableOpacity onPress={nextMonth}><Ionicons name='chevron-forward' size={22} color={colors.foreground} /></TouchableOpacity>
      </View>

      {/* Cartão de Orçamento */}
      <View style={[styles.budgetCard, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.budgetRow}>
          <View style={styles.budgetInfo}>
            <Text style={[styles.budgetLabel, { color: colors.mutedForeground }]}>Saldo Disponível</Text>
            <Text style={[styles.budgetValue, { color: colors.foreground }]}>{formatCurrency(totalBalance)}</Text>
          </View>
          <View style={styles.budgetRight}>
            <Text style={[styles.dailyLabel, { color: colors.mutedForeground }]}>Plano p/ Hoje</Text>
            <Text style={[styles.dailyValue, { color: colors.primary }]}>{formatShort(currentDailyPlan)}</Text>
          </View>
        </View>
      </View>

      {/* Tira de Resumo */}
      <View style={[styles.summaryStrip, { backgroundColor: colors.secondary, borderBottomColor: colors.border }]}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Entradas</Text>
          <Text style={[styles.summaryValue, { color: colors.success }]}>+{formatShort(totalIncome)}</Text>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Saídas</Text>
          <Text style={[styles.summaryValue, { color: colors.destructive }]}>-{formatShort(totalExpense)}</Text>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Projeção Fim</Text>
          <Text style={[styles.summaryValue, { color: endBalance >= 0 ? colors.success : colors.destructive }]}>{formatShort(endBalance)}</Text>
        </View>
      </View>

      {/* Lista de Dias */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {days.map((d, idx) => {
          const rowBg = d.isToday ? colors.primary + '10' : idx % 2 === 0 ? colors.card : colors.background;
          const economizou = d.dailyPlan > 0 && d.expense < d.dailyPlan;
          const excedeu = d.isPast && d.expense > d.dailyPlan;
          const valorDiferenca = Math.abs(d.dailyPlan - d.expense);
          const mostrarBadge = d.isPast || d.isToday;
          const saldoBg = d.balance >= 0 ? colors.successLight : colors.dangerLight;
          const saldoColor = d.balance >= 0 ? colors.success : colors.destructive;

          return (
            // 👉 AQUI A LINHA VIRA CLICÁVEL E ABRE O MODAL
            <TouchableOpacity
              key={d.day}
              activeOpacity={0.7}
              onPress={() => setSelectedDay(d)}
              style={[styles.row, { backgroundColor: rowBg, borderBottomColor: colors.border }]}
            >
              <View style={[styles.colDia, { backgroundColor: d.isToday ? colors.primary + '15' : 'rgba(0,0,0,0.02)' }]}>
                <Text style={[styles.dayNumber, { color: colors.foreground }]}>{d.day}</Text>
                <Text style={[styles.weekDay, { color: colors.mutedForeground }]}>{d.weekDay}</Text>
              </View>

              <View style={styles.colIndicators}>
                <View style={styles.indicatorLine}>
                  <Ionicons name="arrow-up-circle" size={16} color={d.income > 0 ? colors.success : colors.border} />
                  <Text style={[styles.indicatorText, { color: d.income > 0 ? colors.foreground : colors.mutedForeground }]}>
                    {formatShort(d.income)}
                  </Text>
                </View>

                <View style={styles.indicatorLine}>
                  <Ionicons name="arrow-down-circle" size={16} color={d.expense > 0 ? colors.destructive : colors.border} />
                  <Text style={[styles.indicatorText, { color: d.expense > 0 ? colors.foreground : colors.mutedForeground, fontWeight: d.expense > 0 ? '700' : '400' }]}>
                    {formatShort(d.expense)}
                  </Text>
                </View>

                <View style={styles.indicatorLine}>
                  <View style={[styles.miniBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.miniBadgeText}>D</Text>
                  </View>
                  <Text style={[styles.indicatorText, { color: colors.mutedForeground }]}>
                    {formatShort(d.dailyPlan || 0)}
                  </Text>

                  {mostrarBadge && (
                    <>
                      {economizou && (
                        <View style={[styles.savingBadge, { backgroundColor: colors.success + '20' }]}>
                          <Text style={[styles.savingText, { color: colors.success }]}>
                            {`+ ${formatShort(valorDiferenca)}`}
                          </Text>
                        </View>
                      )}
                      {excedeu && (
                        <View style={[styles.savingBadge, { backgroundColor: colors.destructive + '20' }]}>
                          <Text style={[styles.savingText, { color: colors.destructive }]}>
                            {`- ${formatShort(valorDiferenca)}`}
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                </View>
              </View>

              <View style={[styles.colSaldoVisual, { backgroundColor: saldoBg }]}>
                <Text style={[styles.saldoTextLarge, { color: saldoColor }]}>{formatShort(d.balance)}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 50 }} />
      </ScrollView>

      {/* 👉 O MODAL COM OS DETALHES DO DIA (Desliza de baixo para cima) */}
      <Modal
        visible={!!selectedDay}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSelectedDay(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>

            {/* Header do Modal */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  Detalhes do Dia
                </Text>
                <Text style={[styles.modalDate, { color: colors.mutedForeground }]}>
                  {selectedDay ? formatDateShort(selectedDay.fullDate) : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedDay(null)} style={[styles.closeBtn, { backgroundColor: colors.background }]}>
                <Ionicons name="close" size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            {/* Lista Interna de Lançamentos */}
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {!selectedDay?.transactions || selectedDay.transactions.length === 0 ? (
                <View style={styles.emptyModal}>
                  <Ionicons name="calendar-clear-outline" size={32} color={colors.border} />
                  <Text style={[styles.emptyModalText, { color: colors.mutedForeground }]}>
                    Nenhuma movimentação neste dia.
                  </Text>
                </View>
              ) : (
                selectedDay.transactions.map((tx: any, idx: number) => {
                  const isReceita = tx.type === 'receita'
                  const isCredito = tx.paymentMethod === 'credito'
                  const amountColor = isReceita ? colors.success : tx.type === 'transferencia' ? colors.primary : colors.destructive
                  const bgColor = isReceita ? colors.successLight : tx.type === 'transferencia' ? colors.primary + '15' : colors.dangerLight

                  return (
                    <View key={tx.id} style={[styles.modalTxItem, idx !== selectedDay.transactions.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                      <View style={[styles.modalTxIcon, { backgroundColor: bgColor }]}>
                        <Ionicons name={isReceita ? 'arrow-up' : tx.type === 'transferencia' ? 'swap-horizontal' : 'arrow-down'} size={16} color={amountColor} />
                      </View>

                      <View style={styles.modalTxInfo}>
                        <Text style={[styles.modalTxDesc, { color: colors.foreground }]} numberOfLines={1}>{tx.description}</Text>
                        {isCredito && (
                          <View style={[styles.modalCreditBadge, { backgroundColor: colors.secondary }]}>
                            <Text style={[styles.modalCreditText, { color: colors.mutedForeground }]}>CRÉDITO</Text>
                          </View>
                        )}
                      </View>

                      <Text style={[styles.modalTxAmount, { color: amountColor }]}>
                        {isReceita ? '+' : tx.type === 'transferencia' ? '' : '-'}{formatCurrency(tx.amount)}
                      </Text>
                    </View>
                  )
                })
              )}
            </ScrollView>

          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  monthTitle: { fontSize: 17, fontWeight: '700' },
  budgetCard: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  budgetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  budgetInfo: { gap: 2 },
  budgetLabel: { fontSize: 11, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.4 },
  budgetValue: { fontSize: 20, fontWeight: '700' },
  budgetRight: { alignItems: 'flex-end', gap: 2 },
  dailyLabel: { fontSize: 10, fontWeight: '500', textTransform: 'uppercase' },
  dailyValue: { fontSize: 16, fontWeight: '700' },
  summaryStrip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  summaryItem: { flex: 1, alignItems: 'center', gap: 1 },
  summaryLabel: { fontSize: 10, fontWeight: '500', textTransform: 'uppercase' },
  summaryValue: { fontSize: 12, fontWeight: '700' },
  summaryDivider: { width: 1, height: 20 },
  row: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 90 },
  colDia: { width: 55, justifyContent: 'center', alignItems: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: 'rgba(0,0,0,0.05)' },
  dayNumber: { fontSize: 18, fontWeight: '700' },
  weekDay: { fontSize: 11, textTransform: 'capitalize' },
  colIndicators: { flex: 1, padding: 12, gap: 6, justifyContent: 'center' },
  indicatorLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  indicatorText: { fontSize: 13 },
  miniBadge: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  miniBadgeText: { color: '#FFF', fontSize: 9, fontWeight: 'bold' },
  savingBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
  savingText: { fontSize: 11, fontWeight: '700' },
  colSaldoVisual: { width: 120, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 12 },
  saldoTextLarge: { fontSize: 15, fontWeight: '700' },

  // 👉 ESTILOS DO MODAL
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '80%',
    minHeight: '40%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.5 },
  modalDate: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  modalScroll: { flexGrow: 1, marginTop: 8 },
  emptyModal: { alignItems: 'center', justifyContent: 'center', paddingVertical: 50, gap: 12 },
  emptyModalText: { fontSize: 14, fontWeight: '500' },
  modalTxItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  modalTxIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalTxInfo: { flex: 1, gap: 4, alignItems: 'flex-start' },
  modalTxDesc: { fontSize: 15, fontWeight: '600' },
  modalTxAmount: { fontSize: 15, fontWeight: '700' },
  modalCreditBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  modalCreditText: { fontSize: 9, fontWeight: '800' },
});