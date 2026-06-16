import React, { useMemo } from 'react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Transaction } from '@/constants/types';
import { useTheme } from '@/hooks/useTheme';
import { useStoreContext } from '@/context/StoreContext';
import { TransactionItem } from './TransactionItem';
import { formatCurrency } from '@/lib/utils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CategoryTransactionsModalProps {
  category: string;
  transactions: Transaction[];
  onClose: () => void;
}

export function CategoryTransactionsModal({ category, transactions, onClose }: CategoryTransactionsModalProps) {
  const { colors } = useTheme();
  const { accounts, tags } = useStoreContext();
  const insets = useSafeAreaInsets();

  const categoryTransactions = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'despesa' && ((t as any).tag === category || (!(t as any).tag && category === 'Outros')))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, category]);

  const totalAmount = useMemo(() => {
    return categoryTransactions.reduce((sum, t) => sum + t.amount, 0);
  }, [categoryTransactions]);

  const tagInfo = tags.find((t) => t.label === category) || tags.find((t) => t.label === 'Outros');

  return (
    <Modal visible animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: Math.max(insets.top, 20) }]}>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.background }]}>
            <Ionicons name="close" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.tagColorDot, { backgroundColor: tagInfo?.color || colors.primary }]} />
              <Text style={[styles.title, { color: colors.foreground }]}>{category}</Text>
            </View>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {categoryTransactions.length} lançamento{categoryTransactions.length !== 1 && 's'}
            </Text>
          </View>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Total Gasto</Text>
          <Text style={[styles.summaryValue, { color: colors.destructive }]}>
            - {formatCurrency(totalAmount)}
          </Text>
        </View>

        <FlatList
          data={categoryTransactions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Nenhum lançamento encontrado para esta categoria.
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const account = accounts.find((a) => a.id === item.accountId);
            return (
              <TransactionItem
                transaction={item}
                account={account}
                tag={tagInfo}
                colors={colors}
                isFirst={index === 0}
                isLast={index === categoryTransactions.length - 1}
                hideIcon={true}
              />
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  tagColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  summaryCard: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
