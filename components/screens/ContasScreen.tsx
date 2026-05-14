// components/screens/ContasScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useStoreContext } from '@/context/StoreContext';
import { formatCurrency } from '@/lib/utils';
import { Account } from '@/constants/types';

const ACCOUNT_COLORS = [
  '#42A5F5',
  '#66BB6A',
  '#FFA726',
  '#AB47BC',
  '#FF7043',
  '#26C6DA',
  '#EF5350',
  '#8D6E63',
];

const ACCOUNT_ICONS: { icon: string; label: string }[] = [
  { icon: 'card', label: 'Cartão' },
  { icon: 'leaf', label: 'Poupança' },
  { icon: 'wallet', label: 'Carteira' },
  { icon: 'business', label: 'Empresa' },
  { icon: 'trending-up', label: 'Invest.' },
  { icon: 'cash', label: 'Dinheiro' },
];

const ACCOUNT_TYPES: { value: Account['type']; label: string }[] = [
  { value: 'corrente', label: 'Conta Corrente' },
  { value: 'cartao_credito', label: 'Cartão de Crédito' },
  { value: 'poupanca', label: 'Poupança' },
  { value: 'investimento', label: 'Investimento' },
  { value: 'carteira', label: 'Carteira' },
];

export function ContasScreen() {
  const { colors } = useTheme();
  const { accounts, totalBalance, addAccount, updateAccount, deleteAccount, setPrimaryAccount } = useStoreContext();
  const insets = useSafeAreaInsets();

  const [modalVisible, setModalVisible] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [type, setType] = useState<Account['type']>('corrente');
  const [selectedColor, setSelectedColor] = useState(ACCOUNT_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState('card');

  // 👉 ESTADOS DO CARTÃO DE CRÉDITO
  const [closingDay, setClosingDay] = useState('');
  const [dueDay, setDueDay] = useState('');

  const openAdd = () => {
    setEditAccount(null);
    setName('');
    setBalance('');
    setType('corrente');
    setSelectedColor(ACCOUNT_COLORS[0]);
    setSelectedIcon('card');
    setClosingDay('');
    setDueDay('');
    setModalVisible(true);
  };

  const openEdit = (acc: Account) => {
    setEditAccount(acc);
    setName(acc.name);
    // Se for cartão, o balance não é usado na mesma forma (saldo é sempre derivado da fatura)
    setBalance(
      acc.type === 'cartao_credito'
        ? ''
        : acc.balance.toString(),
    );
    setType(acc.type);
    setSelectedColor(acc.color);
    setSelectedIcon(acc.icon);
    setClosingDay(acc.closingDay ? acc.closingDay.toString() : '');
    setDueDay(acc.dueDay ? acc.dueDay.toString() : '');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;

    // 👉 LÓGICA DE SALVAMENTO SEPARADA
    let parsedBalance = 0;
    let finalClosingDay: number | undefined = undefined;
    let finalDueDay: number | undefined = undefined;

    if (type === 'cartao_credito') {
      const parsedClosing = parseInt(closingDay, 10);
      const parsedDue = parseInt(dueDay, 10);

      // Validação Brutal: Se os dados vitais do cartão não existirem, bloqueia.
      if (isNaN(parsedClosing) || isNaN(parsedDue)) {
        Alert.alert(
          'Erro',
          'Para Cartões de Crédito, o Dia de Fechamento e o Vencimento são obrigatórios.',
        );
        return;
      }

      if (
        parsedClosing < 1 ||
        parsedClosing > 31 ||
        parsedDue < 1 ||
        parsedDue > 31
      ) {
        Alert.alert(
          'Erro',
          'Os dias de fechamento e vencimento devem estar entre 1 e 31.',
        );
        return;
      }

      parsedBalance = 0; // O saldo (liquidez) de um cartão recém criado é sempre 0
      finalClosingDay = parsedClosing;
      finalDueDay = parsedDue;
    } else {
      parsedBalance = parseFloat(balance.replace(',', '.')) || 0;
    }

    if (editAccount) {
      const updatedAcc: Account = {
        ...editAccount,
        name: name.trim(),
        balance: type === 'cartao_credito' ? editAccount.balance : parsedBalance,
        type,
        color: selectedColor,
        icon: selectedIcon,
        closingDay: finalClosingDay,
        dueDay: finalDueDay,
      };

      const hasBalanceChanged = type !== 'cartao_credito' && parsedBalance !== editAccount.balance;

      if (hasBalanceChanged) {
        if (Platform.OS === 'web') {
          const choice = window.confirm(
            `O saldo mudou de ${editAccount.balance} para ${parsedBalance}.\n\nClique em OK para "Lançar Ajuste" (mantém histórico).\nClique em CANCELAR para "Apenas Sincronizar" (corrige dessync de cache).`
          );
          await updateAccount(updatedAcc, !choice);
        } else {
          Alert.alert(
            'Alteração de Saldo',
            'Como você deseja processar essa mudança?',
            [
              {
                text: 'Lançar Ajuste',
                onPress: async () => await updateAccount(updatedAcc, false),
              },
              {
                text: 'Apenas Sincronizar',
                onPress: async () => await updateAccount(updatedAcc, true),
              },
              { text: 'Cancelar', style: 'cancel' },
            ]
          );
        }
      } else {
        await updateAccount(updatedAcc);
      }
    } else {
      const newAccount: Account = {
        id: Date.now().toString(),
        name: name.trim(),
        balance: parsedBalance,
        type,
        color: selectedColor,
        icon: selectedIcon,
        closingDay: finalClosingDay,
        dueDay: finalDueDay,
      };
      await addAccount(newAccount);
    }
    setModalVisible(false);
  };

  const handleDelete = (acc: Account) => {
    if (accounts.length <= 1) {
      Alert.alert('Atenção', 'Você precisa ter pelo menos uma conta.');
      return;
    }

    const performDelete = async () => {
      await deleteAccount(acc.id);
    };

    if (Platform.OS === 'web') {
      if (
        window.confirm(
          `Tem certeza que deseja excluir "${acc.name}"? Isso não apagará as transações associadas.`,
        )
      ) {
        performDelete();
      }
    } else {
      Alert.alert(
        'Excluir conta',
        `Tem certeza que deseja excluir "${acc.name}"? Isso não apagará as transações associadas.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Excluir',
            style: 'destructive',
            onPress: performDelete,
          },
        ],
      );
    }
  };

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
          <Text style={styles.totalSub}>
            {accounts.length} conta{accounts.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Header row */}
        <View style={styles.headerRow}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Minhas Contas
          </Text>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={openAdd}
          >
            <Ionicons name='add' size={18} color='#FFF' />
            <Text style={styles.addBtnText}>Nova conta</Text>
          </TouchableOpacity>
        </View>

        {/* Accounts list */}
        <View style={styles.accountsList}>
          {accounts.map((acc) => {
            const typeLabel =
              ACCOUNT_TYPES.find((t) => t.value === acc.type)?.label ??
              acc.type;
            return (
              <View
                key={acc.id}
                style={[
                  styles.accountCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={[styles.accent, { backgroundColor: acc.color }]} />
                <View
                  style={[
                    styles.iconWrap,
                    { backgroundColor: acc.color + '20' },
                  ]}
                >
                  <Ionicons
                    name={acc.icon as any}
                    size={22}
                    color={acc.color}
                  />
                </View>
                <View style={styles.accountInfo}>
                  <Text
                    style={[styles.accountName, { color: colors.foreground }]}
                  >
                    {acc.name}
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
                  {acc.type === 'cartao_credito' ? (
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
                            acc.balance < 0
                              ? colors.destructive
                              : colors.foreground,
                        },
                      ]}
                    >
                      {formatCurrency(acc.balance)}
                    </Text>
                  )}

                  <View style={styles.accountActions}>
                    {acc.id !== accounts[0]?.id && (
                      <TouchableOpacity
                        onPress={() => setPrimaryAccount(acc.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name='star-outline'
                          size={16}
                          color={colors.primary}
                        />
                      </TouchableOpacity>
                    )}
                    {acc.id === accounts[0]?.id && (
                      <Ionicons
                        name='star'
                        size={16}
                        color={colors.primary}
                      />
                    )}
                    <TouchableOpacity
                      onPress={() => openEdit(acc)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name='pencil-outline'
                        size={16}
                        color={colors.mutedForeground}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(acc)}
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
          })}
        </View>
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType='slide'
        presentationStyle='pageSheet'
        onRequestClose={() => setModalVisible(false)}
      >
        <View
          style={[
            styles.modal,
            { backgroundColor: colors.background, paddingTop: insets.top + 16 },
          ]}
        >
          <View
            style={[styles.modalHeader, { borderBottomColor: colors.border }]}
          >
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name='close' size={24} color={colors.foreground} />
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

          <ScrollView
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            <Text
              style={[styles.fieldLabel, { color: colors.mutedForeground }]}
            >
              Tipo
            </Text>
            <View style={styles.typeGrid}>
              {ACCOUNT_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[
                    styles.typeChip,
                    {
                      borderColor: colors.border,
                      backgroundColor:
                        type === t.value ? colors.primary : colors.card,
                    },
                  ]}
                  onPress={() => setType(t.value)}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      { color: type === t.value ? '#FFF' : colors.foreground },
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text
              style={[
                styles.fieldLabel,
                { color: colors.mutedForeground, marginTop: 12 },
              ]}
            >
              Nome
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
              value={name}
              onChangeText={setName}
              placeholder='Ex: Nubank, Bradesco...'
              placeholderTextColor={colors.mutedForeground}
            />

            {type !== 'cartao_credito' && (
              <>
                <Text
                  style={[styles.fieldLabel, { color: colors.mutedForeground }]}
                >
                  Saldo Atual (R$)
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
                  value={balance}
                  onChangeText={setBalance}
                  placeholder='0,00'
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType='decimal-pad'
                />
              </>
            )}

            {/* 👉 CAMPOS EXCLUSIVOS DO CARTÃO DE CRÉDITO */}
            {type === 'cartao_credito' && (
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.fieldLabel,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    Dia Fecha
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
                    value={closingDay}
                    onChangeText={setClosingDay}
                    placeholder='Ex: 25'
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType='number-pad'
                    maxLength={2}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.fieldLabel,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    Dia Vence
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
                    value={dueDay}
                    onChangeText={setDueDay}
                    placeholder='Ex: 5'
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType='number-pad'
                    maxLength={2}
                  />
                </View>
              </View>
            )}

            <Text
              style={[
                styles.fieldLabel,
                { color: colors.mutedForeground, marginTop: 12 },
              ]}
            >
              Ícone
            </Text>
            <View style={styles.iconGrid}>
              {ACCOUNT_ICONS.map((item) => (
                <TouchableOpacity
                  key={item.icon}
                  style={[
                    styles.iconItem,
                    {
                      backgroundColor:
                        selectedIcon === item.icon
                          ? selectedColor
                          : colors.secondary,
                      borderColor:
                        selectedIcon === item.icon
                          ? selectedColor
                          : 'transparent',
                    },
                  ]}
                  onPress={() => setSelectedIcon(item.icon)}
                >
                  <Ionicons
                    name={item.icon as any}
                    size={20}
                    color={
                      selectedIcon === item.icon
                        ? '#FFF'
                        : colors.mutedForeground
                    }
                  />
                  <Text
                    style={[
                      styles.iconLabel,
                      {
                        color:
                          selectedIcon === item.icon
                            ? '#FFF'
                            : colors.mutedForeground,
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text
              style={[styles.fieldLabel, { color: colors.mutedForeground }]}
            >
              Cor
            </Text>
            <View style={styles.colorGrid}>
              {ACCOUNT_COLORS.map((color) => (
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
                    <Ionicons name='checkmark' size={16} color='#FFF' />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  totalCard: { borderRadius: 20, padding: 24, gap: 4 },
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
  totalSub: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  accountsList: { gap: 10 },
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
  accountActions: { flexDirection: 'row', gap: 14 },
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 17, fontWeight: '600' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  saveBtnText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  modalContent: { padding: 20, gap: 12 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  typeChipText: { fontSize: 13, fontWeight: '500' },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  iconItem: {
    width: 72,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 4,
    borderWidth: 1.5,
  },
  iconLabel: { fontSize: 10, fontWeight: '500' },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
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
});
