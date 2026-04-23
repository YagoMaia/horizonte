// components/screens/ContasScreen.tsx
import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/hooks/useTheme'
import { useStoreContext } from '@/context/StoreContext'
import { formatCurrency } from '@/lib/utils'
import { Account } from '@/constants/types'

const ACCOUNT_COLORS = [
  '#42A5F5', '#66BB6A', '#FFA726', '#AB47BC',
  '#FF7043', '#26C6DA', '#EF5350', '#8D6E63',
]

const ACCOUNT_ICONS: { icon: string; label: string }[] = [
  { icon: 'card', label: 'Cartão' },
  { icon: 'leaf', label: 'Poupança' },
  { icon: 'wallet', label: 'Carteira' },
  { icon: 'business', label: 'Empresa' },
  { icon: 'trending-up', label: 'Invest.' },
  { icon: 'cash', label: 'Dinheiro' },
]

// 👉 ATUALIZAÇÃO AQUI: Adicionado 'cartao_credito'
const ACCOUNT_TYPES: { value: Account['type']; label: string }[] = [
  { value: 'corrente', label: 'Conta Corrente' },
  { value: 'cartao_credito', label: 'Cartão de Crédito' },
  { value: 'poupanca', label: 'Poupança' },
  { value: 'investimento', label: 'Investimento' },
  { value: 'carteira', label: 'Carteira' },
]

