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
import { TransactionType, RecurrenceType } from '@/constants/types'

interface AddTransactionModalProps {
  visible: boolean
  onClose: () => void
  onAdd: (tx: any) => void
  accounts: any[]
  tags: any[]
}

const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: 'unica', label: 'Única' },
  { value: 'diaria', label: 'Diária' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'anual', label: 'Anual' },
]

export function AddTransactionModal({ visible, onClose, onAdd, accounts, tags }: AddTransactionModalProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()

  const [type, setType] = useState<TransactionType>('despesa')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [recurrence, setRecurrence] = useState<RecurrenceType>('unica')
  const [paid, setPaid] = useState(true)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  const handleSubmit = () => {
    if (!description.trim() || !amount || !accountId) return
    onAdd({
      description: description.trim(),
      amount: parseFloat(amount.replace(',', '.')),
      type,
      date: new Date(date).toISOString(),
      accountId,
      tagIds: selectedTags,
      recurrence,
      paid,
    })
    // Reset
    setDescription('')
    setAmount('')
    setSelectedTags([])
    setRecurrence('unica')
    setPaid(true)
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
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Nova Transação</Text>
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
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Data</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={date}
              onChangeText={setDate}
              placeholder="AAAA-MM-DD"
              placeholderTextColor={colors.mutedForeground}
            />
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
