// components/screens/orcamento/AllocationEditorModal.tsx
import React, { useState, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { BudgetAllocation } from '@/constants/types'

interface AllocationEditorModalProps {
  visible: boolean
  allocation: BudgetAllocation
  onClose: () => void
  onSave: (a: BudgetAllocation) => void
  colors: any
}

export function AllocationEditorModal({
  visible,
  allocation,
  onClose,
  onSave,
  colors,
}: AllocationEditorModalProps) {
  const [investimento, setInvestimento] = useState(String(allocation.investimento))
  const [fixo, setFixo] = useState(String(allocation.fixo))
  const [variavel, setVariavel] = useState(String(allocation.variavel))
  const [outros, setOutros] = useState(String(allocation.outros))

  React.useEffect(() => {
    if (visible) {
      setInvestimento(String(allocation.investimento))
      setFixo(String(allocation.fixo))
      setVariavel(String(allocation.variavel))
      setOutros(String(allocation.outros))
    }
  }, [visible, allocation])

  const total = useMemo(() => {
    const sum = [investimento, fixo, variavel, outros]
      .map((v) => parseFloat(v) || 0)
      .reduce((a, b) => a + b, 0)
    return Math.round(sum * 10) / 10
  }, [investimento, fixo, variavel, outros])

  const isValid = Math.abs(total - 100) <= 0.1

  const handleSave = () => {
    if (!isValid) {
      Alert.alert('Atenção', `A soma deve ser 100%. Atual: ${total}%`)
      return
    }
    onSave({
      investimento: parseFloat(investimento) || 0,
      fixo: parseFloat(fixo) || 0,
      variavel: parseFloat(variavel) || 0,
      outros: parseFloat(outros) || 0,
    })
    onClose()
  }

  const FIELDS: { label: string; color: string; value: string; setter: (v: string) => void }[] = [
    { label: 'Investimentos',    color: '#388E3C', value: investimento, setter: setInvestimento },
    { label: 'Gastos Fixos',     color: '#1976D2', value: fixo,         setter: setFixo },
    { label: 'Gastos Variáveis', color: '#F57C00', value: variavel,     setter: setVariavel },
    { label: 'Outras Demandas',  color: '#7B1FA2', value: outros,       setter: setOutros },
  ]

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>Configurar Divisão</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles.closeBtn, { color: colors.mutedForeground }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            Defina como deseja dividir seus ganhos. A soma deve ser exatamente 100%.
          </Text>

          {FIELDS.map(({ label, color, value, setter }) => (
            <View key={label} style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>{label}</Text>
              <View style={[styles.inputWrap, { borderColor: color, backgroundColor: color + '12' }]}>
                <TextInput
                  style={[styles.input, { color }]}
                  value={value}
                  onChangeText={setter}
                  keyboardType="decimal-pad"
                  maxLength={5}
                />
                <Text style={[styles.pctSign, { color }]}>%</Text>
              </View>
            </View>
          ))}

          <View style={[styles.totalRow, { borderColor: isValid ? '#388E3C' : '#D32F2F' }]}>
            <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Total</Text>
            <Text style={[styles.totalValue, { color: isValid ? '#388E3C' : '#D32F2F' }]}>
              {total}%
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: isValid ? '#388E3C' : colors.muted }]}
            onPress={handleSave}
            activeOpacity={0.85}
          >
            <Text style={styles.saveBtnText}>Salvar Divisão</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 17, fontWeight: '700' },
  closeBtn: { fontSize: 18 },
  hint: { fontSize: 13, marginBottom: 18, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  rowLabel: { fontSize: 14, fontWeight: '500', flex: 1 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 8 },
  input: { fontSize: 18, fontWeight: '700', minWidth: 44, textAlign: 'right' },
  pctSign: { fontSize: 16, fontWeight: '600', marginLeft: 2 },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1.5, borderRadius: 10, padding: 12, marginVertical: 8,
  },
  totalLabel: { fontSize: 14, fontWeight: '600' },
  totalValue: { fontSize: 20, fontWeight: '800' },
  saveBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8, marginBottom: 4 },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
})
