import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { validateWithdrawalAmount } from '@/lib/goalValidation';
import { Account } from '@/constants/types';

interface GoalWithdrawModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (amount: number, accountId: string) => Promise<void>;
  currentAccumulated: number;
  accounts: Account[];
}

export function GoalWithdrawModal({
  visible,
  onClose,
  onConfirm,
  currentAccumulated,
  accounts,
}: GoalWithdrawModalProps) {
  const { colors } = useTheme();

  const [amount, setAmount] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    accounts.length > 0 ? accounts[0].id : ''
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const formatCurrencyMask = (value: string): string => {
    const cleanValue = value.replace(/\D/g, '');
    const amountNumber = Number(cleanValue) / 100;

    return amountNumber.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleAmountChange = (text: string) => {
    setAmount(formatCurrencyMask(text));
    setError(null);
    setSuccessMessage(null);
  };

  const parseAmount = (formatted: string): number => {
    return parseFloat(formatted.replace(/\./g, '').replace(',', '.'));
  };

  const handleConfirm = useCallback(async () => {
    const numericAmount = parseAmount(amount);

    if (!selectedAccountId) {
      setError('Selecione uma conta para a retirada');
      return;
    }

    const validation = validateWithdrawalAmount(numericAmount, currentAccumulated);
    if (!validation.valid) {
      setError(validation.errors.amount);
      return;
    }

    setLoading(true);
    try {
      await onConfirm(numericAmount, selectedAccountId);
      setSuccessMessage('Retirada realizada com sucesso!');
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch {
      setError('Não foi possível realizar a retirada. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [amount, currentAccumulated, onConfirm, selectedAccountId]);

  const handleClose = useCallback(() => {
    setAmount('');
    setError(null);
    setSuccessMessage(null);
    onClose();
  }, [onClose]);

  const filteredAccounts = useMemo(() => 
    accounts.filter(a => a.type !== 'cartao_credito'),
  [accounts]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.backdrop}
          onPress={handleClose}
        />
        <View
          style={[
            styles.container,
            {
              backgroundColor: colors.card,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: colors.foreground }]}>
                Retirar Valor da Meta
              </Text>
              <TouchableOpacity onPress={handleClose}>
                <Ionicons name="close" size={24} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Balance info */}
            <View style={styles.balanceInfo}>
              <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>
                Saldo disponível na meta
              </Text>
              <Text style={[styles.balanceValue, { color: colors.foreground }]}>
                R$ {currentAccumulated.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>

            {/* Account Selection */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Depositar na conta
              </Text>
              <View style={styles.accountList}>
                {filteredAccounts.map((acc) => (
                  <TouchableOpacity
                    key={acc.id}
                    style={[
                      styles.accountChip,
                      {
                        borderColor: acc.color,
                        backgroundColor: selectedAccountId === acc.id ? acc.color : 'transparent',
                      },
                    ]}
                    onPress={() => {
                      setSelectedAccountId(acc.id);
                      setError(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.accountChipText,
                        { color: selectedAccountId === acc.id ? '#FFF' : acc.color },
                      ]}
                    >
                      {acc.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Input */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Valor da retirada
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    borderColor: error ? colors.destructive : colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              >
                <Text style={[styles.currencyPrefix, { color: colors.mutedForeground }]}>
                  R$
                </Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  value={amount}
                  onChangeText={handleAmountChange}
                  placeholder="0,00"
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.mutedForeground}
                  editable={!loading}
                />
              </View>
              {error && (
                <Text style={[styles.errorText, { color: colors.destructive }]}>
                  {error}
                </Text>
              )}
              {successMessage && (
                <Text style={[styles.successText, { color: colors.success }]}>
                  {successMessage}
                </Text>
              )}
            </View>

            {/* Confirm button */}
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                { backgroundColor: colors.primary },
                (loading || !amount || amount === '0,00') && { opacity: 0.7 },
              ]}
              onPress={handleConfirm}
              disabled={loading || !amount || amount === '0,00'}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.confirmBtnText}>Confirmar Retirada</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  container: {
    padding: 16,
    paddingBottom: 32,
    maxHeight: '80%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ccc',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  balanceInfo: {
    marginBottom: 20,
  },
  balanceLabel: {
    fontSize: 13,
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  accountList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  accountChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  accountChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: '500',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
  },
  successText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  confirmBtn: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
