import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Trip, CreateTripInput, UpdateTripInput } from '@/constants/types';
import { TripFormModal } from '../TripFormModal';
import { useStoreContext } from '@/context/StoreContext';
import { formatCurrency, formatDateShort } from '@/lib/utils';

interface ViagensScreenProps {
  trips: Trip[];
  createTrip: (input: CreateTripInput) => Promise<void>;
  updateTrip: (id: string, input: UpdateTripInput) => Promise<void>;
  onTripPress: (trip: Trip) => void;
  editTrip?: Trip;
  onEditConsumed?: () => void;
}

export function ViagensScreen({ trips, createTrip, updateTrip, onTripPress, editTrip, onEditConsumed }: ViagensScreenProps) {
  const { colors } = useTheme();
  const store = useStoreContext();
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [tripToEdit, setTripToEdit] = useState<Trip | undefined>();

  React.useEffect(() => {
    if (editTrip) {
      setTripToEdit(editTrip);
      setIsFormVisible(true);
      onEditConsumed?.();
    }
  }, [editTrip, onEditConsumed]);

  // Calcula o total gasto por viagem
  const getSpentForTrip = (tripId: string) => {
    return store.transactions
      .filter((t) => t.tripId === tripId && t.type === 'despesa')
      .reduce((acc, t) => acc + t.amount, 0);
  };

  const renderTrip = ({ item }: { item: Trip }) => {
    const spent = getSpentForTrip(item.id);
    const progress = item.budget && item.budget > 0 ? Math.min(spent / item.budget, 1) : 0;
    const isOverBudget = item.budget ? spent > item.budget : false;
    const percentage = item.budget && item.budget > 0 ? Math.round((spent / item.budget) * 100) : 0;
    const remaining = item.budget ? item.budget - spent : 0;
    const today = new Date();
    const end = new Date(item.endDate);
    const start = new Date(item.startDate);
    const status = today < start ? 'Planejada' : today > end ? 'Concluída' : 'Em andamento';

    return (
      <TouchableOpacity 
        style={[styles.tripCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => onTripPress(item)}
      >
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={[styles.iconWrapper, { backgroundColor: item.color + '30' }]}>
              <Ionicons name={item.icon as any} size={28} color={item.color} />
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[styles.tripName, { color: colors.foreground }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={[styles.badge, { backgroundColor: item.color + '20' }]}>
                  <Text style={[styles.badgeText, { color: item.color }]}>{status}</Text>
                </View>
              </View>
              <Text style={[styles.tripDates, { color: colors.mutedForeground }]}>
                {formatDateShort(item.startDate)} - {formatDateShort(item.endDate)}
              </Text>
              {item.destination && (
                <Text style={[styles.tripDates, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {item.destination}
                </Text>
              )}
              {item.budget && (
                <Text style={[styles.totalPlanned, { color: colors.foreground }]}>
                  Total Planejado: {formatCurrency(item.budget)}
                </Text>
              )}
            </View>
          </View>
        </View>

        {item.budget && (
          <View style={{ marginTop: 12 }}>
            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${progress * 100}%`, 
                    backgroundColor: isOverBudget ? colors.destructive : item.color 
                  }
                ]} 
              />
              <Text style={styles.progressPercent}>{percentage}%</Text>
            </View>
            
            <View style={styles.budgetRow}>
              <Text style={[styles.spentText, { color: isOverBudget ? colors.destructive : item.color }]}>
                Gasto: {formatCurrency(spent)}
              </Text>
              <Text style={[styles.remainingText, { color: isOverBudget ? colors.destructive : colors.mutedForeground }]}> 
                {isOverBudget ? `Acima ${formatCurrency(Math.abs(remaining))}` : `Restante: ${formatCurrency(remaining)}`}
              </Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Viagens</Text>
        <TouchableOpacity 
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => { setTripToEdit(undefined); setIsFormVisible(true); }}
        >
          <Ionicons name="add" size={20} color={colors.primaryForeground} />
          <Text style={[styles.addButtonText, { color: colors.primaryForeground }]}>Nova</Text>
        </TouchableOpacity>
      </View>

      {trips.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="airplane-outline" size={64} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhuma viagem</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Crie sua primeira viagem para acompanhar os gastos de suas aventuras!
          </Text>
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id}
          renderItem={renderTrip}
          contentContainerStyle={styles.listContent}
        />
      )}

      <TripFormModal 
        visible={isFormVisible}
        onClose={() => setIsFormVisible(false)}
        tripToEdit={tripToEdit}
        onSubmit={async (input) => {
          if (tripToEdit) await updateTrip(tripToEdit.id, input);
          else await createTrip(input);
          setIsFormVisible(false);
          setTripToEdit(undefined);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  addButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },
  listContent: {
    padding: 20,
    gap: 16,
  },
  tripCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tripName: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  tripDates: {
    fontSize: 13,
    marginTop: 4,
  },
  totalPlanned: {
    fontSize: 14,
    marginTop: 6,
    fontWeight: '500',
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  spentText: {
    fontWeight: '700',
    fontSize: 14,
  },
  remainingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressBar: {
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  progressFill: {
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
    color: '#000', // could be better contrasted
    zIndex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
