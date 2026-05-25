import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Account } from '@/constants/types';
import { formatCurrency } from '@/lib/utils';
import { ThemeColors } from '@/constants/theme';

interface AccountItemProps {
  account: Account;
  colors: ThemeColors;
  typeLabel: string;
  isPrimary: boolean;
  onEdit: (acc: Account) => void;
  onDelete: (acc: Account) => void;
  onSetPrimary: (id: string) => void;
}

export const AccountItem = React.memo(({ 
  account, 
  colors, 
  typeLabel, 
  isPrimary, 
  onEdit, 
  onDelete, 
  onSetPrimary 
}: AccountItemProps) => {
  return (
    <View
      style={[
        styles.accountCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={[styles.accent, { backgroundColor: account.color }]} />
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: account.color + '20' },
        ]}
      >
        <Ionicons
          name={account.icon as any}
          size={22}
          color={account.color}
        />
      </View>
      <View style={styles.accountInfo}>
        <Text
          style={[styles.accountName, { color: colors.foreground }]}
        >
          {account.name}
        </Text>
        <Text
          style={[
            styles.accountType,
            { color: colors.mutedForeground },
          ]}
        >
          {typeLabel}
        </Text>
      </View>
      <View style={styles.accountRight}>
        {account.type === 'cartao_credito' ? (
          <Text
            style={[
              styles.accountBalance,
              { color: colors.mutedForeground },
            ]}
          >
            Cartão
          </Text>
        ) : (
          <Text
            style={[
              styles.accountBalance,
              {
                color:
                  account.balance < 0
                    ? colors.destructive
                    : colors.foreground,
              },
            ]}
          >
            {formatCurrency(account.balance)}
          </Text>
        )}

        <View style={styles.accountActions}>
          {!isPrimary && (
            <TouchableOpacity
              onPress={() => onSetPrimary(account.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name='star-outline'
                size={16}
                color={colors.primary}
              />
            </TouchableOpacity>
          )}
          {isPrimary && (
            <Ionicons
              name='star'
              size={16}
              color={colors.primary}
            />
          )}
          <TouchableOpacity
            onPress={() => onEdit(account)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name='pencil-outline'
              size={16}
              color={colors.mutedForeground}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onDelete(account)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name='trash-outline'
              size={16}
              color={colors.destructive}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    paddingRight: 14,
    gap: 12,
  },
  accent: { width: 4, alignSelf: 'stretch' },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
  },
  accountInfo: { flex: 1, gap: 3 },
  accountName: { fontSize: 15, fontWeight: '600' },
  accountType: { fontSize: 12 },
  accountRight: { alignItems: 'flex-end', gap: 6 },
  accountBalance: { fontSize: 16, fontWeight: '700' },
  accountActions: { flexDirection: 'row', gap: 14, alignItems: 'center' },
});
