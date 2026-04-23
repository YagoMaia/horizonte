// components/AddTransactionModal.tsx
import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
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
  const [date, setDate] = useState(getFormattedDate(0))
  const [showCalendar, setShowCalendar] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [recurrenceStart, setRecurrenceStart] = useState(getFormattedDate(0))
  const [recurrenceEnd, setRecurrenceEnd] = useState('')

  const resetState = () => {
    setType('despesa')
    setDescription('')
    setAmount('')
    setAccountId(accounts[0]?.id ?? '')
    setSelectedTags([])
    setRecurrence('unica')
    setPaid(true)
    setDate(getFormattedDate(0))
    setShowCalendar(false)
    setRecurrenceStart(getFormattedDate(0))
    setRecurrenceEnd('')
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

    const parts = date.split('/')
    if (parts.length === 3 && parts[2].length === 4) {
      const [day, month, year] = parts
      const parsedDate = new Date(Number(year), Number(month) - 1, Number(day))
      if (!isNaN(parsedDate.getTime())) {
        setCalendarMonth(parsedDate)
      }
    }
  }, [visible, transactionToEdit, date])

  const renderCalendar = () => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstDayOfWeek = new Date(year, month, 1).getDay()

    const days = []
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null)
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i)
    }

    const today = new Date()
    let parsedCurrentDate = new Date()
    const parts = date.split('/')
    if (parts.length === 3 && parts[2].length === 4) {
      parsedCurrentDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]))
    }

    return (
      <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, marginTop: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <TouchableOpacity onPress={() => setCalendarMonth(new Date(year, month - 1, 1))} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={{ fontWeight: '600', color: colors.foreground }}>
            {MONTHS[month]} {year}
          </Text>
          <TouchableOpacity onPress={() => setCalendarMonth(new Date(year, month + 1, 1))} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-forward" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {WEEK_DAYS.map((wd, i) => (
            <View key={`wd-${i}`} style={{ width: '14.28%', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '500', color: colors.mutedForeground }}>{wd.charAt(0)}</Text>
            </View>
          ))}
          {days.map((d, i) => {
            if (!d) return <View key={`empty-${i}`} style={{ width: '14.28%' }} />
            const isSelected = parsedCurrentDate.getDate() === d && parsedCurrentDate.getMonth() === month && parsedCurrentDate.getFullYear() === year
            const isToday = today.getDate() === d && today.getMonth() === month && today.getFullYear() === year
            return (
              <TouchableOpacity
                key={`day-${d}`}
                style={{ width: '14.28%', alignItems: 'center', paddingVertical: 6 }}
                onPress={() => {
                  setDate(`${String(d).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`)
                  setShowCalendar(false)
                }}
              >
                <View style={{
                  width: 30, height: 30, borderRadius: 15,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: isSelected ? colors.primary : 'transparent',
                  borderWidth: isToday && !isSelected ? 1 : 0,
                  borderColor: colors.primary
                }}>
                  <Text style={{
                    color: isSelected ? '#FFF' : colors.foreground,
                    fontWeight: isSelected || isToday ? '600' : '400'
                  }}>{d}</Text>
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

    let isoDate = new Date().toISOString()
    const parts = date.split('/')
    if (parts.length === 3 && parts[2].length === 4) {
      const [day, month, year] = parts
      isoDate = new Date(Number(year), Number(month) - 1, Number(day)).toISOString()
    }

    let isoRecurrenceStart;
    if (recurrenceStart) {
      const rsParts = recurrenceStart.split('/')
      if (rsParts.length === 3) isoRecurrenceStart = new Date(Number(rsParts[2]), Number(rsParts[1]) - 1, Number(rsParts[0])).toISOString()
    }

    let isoRecurrenceEnd;
    if (recurrenceEnd) {
      const reParts = recurrenceEnd.split('/')
      if (reParts.length === 3) isoRecurrenceEnd = new Date(Number(reParts[2]), Number(reParts[1]) - 1, Number(reParts[0])).toISOString()
    }

    const txData = {
      description: description.trim(),
      amount: parseFloat(amount.replace(',', '.')),
      type,
      date: isoDate,
      accountId,
      tagIds: selectedTags,
      recurrence,
      paid,
      recurrenceStartDate: recurrence !== 'unica' ? isoRecurrenceStart : undefined,
      recurrenceEndDate: recurrence !== 'unica' && isoRecurrenceEnd ? isoRecurrenceEnd : undefined,
    }

    if (isEditing && onUpdate) {
      onUpdate({ ...txData, id: transactionToEdit.id })
    } else {
      onAdd(txData)
    }

    onClose()
  }

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    )
  }

  const typeColors: Record<TransactionType, string> = {
    receita: colors.success,
    despesa: colors.destructive,
    transferencia: colors.primary,
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 16 }]}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{isEditing ? 'Editar Transação' : 'Nova Transação'}</Text>
          <TouchableOpacity
            onPress={handleSubmit}
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.saveBtnText}>Salvar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Type selector */}
          <View style={[styles.typeSelector, { backgroundColor: colors.secondary }]}>
            {(['receita', 'despesa', 'transferencia'] as TransactionType[]).map(t => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.typeBtn,
                  type === t && { backgroundColor: typeColors[t] }
                ]}
                onPress={() => setType(t)}
              >
                <Text style={[
                  styles.typeBtnText,
                  { color: type === t ? '#FFF' : colors.mutedForeground }
                ]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Amount */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Valor (R$)</Text>
            <TextInput
              style={[styles.amountInput, { color: typeColors[type], borderBottomColor: typeColors[type] }]}
              value={amount}
              onChangeText={setAmount}
              placeholder="0,00"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
            />
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Descrição</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Ex: Supermercado, Salário..."
              placeholderTextColor={colors.mutedForeground}
            />
          </View>

          {/* Date */}
          <View style={styles.field}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Data</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity onPress={() => { setDate(getFormattedDate(-1)); setShowCalendar(false) }}>
                  <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600' }}>Ontem</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setDate(getFormattedDate(0)); setShowCalendar(false) }}>
                  <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600' }}>Hoje</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setDate(getFormattedDate(1)); setShowCalendar(false) }}>
                  <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600' }}>Amanhã</Text>
                </TouchableOpacity>
              </View>
            </View>
            {showCalendar ? (
              renderCalendar()
            ) : (
              <TouchableOpacity
                style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => setShowCalendar(true)}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.foreground, fontSize: 15 }}>{date}</Text>
                <Ionicons name="calendar-outline" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>

          {/* Account selector */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Conta</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {accounts.map(acc => (
                  <TouchableOpacity
                    key={acc.id}
                    style={[
                      styles.chip,
                      { borderColor: acc.color, backgroundColor: accountId === acc.id ? acc.color : 'transparent' }
                    ]}
                    onPress={() => setAccountId(acc.id)}
                  >
                    <Text style={[styles.chipText, { color: accountId === acc.id ? '#FFF' : acc.color }]}>
                      {acc.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Tags */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Tags</Text>
            <View style={styles.chipRow}>
              {tags.map(tag => (
                <TouchableOpacity
                  key={tag.id}
                  style={[
                    styles.chip,
                    { borderColor: tag.color, backgroundColor: selectedTags.includes(tag.id) ? tag.color : 'transparent' }
                  ]}
                  onPress={() => toggleTag(tag.id)}
                >
                  <Text style={[styles.chipText, { color: selectedTags.includes(tag.id) ? '#FFF' : tag.color }]}>
                    {tag.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Recurrence */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Recorrência</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {RECURRENCE_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.chip,
                      {
                        borderColor: colors.primary,
                        backgroundColor: recurrence === opt.value ? colors.primary : 'transparent'
                      }
                    ]}
                    onPress={() => setRecurrence(opt.value)}
                  >
                    <Text style={[
                      styles.chipText,
                      { color: recurrence === opt.value ? '#FFF' : colors.primary }
                    ]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Recurrence Dates */}
          {recurrence !== 'unica' && (
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Início da Recorrência</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                value={recurrenceStart}
                onChangeText={setRecurrenceStart}
                placeholder="DD/MM/AAAA"
                placeholderTextColor={colors.mutedForeground}
              />

              <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 8 }]}>Fim da Recorrência (Opcional)</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                value={recurrenceEnd}
                onChangeText={setRecurrenceEnd}
                placeholder="DD/MM/AAAA"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          )}

          {/* Paid toggle */}
          <View style={[styles.row, { borderTopColor: colors.border }]}>
            <View>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>Lançado</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>Afeta saldo atual</Text>
            </View>
            <Switch
              value={paid}
              onValueChange={setPaid}
              trackColor={{ false: colors.border, true: colors.primary + '66' }}
              thumbColor={paid ? colors.primary : colors.mutedForeground}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
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
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveBtnText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  content: {
    padding: 20,
    gap: 20,
  },
  typeSelector: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  typeBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountInput: {
    fontSize: 40,
    fontWeight: '700',
    borderBottomWidth: 2,
    paddingBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  rowSub: {
    fontSize: 12,
    marginTop: 2,
  },
})
