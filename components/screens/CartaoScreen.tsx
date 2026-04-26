// components/screens/CartaoScreen.tsx
import React, { useState, useMemo } from 'react';
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
  calculateCreditCardInvoice,
  formatCurrency,
  formatDateShort,
  getCreditCardTargetMonth,
} from '@/lib/utils';
import { Account, Transaction } from '@/constants/types';

export function CartaoScreen() {
  const { colors } = useTheme();
  const {
    accounts,
    transactions,
    payCreditCardInvoice, // 👉 GARANTA QUE ISTO ESTÁ EXPORTADO NO SEU CONTEXTO
  } = useStoreContext();

  // Filtra apenas os cartões de crédito
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

  // Estado para o Modal de Pagamento
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [sourceAccountId, setSourceAccountId] = useState<string>('');

  // 👉 CÁLCULOS DO MÊS ALVO E DA FATURA ATUAL
  const {
    currentInvoice,
    targetMonth,
    targetYear,
    invoiceTransactions,
    limit,
    availableLimit,
    limitUsagePercent,
  } = useMemo(() => {
    if (!selectedCard)
      return {
        currentInvoice: 0,
        targetMonth: 0,
        targetYear: 2024,
        invoiceTransactions: [],
        limit: 0,
        availableLimit: 0,
        limitUsagePercent: 0,
      };

    const today = new Date();

    // 🔥 Agora usamos a fonte da verdade do utils.ts
    const { targetMonth: tMonth, targetYear: tYear } = getCreditCardTargetMonth(
      selectedCard,
      today,
    );
    const invoiceValue = calculateCreditCardInvoice(
      selectedCard,
      transactions,
      today,
    );

    const invTxs = transactions
      .filter((tx) => {
        if (
          tx.accountId !== selectedCard.id ||
          tx.paymentMethod !== 'credito' ||
          tx.paid
        )
          return false;
        const txDate = new Date(tx.date);
        return txDate.getMonth() === tMonth && txDate.getFullYear() === tYear;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const cLimit = selectedCard.creditLimit || 0;
    const aLimit = Math.max(0, cLimit - invoiceValue);
    const percent =
      cLimit > 0 ? Math.min((invoiceValue / cLimit) * 100, 100) : 0;

    return {
      currentInvoice: invoiceValue,
      targetMonth: tMonth, // Passa o índice correto (0-11) para o payCreditCardInvoice
      targetYear: tYear,
      invoiceTransactions: invTxs,
      limit: cLimit,
      availableLimit: aLimit,
      limitUsagePercent: percent,
    };
  }, [selectedCard, transactions]);

  // Contas disponíveis para pagar a fatura (exclui cartões de crédito)
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
      Alert.alert('Sucesso', 'Fatura paga e limite libertado!');
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
      <View style={[styles.txItem, { borderBottomColor: colors.border }]}>
        <View style={styles.txInfo}>
          <Text
            style={[styles.txDesc, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {tx.description}
          </Text>
          <Text style={[styles.txDate, { color: colors.mutedForeground }]}>
            {formatDateShort(tx.date)}
          </Text>
        </View>
        <Text style={[styles.txAmount, { color: amountColor }]}>
          {isReceita ? '+' : '-'}
          {formatCurrency(tx.amount)}
        </Text>
      </View>
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
              <Text style={styles.invoiceLabel}>
                Fatura Atual ({String(targetMonth + 1).padStart(2, '0')}/
                {targetYear})
              </Text>
              <Text style={styles.invoiceValue}>
                {formatCurrency(currentInvoice)}
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

          {/* BARRA DE LIMITE */}
          <View
            style={[
              styles.limitSection,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.limitHeader}>
              <Text style={[styles.limitTitle, { color: colors.foreground }]}>
                Limite do Cartão
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
              <View style={{ alignItems: 'flex-end' }}>
                <Text
                  style={[
                    styles.limitSubLabel,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Utilizado
                </Text>
                <Text
                  style={[styles.limitSubValue, { color: colors.foreground }]}
                >
                  {formatCurrency(currentInvoice)}
                </Text>
              </View>
            </View>
          </View>

          {/* BOTÃO DE PAGAMENTO */}
          <TouchableOpacity
            style={[
              styles.payButton,
              {
                backgroundColor:
                  currentInvoice > 0 ? colors.primary : colors.border,
              },
            ]}
            disabled={currentInvoice <= 0}
            onPress={handlePayInvoice}
          >
            <Ionicons
              name='checkmark-circle-outline'
              size={20}
              color={currentInvoice > 0 ? '#FFF' : colors.mutedForeground}
            />
            <Text
              style={[
                styles.payButtonText,
                { color: currentInvoice > 0 ? '#FFF' : colors.mutedForeground },
              ]}
            >
              {currentInvoice > 0 ? 'Pagar Fatura' : 'Fatura Zerada'}
            </Text>
          </TouchableOpacity>

          {/* LISTA DE DESPESAS DA FATURA */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Lançamentos da Fatura
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
              O valor de {formatCurrency(currentInvoice)} será debitado da conta
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
                <Text style={styles.confirmBtnText}>Confirmar Pagamento</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
