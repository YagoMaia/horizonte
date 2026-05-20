import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Project, Transaction } from '@/constants/types';
import { useStoreContext } from '@/context/StoreContext';
import { formatCurrency, formatDateShort } from '@/lib/utils';

interface Props {
  project: Project | null;
  onClose: () => void;
}

export function ProjectTransactionsModal({ project, onClose }: Props) {
  const { colors } = useTheme();
  const { transactions, getProjectSpent } = useStoreContext();

  const projectTransactions = useMemo(() => {
    if (!project) return [];
    return transactions
      .filter((tx) => tx.projectId === project.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [project, transactions]);

  if (!project) return null;

  const totalSpent = getProjectSpent(project.id);

  const progress = project.targetBudget > 0 ? Math.min(totalSpent / project.targetBudget, 1) : 0;
  const isOverBudget = totalSpent > project.targetBudget;

  const renderItem = ({ item: tx }: { item: Transaction }) => {
    const isReceita = tx.type === 'receita';
    const amountColor = isReceita ? colors.success : colors.destructive;
    
    return (
      <View style={[styles.txItem, { borderBottomColor: colors.border }]}>
        <View style={styles.txInfo}>
          <Text style={[styles.txDesc, { color: colors.foreground }]} numberOfLines={1}>{tx.description}</Text>
          <Text style={[styles.txMetaText, { color: colors.mutedForeground }]}>{formatDateShort(tx.date)}</Text>
        </View>
        <Text style={[styles.txAmount, { color: amountColor }]}>
          {isReceita ? '+' : '-'}{formatCurrency(tx.amount)}
        </Text>
      </View>
    );
  };

  return (
    <Modal
      visible={!!project}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlayBottom}>
        <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.header}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{project.name}</Text>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.background }]}>
              <Ionicons name="close" size={20} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <View style={styles.summaryContainer}>
            <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    backgroundColor: isOverBudget ? colors.destructive : project.color,
                    width: `${progress * 100}%`
                  }
                ]}
              />
            </View>
            <View style={styles.summaryTextRow}>
              <Text style={[styles.summarySpent, { color: isOverBudget ? colors.destructive : colors.foreground }]}>
                {formatCurrency(totalSpent)}
              </Text>
              <Text style={[styles.summaryBudget, { color: colors.mutedForeground }]}>
                Meta: <Text style={{ color: colors.foreground, fontWeight: '600' }}>{formatCurrency(project.targetBudget)}</Text>
              </Text>
            </View>
          </View>

          <Text style={[styles.listTitle, { color: colors.foreground }]}>Lançamentos Vinculados</Text>

          <FlatList
            data={projectTransactions}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={40} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhum lançamento vinculado a este projeto ainda.</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '80%',
    minHeight: '50%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryContainer: {
    marginBottom: 24,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  summaryTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summarySpent: {
    fontSize: 16,
    fontWeight: '800',
  },
  summaryBudget: {
    fontSize: 12,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 20,
  },
  txItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  txInfo: {
    flex: 1,
    gap: 2,
  },
  txDesc: {
    fontSize: 14,
    fontWeight: '600',
  },
  txMetaText: {
    fontSize: 12,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