export function ContasScreen() {
  const { colors } = useTheme()
  const { accounts, totalBalance, saveAccounts } = useStoreContext()
  const insets = useSafeAreaInsets()

  const [modalVisible, setModalVisible] = useState(false)
  const [editAccount, setEditAccount] = useState<Account | null>(null)
  const [name, setName] = useState('')
  const [balance, setBalance] = useState('')
  const [type, setType] = useState<Account['type']>('corrente')
  const [selectedColor, setSelectedColor] = useState(ACCOUNT_COLORS[0])
  const [selectedIcon, setSelectedIcon] = useState('card')

  const openAdd = () => {
    setEditAccount(null)
    setName('')
    setBalance('')
    setType('corrente')
    setSelectedColor(ACCOUNT_COLORS[0])
    setSelectedIcon('card')
    setModalVisible(true)
  }

  const openEdit = (acc: Account) => {
    setEditAccount(acc)
    setName(acc.name)
    setBalance(acc.balance.toString())
    setType(acc.type)
    setSelectedColor(acc.color)
    setSelectedIcon(acc.icon)
    setModalVisible(true)
  }

  const handleSave = async () => {
    if (!name.trim()) return
    const parsedBalance = parseFloat(balance.replace(',', '.')) || 0

    if (editAccount) {
      const updated = accounts.map(a =>
        a.id === editAccount.id
          ? { ...a, name: name.trim(), balance: parsedBalance, type, color: selectedColor, icon: selectedIcon }
          : a
      )
      await saveAccounts(updated)
    } else {
      const newAccount: Account = {
        id: Date.now().toString(),
        name: name.trim(),
        balance: parsedBalance,
        type,
        color: selectedColor,
        icon: selectedIcon,
      }
      await saveAccounts([...accounts, newAccount])
    }
    setModalVisible(false)
  }

  const handleDelete = (acc: Account) => {
    if (accounts.length <= 1) {
      Alert.alert('Atenção', 'Você precisa ter pelo menos uma conta.')
      return
    }
    Alert.alert(
      'Excluir conta',
      `Tem certeza que deseja excluir "${acc.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await saveAccounts(accounts.filter(a => a.id !== acc.id))
          },
        },
      ]
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Total */}
        <View style={[styles.totalCard, { backgroundColor: colors.primary }]}>
          <Text style={styles.totalLabel}>Patrimônio Total</Text>
          <Text style={styles.totalValue}>{formatCurrency(totalBalance)}</Text>
          <Text style={styles.totalSub}>{accounts.length} conta{accounts.length !== 1 ? 's' : ''}</Text>
        </View>

        {/* Header row */}
        <View style={styles.headerRow}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Minhas Contas</Text>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={openAdd}
          >
            <Ionicons name="add" size={18} color="#FFF" />
            <Text style={styles.addBtnText}>Nova conta</Text>
          </TouchableOpacity>
        </View>

        {/* Accounts list */}
        <View style={styles.accountsList}>
          {accounts.map(acc => {
            const typeLabel = ACCOUNT_TYPES.find(t => t.value === acc.type)?.label ?? acc.type
            return (
              <View
                key={acc.id}
                style={[styles.accountCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                {/* Left accent bar */}
                <View style={[styles.accent, { backgroundColor: acc.color }]} />

                <View style={[styles.iconWrap, { backgroundColor: acc.color + '20' }]}>
                  <Ionicons name={acc.icon as any} size={22} color={acc.color} />
                </View>

                <View style={styles.accountInfo}>
                  <Text style={[styles.accountName, { color: colors.foreground }]}>{acc.name}</Text>
                  <Text style={[styles.accountType, { color: colors.mutedForeground }]}>{typeLabel}</Text>
                </View>

                <View style={styles.accountRight}>
                  <Text style={[
                    styles.accountBalance,
                    { color: acc.balance < 0 ? colors.destructive : colors.foreground }
                  ]}>
                    {formatCurrency(acc.balance)}
                  </Text>
                  <View style={styles.accountActions}>
                    <TouchableOpacity
                      onPress={() => openEdit(acc)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="pencil-outline" size={16} color={colors.mutedForeground} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(acc)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )
          })}
        </View>
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[styles.modal, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {editAccount ? 'Editar conta' : 'Nova conta'}
            </Text>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
              onPress={handleSave}
            >
              <Text style={styles.saveBtnText}>Salvar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Preview */}
            <View style={[styles.preview, { backgroundColor: selectedColor + '20', borderColor: selectedColor + '40' }]}>
              <View style={[styles.previewIcon, { backgroundColor: selectedColor }]}>
                <Ionicons name={selectedIcon as any} size={24} color="#FFF" />
              </View>
              <View>
                <Text style={[styles.previewName, { color: colors.foreground }]}>
                  {name || 'Nome da conta'}
                </Text>
                <Text style={[styles.previewBalance, { color: selectedColor }]}>
                  {balance ? formatCurrency(parseFloat(balance.replace(',', '.')) || 0) : 'R$ 0,00'}
                </Text>
              </View>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Nome</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={name}
              onChangeText={setName}
              placeholder="Ex: Nubank, Bradesco..."
              placeholderTextColor={colors.mutedForeground}
            />

            {/* Dica visual para Cartão de Crédito */}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
              {type === 'cartao_credito' ? 'Limite do Cartão (R$)' : 'Saldo Atual (R$)'}
            </Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={balance}
              onChangeText={setBalance}
              placeholder="0,00"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Tipo</Text>
            <View style={styles.typeGrid}>
              {ACCOUNT_TYPES.map(t => (
                <TouchableOpacity
                  key={t.value}
                  style={[
                    styles.typeChip,
                    {
                      borderColor: colors.border,
                      backgroundColor: type === t.value ? colors.primary : colors.card,
                    }
                  ]}
                  onPress={() => setType(t.value)}
                >
                  <Text style={[
                    styles.typeChipText,
                    { color: type === t.value ? '#FFF' : colors.foreground }
                  ]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Ícone</Text>
            <View style={styles.iconGrid}>
              {ACCOUNT_ICONS.map(item => (
                <TouchableOpacity
                  key={item.icon}
                  style={[
                    styles.iconItem,
                    {
                      backgroundColor: selectedIcon === item.icon ? selectedColor : colors.secondary,
                      borderColor: selectedIcon === item.icon ? selectedColor : 'transparent',
                    }
                  ]}
                  onPress={() => setSelectedIcon(item.icon)}
                >
                  <Ionicons
                    name={item.icon as any}
                    size={20}
                    color={selectedIcon === item.icon ? '#FFF' : colors.mutedForeground}
                  />
                  <Text style={[
                    styles.iconLabel,
                    { color: selectedIcon === item.icon ? '#FFF' : colors.mutedForeground }
                  ]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Cor</Text>
            <View style={styles.colorGrid}>
              {ACCOUNT_COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: color },
                    selectedColor === color && styles.colorSwatchSelected,
                  ]}
                  onPress={() => setSelectedColor(color)}
                >
                  {selectedColor === color && (
                    <Ionicons name="checkmark" size={16} color="#FFF" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  totalCard: {
    borderRadius: 20,
    padding: 24,
    gap: 4,
  },
  totalLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '500',
  },
  totalValue: {
    color: '#FFF',
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -1,
  },
  totalSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  accountsList: {
    gap: 10,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    paddingRight: 14,
    gap: 12,
  },
  accent: {
    width: 4,
    alignSelf: 'stretch',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
  },
  accountInfo: {
    flex: 1,
    gap: 3,
  },
  accountName: {
    fontSize: 15,
    fontWeight: '600',
  },
  accountType: {
    fontSize: 12,
  },
  accountRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  accountBalance: {
    fontSize: 16,
    fontWeight: '700',
  },
  accountActions: {
    flexDirection: 'row',
    gap: 14,
  },
  modal: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
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
  modalContent: {
    padding: 20,
    gap: 12,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 8,
  },
  previewIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewName: {
    fontSize: 16,
    fontWeight: '600',
  },
  previewBalance: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  iconItem: {
    width: 72,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 4,
    borderWidth: 1.5,
  },
  iconLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
})