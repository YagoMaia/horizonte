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
import { validateDepositAmount } from '@/lib/goalValidation';
import { Account } from '@/constants/types';

interface GoalDepositModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (amount: number, accountId: string) => Promise<void>;
  currentAccumulated: number;
  targetAmount: number;
  accounts: Account[];
}

export function GoalDepositModal({
  visible,
  onClose,
  onConfirm,
  currentAccumulated,
  targetAmount,
  accounts,
}: GoalDepositModalProps) {
  const { colors } = useTheme();

  const [amount, setAmount] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    accounts.length > 0 ? accounts[0].id : ''
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCongrats, setShowCongrats] = useState(false);

  const formatCurrencyMask = (value: string): string => {
    const cleanValue = value.replace(/\D/g, '');
    const amountNumber = Number(cleanValue) / 100;

    return amountNumber.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const parseAmount = (formatted: string): number => {
    return parseFloat(formatted.replace(/\./g, '').replace(',', '.'));
  };

  const handleAmountChange = (text: string) => {
    setAmount(formatCurrencyMask(text));
    if (error) setError(null);
  };

  const handleConfirm = useCallback(async () => {
    const numericAmount = parseAmount(amount);

    if (!selectedAccountId) {
      setError('Selecione uma conta para o depósito');
      return;
    }

    const validation = validateDepositAmount(numericAmount);
    if (!validation.valid) {
      setError(validation.errors.amount || 'Valor inválido');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onConfirm(numericAmount, selectedAccountId);

      // Check if goal is now completed
      if (currentAccumulated + numericAmount >= targetAmount) {
        setShowCongrats(true);
      } else {
        resetAndClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar o depósito. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [amount, onConfirm, onClose, currentAccumulated, targetAmount, selectedAccountId]);

  const resetAndClose = () => {
    setAmount('');
    setError(null);
    setShowCongrats(false);
    onClose();
  };

  const handleClose = () => {
    if (showCongrats) {
      resetAndClose();
    } else {
      setAmount('');
      setError(null);
      onClose();
    }
  };

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
          style={styles.overlayTouchable}
          onPress={handleClose}
        />

        <View
          style={[
            styles.container,
            {
              backgroundColor: colors.card,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              borderColor: colors.border,
            },
          ]}
        >
          {showCongrats ? (
            <View style={styles.congratsContainer}>
              <View style={[styles.congratsIcon, { backgroundColor: colors.success + '20' }]}>
                <Ionicons name="trophy" size={48} color={colors.success} />
              </View>
              <Text style={[styles.congratsText, { color: colors.foreground }]}>
                Parabéns! Você atingiu sua meta!
              </Text>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
                onPress={resetAndClose}
              >
                <Text style={[styles.confirmBtnText, { color: colors.primaryForeground }]}>
                  Fechar
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Handle bar */}
              <View style={[styles.handleBar, { backgroundColor: colors.border }]} />

              {/* Header */}
              <View style={styles.header}>
                <Text style={[styles.title, { color: colors.foreground }]}>
                  Depositar na Meta
                </Text>
                <TouchableOpacity onPress={handleClose}>
                  <Ionicons name="close" size={24} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Account Selection */}
                <View style={styles.section}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>
                    Retirar da conta
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
                    Valor do depósito
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
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="decimal-pad"
                      autoFocus
                      editable={!loading}
                    />
                  </View>
                  {error && (
                    <Text style={[styles.errorText, { color: colors.destructive }]}>
                      {error}
                    </Text>
                  )}
                </View>

                {/* Confirm button */}
                <TouchableOpacity
                  style={[
                    styles.confirmBtn,
                    {
                      backgroundColor: colors.primary,
                      opacity: loading || !amount || amount === '0,00' ? 0.7 : 1,
                    },
                  ]}
                  onPress={handleConfirm}
                  disabled={loading || !amount || amount === '0,00'}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.primaryForeground} size="small" />
                  ) : (
                    <Text style={[styles.confirmBtnText, { color: colors.primaryForeground }]}>
                      Confirmar Depósito
                    </Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </>
          )}
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
  overlayTouchable: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  container: {
    padding: 16,
    paddingBottom: 32,
    maxHeight: '80%',
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
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
  confirmBtn: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  congratsContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  congratsIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  congratsText: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
});
