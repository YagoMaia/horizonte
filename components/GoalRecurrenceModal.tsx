// components/GoalRecurrenceModal.tsx
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
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Account, GoalRecurrence } from '@/constants/types';
import { formatCurrency } from '@/lib/utils';

interface GoalRecurrenceModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (amount: number, accountId: string, dayOfMonth: number, hasEndDate: boolean, endDate?: string) => Promise<void>;
  onCancel?: () => Promise<void>;
  accounts: Account[];
  goalName: string;
  existingRecurrence?: GoalRecurrence | null;
}

export function GoalRecurrenceModal({
  visible,
  onClose,
  onConfirm,
  onCancel,
  accounts,
  goalName,
  existingRecurrence,
}: GoalRecurrenceModalProps) {
  const { colors } = useTheme();

  const [amount, setAmount] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    accounts.length > 0 ? accounts[0].id : ''
  );
  const [dayOfMonth, setDayOfMonth] = useState(
    existingRecurrence?.dayOfMonth?.toString() ?? new Date().getDate().toString()
  );
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDateMonth, setEndDateMonth] = useState('');
  const [endDateYear, setEndDateYear] = useState(
    (new Date().getFullYear() + 1).toString()
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const filteredAccounts = useMemo(
    () => accounts.filter((a) => a.type !== 'cartao_credito'),
    [accounts]
  );

  const formatCurrencyMask = (value: string): string => {
    const cleanValue = value.replace(/\D/g, '');
    const amountNumber = Number(cleanValue) / 100;
    return amountNumber.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const parseAmount = (formatted: string): number =>
    parseFloat(formatted.replace(/\./g, '').replace(',', '.'));

  const handleAmountChange = (text: string) => {
    setAmount(formatCurrencyMask(text));
    if (error) setError(null);
  };

  const handleDayChange = (text: string) => {
    const numeric = text.replace(/\D/g, '');
    if (numeric === '') { setDayOfMonth(''); return; }
    const day = Math.min(28, Math.max(1, parseInt(numeric, 10)));
    setDayOfMonth(day.toString());
  };

  const handleConfirm = useCallback(async () => {
    const numericAmount = parseAmount(amount);
    const day = parseInt(dayOfMonth, 10);

    if (!selectedAccountId) {
      setError('Selecione uma conta de origem');
      return;
    }
    if (!amount || isNaN(numericAmount) || numericAmount <= 0) {
      setError('Informe um valor válido para o aporte');
      return;
    }
    if (isNaN(day) || day < 1 || day > 28) {
      setError('Informe um dia válido entre 1 e 28');
      return;
    }

    let endDate: string | undefined;
    if (hasEndDate) {
      const month = parseInt(endDateMonth, 10);
      const year = parseInt(endDateYear, 10);
      if (isNaN(month) || month < 1 || month > 12 || isNaN(year) || year < new Date().getFullYear()) {
        setError('Informe uma data de término válida');
        return;
      }
      endDate = new Date(year, month - 1, 28, 23, 59, 59).toISOString();
    }

    setLoading(true);
    setError(null);
    try {
      await onConfirm(numericAmount, selectedAccountId, day, hasEndDate, endDate);
      resetAndClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao configurar aporte. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [amount, selectedAccountId, dayOfMonth, hasEndDate, endDateMonth, endDateYear, onConfirm]);

  const handleCancelRecurrence = useCallback(async () => {
    if (!onCancel) return;
    setLoading(true);
    try {
      await onCancel();
      setShowCancelConfirm(false);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao cancelar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [onCancel, onClose]);

  const resetAndClose = () => {
    setAmount('');
    setError(null);
    setShowCancelConfirm(false);
    setHasEndDate(false);
    onClose();
  };

  const isEditing = !!existingRecurrence?.active;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={resetAndClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.overlayTouchable}
          onPress={resetAndClose}
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
          {/* Handle bar */}
          <View style={[styles.handleBar, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerIcon, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="repeat" size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.title, { color: colors.foreground }]}>
                  {isEditing ? 'Aporte Recorrente' : 'Configurar Aporte Mensal'}
                </Text>
                <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {goalName}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={resetAndClose}>
              <Ionicons name="close" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Active recurrence summary */}
            {isEditing && existingRecurrence && (
              <View style={[styles.activeBanner, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
                <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.activeBannerTitle, { color: colors.primary }]}>
                    Aporte ativo: {formatCurrency(existingRecurrence.amount)}/mês
                  </Text>
                  <Text style={[styles.activeBannerSub, { color: colors.mutedForeground }]}>
                    Todo dia {existingRecurrence.dayOfMonth} do mês
                  </Text>
                </View>
              </View>
            )}

            {/* Account selection */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Debitar da conta
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

            {/* Amount */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Valor mensal
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
                <Text style={[styles.currencyPrefix, { color: colors.mutedForeground }]}>R$</Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  value={amount}
                  onChangeText={handleAmountChange}
                  placeholder="0,00"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  autoFocus={!isEditing}
                  editable={!loading}
                />
              </View>
            </View>

            {/* Day of month */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Dia do mês (1–28)
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
                <Ionicons name="calendar-outline" size={18} color={colors.mutedForeground} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  value={dayOfMonth}
                  onChangeText={handleDayChange}
                  placeholder="5"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                  maxLength={2}
                  editable={!loading}
                />
                <Text style={[styles.daySuffix, { color: colors.mutedForeground }]}>
                  de cada mês
                </Text>
              </View>
            </View>

            {/* End date toggle */}
            <View style={[styles.section, styles.toggleRow]}>
              <View>
                <Text style={[styles.toggleLabel, { color: colors.foreground }]}>Definir data de término</Text>
                <Text style={[styles.toggleSub, { color: colors.mutedForeground }]}>Opcional — sem limite por padrão</Text>
              </View>
              <Switch
                value={hasEndDate}
                onValueChange={setHasEndDate}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFF"
              />
            </View>

            {hasEndDate && (
              <View style={[styles.section, styles.endDateRow]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>Mês</Text>
                  <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.background }]}>
                    <TextInput
                      style={[styles.input, { color: colors.foreground }]}
                      value={endDateMonth}
                      onChangeText={(t) => setEndDateMonth(t.replace(/\D/g, '').slice(0, 2))}
                      placeholder="12"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>Ano</Text>
                  <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.background }]}>
                    <TextInput
                      style={[styles.input, { color: colors.foreground }]}
                      value={endDateYear}
                      onChangeText={(t) => setEndDateYear(t.replace(/\D/g, '').slice(0, 4))}
                      placeholder="2026"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="number-pad"
                      maxLength={4}
                    />
                  </View>
                </View>
              </View>
            )}

            {error && (
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            )}

            {/* Confirm button */}
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 },
              ]}
              onPress={handleConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
                  <Text style={styles.confirmBtnText}>
                    {isEditing ? 'Atualizar Aporte' : 'Ativar Aporte Mensal'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Cancel recurrence button (only when one is active) */}
            {isEditing && onCancel && (
              <>
                {showCancelConfirm ? (
                  <View style={[styles.cancelConfirmBox, { backgroundColor: colors.destructive + '10', borderColor: colors.destructive + '30' }]}>
                    <Text style={[styles.cancelConfirmText, { color: colors.foreground }]}>
                      Tem certeza? Os aportes automáticos serão interrompidos.
                    </Text>
                    <View style={styles.cancelConfirmBtns}>
                      <TouchableOpacity
                        style={[styles.cancelConfirmNo, { borderColor: colors.border }]}
                        onPress={() => setShowCancelConfirm(false)}
                      >
                        <Text style={[styles.cancelConfirmNoText, { color: colors.foreground }]}>Não</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.cancelConfirmYes, { backgroundColor: colors.destructive }]}
                        onPress={handleCancelRecurrence}
                        disabled={loading}
                      >
                        {loading ? (
                          <ActivityIndicator color="#FFF" size="small" />
                        ) : (
                          <Text style={styles.cancelConfirmYesText}>Sim, cancelar</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.cancelBtn, { borderColor: colors.destructive + '50' }]}
                    onPress={() => setShowCancelConfirm(true)}
                  >
                    <Ionicons name="close-circle-outline" size={16} color={colors.destructive} />
                    <Text style={[styles.cancelBtnText, { color: colors.destructive }]}>
                      Cancelar aporte recorrente
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            <View style={{ height: 16 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  overlayTouchable: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  container: {
    padding: 16,
    paddingBottom: 32,
    maxHeight: '90%',
    borderTopWidth: StyleSheet.hairlineWidth,
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
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 1 },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  activeBannerTitle: { fontSize: 14, fontWeight: '700' },
  activeBannerSub: { fontSize: 12, marginTop: 2 },
  section: { marginBottom: 20 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  accountList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  accountChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  accountChipText: { fontSize: 13, fontWeight: '600' },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  currencyPrefix: { fontSize: 16, fontWeight: '500', marginRight: 8 },
  input: { flex: 1, fontSize: 18, fontWeight: '600' },
  daySuffix: { fontSize: 13, marginLeft: 4 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: { fontSize: 14, fontWeight: '600' },
  toggleSub: { fontSize: 12, marginTop: 2 },
  endDateRow: { flexDirection: 'row', gap: 12 },
  errorText: { fontSize: 12, fontWeight: '500', marginBottom: 12 },
  confirmBtn: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  confirmBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  cancelBtn: {
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600' },
  cancelConfirmBox: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  cancelConfirmText: { fontSize: 14, lineHeight: 20 },
  cancelConfirmBtns: { flexDirection: 'row', gap: 10 },
  cancelConfirmNo: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cancelConfirmNoText: { fontSize: 14, fontWeight: '600' },
  cancelConfirmYes: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelConfirmYesText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
