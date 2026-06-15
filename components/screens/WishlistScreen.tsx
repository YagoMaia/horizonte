// components/screens/WishlistScreen.tsx
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useStoreContext } from '@/context/StoreContext';
import { WishlistItem, PaymentPreference } from '@/constants/types';
import { WishlistItemCard } from '@/components/wishlist/WishlistItemCard';
import { ItemBreakdownSheet } from '@/components/wishlist/ItemBreakdownSheet';
import { useRouter } from 'expo-router';

type FilterType = 'todos' | 'PENDENTE' | 'COMPRADO';

export function WishlistScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const {
    wishlist,
    addWishlistItem,
    deleteWishlistItem,
    markAsBought,
    addTransaction,
    calculateAvailableCash,
    userSettings,
    updateUserSettings,
    accounts,
    toggleSimulatorAccount,
    selectSimulatorCreditCard,
    evaluateItemAffordability,
    getMonthBreakdown,
  } = useStoreContext();

  const [breakdownModalVisible, setBreakdownModalVisible] = useState(false);
  const [selectedItemForBreakdown, setSelectedItemForBreakdown] = useState<WishlistItem | null>(null);
  const [currentBreakdownData, setCurrentBreakdownData] = useState<any | null>(null);
  const [targetMonthIndex, setTargetMonthIndex] = useState(new Date().getMonth());
  const [currentSuggestedMessage, setCurrentSuggestedMessage] = useState<string>('');
  const [currentAvailableAtPress, setCurrentAvailableAtPress] = useState<number>(0);
  const [currentCreditData, setCurrentCreditData] = useState<any | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAccountsModal, setShowAccountsModal] = useState(false);

  // Add form
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newPreference, setNewPreference] = useState<PaymentPreference>('QUALQUER');
  const [newInstallments, setNewInstallments] = useState<string>('2');

  // Settings form
  const [settingsDailyAllowance, setSettingsDailyAllowance] = useState('');
  const [settingsSafetyMargin, setSettingsSafetyMargin] = useState('');
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const [tempMaxSpend, setTempMaxSpend] = useState('');
  const [tempCreditSafetyMargin, setTempCreditSafetyMargin] = useState('');

  // Filter
  const [filter, setFilter] = useState<FilterType>('todos');

  const availableCash = useMemo(() => calculateAvailableCash(), [calculateAvailableCash]);

  const filteredWishlist = useMemo(() => {
    const sorted = [...wishlist].sort((a, b) => {
      if (a.status === 'COMPRADO' && b.status !== 'COMPRADO') return 1;
      if (a.status !== 'COMPRADO' && b.status === 'COMPRADO') return -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    if (filter === 'todos') return sorted;
    return sorted.filter(i => i.status === filter);
  }, [wishlist, filter]);

  const pendingTotal = useMemo(() => {
    return wishlist
      .filter(i => i.status === 'PENDENTE')
      .reduce((sum, i) => sum + i.price, 0);
  }, [wishlist]);

  const formatCurrencyMask = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    const amountNumber = Number(cleanValue) / 100;
    return amountNumber.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseCurrency = (value: string): number => {
    return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
  };

  const handleAddItem = useCallback(async () => {
    if (!newName.trim() || !newPrice.trim()) return;
    const price = parseCurrency(newPrice);
    if (price <= 0) return;

    await addWishlistItem({
      name: newName.trim(),
      price,
      paymentPreference: newPreference,
      installments: newPreference === 'CREDITO' ? (parseInt(newInstallments) || 2) : undefined,
    });
    
    setNewName('');
    setNewPrice('');
    setNewPreference('QUALQUER');
    setNewInstallments('2');
    setShowAddModal(false);
  }, [newName, newPrice, newPreference, newInstallments, addWishlistItem]);

  const handleDeleteItem = useCallback((item: WishlistItem) => {
    Alert.alert(
      'Remover item',
      `Deseja remover "${item.name}" da lista de desejos?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => deleteWishlistItem(item.id),
        },
      ]
    );
  }, [deleteWishlistItem]);

  const handleBuyPress = useCallback((item: WishlistItem) => {
    const defaultAccount = accounts.find(a => a.type !== 'cartao_credito');
    router.push({
      pathname: '/add-transaction',
      params: {
        accountId: defaultAccount?.id,
        type: 'despesa',
        wishlistId: item.id,
        initialDescription: item.name,
        initialAmount: item.price.toString(),
      }
    });
  }, [router, accounts]);

  const handleOpenSettings = useCallback(() => {
    setSettingsDailyAllowance(
      userSettings.dailyAllowance > 0
        ? formatCurrencyMask(String(Math.round(userSettings.dailyAllowance * 100)))
        : ''
    );
    setSettingsSafetyMargin(
      userSettings.safetyMargin > 0
        ? formatCurrencyMask(String(Math.round(userSettings.safetyMargin * 100)))
        : ''
    );
    setShowSettingsModal(true);
  }, [userSettings]);

  const handleSaveSettings = useCallback(() => {
    updateUserSettings({
      dailyAllowance: parseCurrency(settingsDailyAllowance),
      safetyMargin: parseCurrency(settingsSafetyMargin),
    });
    setShowSettingsModal(false);
  }, [settingsDailyAllowance, settingsSafetyMargin, updateUserSettings]);

  const handleSaveMaxSpend = useCallback(() => {
    updateUserSettings({
      maxMonthlyCreditSpend: Number(tempMaxSpend) || undefined,
      creditSafetyMargin: Number(tempCreditSafetyMargin) || 0,
    });
    setIsSettingsModalVisible(false);
  }, [tempMaxSpend, tempCreditSafetyMargin, updateUserSettings]);

  const handleItemPress = useCallback((item: WishlistItem) => {
    if (item.status === 'COMPRADO') return;

    const { status, bestFutureMonth, suggestedMessage, currentAvailable, creditData } = evaluateItemAffordability(item.price, item.paymentPreference, item.installments);
    
    let targetMonth = new Date().getMonth();
    if (status !== 'VERDE' && bestFutureMonth !== undefined) {
      targetMonth = bestFutureMonth;
    }
    
    setSelectedItemForBreakdown(item);
    setCurrentBreakdownData(getMonthBreakdown(targetMonth, new Date().getFullYear()));
    setTargetMonthIndex(targetMonth);
    setCurrentSuggestedMessage(suggestedMessage);
    setCurrentAvailableAtPress(currentAvailable);
    setCurrentCreditData(creditData || null);
    setSelectedItemForBreakdown(item);
    setBreakdownModalVisible(true);
  }, [evaluateItemAffordability, getMonthBreakdown]);
  const renderHeader = () => {
    const maxSpend = userSettings.maxMonthlyCreditSpend || Infinity;
    const creditMargin = userSettings.creditSafetyMargin || 0;
    const effectiveMax = maxSpend === Infinity ? 'Sem Teto' : `R$ ${(maxSpend - creditMargin).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    return (
    <View style={styles.headerSection}>
      {/* Budget Card */}
      <View style={[styles.budgetCard, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}>
        <View style={styles.budgetRow}>
          <View style={styles.budgetItem}>
            <Text style={[styles.budgetLabel, { color: colors.mutedForeground }]}>Caixa Disponível</Text>
            <Text style={[styles.budgetValue, { color: colors.primary }]}>
              R$ {availableCash.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={[styles.budgetDivider, { backgroundColor: colors.primary + '30' }]} />
          <View style={styles.budgetItem}>
            <Text style={[styles.budgetLabel, { color: colors.mutedForeground }]}>Teto Útil (Cartão)</Text>
            <Text style={[styles.budgetValue, { color: effectiveMax === 'Sem Teto' ? colors.mutedForeground : colors.primary }]}>
              {effectiveMax}
            </Text>
          </View>
        </View>

        <View style={styles.budgetActionRow}>
          <TouchableOpacity
            style={[styles.settingsBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {
              setTempMaxSpend(String(userSettings.maxMonthlyCreditSpend || ''));
              setTempCreditSafetyMargin(String(userSettings.creditSafetyMargin || ''));
              setIsSettingsModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={14} color={colors.mutedForeground} />
            <Text style={[styles.settingsBtnText, { color: colors.mutedForeground }]}>Teto Fatura</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.settingsBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleOpenSettings}
            activeOpacity={0.7}
          >
            <Ionicons name="options-outline" size={14} color={colors.mutedForeground} />
            <Text style={[styles.settingsBtnText, { color: colors.mutedForeground }]}>Valores</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.settingsBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setShowAccountsModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="wallet-outline" size={14} color={colors.mutedForeground} />
            <Text style={[styles.settingsBtnText, { color: colors.mutedForeground }]}>Contas</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        {([
          { key: 'todos', label: 'Todos', icon: 'list-outline' },
          { key: 'PENDENTE', label: 'Pendentes', icon: 'time-outline' },
          { key: 'COMPRADO', label: 'Comprados', icon: 'checkmark-circle-outline' },
        ] as { key: FilterType; label: string; icon: string }[]).map(f => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterChip,
              { borderColor: colors.border },
              filter === f.key && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => setFilter(f.key)}
          >
            <Ionicons
              name={f.icon as any}
              size={14}
              color={filter === f.key ? '#FFF' : colors.mutedForeground}
            />
            <Text style={[
              styles.filterChipText,
              { color: filter === f.key ? '#FFF' : colors.foreground },
            ]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Add New Item Button */}
      <TouchableOpacity
        style={[styles.addBtn, { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
        <Text style={[styles.addBtnText, { color: colors.primary }]}>Adicionar novo desejo</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Ionicons name="gift-outline" size={56} color={colors.mutedForeground} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Lista vazia</Text>
      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
        Adicione itens que deseja comprar para simular o impacto no seu orçamento.
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={filteredWishlist}
        keyExtractor={item => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        renderItem={({ item }) => (
          <WishlistItemCard
            item={item}
            onBuyPress={handleBuyPress}
            onDeletePress={handleDeleteItem}
            onPress={() => handleItemPress(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Add Modal */}
      <Modal visible={showAddModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Novo desejo</Text>

              <View style={styles.modalField}>
                <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>Nome do item</Text>
                <TextInput
                  style={[styles.modalInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.secondary }]}
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Ex: iPhone 15, Cadeira Gamer..."
                  placeholderTextColor={colors.mutedForeground}
                  autoFocus
                />
              </View>

              <View style={styles.modalField}>
                <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>Preço estimado</Text>
                <TextInput
                  style={[styles.modalInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.secondary }]}
                  value={newPrice}
                  onChangeText={t => setNewPrice(formatCurrencyMask(t))}
                  placeholder="0,00"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.modalField}>
                <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>Pretende pagar como?</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['QUALQUER', 'DEBITO', 'CREDITO'] as PaymentPreference[]).map(pref => (
                    <TouchableOpacity
                      key={pref}
                      style={[
                        { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
                        newPreference === pref 
                          ? { backgroundColor: colors.primary, borderColor: colors.primary } 
                          : { backgroundColor: colors.secondary, borderColor: colors.border }
                      ]}
                      onPress={() => setNewPreference(pref)}
                    >
                      <Text style={{ 
                        fontSize: 12, 
                        fontWeight: '600', 
                        color: newPreference === pref ? '#FFF' : colors.foreground 
                      }}>
                        {pref === 'QUALQUER' ? 'Tanto Faz' : pref === 'DEBITO' ? 'À Vista' : 'Crédito'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {newPreference === 'CREDITO' && (
                <View style={styles.modalField}>
                  <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>Quantidade de Parcelas</Text>
                  <TextInput
                    style={[styles.modalInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.secondary }]}
                    value={newInstallments}
                    onChangeText={setNewInstallments}
                    placeholder="Ex: 4"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numeric"
                  />
                  {parseCurrency(newPrice) > 0 && parseInt(newInstallments) > 0 && (
                    <Text style={{ marginTop: 6, fontSize: 13, color: colors.primary, fontWeight: '500' }}>
                      Valor da parcela: {parseInt(newInstallments)}x de R$ {(parseCurrency(newPrice) / parseInt(newInstallments)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  )}
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: colors.secondary }]}
                  onPress={() => { setShowAddModal(false); setNewName(''); setNewPrice(''); setNewPreference('QUALQUER'); setNewInstallments('2'); }}
                >
                  <Text style={{ color: colors.foreground, fontWeight: '600' }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                  onPress={handleAddItem}
                >
                  <Text style={{ color: '#FFF', fontWeight: '600' }}>Adicionar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={showSettingsModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Orçamento Base Zero</Text>
              <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
                Configure os valores essenciais que você deseja preservar na sua conta antes de simulá-la para novas compras.
              </Text>

              <View style={styles.modalField}>
                <Text style={[styles.modalLabel, { color: colors.foreground }]}>Orçamento p/ Gastos Diários (R$)</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 8, marginTop: -4 }}>
                  Valor total no mês que você deseja reservar para cobrir as despesas do seu dia a dia.
                </Text>
                <TextInput
                  style={[styles.modalInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.secondary }]}
                  value={settingsDailyAllowance}
                  onChangeText={t => setSettingsDailyAllowance(formatCurrencyMask(t))}
                  placeholder="0,00"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.modalField}>
                <Text style={[styles.modalLabel, { color: colors.foreground }]}>Reserva Mensal / Meta (R$)</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 8, marginTop: -4 }}>
                  Valor que você deseja proteger e guardar a cada mês simulado.
                </Text>
                <TextInput
                  style={[styles.modalInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.secondary }]}
                  value={settingsSafetyMargin}
                  onChangeText={t => setSettingsSafetyMargin(formatCurrencyMask(t))}
                  placeholder="0,00"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: colors.secondary }]}
                  onPress={() => setShowSettingsModal(false)}
                >
                  <Text style={{ color: colors.foreground, fontWeight: '600' }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                  onPress={handleSaveSettings}
                >
                  <Text style={{ color: '#FFF', fontWeight: '600' }}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Accounts Modal */}
      <Modal visible={showAccountsModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border, maxHeight: '80%' }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Contas Consideradas</Text>
            <Text style={[styles.modalSubtitle, { color: colors.mutedForeground, marginBottom: 8 }]}>
              Escolha quais contas bancárias farão parte do saldo livre para a simulação.
            </Text>

            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {accounts.filter(a => a.type !== 'cartao_credito').map(item => {
                const isIncluded = userSettings.simulatorIncludedAccounts
                  ? userSettings.simulatorIncludedAccounts.includes(item.id)
                  : true;

                return (
                  <View key={item.id} style={[styles.accountItem, { borderBottomColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.accountName, { color: colors.foreground }]}>{item.name}</Text>
                      <Text style={[styles.accountBalance, { color: colors.mutedForeground }]}>
                        R$ {item.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </Text>
                    </View>
                    <Switch
                      value={isIncluded}
                      onValueChange={() => toggleSimulatorAccount(item.id)}
                      trackColor={{ true: colors.primary, false: colors.border }}
                    />
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={() => setShowAccountsModal(false)}
              >
                <Text style={{ color: '#FFF', fontWeight: '600' }}>Concluído</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Teto Fatura Modal */}
      <Modal visible={isSettingsModalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Limites do Cartão</Text>
              <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
                Defina os seus limites pessoais para evitar que as faturas de cartão de crédito fiquem impagáveis.
              </Text>

              <View style={styles.modalField}>
                <Text style={[styles.modalLabel, { color: colors.foreground }]}>Teto Máximo da Fatura (R$)</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 8, marginTop: -4 }}>
                  O simulador não aprovará a compra se o total da fatura mensal ficar maior que esse valor.
                </Text>
                <TextInput
                  style={[styles.modalInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.secondary }]}
                  value={tempMaxSpend}
                  onChangeText={setTempMaxSpend}
                  placeholder="Teto (Ex: 1500)"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.modalField}>
                <Text style={[styles.modalLabel, { color: colors.foreground, marginTop: 10 }]}>Reserva para Imprevistos (R$)</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 8, marginTop: -4 }}>
                  Uma folga financeira no seu teto para garantir espaço caso aconteça alguma emergência no cartão.
                </Text>
                <TextInput
                  style={[styles.modalInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.secondary }]}
                  value={tempCreditSafetyMargin}
                  onChangeText={setTempCreditSafetyMargin}
                  placeholder="Ex: 200"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: colors.secondary }]}
                  onPress={() => setIsSettingsModalVisible(false)}
                >
                  <Text style={{ color: colors.foreground, fontWeight: '600' }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                  onPress={handleSaveMaxSpend}
                >
                  <Text style={{ color: '#FFF', fontWeight: '600' }}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <ItemBreakdownSheet
        isVisible={breakdownModalVisible}
        onClose={() => setBreakdownModalVisible(false)}
        item={selectedItemForBreakdown}
        breakdownData={currentBreakdownData}
        targetMonthIndex={targetMonthIndex}
        suggestedMessage={currentSuggestedMessage}
        currentAvailable={currentAvailableAtPress}
        creditData={currentCreditData}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  headerSection: {
    gap: 16,
    marginBottom: 16,
  },
  budgetCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  budgetItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  budgetDivider: {
    width: 1,
    height: 40,
    marginHorizontal: 12,
  },
  budgetLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  budgetValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  budgetActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  settingsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  settingsBtnText: {
    fontSize: 12,
    fontWeight: '500',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 20,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 16,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    width: 340,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    gap: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: -8,
  },
  modalField: {
    gap: 6,
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
    borderRadius: 12,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  accountName: {
    fontSize: 15,
    fontWeight: '600',
  },
  accountBalance: {
    fontSize: 13,
    marginTop: 2,
  },
  confirmIcon: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  confirmItemName: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  confirmItemPrice: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: -4,
  },
  confirmDesc: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
