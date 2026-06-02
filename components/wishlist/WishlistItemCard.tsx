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

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function WishlistItemCard({ item, onBuyPress, onDeletePress, onPress }: WishlistItemCardProps) {
  const { colors } = useTheme();
  const { evaluateItemAffordability } = useStoreContext();
  
  const isBought = item.status === 'COMPRADO';
  const { status, bestFutureMonth, suggestedMethod, suggestedMessage } = evaluateItemAffordability(item.price);

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
      <View style={styles.contentRow}>
        <View style={styles.info}>
          <Text
            style={[styles.name, { color: isBought ? colors.mutedForeground : colors.foreground }]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text style={[styles.price, { color: isBought ? colors.mutedForeground : colors.primary }]}>
            R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <View style={[styles.badge, { backgroundColor: borderColor + '18' }]}>
            <View style={[styles.badgeDot, { backgroundColor: borderColor }]} />
            <Text style={[styles.badgeText, { color: borderColor }]}>{statusLabel}</Text>
          </View>
          
          {!isBought && suggestedMessage && (
            <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
              {suggestedMessage}
            </Text>
          )}
        </View>

        <View style={styles.actions}>
          {!isBought && (
            <TouchableOpacity
              style={[styles.buyBtn, { backgroundColor: colors.primary }]}
              onPress={() => onBuyPress(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="cart-outline" size={16} color="#FFF" />
              <Text style={styles.buyBtnText}>Comprar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.deleteBtn, { backgroundColor: colors.destructive + '15' }]}
            onPress={() => onDeletePress(item)}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={16} color={colors.destructive} />
          </TouchableOpacity>
        </View>
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
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  info: {
    flex: 1,
    marginRight: 12,
    gap: 4,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 5,
    marginTop: 2,
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  hintText: {
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic',
  },
});
