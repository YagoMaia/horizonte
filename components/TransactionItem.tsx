import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Transaction, Account, Tag } from '@/constants/types';
import { formatCurrency, formatDateShort } from '@/lib/utils';
import { ThemeColors } from '@/constants/theme';
import { Swipeable } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { dayKey } from '@/lib/financialDate';
import { PaymentStatus } from '@/lib/financialIndex';

interface TransactionItemProps {
  transaction: Transaction;
  account?: Account;
  targetAccount?: Account;
  selectedAccountId?: string;
  status?: PaymentStatus;
  onConfirm?: (transaction: Transaction) => void;
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

// eslint-disable-next-line react/display-name
export const TransactionItem = React.memo(({
  transaction,
  account,
  targetAccount,
  selectedAccountId,
  status,
  onConfirm,
  tag,
  colors,
  onPress,
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
  const { width, fontScale } = useWindowDimensions();
  const stacked = width / fontScale < 380;
  const isReceita = transaction.type === 'receita';
  const isTransfer = transaction.type === 'transferencia';
  const incoming = isTransfer && selectedAccountId === transaction.targetAccountId;
  const outgoing = isTransfer && selectedAccountId === transaction.accountId;
  const amountColor = isTransfer ? (incoming ? colors.success : outgoing ? colors.destructive : colors.foreground) : isReceita ? colors.success : colors.destructive;
  const sign = isTransfer ? (incoming ? '+' : outgoing ? '-' : '') : isReceita ? '+' : '-';
  const effectiveStatus = status || (transaction.paid && dayKey(transaction.date) <= dayKey(new Date()) ? 'realizado' : !transaction.paid && dayKey(transaction.date) < dayKey(new Date()) ? 'vencido' : 'previsto');
  const statusLabel = effectiveStatus === 'realizado' ? (isTransfer ? 'Transferido' : isReceita ? 'Recebido' : 'Pago') : effectiveStatus === 'vencido' ? 'Vencido' : 'Previsto';
  const setRowRef = React.useCallback((ref: Swipeable | null) => {
    if (ref) rowRefs?.set(transaction.id, ref);
    else rowRefs?.delete(transaction.id);
  }, [rowRefs, transaction.id]);
  React.useEffect(() => () => { rowRefs?.delete(transaction.id); }, [rowRefs, transaction.id]);
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
      accessibilityRole="button"
      accessibilityLabel={`${transaction.description}, ${statusLabel}, ${sign + formatCurrency(transaction.amount)}`}
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
      <View style={[styles.txInfo, stacked && styles.fullRow, hideIcon && { paddingLeft: 4 }]}>
        <View style={styles.descriptionRow}>
          <Text 
            numberOfLines={2}
            ellipsizeMode="tail"
            style={[styles.txDesc, { color: colors.foreground, flexShrink: 1 }]}
          >
            {transaction.description}
          </Text>
          {effectiveStatus === 'realizado' && (
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
          {showAccount && account ? ` • ${account.name}${isTransfer ? ` → ${targetAccount?.name || 'Destino'}` : ''}` : ''}
        </Text>
        <Text style={[styles.txMetaText, { color: effectiveStatus === 'vencido' ? colors.destructive : colors.mutedForeground }]}>{statusLabel}{transaction.isAdjustment ? ' • Ajuste de saldo' : ''}</Text>
      </View>
      <View style={[styles.amountContainer, stacked && styles.stackedAmount]}>
        <Text style={[styles.txAmount, { color: amountColor }]}>
          {`${sign}${formatCurrency(transaction.amount)}`}
        </Text>
        {onConfirm && !transaction.paid && transaction.paymentMethod !== 'credito' && (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Confirmar ${isReceita ? 'recebimento' : 'pagamento'} de ${transaction.description}`} onPress={(event) => { event.stopPropagation(); onConfirm(transaction); }} style={{ paddingVertical: 10, paddingHorizontal: 4 }}>
            <Text style={{ color: colors.foreground, textDecorationLine: 'underline', fontSize: 12 }}>Confirmar</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  if (swipeable && renderRightActions) {
    return (
      <Swipeable
        ref={setRowRef}
        renderRightActions={() => renderRightActions(transaction.id)}
        onSwipeableWillOpen={() => onSwipeableWillOpen?.(transaction.id)}
      >
        {content}
      </Swipeable>
    );
  }

  return content;
});

const styles = StyleSheet.create({
  txItem: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    minWidth: 100,
  },
  fullRow: { flexBasis: '100%', flexGrow: 0 },
  stackedAmount: { width: '100%', marginLeft: 0, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  descriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  txDesc: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
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
    maxWidth: '100%',
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
});
