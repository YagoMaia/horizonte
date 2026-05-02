// components/AddTransactionModal.tsx
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import {
  Transaction,
  TransactionType,
  RecurrenceType,
  Account,
} from '@/constants/types';
import { RecurrenceActionModal } from './RecurrenceActionModal';

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

interface AddTransactionModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (tx: any) => void;
  onUpdate?: (tx: any, mode: 'single' | 'future' | 'all') => void;
  accounts: Account[];
  tags: any[];
  transactionToEdit?: Transaction | null;
  initialAccountId?: string;
  initialType?: TransactionType;
}

const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: 'unica', label: 'Única' },
  { value: 'diaria', label: 'Diária' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'quinto_dia_util', label: '5º Dia Útil' },
  { value: 'anual', label: 'Anual' },
];

export function AddTransactionModal({
  visible,
  onClose,
  onAdd,
  onUpdate,
  accounts,
  tags,
  transactionToEdit,
  initialAccountId,
  initialType,
}: AddTransactionModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const isEditing = !!transactionToEdit;

  const hasAccounts = accounts.length > 0;

  const getFormattedDate = (offsetDays = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const [type, setType] = useState<TransactionType>(initialType ?? 'despesa');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState(initialAccountId ?? accounts[0]?.id ?? '');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [recurrence, setRecurrence] = useState<RecurrenceType>('unica');
  const [paid, setPaid] = useState(true);
  const [targetAccountId, setTargetAccountId] = useState('');
  const [recurrenceActionVisible, setRecurrenceActionVisible] = useState(false);
  const [pendingTxData, setPendingTxData] = useState<any>(null);

  const [installments, setInstallments] = useState(1);

  const [date, setDate] = useState(getFormattedDate(0));
  const [recurrenceStart, setRecurrenceStart] = useState(getFormattedDate(0));
  const [recurrenceEnd, setRecurrenceEnd] = useState('');

  const [calendarTarget, setCalendarTarget] = useState<
    'main' | 'start' | 'end' | null
  >(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const isCreditCardSelected = useMemo(() => {
    const acc = accounts.find((a) => a.id === accountId);
    return acc?.type === 'cartao_credito';
  }, [accountId, accounts]);

  React.useEffect(() => {
    if (isCreditCardSelected && type !== 'despesa') {
      setType('despesa');
      setPaid(false);
    }
  }, [isCreditCardSelected, type]);

  // Sincroniza com valores iniciais quando o modal abre (para novos lançamentos)
  React.useEffect(() => {
    if (visible && !isEditing) {
      if (initialAccountId) setAccountId(initialAccountId);
      if (initialType) setType(initialType);
      
      const acc = accounts.find(a => a.id === (initialAccountId || accountId));
      if (acc?.type === 'cartao_credito') {
        setPaid(false);
      } else {
        setPaid(true);
      }
    }
  }, [visible, initialAccountId, initialType, isEditing]);

  const resetState = () => {
    setType(initialType ?? 'despesa');
    setDescription('');
    setAmount('');
    setAccountId(initialAccountId ?? accounts[0]?.id ?? '');
    setSelectedTags([]);
    setRecurrence('unica');
    
    const acc = accounts.find(a => a.id === (initialAccountId || accounts[0]?.id));
    setPaid(acc?.type === 'cartao_credito' ? false : true);
    
    setInstallments(1);
    setDate(getFormattedDate(0));
    setRecurrenceStart(getFormattedDate(0));
    setRecurrenceEnd('');
    setCalendarTarget(null);
    setTargetAccountId('');
  };

  React.useEffect(() => {
    if (visible) {
      if (transactionToEdit) {
        setType(transactionToEdit.type);
        setDescription(transactionToEdit.description);
        setAmount(String(transactionToEdit.amount).replace('.', ','));
        setAccountId(transactionToEdit.accountId);
        setSelectedTags(transactionToEdit.tagIds);
        setRecurrence(transactionToEdit.recurrence);
        setPaid(transactionToEdit.paid);
        setInstallments(transactionToEdit.totalInstallments || 1);
        const d = new Date(transactionToEdit.date);
        setDate(
          `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`,
        );
      } else {
        resetState();
      }
    }
  }, [visible, transactionToEdit]);

  const renderCalendar = () => {
    if (!calendarTarget) return null;

    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay();

    const days = [];
    for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    const today = new Date();

    let currentVal = date;
    if (calendarTarget === 'start') currentVal = recurrenceStart;
    if (calendarTarget === 'end') currentVal = recurrenceEnd || date;

    const parts = currentVal.split('/');
    const parsedCurrentDate =
      parts.length === 3
        ? new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]))
        : new Date();

    return (
      <Modal transparent={true} visible={!!calendarTarget} animationType='fade'>
        <View style={styles.calendarOverlay}>
          <View
            style={[
              styles.calendarBox,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.calendarHeader}>
              <TouchableOpacity
                onPress={() => setCalendarMonth(new Date(year, month - 1, 1))}
              >
                <Ionicons
                  name='chevron-back'
                  size={20}
                  color={colors.foreground}
                />
              </TouchableOpacity>
              <Text
                style={[styles.calendarMonthText, { color: colors.foreground }]}
              >
                {MONTHS[month]} {year}
              </Text>
              <TouchableOpacity
                onPress={() => setCalendarMonth(new Date(year, month + 1, 1))}
              >
                <Ionicons
                  name='chevron-forward'
                  size={20}
                  color={colors.foreground}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarGrid}>
              {WEEK_DAYS.map((wd, i) => (
                <View key={`wd-${i}`} style={styles.calendarDayCell}>
                  <Text style={{ fontSize: 10, color: colors.mutedForeground }}>
                    {wd[0]}
                  </Text>
                </View>
              ))}
              {days.map((d, i) => {
                if (!d)
                  return (
                    <View key={`empty-${i}`} style={styles.calendarDayCell} />
                  );

                const isSelected =
                  parsedCurrentDate.getDate() === d &&
                  parsedCurrentDate.getMonth() === month &&
                  parsedCurrentDate.getFullYear() === year;
                const isToday =
                  today.getDate() === d &&
                  today.getMonth() === month &&
                  today.getFullYear() === year;

                return (
                  <TouchableOpacity
                    key={`day-${d}`}
                    style={styles.calendarDayCell}
                    onPress={() => {
                      const newDate = `${String(d).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;
                      if (calendarTarget === 'main') setDate(newDate);
                      if (calendarTarget === 'start') setRecurrenceStart(newDate);
                      if (calendarTarget === 'end') setRecurrenceEnd(newDate);
                      setCalendarTarget(null);
                    }}
                  >
                    <View
                      style={[
                        styles.dayInner,
                        isSelected && { backgroundColor: colors.primary },
                        isToday &&
                        !isSelected && {
                          borderWidth: 1,
                          borderColor: colors.primary,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: isSelected ? '#FFF' : colors.foreground,
                          fontSize: 13,
                        }}
                      >
                        {d}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={styles.calendarCloseBtn}
              onPress={() => setCalendarTarget(null)}
            >
              <Text style={{ color: colors.primary, fontWeight: '600' }}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  };

  const handleSubmit = () => {
    if (!hasAccounts || !amount || !accountId) return;
    if (type === 'transferencia' && !targetAccountId) {
      alert('Selecione uma conta de destino para a transferência.');
      return;
    }

    const parseToISO = (str: string) => {
      const p = str.split('/');
      if (p.length !== 3) return new Date().toISOString();
      return new Date(
        Number(p[2]),
        Number(p[1]) - 1,
        Number(p[0]),
      ).toISOString();
    };

    const isInstallment = isCreditCardSelected && installments > 1;
    const finalRecurrence = isInstallment ? 'unica' : recurrence;

    // 👉 CORREÇÃO: Calcula a quantidade exata de repetições com base na data final
    let calculatedMaxRecurrences = 24; // Padrão máximo caso não haja data de fim definida

    if (finalRecurrence !== 'unica' && recurrenceEnd) {
      const startD = new Date(parseToISO(recurrenceStart));
      const endD = new Date(parseToISO(recurrenceEnd));

      if (endD < startD) {
        alert('A data de fim não pode ser antes da data de início.');
        return;
      }

      if (finalRecurrence === 'mensal' || finalRecurrence === 'quinto_dia_util') {
        const monthsDiff =
          (endD.getFullYear() - startD.getFullYear()) * 12 +
          (endD.getMonth() - startD.getMonth());
        calculatedMaxRecurrences = monthsDiff + 1; // +1 para incluir o mês de início
      } else if (finalRecurrence === 'anual') {
        calculatedMaxRecurrences = (endD.getFullYear() - startD.getFullYear()) + 1;
      } else if (finalRecurrence === 'semanal') {
        const diffTime = Math.abs(endD.getTime() - startD.getTime());
        calculatedMaxRecurrences = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7)) + 1;
      } else if (finalRecurrence === 'diaria') {
        const diffTime = Math.abs(endD.getTime() - startD.getTime());
        calculatedMaxRecurrences = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      }
    }

    const txData = {
      description: description.trim(),
      amount: parseFloat(amount.replace(',', '.')),
      type,
      date: (recurrence === 'unica' || isInstallment)
        ? parseToISO(date)
        : parseToISO(recurrenceStart),
      accountId,
      tagIds: selectedTags,
      recurrence: finalRecurrence,
      paid,
      recurrenceStartDate: (!isInstallment && finalRecurrence !== 'unica')
        ? parseToISO(recurrenceStart)
        : undefined,
      recurrenceEndDate: (!isInstallment && finalRecurrence !== 'unica' && recurrenceEnd)
        ? parseToISO(recurrenceEnd)
        : undefined,
      totalInstallments: isCreditCardSelected ? installments : 1,
      paymentMethod: isCreditCardSelected ? 'credito' : 'debito',
      targetAccountId: type === 'transferencia' ? targetAccountId : undefined,
      // 👉 Repassa o cálculo exato para o store respeitar o limite
      calculatedRecurrenceCount: calculatedMaxRecurrences,
    };

    if (isEditing && onUpdate) {
      const isFamily =
        transactionToEdit.groupId || transactionToEdit.id.includes('-');

      if (isFamily) {
        setPendingTxData({ ...txData, id: transactionToEdit.id });
        setRecurrenceActionVisible(true);
      } else {
        onUpdate({ ...txData, id: transactionToEdit.id }, 'single');
        onClose();
      }
    } else {
      onAdd(txData);
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType='slide'
      presentationStyle='pageSheet'
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={[
            styles.header,
            { borderBottomColor: colors.border, paddingTop: insets.top + 16 },
          ]}
        >
          <TouchableOpacity onPress={onClose}>
            <Ionicons name='close' size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {isEditing ? 'Editar' : 'Novo Lançamento'}
          </Text>

          {hasAccounts ? (
            <TouchableOpacity
              onPress={handleSubmit}
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.saveBtnText}>Salvar</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 60 }} />
          )}
        </View>

        {hasAccounts ? (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Conta de Origem
              </Text>
              <View style={styles.chipRow}>
                {accounts.map((acc) => (
                  <TouchableOpacity
                    key={acc.id}
                    style={[
                      styles.chip,
                      {
                        borderColor: acc.color,
                        backgroundColor:
                          accountId === acc.id ? acc.color : 'transparent',
                      },
                    ]}
                    onPress={() => setAccountId(acc.id)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: accountId === acc.id ? '#FFF' : acc.color },
                      ]}
                    >
                      {acc.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View
              style={[
                styles.typeSelector,
                {
                  backgroundColor: colors.secondary,
                  opacity: isCreditCardSelected ? 0.5 : 1,
                },
              ]}
              pointerEvents={isCreditCardSelected ? 'none' : 'auto'}
            >
              {(
                ['receita', 'despesa', 'transferencia'] as TransactionType[]
              ).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.typeBtn,
                    type === t && {
                      backgroundColor:
                        t === 'receita'
                          ? colors.success
                          : t === 'despesa'
                            ? colors.destructive
                            : colors.primary,
                    },
                  ]}
                  onPress={() => setType(t)}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: type === t ? '#FFF' : colors.mutedForeground,
                    }}
                  >
                    {t.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {isCreditCardSelected && (
              <Text
                style={{
                  fontSize: 10,
                  color: colors.mutedForeground,
                  textAlign: 'center',
                  marginTop: -15,
                }}
              >
                * Cartões aceitam apenas despesas
              </Text>
            )}

            {type === 'transferencia' && (
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>
                  Conta de Destino
                </Text>
                <View style={styles.chipRow}>
                  {accounts
                    .filter(
                      (acc) =>
                        acc.id !== accountId && acc.type !== 'cartao_credito',
                    )
                    .map((acc) => (
                      <TouchableOpacity
                        key={acc.id}
                        style={[
                          styles.chip,
                          {
                            borderColor: acc.color,
                            backgroundColor:
                              targetAccountId === acc.id
                                ? acc.color
                                : 'transparent',
                          },
                        ]}
                        onPress={() => setTargetAccountId(acc.id)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            {
                              color:
                                targetAccountId === acc.id ? '#FFF' : acc.color,
                            },
                          ]}
                        >
                          {acc.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </View>
                {accounts.filter(
                  (acc) =>
                    acc.id !== accountId && acc.type !== 'cartao_credito',
                ).length === 0 && (
                    <Text style={{ fontSize: 11, color: colors.destructive }}>
                      Não tem outras contas disponíveis para receber a
                      transferência.
                    </Text>
                  )}
              </View>
            )}

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Valor
              </Text>
              <TextInput
                style={[
                  styles.amountInput,
                  {
                    color: colors.foreground,
                    borderBottomColor: colors.border,
                  },
                ]}
                value={amount}
                onChangeText={setAmount}
                placeholder='0,00'
                keyboardType='decimal-pad'
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Descrição
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                  },
                ]}
                value={description}
                onChangeText={setDescription}
                placeholder='Ex: Almoço, Uber... (Opcional)'
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            {isCreditCardSelected && !isEditing && (
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>
                  Parcelamento
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ flexDirection: 'row', marginTop: 4 }}
                >
                  {[1, 2, 3, 4, 5, 6, 10, 12, 24].map((n) => (
                    <TouchableOpacity
                      key={n}
                      style={[
                        styles.instBtn,
                        { borderColor: colors.border },
                        installments === n && {
                          backgroundColor: colors.primary,
                          borderColor: colors.primary,
                        },
                      ]}
                      onPress={() => setInstallments(n)}
                    >
                      <Text
                        style={{
                          color:
                            installments === n ? '#FFF' : colors.foreground,
                          fontWeight: '500',
                        }}
                      >
                        {n === 1 ? 'À Vista' : `${n}x`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {installments > 1 && amount && (
                  <Text
                    style={{
                      fontSize: 11,
                      color: colors.mutedForeground,
                      marginTop: 4,
                    }}
                  >
                    Serão lançadas {installments} parcelas de R${' '}
                    {(parseFloat(amount.replace(',', '.')) / installments)
                      .toFixed(2)
                      .replace('.', ',')}
                  </Text>
                )}
              </View>
            )}

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Tags
              </Text>
              <View style={styles.chipRow}>
                {tags.map((tag) => (
                  <TouchableOpacity
                    key={tag.id}
                    style={[
                      styles.chip,
                      {
                        borderColor: tag.color,
                        backgroundColor: selectedTags.includes(tag.id)
                          ? tag.color
                          : 'transparent',
                      },
                    ]}
                    onPress={() => toggleTag(tag.id)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color: selectedTags.includes(tag.id)
                            ? '#FFF'
                            : tag.color,
                        },
                      ]}
                    >
                      {tag.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {!isCreditCardSelected && (
              <>
                <View style={styles.field}>
                  <Text
                    style={[styles.label, { color: colors.mutedForeground }]}
                  >
                    Recorrência
                  </Text>
                  <View style={styles.chipRow}>
                    {RECURRENCE_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[
                          styles.chip,
                          {
                            borderColor: colors.primary,
                            backgroundColor:
                              recurrence === opt.value
                                ? colors.primary
                                : 'transparent',
                          },
                        ]}
                        onPress={() => setRecurrence(opt.value)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            {
                              color:
                                recurrence === opt.value
                                  ? '#FFF'
                                  : colors.primary,
                            },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </>
            )}

            {recurrence === 'unica' ? (
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>
                  Data da Compra
                </Text>
                <TouchableOpacity
                  style={[
                    styles.dateButton,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                    },
                  ]}
                  onPress={() =>
                    setCalendarTarget(calendarTarget === 'main' ? null : 'main')
                  }
                >
                  <Text style={{ color: colors.foreground }}>{date}</Text>
                  <Ionicons
                    name='calendar-outline'
                    size={20}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                <View style={styles.field}>
                  <Text
                    style={[styles.label, { color: colors.mutedForeground }]}
                  >
                    Inicia em
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.dateButton,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                      },
                    ]}
                    onPress={() =>
                      setCalendarTarget(
                        calendarTarget === 'start' ? null : 'start',
                      )
                    }
                  >
                    <Text style={{ color: colors.foreground }}>
                      {recurrenceStart}
                    </Text>
                    <Ionicons
                      name='calendar-outline'
                      size={20}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                </View>
                <View style={styles.field}>
                  <Text
                    style={[styles.label, { color: colors.mutedForeground }]}
                  >
                    Termina em (Opcional)
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.dateButton,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                      },
                    ]}
                    onPress={() =>
                      setCalendarTarget(calendarTarget === 'end' ? null : 'end')
                    }
                  >
                    <Text style={{ color: colors.foreground }}>
                      {recurrenceEnd || 'Não definido'}
                    </Text>
                    <Ionicons
                      name='calendar-outline'
                      size={20}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {!isCreditCardSelected && (
              <View style={styles.switchRow}>
                <Text style={{ color: colors.foreground, fontWeight: '500' }}>
                  Pago / Recebido
                </Text>
                <Switch
                  value={paid}
                  onValueChange={setPaid}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>
            )}
          </ScrollView>
        ) : (
          <View style={styles.emptyStateContainer}>
            <Ionicons
              name='wallet-outline'
              size={64}
              color={colors.mutedForeground}
              style={{ marginBottom: 16 }}
            />
            <Text
              style={[styles.emptyStateTitle, { color: colors.foreground }]}
            >
              Nenhuma conta cadastrada
            </Text>
            <Text
              style={[styles.emptyStateText, { color: colors.mutedForeground }]}
            >
              Você precisa adicionar pelo menos uma conta bancária ou cartão
              antes de registrar suas transações.
            </Text>
          </View>
        )}
        {/* Renderiza o modal de calendário se estiver ativo */}
        {renderCalendar()}
        <RecurrenceActionModal
          visible={recurrenceActionVisible}
          actionType='edit'
          onClose={() => setRecurrenceActionVisible(false)}
          onSelect={(mode) => {
            setRecurrenceActionVisible(false);
            if (onUpdate && pendingTxData) {
              onUpdate(pendingTxData, mode);
              onClose();
            }
          }}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  saveBtnText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  content: { padding: 20, gap: 20 },
  typeSelector: { flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4 },
  typeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  field: { gap: 6 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountInput: {
    fontSize: 32,
    fontWeight: '700',
    borderBottomWidth: 1,
    paddingBottom: 4,
  },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '500' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 10,
  },
  instBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  calendarMonthText: { fontWeight: '700', fontSize: 14 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarDayCell: {
    width: '14.28%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  dayInner: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 64,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  calendarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarBox: {
    width: '90%',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  calendarCloseBtn: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 12,
  },
});