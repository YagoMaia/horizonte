// components/screens/CartaoScreen.tsx
import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useStoreContext } from '@/context/StoreContext';
import {
  getCreditCardTargetMonth,
  formatCurrency,
  formatDateShort,
} from '@/lib/utils';
import { Account, Transaction } from '@/constants/types';

// 👉 IMPORT DOS MODAIS DE EDIÇÃO
import { TransactionDetailModal } from '../TransactionDetailModal';
import { AddTransactionModal } from '../AddTransactionModal';

const MONTH_NAMES = [
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

export function CartaoScreen() {
  const { colors } = useTheme();
  const {
    accounts,
    transactions,
    tags,
    payCreditCardInvoice,
    addTransaction,
    updateTransaction,
    deleteTransaction, // Adicionado para a função de excluir todos
  } = useStoreContext();

  const creditCards = useMemo(
    () => accounts.filter((a) => a.type === 'cartao_credito'),
    [accounts],
  );

  const [selectedCardId, setSelectedCardId] = useState<string | null>(
    creditCards.length > 0 ? creditCards[0].id : null,
  );

  const selectedCard = useMemo(
    () => creditCards.find((c) => c.id === selectedCardId) || null,
    [creditCards, selectedCardId],
  );

  const [monthOffset, setMonthOffset] = useState(0);

  useEffect(() => {
    setMonthOffset(0);
  }, [selectedCardId]);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [sourceAccountId, setSourceAccountId] = useState<string>('');

  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // MOTOR BANCÁRIO DE FATURA
  const getInvoiceForTx = (txDateStr: string, accountId: string) => {
    const card = accounts.find(c => c.id === accountId);
    const closingDay = card?.closingDay || 25;
    const dueDay = card?.dueDay || 5;
    const d = new Date(txDateStr);

    let m = d.getMonth() + 1;
    let y = d.getFullYear();

    if (d.getDate() >= closingDay) {
      m += 1;
    }

    if (dueDay < closingDay) {
      m += 1;
    }

    while (m > 12) {
      m -= 12;
      y += 1;
    }
    return { viewMonth: m - 1, viewYear: y, value: y * 100 + m };
  };

  const {
    totalInvoice,
    pendingInvoice,
    targetMonth,
    targetYear,
    invoiceTransactions,
    limit,
    availableLimit,
    limitUsagePercent,
    invoiceStatus,
    statusColor,
    globalPendingDebt,
  } = useMemo(() => {
    if (!selectedCard)
      return {
        totalInvoice: 0,
        pendingInvoice: 0,
        targetMonth: 0,
        targetYear: 2024,
        invoiceTransactions: [],
        limit: 0,
        availableLimit: 0,
        limitUsagePercent: 0,
        invoiceStatus: 'ZERADA',
        statusColor: colors.mutedForeground,
        globalPendingDebt: 0,
      };

    const baseDate = new Date();
    baseDate.setMonth(baseDate.getMonth() + monthOffset);

    const targetInvoice = getInvoiceForTx(baseDate.toISOString(), selectedCard.id);
    const tMonth = targetInvoice.viewMonth;
    const tYear = targetInvoice.viewYear;
    const tValue = targetInvoice.value;

    const expandedTxs: any[] = [];
    transactions.forEach(tx => {
      if (tx.accountId !== selectedCard.id || tx.paymentMethod !== 'credito') return;

      const installmentsCount = tx.totalInstallments || 1;
      const isInstallment = installmentsCount > 1;

      if (isInstallment) {
        const parcelAmount = tx.amount / installmentsCount;
        const baseInv = getInvoiceForTx(tx.date, tx.accountId);

        for (let i = 0; i < installmentsCount; i++) {
          let m = baseInv.viewMonth + i;
          let y = baseInv.viewYear;

          while (m > 11) {
            m -= 12;
            y += 1;
          }

          let installmentDate = tx.date;
          if (i > 0) {
            installmentDate = new Date(y, m, 1, 12, 0, 0).toISOString();
          }

          expandedTxs.push({
            ...tx,
            id: `${tx.id}-parcel-${i}`,
            originalId: tx.id,
            amount: parcelAmount,
            date: installmentDate,
            description: `${tx.description} (${i + 1}/${installmentsCount})`,
            targetInvoiceValue: y * 100 + (m + 1)
          });
        }
      } else if (tx.recurrence === 'mensal') {
        const startDate = new Date(tx.date);
        const limitMonths = 36;
        for (let i = 0; i < limitMonths; i++) {
          const d = new Date(startDate);
          d.setMonth(d.getMonth() + i);
          if (tx.recurrenceEndDate && d > new Date(tx.recurrenceEndDate)) break;

          expandedTxs.push({
            ...tx,
            id: `${tx.id}-rec-${i}`,
            originalId: tx.id,
            date: d.toISOString(),
            targetInvoiceValue: getInvoiceForTx(d.toISOString(), tx.accountId).value
          });
        }
      } else {
        expandedTxs.push({
          ...tx,
          originalId: tx.id,
          targetInvoiceValue: getInvoiceForTx(tx.date, tx.accountId).value
        });
      }
    });

    const invTxs = expandedTxs
      .filter((tx) => tx.targetInvoiceValue === tValue)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const tInvoice = invTxs.reduce(
      (sum, tx) => sum + (tx.type === 'receita' ? -tx.amount : tx.amount),
      0,
    );
    const pInvoice = invTxs
      .filter((t) => !t.paid)
      .reduce(
        (sum, tx) => sum + (tx.type === 'receita' ? -tx.amount : tx.amount),
        0,
      );

    const openInvoiceValue = getInvoiceForTx(new Date().toISOString(), selectedCard.id).value;

    const globalPendingDebtValue = expandedTxs
      .filter(
        (tx) =>
          !tx.paid && tx.targetInvoiceValue >= openInvoiceValue
      )
      .reduce(
        (sum, tx) => sum + (tx.type === 'receita' ? -tx.amount : tx.amount),
        0,
      );

    const cLimit = selectedCard.creditLimit || 0;
    const aLimit = Math.max(0, cLimit - globalPendingDebtValue);
    const percent =
      cLimit > 0 ? Math.min((globalPendingDebtValue / cLimit) * 100, 100) : 0;

    let status = 'ABERTA';
    let color = colors.primary;

    if (tValue < openInvoiceValue && pInvoice <= 0 && tInvoice > 0) {
      status = 'PAGA';
      color = colors.success;
    } else if (tValue > openInvoiceValue) {
      status = 'FUTURA';
      color = colors.warning;
    } else if (tInvoice <= 0) {
      status = 'ZERADA';
      color = colors.mutedForeground;
    }

    return {
      totalInvoice: tInvoice,
      pendingInvoice: pInvoice,
      targetMonth: tMonth,
      targetYear: tYear,
      invoiceTransactions: invTxs,
      limit: cLimit,
      availableLimit: aLimit,
      limitUsagePercent: percent,
      invoiceStatus: status,
      statusColor: color,
      globalPendingDebt: globalPendingDebtValue,
    };
  }, [selectedCard, transactions, monthOffset, colors]);

  const debitAccounts = useMemo(
    () => accounts.filter((a) => a.type !== 'cartao_credito'),
    [accounts],
  );

  const handlePayInvoice = () => {
    if (debitAccounts.length === 0) {
      Alert.alert(
        'Aviso',
        'Não tem nenhuma conta corrente cadastrada para pagar esta fatura.',
      );
      return;
    }
    setSourceAccountId(debitAccounts[0].id);
    setIsPaymentModalOpen(true);
  };

  const confirmPayment = async () => {
    if (!selectedCard || !sourceAccountId) return;
    try {
      await payCreditCardInvoice(
        selectedCard.id,
        sourceAccountId,
        targetMonth,
        targetYear,
      );
      setIsPaymentModalOpen(false);
      Alert.alert('Sucesso', 'Fatura paga com sucesso!');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível processar o pagamento.');
    }
  };

  // 👉 LÓGICA PARA EXCLUIR TODOS OS ITENS DA FATURA ATUAL
  const handleDeleteAllFromInvoice = () => {
    if (invoiceTransactions.length === 0) return;

    // Pegamos apenas os IDs originais únicos (para não chamar delete 2x no mesmo ID)
    const uniqueOriginalIds = Array.from(new Set(invoiceTransactions.map((tx: any) => tx.originalId)));

    const alertMessage = 'Atenção: Se houver compras parceladas nesta fatura, TODAS as parcelas (passadas e futuras) dessas compras também serão excluídas. Deseja continuar?';

    if (Platform.OS === 'web') {
      if (window.confirm(`${alertMessage}\n\nTem certeza que deseja excluir todos os ${uniqueOriginalIds.length} lançamentos originais?`)) {
        uniqueOriginalIds.forEach(id => deleteTransaction(id));
      }
    } else {
      Alert.alert(
        'Excluir Fatura',
        alertMessage,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Excluir Todos',
            style: 'destructive',
            onPress: () => {
              uniqueOriginalIds.forEach(id => deleteTransaction(id));
            }
          }
        ]
      );
    }
  };

  if (creditCards.length === 0) {
    return (
      <View
        style={[styles.emptyContainer, { backgroundColor: colors.background }]}
      >
        <Ionicons name='card-outline' size={64} color={colors.border} />
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          Nenhum cartão de crédito registado.
        </Text>
      </View>
    );
  }

  const renderTransaction = ({ item: tx }: { item: any }) => {
    const isReceita = tx.type === 'receita';
    const amountColor = isReceita ? colors.success : colors.foreground;

    return (
      <TouchableOpacity
        style={[styles.txItem, { borderBottomColor: colors.border }]}
        onPress={() => setSelectedTx(tx)}
        activeOpacity={0.7}
      >
        <View style={styles.txInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text
              style={[styles.txDesc, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {tx.description}
            </Text>
            {tx.paid && (
              <Ionicons
                name='checkmark-circle'
                size={14}
                color={colors.success}
              />
            )}
          </View>
          <Text style={[styles.txDate, { color: colors.mutedForeground }]}>
            {formatDateShort(tx.date)}
          </Text>
        </View>
        <Text style={[styles.txAmount, { color: amountColor }]}>
          {isReceita ? '+' : '-'}
          {formatCurrency(tx.amount)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={[
          styles.carouselContainer,
          { borderBottomColor: colors.border, backgroundColor: colors.card },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContent}
        >
          {creditCards.map((card) => {
            const isSelected = card.id === selectedCardId;
            return (
              <TouchableOpacity
                key={card.id}
                onPress={() => setSelectedCardId(card.id)}
                style={[
                  styles.cardSelectorItem,
                  {
                    backgroundColor: isSelected ? card.color : 'transparent',
                    borderColor: isSelected ? card.color : colors.border,
                  },
                ]}
              >
                <Ionicons
                  name={card.icon as any}
                  size={16}
                  color={isSelected ? '#FFF' : card.color}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: isSelected ? '#FFF' : colors.foreground,
                  }}
                >
                  {card.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {selectedCard && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <View style={styles.monthNav}>
            <TouchableOpacity
              onPress={() => setMonthOffset((m) => m - 1)}
              style={styles.navBtn}
            >
              <Ionicons
                name='chevron-back'
                size={24}
                color={colors.foreground}
              />
            </TouchableOpacity>

            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.monthTitle, { color: colors.foreground }]}>
                {MONTH_NAMES[targetMonth]} {targetYear}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setMonthOffset((m) => m + 1)}
              style={styles.navBtn}
            >
              <Ionicons
                name='chevron-forward'
                size={24}
                color={colors.foreground}
              />
            </TouchableOpacity>
          </View>

          <View style={[styles.cardVisual, { backgroundColor: selectedCard.color }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="card" size={28} color="#FFF" />
              <Text style={styles.cardBrand}>{selectedCard.name.toUpperCase()}</Text>
            </View>

            <View style={styles.cardBody}>
              <Text style={styles.cardLabel}>Valor total da fatura</Text>
              <Text style={styles.cardAmount}>{formatCurrency(totalInvoice)}</Text>

              <View style={styles.limitContainer}>
                <View style={styles.limitBarBackground}>
                  <View style={[styles.limitBarFill, { width: `${limitUsagePercent}%` }]} />
                </View>
                <View style={styles.limitInfo}>
                  <View>
                    <Text style={styles.limitValue}>{formatCurrency(globalPendingDebt)}</Text>
                    <Text style={styles.limitLabel}>Utilizado</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.limitValue}>{formatCurrency(availableLimit)}</Text>
                    <Text style={styles.limitLabel}>Disponível</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.cardFooter}>
              <View style={styles.chip} />
              <View style={styles.cardStatus}>
                <Text style={styles.cardStatusText}>{invoiceStatus === 'ABERTA' ? 'FATURA EM ABERTO' : `FATURA ${invoiceStatus}`}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.payButton,
              {
                backgroundColor:
                  pendingInvoice > 0 ? colors.primary : colors.border,
              },
            ]}
            disabled={pendingInvoice <= 0}
            onPress={handlePayInvoice}
          >
            <Ionicons
              name={
                pendingInvoice > 0
                  ? 'wallet-outline'
                  : 'checkmark-circle-outline'
              }
              size={20}
              color={pendingInvoice > 0 ? '#FFF' : colors.mutedForeground}
            />
            <Text
              style={[
                styles.payButtonText,
                { color: pendingInvoice > 0 ? '#FFF' : colors.mutedForeground },
              ]}
            >
              {pendingInvoice > 0
                ? `Pagar ${formatCurrency(pendingInvoice)}`
                : 'Fatura sem pendências'}
            </Text>
          </TouchableOpacity>

          {/* 👉 SEÇÃO DA LISTA COM O NOVO BOTÃO EXCLUIR TODOS */}
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>ITENS DA FATURA</Text>
              <Text style={[styles.itemCount, { color: colors.mutedForeground }]}>{invoiceTransactions.length} itens</Text>
            </View>

            {invoiceTransactions.length > 0 && (
              <TouchableOpacity
                style={styles.deleteAllBtn}
                onPress={handleDeleteAllFromInvoice}
              >
                <Ionicons name="trash-outline" size={16} color={colors.destructive} />
                <Text style={[styles.deleteAllText, { color: colors.destructive }]}>Excluir Todos</Text>
              </TouchableOpacity>
            )}
          </View>

          <View
            style={[
              styles.txContainer,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {invoiceTransactions.length === 0 ? (
              <Text
                style={[styles.emptyTxText, { color: colors.mutedForeground }]}
              >
                Nenhum gasto nesta fatura.
              </Text>
            ) : (
              <FlatList
                data={invoiceTransactions}
                keyExtractor={(item) => item.id}
                renderItem={renderTransaction}
                scrollEnabled={false}
              />
            )}
          </View>
        </ScrollView>
      )}

      <Modal visible={isPaymentModalOpen} transparent animationType='slide'>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Pagar Fatura
            </Text>
            <Text
              style={[styles.modalSubtitle, { color: colors.mutedForeground }]}
            >
              O valor de {formatCurrency(pendingInvoice)} será debitado da conta
              selecionada abaixo:
            </Text>

            <View style={styles.accountSelection}>
              {debitAccounts.map((acc) => (
                <TouchableOpacity
                  key={acc.id}
                  style={[
                    styles.accountOption,
                    {
                      borderColor:
                        sourceAccountId === acc.id
                          ? colors.primary
                          : colors.border,
                      backgroundColor:
                        sourceAccountId === acc.id
                          ? colors.primary + '10'
                          : 'transparent',
                    },
                  ]}
                  onPress={() => setSourceAccountId(acc.id)}
                >
                  <Ionicons
                    name={acc.icon as any}
                    size={20}
                    color={acc.color}
                  />
                  <Text
                    style={[
                      styles.accountOptionName,
                      { color: colors.foreground },
                    ]}
                  >
                    {acc.name}
                  </Text>
                  {sourceAccountId === acc.id && (
                    <Ionicons
                      name='checkmark'
                      size={18}
                      color={colors.primary}
                      style={{ marginLeft: 'auto' }}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsPaymentModalOpen(false)}
              >
                <Text
                  style={[
                    styles.cancelBtnText,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
                onPress={confirmPayment}
              >
                <Text style={styles.confirmBtnText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <TransactionDetailModal
        transaction={isEditing ? null : selectedTx}
        onClose={() => setSelectedTx(null)}
        onEdit={() => setIsEditing(true)}
      />

      {isEditing && selectedTx && (
        <AddTransactionModal
          visible={isEditing}
          onClose={() => {
            setIsEditing(false);
            setSelectedTx(null);
          }}
          onAdd={addTransaction}
          onUpdate={updateTransaction as any}
          accounts={accounts}
          tags={tags}
          transactionToEdit={
            transactions.find(t => t.id === (selectedTx as any).originalId) || selectedTx
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { marginTop: 16, fontSize: 16, fontWeight: '500' },
  carouselContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  carouselContent: { paddingHorizontal: 16, gap: 12 },
  cardSelectorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  content: { padding: 16, paddingBottom: 40, gap: 20 },

  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  navBtn: { padding: 8 },
  monthTitle: { fontSize: 18, fontWeight: '700' },

  cardVisual: {
    marginVertical: 4,
    padding: 24,
    borderRadius: 24,
    minHeight: 210,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardBrand: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
  },
  cardBody: { marginTop: 12 },
  cardLabel: {
    color: '#FFF',
    fontSize: 13,
    opacity: 0.8,
    marginBottom: 2,
  },
  cardAmount: {
    color: '#FFF',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
  },
  limitContainer: { marginTop: 24, gap: 6 },
  limitBarBackground: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  limitBarFill: { height: '100%', backgroundColor: '#FF8C00' },
  limitInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  limitValue: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  limitLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 16,
  },
  chip: {
    width: 42,
    height: 28,
    backgroundColor: '#cca633',
    borderRadius: 6,
    opacity: 0.9,
  },
  cardStatus: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  cardStatusText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  payButtonText: { fontSize: 16, fontWeight: '700' },

  // 👉 AJUSTE DO CABEÇALHO PARA ACOMODAR O BOTÃO
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  itemCount: { fontSize: 12, marginTop: 2 },

  // 👉 ESTILOS DO NOVO BOTÃO EXCLUIR TODOS
  deleteAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,59,48,0.1)', // Um vermelho bem clarinho e suave
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  deleteAllText: {
    fontSize: 12,
    fontWeight: '700',
  },

  txContainer: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  emptyTxText: { padding: 24, textAlign: 'center', fontSize: 14 },
  txItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  txInfo: { flex: 1, gap: 4 },
  txDesc: { fontSize: 15, fontWeight: '500' },
  txDate: { fontSize: 12 },
  txAmount: { fontSize: 15, fontWeight: '700' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    borderWidth: 1,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  modalSubtitle: { fontSize: 14, lineHeight: 20, marginBottom: 24 },
  accountSelection: { gap: 12, marginBottom: 32 },
  accountOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  accountOptionName: { fontSize: 15, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600' },
  confirmBtn: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});