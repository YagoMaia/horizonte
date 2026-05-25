import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Transaction, Account, Tag } from '@/constants/types';
import { formatCurrency, formatDateShort } from '@/lib/utils';
import { ThemeColors } from '@/constants/theme';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { MarqueeText } from './MarqueeText';
import { useRouter } from 'expo-router';

interface TransactionItemProps {
  transaction: Transaction;
  account?: Account;
  tag?: Tag;
  colors: ThemeColors;
  onPress?: (transaction: Transaction) => void;
  onDelete?: (txId: string) => void;
  isFirst?: boolean;
  isLast?: boolean;
  showAccount?: boolean;
  swipeable?: boolean;
  hideIcon?: boolean;
  rowRefs?: Map<string, any>;
  onSwipeableWillOpen?: (txId: string) => void;
  renderRightActions?: (txId: string) => React.ReactNode;
}

export const TransactionItem = React.memo(({
  transaction,
  account,
  tag,
  colors,
  onPress,
  onDelete,
  isFirst,
  isLast,
  showAccount = true,
  swipeable = false,
  hideIcon = false,
  rowRefs,
  onSwipeableWillOpen,
  renderRightActions,
}: TransactionItemProps) => {
  const router = useRouter();
  const isReceita = transaction.type === 'receita';
  const tagColor = tag?.color || colors.primary;
  
  const handlePress = () => {
    if (onPress) {
      onPress(transaction);
    } else {
      router.push(`/transaction/${transaction.id}` as any);
    }
  };

  const content = (
    <TouchableOpacity
      style={[
        styles.txItem,
        { backgroundColor: colors.card, borderColor: colors.border },
        isFirst && styles.txItemFirst,
        isLast && styles.txItemLast,
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {!hideIcon && (
        <View style={[styles.txIcon, { backgroundColor: tagColor + '15' }]}>
          <Ionicons 
            name={(tag?.icon as any) || (isReceita ? 'arrow-up' : 'receipt')} 
            size={18} 
            color={tagColor} 
          />
        </View>
      )}
      <View style={[styles.txInfo, hideIcon && { paddingLeft: 4 }]}>
        <View style={styles.descriptionRow}>
          <MarqueeText 
            text={transaction.description}
            style={[styles.txDesc, { color: colors.foreground }]}
          />
          {!hideIcon && transaction.paid && (
            <Ionicons 
              name='checkmark-circle' 
              size={14} 
              color={colors.success} 
              style={styles.paidIcon}
            />
          )}
        </View>
        <Text style={[styles.txMetaText, { color: colors.mutedForeground }]}>
          {formatDateShort(transaction.date)}
          {showAccount && account ? ` • ${account.name}` : ''}
        </Text>
      </View>
      <View style={styles.amountContainer}>
        <Text style={[styles.txAmount, { color: isReceita ? colors.success : colors.destructive }]}>
          {isReceita ? '+' : '-'}{formatCurrency(transaction.amount)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (swipeable && renderRightActions) {
    return (
      <GestureHandlerRootView>
        <Swipeable
          ref={(ref) => { if (ref && rowRefs) rowRefs.set(transaction.id, ref); }}
          renderRightActions={() => renderRightActions(transaction.id)}
          onSwipeableWillOpen={() => onSwipeableWillOpen?.(transaction.id)}
        >
          {content}
        </Swipeable>
      </GestureHandlerRootView>
    );
  }

  return content;
});

const styles = StyleSheet.create({
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  txItemFirst: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  txItemLast: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomWidth: 0,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txInfo: {
    flex: 1,
    flexShrink: 1,
  },
  descriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  txDesc: {
    fontSize: 14,
    fontWeight: '600',
  },
  paidIcon: {
    flexShrink: 0,
  },
  txMetaText: {
    fontSize: 12,
  },
  amountContainer: {
    flexShrink: 0,
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
});
