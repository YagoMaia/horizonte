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

  // 👉 1. NOVO ESTADO: MÁQUINA DO TEMPO
  const [monthOffset, setMonthOffset] = useState(0);

  // Reseta a máquina do tempo ao trocar de cartão
  useEffect(() => {
    setMonthOffset(0);
  }, [selectedCardId]);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [sourceAccountId, setSourceAccountId] = useState<string>('');

  // Estados de Edição
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // 👉 2. MOTOR DE CÁLCULO (SEPARANDO O GLOBAL DO LOCAL)
  const {
    totalInvoice, // Total bruto gasto neste mês específico (histórico)
    pendingInvoice, // Quanto DESSA fatura específica ainda não foi pago
    targetMonth,
    targetYear,
    invoiceTransactions,
    limit,
    availableLimit,
    limitUsagePercent,
    invoiceStatus,
    statusColor,
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
      };

    // A data base para os cálculos viaja no tempo usando o offset
    const baseDate = new Date();
    baseDate.setMonth(baseDate.getMonth() + monthOffset);

    // Descobre qual é o mês/ano faturado desta data no tempo
    const { targetMonth: tMonth, targetYear: tYear } = getCreditCardTargetMonth(
      selectedCard,
      baseDate,
    );

    // FILTRO LOCAL: Pega TODAS as transações desta fatura no tempo (pagas ou não)
    const invTxs = transactions
      .filter((tx) => {
        if (tx.accountId !== selectedCard.id || tx.paymentMethod !== 'credito')
          return false;
        const txDate = new Date(tx.date);
        return txDate.getMonth() === tMonth && txDate.getFullYear() === tYear;
      })
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

    // FILTRO GLOBAL: O limite do cartão independe do mês atual. Ele olha toda a dívida não paga da história.
    const globalPendingDebt = transactions
      .filter(
        (tx) =>
          tx.accountId === selectedCard.id &&
          tx.paymentMethod === 'credito' &&
          !tx.paid,
      )
      .reduce(
        (sum, tx) => sum + (tx.type === 'receita' ? -tx.amount : tx.amount),
        0,
      );

    const cLimit = selectedCard.creditLimit || 0;
    const aLimit = Math.max(0, cLimit - globalPendingDebt);
    const percent =
      cLimit > 0 ? Math.min((globalPendingDebt / cLimit) * 100, 100) : 0;

    // Lógica visual de Status
    let status = 'ABERTA';
    let color = colors.primary;

    if (monthOffset < 0 && pInvoice <= 0 && tInvoice > 0) {
      status = 'PAGA';
      color = colors.success;
    } else if (monthOffset > 0) {
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

  const renderTransaction = ({ item: tx }: { item: Transaction }) => {
    const isReceita = tx.type === 'receita';
    const amountColor = isReceita ? colors.success : colors.foreground;

    return (
      // 👉 3. HABILITADA A EDIÇÃO NA TELA DO CARTÃO
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
            {/* Indicador visual se a compra específica já foi paga (Ex: Faturas antigas) */}
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
      {/* SELETOR DE CARTÕES (CARROSSEL) */}
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
          {/* 👉 4. NAVEGAÇÃO DA FATURA (MÁQUINA DO TEMPO) */}
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
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: statusColor + '20' },
                ]}
              >
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {invoiceStatus}
                </Text>
              </View>
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

          {/* O CARTÃO FÍSICO VISUAL */}
          <View
            style={[
              styles.creditCardVisual,
              { backgroundColor: selectedCard.color },
            ]}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardName}>{selectedCard.name}</Text>
              <Ionicons
                name='wifi'
                size={24}
                color='rgba(255,255,255,0.7)'
                style={{ transform: [{ rotate: '90deg' }] }}
              />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.invoiceLabel}>Total da Fatura</Text>
              <Text style={styles.invoiceValue}>
                {formatCurrency(totalInvoice)}
              </Text>
            </View>
            <View style={styles.cardFooter}>
              <Text style={styles.cardInfoText}>
                Fecha dia {selectedCard.closingDay || 31}
              </Text>
              <Text style={styles.cardInfoText}>
                Vence dia {selectedCard.dueDay || 5}
              </Text>
            </View>
          </View>

          {/* BARRA DE LIMITE GLOBAL */}
          <View
            style={[
              styles.limitSection,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.limitHeader}>
              <Text style={[styles.limitTitle, { color: colors.foreground }]}>
                Limite Global
              </Text>
              <Text
                style={[styles.limitTotal, { color: colors.mutedForeground }]}
              >
                {formatCurrency(limit)}
              </Text>
            </View>

            <View
              style={[
                styles.progressBarBackground,
                { backgroundColor: colors.border },
              ]}
            >
              <View
                style={[
                  styles.progressBarFill,
                  {
                    backgroundColor:
                      limitUsagePercent > 90
                        ? colors.destructive
                        : selectedCard.color,
                    width: `${limitUsagePercent}%`,
                  },
                ]}
              />
            </View>

            <View style={styles.limitDetails}>
              <View>
                <Text
                  style={[
                    styles.limitSubLabel,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Disponível
                </Text>
                <Text style={[styles.limitSubValue, { color: colors.success }]}>
                  {formatCurrency(availableLimit)}
                </Text>
              </View>
            </View>
          </View>

          {/* BOTÃO DE PAGAMENTO (Baseado na Dívida Pendente da fatura visível) */}
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

          {/* LISTA DE DESPESAS DA FATURA */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Lançamentos
          </Text>
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

      {/* MODAL DE PAGAMENTO DA FATURA */}
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

      {/* MODAIS DE EDIÇÃO DA TRANSAÇÃO */}
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
          onUpdate={(updatedTx: any, mode: any) => updateTransaction(updatedTx, mode)}
          accounts={accounts}
          tags={tags}
          transactionToEdit={selectedTx}
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

  // 👉 ESTILOS DA NAVEGAÇÃO DA FATURA
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  navBtn: { padding: 8 },
  monthTitle: { fontSize: 18, fontWeight: '700' },
  statusBadge: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: { fontSize: 10, fontWeight: '800' },

  creditCardVisual: {
    borderRadius: 20,
    padding: 24,
    height: 200,
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
  cardName: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
  },
  cardBody: { gap: 4 },
  invoiceLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  invoiceValue: {
    color: '#FFF',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
  },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  cardInfoText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '500',
  },

  limitSection: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
  },
  limitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  limitTitle: { fontSize: 14, fontWeight: '600' },
  limitTotal: { fontSize: 14, fontWeight: '700' },
  progressBarBackground: {
    height: 8,
    borderRadius: 4,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%', borderRadius: 4 },
  limitDetails: { flexDirection: 'row', justifyContent: 'space-between' },
  limitSubLabel: { fontSize: 11, textTransform: 'uppercase', marginBottom: 2 },
  limitSubValue: { fontSize: 15, fontWeight: '700' },

  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  payButtonText: { fontSize: 16, fontWeight: '700' },

  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 4,
    marginTop: 8,
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
