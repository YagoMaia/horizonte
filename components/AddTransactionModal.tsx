// components/AddTransactionModal.tsx
import React, { useState } from 'react'
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
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/hooks/useTheme'
import { Transaction, TransactionType, RecurrenceType } from '@/constants/types'

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

interface AddTransactionModalProps {
  visible: boolean
  onClose: () => void
  onAdd: (tx: any) => void
  onUpdate?: (tx: any) => void
  accounts: any[]
  tags: any[]
  transactionToEdit?: Transaction | null
}

const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: 'unica', label: 'Única' },
  { value: 'diaria', label: 'Diária' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'anual', label: 'Anual' },
]

export function AddTransactionModal({ visible, onClose, onAdd, onUpdate, accounts, tags, transactionToEdit }: AddTransactionModalProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const isEditing = !!transactionToEdit

  const getFormattedDate = (offsetDays = 0) => {
    const d = new Date()
    d.setDate(d.getDate() + offsetDays)
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  }

  const [type, setType] = useState<TransactionType>('despesa')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [recurrence, setRecurrence] = useState<RecurrenceType>('unica')
  const [paid, setPaid] = useState(true)

  // Estados de Data
  const [date, setDate] = useState(getFormattedDate(0))
  const [recurrenceStart, setRecurrenceStart] = useState(getFormattedDate(0))
  const [recurrenceEnd, setRecurrenceEnd] = useState('')

  // Controle do Calendário
  const [calendarTarget, setCalendarTarget] = useState<'main' | 'start' | 'end' | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(new Date())

  const resetState = () => {
    setType('despesa')
    setDescription('')
    setAmount('')
    setAccountId(accounts[0]?.id ?? '')
    setSelectedTags([])
    setRecurrence('unica')
    setPaid(true)
    setDate(getFormattedDate(0))
    setRecurrenceStart(getFormattedDate(0))
    setRecurrenceEnd('')
    setCalendarTarget(null)
  }

  React.useEffect(() => {
    if (visible) {
      if (transactionToEdit) {
        setType(transactionToEdit.type)
        setDescription(transactionToEdit.description)
        setAmount(String(transactionToEdit.amount).replace('.', ','))
        setAccountId(transactionToEdit.accountId)
        setSelectedTags(transactionToEdit.tagIds)
        setRecurrence(transactionToEdit.recurrence)
        setPaid(transactionToEdit.paid)
        const d = new Date(transactionToEdit.date)
        setDate(`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`)
      } else {
        resetState()
      }
    }
  }, [visible, transactionToEdit])

  // Lógica de Renderização do Calendário
  const renderCalendar = () => {
    if (!calendarTarget) return null

    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstDayOfWeek = new Date(year, month, 1).getDay()

    const days = []
    for (let i = 0; i < firstDayOfWeek; i++) days.push(null)
    for (let i = 1; i <= daysInMonth; i++) days.push(i)

    const today = new Date()

    // Pega a data atual do campo selecionado para destacar no calendário
    let currentVal = date
    if (calendarTarget === 'start') currentVal = recurrenceStart
    if (calendarTarget === 'end') currentVal = recurrenceEnd || date

    const parts = currentVal.split('/')
    const parsedCurrentDate = parts.length === 3
      ? new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]))
      : new Date()

    return (
      <View style={[styles.calendarBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity onPress={() => setCalendarMonth(new Date(year, month - 1, 1))}>
            <Ionicons name="chevron-back" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.calendarMonthText, { color: colors.foreground }]}>
            {MONTHS[month]} {year}
          </Text>
          <TouchableOpacity onPress={() => setCalendarMonth(new Date(year, month + 1, 1))}>
            <Ionicons name="chevron-forward" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <View style={styles.calendarGrid}>
          {WEEK_DAYS.map((wd, i) => (
            <View key={`wd-${i}`} style={styles.calendarDayCell}>
              <Text style={{ fontSize: 10, color: colors.mutedForeground }}>{wd[0]}</Text>
            </View>
          ))}
          {days.map((d, i) => {
            if (!d) return <View key={`empty-${i}`} style={styles.calendarDayCell} />

            const isSelected = parsedCurrentDate.getDate() === d && parsedCurrentDate.getMonth() === month && parsedCurrentDate.getFullYear() === year
            const isToday = today.getDate() === d && today.getMonth() === month && today.getFullYear() === year

            return (
              <TouchableOpacity
                key={`day-${d}`}
                style={styles.calendarDayCell}
                onPress={() => {
                  const newDate = `${String(d).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`
                  if (calendarTarget === 'main') setDate(newDate)
                  if (calendarTarget === 'start') setRecurrenceStart(newDate)
                  if (calendarTarget === 'end') setRecurrenceEnd(newDate)
                  setCalendarTarget(null)
                }}
              >
                <View style={[
                  styles.dayInner,
                  isSelected && { backgroundColor: colors.primary },
                  isToday && !isSelected && { borderWidth: 1, borderColor: colors.primary }
                ]}>
                  <Text style={{ color: isSelected ? '#FFF' : colors.foreground, fontSize: 13 }}>{d}</Text>
                </View>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>
    )
  }

  const handleSubmit = () => {
    if (!description.trim() || !amount || !accountId) return

    const parseToISO = (str: string) => {
      const p = str.split('/')
      if (p.length !== 3) return new Date().toISOString()
      return new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0])).toISOString()
    }

    const txData = {
      description: description.trim(),
      amount: parseFloat(amount.replace(',', '.')),
      type,
      date: parseToISO(date),
      accountId,
      tagIds: selectedTags,
      recurrence,
      paid,
      recurrenceStartDate: recurrence !== 'unica' ? parseToISO(recurrenceStart) : undefined,
      recurrenceEndDate: (recurrence !== 'unica' && recurrenceEnd) ? parseToISO(recurrenceEnd) : undefined,
    }

    if (isEditing && onUpdate) {
      onUpdate({ ...txData, id: transactionToEdit.id })
    } else {
      onAdd(txData)
    }
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 16 }]}>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.foreground} /></TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{isEditing ? 'Editar' : 'Novo Lançamento'}</Text>
          <TouchableOpacity onPress={handleSubmit} style={[styles.saveBtn, { backgroundColor: colors.primary }]}><Text style={styles.saveBtnText}>Salvar</Text></TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Tipo e Valor */}
          <View style={[styles.typeSelector, { backgroundColor: colors.secondary }]}>
            {(['receita', 'despesa', 'transferencia'] as TransactionType[]).map(t => (
              <TouchableOpacity key={t} style={[styles.typeBtn, type === t && { backgroundColor: t === 'receita' ? colors.success : t === 'despesa' ? colors.destructive : colors.primary }]} onPress={() => setType(t)}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: type === t ? '#FFF' : colors.mutedForeground }}>{t.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Valor</Text>
            <TextInput style={[styles.amountInput, { color: colors.foreground, borderBottomColor: colors.border }]} value={amount} onChangeText={setAmount} placeholder="0,00" keyboardType="decimal-pad" placeholderTextColor={colors.mutedForeground} />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Descrição</Text>
            <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} value={description} onChangeText={setDescription} placeholder="O que é?" placeholderTextColor={colors.mutedForeground} />
          </View>

          {/* Seletor de Data Principal */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Data do Lançamento</Text>
            <TouchableOpacity
              style={[styles.dateButton, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={() => setCalendarTarget(calendarTarget === 'main' ? null : 'main')}
            >
              <Text style={{ color: colors.foreground }}>{date}</Text>
              <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
            {calendarTarget === 'main' && renderCalendar()}
          </View>

          {/* Contas e Tags (Simplificado para o código) */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Conta</Text>
            <View style={styles.chipRow}>
              {accounts.map(acc => (
                <TouchableOpacity key={acc.id} style={[styles.chip, { borderColor: acc.color, backgroundColor: accountId === acc.id ? acc.color : 'transparent' }]} onPress={() => setAccountId(acc.id)}>
                  <Text style={{ fontSize: 12, color: accountId === acc.id ? '#FFF' : acc.color }}>{acc.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Recorrência */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Recorrência</Text>
            <View style={styles.chipRow}>
              {RECURRENCE_OPTIONS.map(opt => (
                <TouchableOpacity key={opt.value} style={[styles.chip, { borderColor: colors.primary, backgroundColor: recurrence === opt.value ? colors.primary : 'transparent' }]} onPress={() => setRecurrence(opt.value)}>
                  <Text style={{ fontSize: 12, color: recurrence === opt.value ? '#FFF' : colors.primary }}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {recurrence !== 'unica' && (
            <View style={{ gap: 12 }}>
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Inicia em</Text>
                <TouchableOpacity
                  style={[styles.dateButton, { borderColor: colors.border, backgroundColor: colors.card }]}
                  onPress={() => setCalendarTarget(calendarTarget === 'start' ? null : 'start')}
                >
                  <Text style={{ color: colors.foreground }}>{recurrenceStart}</Text>
                  <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
                {calendarTarget === 'start' && renderCalendar()}
              </View>

              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Termina em (Opcional)</Text>
                <TouchableOpacity
                  style={[styles.dateButton, { borderColor: colors.border, backgroundColor: colors.card }]}
                  onPress={() => setCalendarTarget(calendarTarget === 'end' ? null : 'end')}
                >
                  <Text style={{ color: colors.foreground }}>{recurrenceEnd || 'Não definido'}</Text>
                  <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
                {calendarTarget === 'end' && renderCalendar()}
              </View>
            </View>
          )}

          <View style={styles.switchRow}>
            <Text style={{ color: colors.foreground, fontWeight: '500' }}>Pago / Recebido</Text>
            <Switch value={paid} onValueChange={setPaid} trackColor={{ false: colors.border, true: colors.primary }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  saveBtnText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  content: { padding: 20, gap: 20 },
  typeSelector: { flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4 },
  typeBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  field: { gap: 6 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  amountInput: { fontSize: 32, fontWeight: '700', borderBottomWidth: 1, paddingBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
  dateButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingVertical: 10 },
  // Estilos do Calendário
  calendarBox: { marginTop: 8, borderRadius: 12, padding: 12, borderWidth: 1 },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  calendarMonthText: { fontWeight: '700', fontSize: 14 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarDayCell: { width: '14.28%', alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  dayInner: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }
})