// components/screens/reports/TopTransactionsSection.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { TopTransaction } from '@/hooks/useReportsData';
import { formatCurrency, formatDateShort } from '@/lib/utils';

interface TopTransactionsSectionProps {
  topExpenses: TopTransaction[];
  topIncomes: TopTransaction[];
}

export function TopTransactionsSection({ topExpenses, topIncomes }: TopTransactionsSectionProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {/* Maiores Despesas */}
      <TransactionList
        title="Maiores Despesas"
        icon="arrow-down-circle"
        iconColor={colors.destructive}
        transactions={topExpenses}
        colors={colors}
        type="expense"
      />

      {/* Maiores Receitas */}
      <TransactionList
        title="Maiores Receitas"
        icon="arrow-up-circle"
        iconColor={colors.success}
        transactions={topIncomes}
        colors={colors}
        type="income"
      />
    </View>
  );
}

interface TransactionListProps {
  title: string;
  icon: string;
  iconColor: string;
  transactions: TopTransaction[];
  colors: any;
  type: 'expense' | 'income';
}

function TransactionList({ title, icon, iconColor, transactions, colors, type }: TransactionListProps) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <Ionicons name={icon as any} size={20} color={iconColor} />
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>{title}</Text>
      </View>

      {transactions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Nenhuma transação
          </Text>
        </View>
      ) : (
        <View style={styles.listContainer}>
          {transactions.map((tx, index) => (
            <View
              key={tx.id}
              style={[
                styles.txRow,
                index < transactions.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <View style={styles.txInfo}>
                <Text
                  style={[styles.txDescription, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {tx.description}
                </Text>
                <Text style={[styles.txMeta, { color: colors.mutedForeground }]}>
                  {formatDateShort(tx.date)} • {tx.accountName}
                </Text>
              </View>
              <Text
                style={[
                  styles.txAmount,
                  { color: type === 'expense' ? colors.destructive : colors.success },
                ]}
              >
                {type === 'expense' ? '-' : '+'}{formatCurrency(tx.amount)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptyContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  listContainer: {
    gap: 0,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  txInfo: {
    flex: 1,
    gap: 2,
  },
  txDescription: {
    fontSize: 14,
    fontWeight: '500',
  },
  txMeta: {
    fontSize: 12,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
});
