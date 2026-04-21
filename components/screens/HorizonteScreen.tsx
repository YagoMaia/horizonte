// components/screens/HorizonteScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useStoreContext } from '@/context/StoreContext';
import { formatCurrency } from '@/lib/utils';

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
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
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

export function HorizonteScreen() {
  const { colors } = useTheme();
  const {
    transactions,
    accounts,
    monthlyBudget: savedBudget,
    saveMonthlyBudget,
  } = useStoreContext();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  // Gasto mensal — persiste no AsyncStorage via contexto
  const [monthlyBudgetStr, setMonthlyBudgetStr] = useState(String(savedBudget));
  const [editingBudget, setEditingBudget] = useState(false);
  const monthlyBudget = parseFloat(monthlyBudgetStr.replace(',', '.')) || 0;

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  const days = useMemo(() => {
    const daysCount = getDaysInMonth(year, month);
    const dailyBudget = daysCount > 0 ? monthlyBudget / daysCount : 0;

    const monthTxs = transactions.filter((tx) => {
      const d = new Date(tx.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });

    // Compute opening balance by reversing transactions from this month onward
    const thisPlusAfterTxs = transactions.filter((tx) => {
      const d = new Date(tx.date);
      return (
        d.getFullYear() > year ||
        (d.getFullYear() === year && d.getMonth() >= month)
      );
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
      const income = dayTxs
        .filter((t) => t.type === 'receita')
        .reduce((s, t) => s + t.amount, 0);
      const expense = dayTxs
        .filter((t) => t.type === 'despesa')
        .reduce((s, t) => s + t.amount, 0);

      // Apply real transactions + daily budget deduction
      runningBalance += income - expense - dailyBudget;

      const dayDate = new Date(year, month, d);
      const isPast =
        dayDate <
        new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const isToday =
        d === today.getDate() &&
        month === today.getMonth() &&
        year === today.getFullYear();

      result.push({
        day: d,
        weekDay: getWeekDay(year, month, d),
        income,
        expense,
        dailyBudget,
        balance: runningBalance,
        isPast,
        isToday,
      });
    }
    return result;
  }, [transactions, accounts, year, month, monthlyBudget, totalBalance]);

  const totalIncome = days.reduce((s, d) => s + d.income, 0);
  const totalExpense = days.reduce((s, d) => s + d.expense, 0);
  const endBalance =
    days.length > 0 ? days[days.length - 1].balance : totalBalance;
  const daysCount = getDaysInMonth(year, month);
  const dailyBudget = daysCount > 0 ? monthlyBudget / daysCount : 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Month navigator */}
      <View
        style={[
          styles.monthNav,
          { borderBottomColor: colors.border, backgroundColor: colors.card },
        ]}
      >
        <TouchableOpacity
          onPress={prevMonth}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name='chevron-back' size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.monthTitle, { color: colors.foreground }]}>
          {MONTH_NAMES[month]} {year}
        </Text>
        <TouchableOpacity
          onPress={nextMonth}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons
            name='chevron-forward'
            size={22}
            color={colors.foreground}
          />
        </TouchableOpacity>
      </View>

      {/* Budget config card */}
      <View
        style={[
          styles.budgetCard,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.budgetRow}>
          <View
            style={[
              styles.budgetIconWrap,
              { backgroundColor: colors.primary + '20' },
            ]}
          >
            <Ionicons
              name='calculator-outline'
              size={18}
              color={colors.primary}
            />
          </View>
          <View style={styles.budgetInfo}>
            <Text
              style={[styles.budgetLabel, { color: colors.mutedForeground }]}
            >
              Gasto mensal estimado
            </Text>
            <View style={styles.budgetValueRow}>
              {editingBudget ? (
                <TextInput
                  style={[
                    styles.budgetInput,
                    {
                      color: colors.foreground,
                      borderBottomColor: colors.primary,
                    },
                  ]}
                  value={monthlyBudgetStr}
                  onChangeText={setMonthlyBudgetStr}
                  keyboardType='decimal-pad'
                  autoFocus
                  onBlur={() => {
                    setEditingBudget(false);
                    saveMonthlyBudget(monthlyBudget);
                  }}
                  selectTextOnFocus
                />
              ) : (
                <TouchableOpacity
                  onPress={() => setEditingBudget(true)}
                  style={styles.budgetValueBtn}
                >
                  <Text
                    style={[styles.budgetValue, { color: colors.foreground }]}
                  >
                    {formatCurrency(monthlyBudget)}
                  </Text>
                  <Ionicons
                    name='pencil-outline'
                    size={14}
                    color={colors.mutedForeground}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>
          <View style={styles.budgetRight}>
            <Text
              style={[styles.dailyLabel, { color: colors.mutedForeground }]}
            >
              por dia
            </Text>
            <Text style={[styles.dailyValue, { color: colors.primary }]}>
              {formatShort(dailyBudget)}
            </Text>
          </View>
        </View>
      </View>

      {/* Summary strip */}
      <View
        style={[
          styles.summaryStrip,
          {
            backgroundColor: colors.secondary,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.summaryItem}>
          <Text
            style={[styles.summaryLabel, { color: colors.mutedForeground }]}
          >
            Entradas
          </Text>
          <Text style={[styles.summaryValue, { color: colors.success }]}>
            +{formatShort(totalIncome)}
          </Text>
        </View>
        <View
          style={[styles.summaryDivider, { backgroundColor: colors.border }]}
        />
        <View style={styles.summaryItem}>
          <Text
            style={[styles.summaryLabel, { color: colors.mutedForeground }]}
          >
            Saídas
          </Text>
          <Text style={[styles.summaryValue, { color: colors.destructive }]}>
            -{formatShort(totalExpense)}
          </Text>
        </View>
        <View
          style={[styles.summaryDivider, { backgroundColor: colors.border }]}
        />
        <View style={styles.summaryItem}>
          <Text
            style={[styles.summaryLabel, { color: colors.mutedForeground }]}
          >
            Saldo final
          </Text>
          <Text
            style={[
              styles.summaryValue,
              { color: endBalance >= 0 ? colors.success : colors.destructive },
            ]}
          >
            {formatShort(endBalance)}
          </Text>
        </View>
      </View>

      {/* Table header — 4 colunas */}
      <View
        style={[
          styles.tableHeader,
          {
            backgroundColor: colors.secondary,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text
          style={[
            styles.colDia,
            styles.headerText,
            { color: colors.mutedForeground },
          ]}
        >
          DIA
        </Text>
        <Text
          style={[
            styles.colGasto,
            styles.headerText,
            { color: colors.mutedForeground },
          ]}
        >
          GASTO
        </Text>
        <Text
          style={[
            styles.colPlan,
            styles.headerText,
            { color: colors.mutedForeground },
          ]}
        >
          PLAN.
        </Text>
        <Text
          style={[
            styles.colSaldo,
            styles.headerText,
            { color: colors.mutedForeground },
          ]}
        >
          SALDO
        </Text>
      </View>

      {/* Table rows */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {days.map((d, idx) => {
          const rowBg = d.isToday
            ? colors.primary + '10'
            : idx % 2 === 0
              ? colors.card
              : colors.background;

          const saldoBg =
            d.balance >= 0 ? colors.successLight : colors.dangerLight;
          const saldoColor =
            d.balance >= 0 ? colors.success : colors.destructive;

          return (
            <View
              key={d.day}
              style={[
                styles.row,
                { backgroundColor: rowBg, borderBottomColor: colors.border },
              ]}
            >
              {/* DIA */}
              <View style={[styles.colDia, styles.rowDiaInner]}>
                {d.isPast ? (
                  <Ionicons
                    name='checkmark-circle'
                    size={26}
                    color={colors.success}
                  />
                ) : d.isToday ? (
                  <View
                    style={[
                      styles.todayCircle,
                      { borderColor: colors.primary },
                    ]}
                  >
                    <Ionicons name='ellipse' size={8} color={colors.primary} />
                  </View>
                ) : (
                  <View
                    style={[
                      styles.futureCircle,
                      { borderColor: colors.border },
                    ]}
                  />
                )}
                <View>
                  <Text
                    style={[
                      styles.dayNumber,
                      {
                        color: colors.foreground,
                        fontWeight: d.isToday ? '700' : '500',
                      },
                    ]}
                  >
                    {d.day}
                  </Text>
                  <Text
                    style={[styles.weekDay, { color: colors.mutedForeground }]}
                  >
                    {d.weekDay}
                  </Text>
                </View>
              </View>

              {/* GASTO (real) */}
              <View style={styles.colGasto}>
                {d.expense > 0 ? (
                  <Text
                    style={[styles.cellText, { color: colors.destructive }]}
                  >
                    -{formatShort(d.expense)}
                  </Text>
                ) : d.income > 0 ? (
                  <Text style={[styles.cellText, { color: colors.success }]}>
                    +{formatShort(d.income)}
                  </Text>
                ) : (
                  <Text
                    style={[styles.cellText, { color: colors.mutedForeground }]}
                  >
                    -
                  </Text>
                )}
              </View>

              {/* PLANEJADO (budget diário) */}
              <View style={styles.colPlan}>
                <Text style={[styles.cellText, { color: colors.warning }]}>
                  -{formatShort(d.dailyBudget)}
                </Text>
              </View>

              {/* SALDO */}
              <View style={styles.colSaldo}>
                <View style={[styles.saldoBadge, { backgroundColor: saldoBg }]}>
                  <Text
                    style={[styles.saldoText, { color: saldoColor }]}
                    numberOfLines={1}
                  >
                    {formatShort(d.balance)}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
        <View style={{ height: 32 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const COL_DIA = 82;
const COL_GASTO = 80;
const COL_PLAN = 72;

const styles = StyleSheet.create({
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: '700',
  },

  // Budget config
  budgetCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  budgetIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetInfo: {
    flex: 1,
    gap: 2,
  },
  budgetLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  budgetValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  budgetValueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  budgetValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  budgetInput: {
    fontSize: 18,
    fontWeight: '700',
    borderBottomWidth: 2,
    minWidth: 120,
    paddingBottom: 2,
  },
  budgetRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  dailyLabel: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  dailyValue: {
    fontSize: 15,
    fontWeight: '700',
  },

  // Summary
  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  summaryDivider: {
    width: 1,
    height: 24,
  },

  // Table
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
  },

  // Column widths
  colDia: {
    width: COL_DIA,
    textAlign: 'left',
  },
  colGasto: {
    width: COL_GASTO,
    alignItems: 'flex-end',
  },
  colPlan: {
    width: COL_PLAN,
    alignItems: 'flex-end',
  },
  colSaldo: {
    flex: 1,
    alignItems: 'flex-end',
  },

  rowDiaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  todayCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  futureCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
  },
  dayNumber: {
    fontSize: 14,
    lineHeight: 17,
  },
  weekDay: {
    fontSize: 10,
    lineHeight: 13,
  },
  cellText: {
    fontSize: 13,
    fontWeight: '500',
  },
  saldoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    minWidth: 80,
    alignItems: 'center',
  },
  saldoText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
