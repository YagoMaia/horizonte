import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { Trip, Transaction } from '@/constants/types';
import { formatCurrency, formatDateShort } from '@/lib/utils';
import { useStoreContext } from '@/context/StoreContext';

interface TripDetailScreenProps {
  trip: Trip;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddTransaction?: () => void;
}

export function TripDetailScreen({ trip, onBack, onEdit, onDelete, onAddTransaction }: TripDetailScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const store = useStoreContext();

  const tripTransactions = store.transactions
    .filter(t => t.tripId === trip.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const spent = tripTransactions.reduce((acc, t) => acc + (t.type === 'despesa' ? t.amount : 0), 0);
  const income = tripTransactions.reduce((acc, t) => acc + (t.type === 'receita' ? t.amount : 0), 0);
  const netSpent = spent - income;

  const progress = trip.budget && trip.budget > 0 ? Math.min(spent / trip.budget, 1) : 0;
  const isOverBudget = trip.budget ? spent > trip.budget : false;

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isExpense = item.type === 'despesa';
    return (
      <View style={[styles.txCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.txLeft}>
          <View style={[styles.txIcon, { backgroundColor: isExpense ? colors.destructive + '15' : colors.success + '15' }]}>
            <Ionicons name={isExpense ? 'arrow-down' : 'arrow-up'} size={16} color={isExpense ? colors.destructive : colors.success} />
          </View>
          <View>
            <Text style={[styles.txDesc, { color: colors.foreground }]}>{item.description}</Text>
            <Text style={[styles.txDate, { color: colors.mutedForeground }]}>{formatDateShort(item.date)}</Text>
          </View>
        </View>
        <Text style={[styles.txAmount, { color: isExpense ? colors.foreground : colors.success }]}>
          {isExpense ? '-' : '+'}{formatCurrency(item.amount)}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Detalhes da Viagem</Text>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity onPress={onEdit} style={styles.iconBtn}>
            <Ionicons name="pencil" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={styles.iconBtn}>
            <Ionicons name="trash" size={22} color={colors.destructive} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.summaryCard, { borderColor: trip.color, backgroundColor: colors.card, borderWidth: 1 }]}>
        <View style={styles.summaryHeader}>
          <Text style={[styles.tripName, { color: colors.foreground }]}>{trip.name}</Text>
          {!!trip.destination && (
            <Text style={[styles.destination, { color: colors.mutedForeground }]}>
              <Ionicons name="location-outline" size={14} /> {trip.destination}
            </Text>
          )}
        </View>

        <View style={styles.budgetBox}>
          <Text style={[styles.budgetValue, { color: colors.foreground }]}>{formatCurrency(spent)}</Text>
          {trip.budget && (
            <Text style={[styles.budgetLabel, { color: colors.mutedForeground }]}>
              de {formatCurrency(trip.budget)}
            </Text>
          )}
          
          {trip.budget && (
            <View style={[styles.progressBarWrapper, { backgroundColor: colors.border }]}>
              <View style={[styles.progressBarFill, { width: `${progress * 100}%`, backgroundColor: isOverBudget ? colors.destructive : trip.color }]} />
              <Text style={styles.progressPercent}>{Math.round(progress * 100)}%</Text>
            </View>
          )}
          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>Despesas</Text>
              <Text style={[styles.metricValue, { color: colors.foreground }]}>{formatCurrency(spent)}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>Receitas</Text>
              <Text style={[styles.metricValue, { color: colors.success }]}>{formatCurrency(income)}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>Saldo líquido</Text>
              <Text style={[styles.metricValue, { color: netSpent > 0 ? colors.destructive : colors.success }]}>{formatCurrency(netSpent)}</Text>
            </View>
          </View>
        </View>
      </View>

      {!!trip.notes && (
        <View style={[styles.notesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="document-text-outline" size={18} color={trip.color} />
          <Text style={[styles.notesText, { color: colors.foreground }]}>{trip.notes}</Text>
        </View>
      )}

      <View style={styles.listHeader}>
        <View>
          <Text style={[styles.listTitle, { color: colors.foreground }]}>Transações</Text>
          <Text style={[styles.listCount, { color: colors.mutedForeground }]}>{tripTransactions.length} lançamentos</Text>
        </View>
        
        {onAddTransaction && (
          <TouchableOpacity 
            style={[styles.addTxBtn, { backgroundColor: colors.primary }]} 
            onPress={onAddTransaction}
          >
            <Ionicons name="add" size={16} color={colors.primaryForeground} />
            <Text style={[styles.addTxBtnText, { color: colors.primaryForeground }]}>Gasto</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={tripTransactions}
        keyExtractor={item => item.id}
        renderItem={renderTransaction}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Nenhuma transação atrelada a esta viagem ainda.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  summaryCard: {
    margin: 16,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  summaryHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  tripName: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  destination: { fontSize: 14, marginTop: 6 },
  budgetBox: {
    alignItems: 'center',
  },
  budgetValue: {
    fontSize: 36,
    fontWeight: '800',
  },
  budgetLabel: {
    fontSize: 14,
    marginTop: 4,
  },
  progressBarWrapper: {
    width: '100%',
    height: 16,
    borderRadius: 8,
    marginTop: 16,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  progressBarFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 8,
  },
  progressPercent: {
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF', 
    zIndex: 1,
  },
  metricsRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', marginTop: 20 },
  metric: { alignItems: 'center', flex: 1 },
  metricLabel: { fontSize: 11, marginBottom: 4 },
  metricValue: { fontSize: 14, fontWeight: '700' },
  notesCard: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  notesText: { flex: 1, fontSize: 13, lineHeight: 19 },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  listTitle: { fontSize: 18, fontWeight: '600' },
  listCount: { fontSize: 14, marginTop: 2 },
  addTxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  addTxBtnText: {
    fontWeight: '600',
    fontSize: 13,
  },
  listContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  txCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  txLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txDesc: { fontSize: 15, fontWeight: '500', marginBottom: 2 },
  txDate: { fontSize: 12 },
  txAmount: { fontSize: 16, fontWeight: '600' },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { textAlign: 'center', fontSize: 14 },
});
