// components/wishlist/WishlistItemCard.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { WishlistItem } from '@/constants/types';

import { useStoreContext } from '@/context/StoreContext';

interface WishlistItemCardProps {
  item: WishlistItem;
  onBuyPress: (item: WishlistItem) => void;
  onDeletePress: (item: WishlistItem) => void;
  onPress?: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function WishlistItemCard({ item, onBuyPress, onDeletePress, onPress }: WishlistItemCardProps) {
  const { colors } = useTheme();
  const { evaluateItemAffordability } = useStoreContext();
  
  const isBought = item.status === 'COMPRADO';
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { status, bestFutureMonth, suggestedMethod, suggestedMessage } = evaluateItemAffordability(item.price, item.paymentPreference, item.installments);

  let borderColor = '#9CA3AF';
  let statusLabel = 'Comprado';

  if (!isBought) {
    if (status === 'VERDE') {
      borderColor = '#10B981';
      statusLabel = 'À vista';
    } else if (status === 'AMARELO') {
      borderColor = '#F59E0B';
      statusLabel = 'Parcelável';
    } else {
      borderColor = '#EF4444';
      statusLabel = bestFutureMonth !== undefined ? 'Requer poupar' : 'Fora do orçamento';
    }
  }

  return (
    <TouchableOpacity 
      style={[styles.card, { backgroundColor: colors.card, borderLeftColor: borderColor, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      {/* Header Row */}
      <View style={styles.headerRow}>
        <Text style={[styles.name, { color: isBought ? colors.mutedForeground : colors.foreground }]} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={[styles.badge, { backgroundColor: borderColor + '18' }]}>
          <View style={[styles.badgeDot, { backgroundColor: borderColor }]} />
          <Text style={[styles.badgeText, { color: borderColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {/* Price Row */}
      <Text style={[styles.price, { color: isBought ? colors.mutedForeground : colors.primary }]}>
        R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </Text>

      {/* Insight Box */}
      {!isBought && suggestedMessage && (
        <View style={[styles.insightBox, { backgroundColor: colors.foreground + '0D' }]}>
          <Text style={styles.insightIcon}>💡</Text>
          <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
            {suggestedMessage}
          </Text>
        </View>
      )}

      {/* Action Row / Footer */}
      <View style={styles.footerRow}>
        <TouchableOpacity
          style={[styles.deleteBtn, { backgroundColor: colors.destructive + '15' }]}
          onPress={() => onDeletePress(item)}
          activeOpacity={0.8}
        >
          <Ionicons name="trash-outline" size={16} color={colors.destructive} />
        </TouchableOpacity>


      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 5,
    padding: 16,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    flex: 1,
    marginRight: 8,
    fontSize: 15,
    fontWeight: '600',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 5,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  price: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  insightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  insightIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  hintText: {
    flex: 1,
    fontSize: 12,
    fontStyle: 'normal',
    lineHeight: 16,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
  },
  buyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  buyBtnText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 13,
  },
  deleteBtn: {
    padding: 8,
    borderRadius: 10,
  },
});
