// components/screens/CartaoScreen.tsx
import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useStoreContext } from '@/context/StoreContext';
import {
  formatCurrency,
  formatDateShort,
  getInvoiceForTx,
} from '@/lib/utils';
import { Account, Transaction } from '@/constants/types';

import { AddTransactionModal } from '../AddTransactionModal';
import { TransactionItem } from '../TransactionItem';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const ALL_CARDS_VIRTUAL_ACCOUNT: Account = {
  id: 'all',
  name: 'Todos os Cartões',
  color: '#334155', // Slate escoro para manter o texto branco legível
  type: 'cartao_credito',
  icon: 'albums',
  balance: 0,
};

export function CartaoScreen({ onSelectCard }: { onSelectCard?: (card: Account | null) => void }) {
  const { colors } = useTheme();
  const {
    accounts,
    transactions,
    payCreditCardInvoice,
    anticipateCreditCardPayment,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    deleteMultipleTransactions,
  } = useStoreContext() as any;

  const creditCards = useMemo(
    () => accounts.filter((a: Account) => a.type === 'cartao_credito'),
    [accounts],
  );

  // 👉 selectedCardId agora pode ser 'all' (Todos)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(
    creditCards.length > 0 ? 'all' : null,
  );

  // 👉 Cria um cartão "Virtual" caso a opção Todos esteja selecionada
  const selectedCard = useMemo(() => {
    if (selectedCardId === 'all') {
      return ALL_CARDS_VIRTUAL_ACCOUNT;
    }
    return creditCards.find((c: Account) => c.id === selectedCardId) || null;
  }, [creditCards, selectedCardId]);

  // Informa ao pai qual cartão está selecionado para pré-configurar o modal de transação
  useEffect(() => {
    if (onSelectCard) {
      onSelectCard(selectedCardId === 'all' ? null : selectedCard);
    }
  }, [selectedCard, selectedCardId, onSelectCard]);

  const [monthOffset, setMonthOffset] = useState(0);

  useEffect(() => {
    setMonthOffset(0);
  }, [selectedCardId]);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isPaymentTypeModalOpen, setIsPaymentTypeModalOpen] = useState(false);
  const [sourceAccountId, setSourceAccountId] = useState<string>('');

  const [isAnticipateModalOpen, setIsAnticipateModalOpen] = useState(false);
  const [anticipateAmountStr, setAnticipateAmountStr] = useState('');
  const [anticipateSourceAccountId, setAnticipateSourceAccountId] = useState<string>('');

  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [txToEdit, setTxToEdit] = useState<Transaction | null>(null);

  const {
    totalInvoice,
    pendingInvoice,
    targetMonth,
    targetYear,
    invoiceTransactions,
    invoiceStatus,
    globalPendingDebt,
    isAll,
  } = useMemo(() => {
    if (!selectedCard)
      return {
        totalInvoice: 0, pendingInvoice: 0, targetMonth: 0, targetYear: 2024,
        invoiceTransactions: [], limit: 0, availableLimit: 0, limitUsagePercent: 0,
        invoiceStatus: 'ZERADA', statusColor: colors.mutedForeground, globalPendingDebt: 0,
        isAll: false
      };

    const baseDate = new Date();
    baseDate.setMonth(baseDate.getMonth() + monthOffset);

    // 👉 LÓGICA PARA "TODOS OS CARTÕES"
    if (selectedCard.id === 'all') {
      let tInvoice = 0;
      let pInvoice = 0;
      let globalDebt = 0;
      let allTxs: Transaction[] = [];

      creditCards.forEach((card: Account) => {
        const targetInvoice = getInvoiceForTx(baseDate.toISOString(), card);
        const tValue = targetInvoice.value;
        const openInvoiceValue = getInvoiceForTx(new Date().toISOString(), card).value;

        const cardInvTxs = transactions.filter((tx: Transaction) => {
          if (tx.accountId !== card.id || tx.paymentMethod !== 'credito') return false;
          return getInvoiceForTx(tx.date, card).value === tValue;
        });

        allTxs.push(...cardInvTxs);

        tInvoice += cardInvTxs.reduce((sum: number, tx: Transaction) => sum + (tx.type === 'receita' ? -tx.amount : tx.amount), 0);
        pInvoice += cardInvTxs.filter((t: Transaction) => !t.paid).reduce((sum: number, tx: Transaction) => sum + (tx.type === 'receita' ? -tx.amount : tx.amount), 0);

        const cardDebt = transactions.filter((tx: Transaction) => {
          if (tx.accountId !== card.id || tx.paymentMethod !== 'credito' || tx.paid) return false;
          
          const isInstallment = tx.totalInstallments && tx.totalInstallments > 1;
          
          if (!isInstallment) {
            if (getInvoiceForTx(tx.date, card).value > openInvoiceValue) return false;
          }
          return true;
        }).reduce((sum: number, tx: Transaction) => sum + (tx.type === 'receita' ? -tx.amount : tx.amount), 0);

        globalDebt += cardDebt;
      });

      allTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      let status = 'CONSOLIDADA';
      if (pInvoice <= 0 && tInvoice > 0) { status = 'PAGA'; }
      else if (tInvoice <= 0) { status = 'ZERADA'; }

      // Pega o nome do mês usando o primeiro cartão como referência de data
      const refInvoice = creditCards.length > 0 ? getInvoiceForTx(baseDate.toISOString(), creditCards[0]) : { viewMonth: baseDate.getMonth(), viewYear: baseDate.getFullYear() };

      return {
        totalInvoice: tInvoice, pendingInvoice: pInvoice, targetMonth: refInvoice.viewMonth, targetYear: refInvoice.viewYear,
        invoiceTransactions: allTxs,
        invoiceStatus: status, globalPendingDebt: globalDebt, isAll: true
      };
    }

    // 👉 LÓGICA PARA UM CARTÃO ESPECÍFICO (Mantida igual)
    const targetInvoice = getInvoiceForTx(baseDate.toISOString(), selectedCard);
    const tMonth = targetInvoice.viewMonth;
    const tYear = targetInvoice.viewYear;
    const tValue = targetInvoice.value;

    const invTxs = transactions
      .filter((tx: Transaction) => {
        if (tx.accountId !== selectedCard.id || tx.paymentMethod !== 'credito') return false;
        return getInvoiceForTx(tx.date, selectedCard).value === tValue;
      })
      .sort((a: Transaction, b: Transaction) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const tInvoice = invTxs.reduce((sum: number, tx: Transaction) => sum + (tx.type === 'receita' ? -tx.amount : tx.amount), 0);
    const pInvoice = invTxs.filter((t: Transaction) => !t.paid).reduce((sum: number, tx: Transaction) => sum + (tx.type === 'receita' ? -tx.amount : tx.amount), 0);
    const openInvoiceValue = getInvoiceForTx(new Date().toISOString(), selectedCard).value;

    const globalPendingDebtValue = transactions
      .filter((tx: Transaction) => {
        if (tx.accountId !== selectedCard.id || tx.paymentMethod !== 'credito' || tx.paid) return false;
        return true; // Conta todas as faturas em aberto, garantindo que o limite consumido inclua passadas
      })
      .reduce((sum: number, tx: Transaction) => sum + (tx.type === 'receita' ? -tx.amount : tx.amount), 0);

    let status = 'ABERTA';

    // Neutraliza completamente as horas para evitar falhas de timezone (ex: meia tarde)
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const dueDay = selectedCard.dueDay || 5;
    const dueDate = new Date(tYear, tMonth, dueDay);

    if (tInvoice > 0 && pInvoice <= 0.01 && tValue <= openInvoiceValue) {
      status = 'PAGA';
    } else if (tValue > openInvoiceValue) {
      status = 'FUTURA';
    } else if (tInvoice <= 0) {
      status = 'ZERADA';
    } else if (pInvoice > 0.01 && dueDate.getTime() < todayStart.getTime()) {
      status = 'VENCIDA';
    }

    return {
      totalInvoice: tInvoice, pendingInvoice: pInvoice, targetMonth: tMonth, targetYear: tYear,
      invoiceTransactions: invTxs,
      invoiceStatus: status, globalPendingDebt: globalPendingDebtValue, isAll: false
    };
  }, [selectedCard, transactions, monthOffset, colors, creditCards]);

  const debitAccounts = useMemo(() => accounts.filter((a: Account) => a.type !== 'cartao_credito'), [accounts]);

  const handlePayInvoice = useCallback(() => {
    if (Platform.OS === 'web') {
      setIsPaymentTypeModalOpen(true);
    } else {
      Alert.alert(
        'Pagar Fatura',
        'Como deseja registrar este pagamento?',
        [
          {
            text: 'Pagar e abater do saldo',
            onPress: () => {
              if (debitAccounts.length === 0) {
                Alert.alert('Aviso', 'Não tem nenhuma conta corrente cadastrada para pagar esta fatura.');
                return;
              }
              setSourceAccountId(debitAccounts[0].id);
              setIsPaymentModalOpen(true);
            },
          },
          {
            text: 'Apenas marcar como paga',
            onPress: async () => {
              if (!selectedCard || selectedCard.id === 'all') return;
              try {
                await payCreditCardInvoice(selectedCard.id, null, targetMonth, targetYear, false);
                Alert.alert('Sucesso', 'Fatura marcada como paga!');
              } catch (e) {
                Alert.alert('Erro', 'Não foi possível processar o pagamento.');
              }
            },
          },
          {
            text: 'Cancelar',
            style: 'cancel',
          },
        ]
      );
    }
  }, [debitAccounts, selectedCard, payCreditCardInvoice, targetMonth, targetYear]);

  const confirmMarkAsPaidOnly = useCallback(async () => {
    if (!selectedCard || selectedCard.id === 'all') return;
    try {
      await payCreditCardInvoice(selectedCard.id, null, targetMonth, targetYear, false);
      if (Platform.OS === 'web') {
        alert('Fatura marcada como paga!');
      } else {
        Alert.alert('Sucesso', 'Fatura marcada como paga!');
      }
    } catch (e) {
      if (Platform.OS === 'web') {
        alert('Não foi possível processar o pagamento.');
      } else {
        Alert.alert('Erro', 'Não foi possível processar o pagamento.');
      }
    }
  }, [selectedCard, payCreditCardInvoice, targetMonth, targetYear]);

  const handleSelectPaymentType = useCallback((type: 'full' | 'markOnly') => {
    setIsPaymentTypeModalOpen(false);
    if (type === 'full') {
      if (debitAccounts.length === 0) {
        Alert.alert('Aviso', 'Não tem nenhuma conta corrente cadastrada para pagar esta fatura.');
        return;
      }
      setSourceAccountId(debitAccounts[0].id);
      setIsPaymentModalOpen(true);
    } else {
      confirmMarkAsPaidOnly();
    }
  }, [debitAccounts, confirmMarkAsPaidOnly]);

  const confirmPayment = useCallback(async () => {
    if (!selectedCard || !sourceAccountId || selectedCard.id === 'all') return;
    try {
      await payCreditCardInvoice(selectedCard.id, sourceAccountId, targetMonth, targetYear);
      setIsPaymentModalOpen(false);
      Alert.alert('Sucesso', 'Fatura paga com sucesso!');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível processar o pagamento.');
    }
  }, [selectedCard, sourceAccountId, payCreditCardInvoice, targetMonth, targetYear]);

  const handleOpenAnticipate = useCallback(() => {
    if (debitAccounts.length === 0) {
      Alert.alert('Aviso', 'Nenhuma conta corrente cadastrada para debitar a antecipação.');
      return;
    }
    if (globalPendingDebt <= 0) {
      Alert.alert('Aviso', 'Você não tem dívidas pendentes neste cartão para antecipar.');
      return;
    }
    setAnticipateSourceAccountId(debitAccounts[0].id);
    setAnticipateAmountStr('');
    setIsAnticipateModalOpen(true);
  }, [debitAccounts, globalPendingDebt]);

  const confirmAnticipation = useCallback(async () => {
    if (!selectedCard || !anticipateSourceAccountId || selectedCard.id === 'all') return;
    const amount = parseFloat(anticipateAmountStr.replace(',', '.'));

    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Erro', 'Digite um valor válido maior que zero.');
      return;
    }

    if (amount > globalPendingDebt) {
      Alert.alert('Aviso', `Você só pode antecipar até ${formatCurrency(globalPendingDebt)}, que é o total da sua dívida.`);
      return;
    }

    try {
      await anticipateCreditCardPayment(selectedCard.id, anticipateSourceAccountId, amount, targetMonth, targetYear);
      setIsAnticipateModalOpen(false);
      Alert.alert('Sucesso', 'Fatura antecipada e limite liberado!');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível processar a antecipação.');
    }
  }, [selectedCard, anticipateSourceAccountId, anticipateAmountStr, globalPendingDebt, anticipateCreditCardPayment, targetMonth, targetYear]);

  const handleDeleteAllFromInvoice = useCallback(() => {
    if (invoiceTransactions.length === 0 || isAll) return;

    const idsToDelete = invoiceTransactions.map((tx: Transaction) => tx.id);
    const alertMessage = 'Atenção: Se houver compras parceladas nesta fatura, TODAS as parcelas (passadas e futuras) dessas compras também serão excluídas. Deseja continuar?';

    if (Platform.OS === 'web') {
      if (window.confirm(`${alertMessage}\n\nTem certeza que deseja excluir todos os lançamentos desta fatura?`)) {
        deleteMultipleTransactions(idsToDelete);
      }
    } else {
      Alert.alert('Excluir Fatura', alertMessage, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir Todos',
          style: 'destructive',
          onPress: () => deleteMultipleTransactions(idsToDelete)
        }
      ]);
    }
  }, [invoiceTransactions, isAll, deleteMultipleTransactions]);

  const handleEdit = useCallback(() => {
    setOptionsModalVisible(false);
    setTxToEdit(selectedTx);
    setIsEditing(true);
  }, [selectedTx]);

  const handleSelectTx = useCallback((tx: Transaction) => {
    setSelectedTx(tx);
    setOptionsModalVisible(true);
  }, []);

  const renderTransaction = useCallback(({ item: tx }: { item: Transaction }) => {
    const txCard = isAll ? accounts.find((a: Account) => a.id === tx.accountId) : null;
    return (
      <TransactionItem
        transaction={tx}
        account={txCard || undefined}
        colors={colors}
        onPress={handleSelectTx}
        showAccount={isAll}
      />
    );
  }, [isAll, accounts, colors, handleSelectTx]);

  const renderHeader = useCallback(() => {
    if (!selectedCard) return null;
    return (
      <View style={{ gap: 20, paddingBottom: 16 }}>
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => setMonthOffset((m) => m - 1)} style={styles.navBtn}>
            <Ionicons name='chevron-back' size={24} color={colors.foreground} />
          </TouchableOpacity>

          <View style={{ alignItems: 'center' }}>
            <Text style={[styles.monthTitle, { color: colors.foreground }]}>{MONTH_NAMES[targetMonth]} {targetYear}</Text>
          </View>

          <TouchableOpacity onPress={() => setMonthOffset((m) => m + 1)} style={styles.navBtn}>
            <Ionicons name='chevron-forward' size={24} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <View style={[styles.cardVisual, { backgroundColor: selectedCard.color }]}>
          <View style={styles.cardHeader}>
            <Ionicons name={selectedCard.icon as any} size={28} color="#FFF" />
            <Text style={styles.cardBrand}>{selectedCard.name.toUpperCase()}</Text>
          </View>

          <View style={styles.cardBody}>
            <Text style={styles.cardLabel}>Valor total da fatura</Text>
            <Text style={styles.cardAmount}>{formatCurrency(totalInvoice)}</Text>
          </View>

          <View style={styles.cardFooter}>
            <View style={styles.chip} />
            <View style={[styles.cardStatus, invoiceStatus === 'VENCIDA' && { backgroundColor: colors.destructive }]}>
              {invoiceStatus === 'VENCIDA' && <Ionicons name="alert-circle" size={12} color="#FFF" style={{ marginRight: 4 }} />}
              <Text style={styles.cardStatusText}>{invoiceStatus === 'ABERTA' ? 'FATURA EM ABERTO' : `FATURA ${invoiceStatus}`}</Text>
            </View>
          </View>
        </View>

        {!isAll && (
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={[styles.payButton, { backgroundColor: pendingInvoice > 0 ? colors.primary : colors.border, flex: 1 }]}
              disabled={pendingInvoice <= 0}
              onPress={handlePayInvoice}
            >
              <Ionicons name={pendingInvoice > 0 ? 'wallet-outline' : 'checkmark-circle-outline'} size={20} color={pendingInvoice > 0 ? '#FFF' : colors.mutedForeground} />
              <Text style={[styles.payButtonText, { color: pendingInvoice > 0 ? '#FFF' : colors.mutedForeground }]}>
                {pendingInvoice > 0 ? `Pagar Fatura` : 'Paga'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.payButton, { backgroundColor: globalPendingDebt > 0 ? colors.secondary : colors.border, marginLeft: 12, paddingHorizontal: 16 }]}
              disabled={globalPendingDebt <= 0}
              onPress={handleOpenAnticipate}
            >
              <Ionicons name="flash-outline" size={20} color={globalPendingDebt > 0 ? colors.foreground : colors.mutedForeground} />
              <Text style={[styles.payButtonText, { color: globalPendingDebt > 0 ? colors.foreground : colors.mutedForeground }]}>
                Antecipar
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>ITENS DA FATURA</Text>
            <Text style={[styles.itemCount, { color: colors.mutedForeground }]}>{invoiceTransactions.length} itens</Text>
          </View>

          {invoiceTransactions.length > 0 && !isAll && (
            <TouchableOpacity style={styles.deleteAllBtn} onPress={handleDeleteAllFromInvoice}>
              <Ionicons name="trash-outline" size={16} color={colors.destructive} />
              <Text style={[styles.deleteAllText, { color: colors.destructive }]}>Excluir Todos</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }, [selectedCard, colors, targetMonth, targetYear, totalInvoice, invoiceStatus, isAll, pendingInvoice, handlePayInvoice, globalPendingDebt, handleOpenAnticipate, invoiceTransactions.length, handleDeleteAllFromInvoice]);

  if (creditCards.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <Ionicons name='card-outline' size={64} color={colors.border} />
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhum cartão de crédito registado.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.carouselContainer, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselContent}>
          <TouchableOpacity
            onPress={() => setSelectedCardId('all')}
            style={[styles.cardSelectorItem, { backgroundColor: selectedCardId === 'all' ? colors.primary : 'transparent', borderColor: selectedCardId === 'all' ? colors.primary : colors.border }]}
          >
            <Ionicons name="albums" size={16} color={selectedCardId === 'all' ? '#FFF' : colors.foreground} style={{ marginRight: 6 }} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: selectedCardId === 'all' ? '#FFF' : colors.foreground }}>Todos</Text>
          </TouchableOpacity>

          {creditCards.map((card: Account) => {
            const isSelected = card.id === selectedCardId;
            return (
              <TouchableOpacity
                key={card.id}
                onPress={() => setSelectedCardId(card.id)}
                style={[styles.cardSelectorItem, { backgroundColor: isSelected ? card.color : 'transparent', borderColor: isSelected ? card.color : colors.border }]}
              >
                <Ionicons name={card.icon as any} size={16} color={isSelected ? '#FFF' : card.color} style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: isSelected ? '#FFF' : colors.foreground }}>{card.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={selectedCard ? invoiceTransactions : []}
        keyExtractor={(item) => item.id}
        renderItem={renderTransaction}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.content}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        ListEmptyComponent={
          selectedCard ? (
            <View style={[styles.txContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.emptyTxText, { color: colors.mutedForeground }]}>Nenhum gasto nesta fatura.</Text>
            </View>
          ) : null
        }
      />

      {/* MODAL DE SELEÇÃO DE TIPO DE PAGAMENTO (Para Web e suporte Mobile) */}
      <Modal visible={isPaymentTypeModalOpen} transparent animationType='slide'>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Pagar Fatura</Text>
            <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
              Como deseja registrar este pagamento?
            </Text>

            <View style={{ gap: 12, marginBottom: 24 }}>
              <TouchableOpacity
                style={[styles.paymentTypeOption, { borderColor: colors.border }]}
                onPress={() => handleSelectPaymentType('full')}
              >
                <View style={[styles.typeIconContainer, { backgroundColor: colors.primary + '20' }]}>
                  <Ionicons name="wallet-outline" size={24} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.typeOptionTitle, { color: colors.foreground }]}>Pagar e abater do saldo</Text>
                  <Text style={[styles.typeOptionDesc, { color: colors.mutedForeground }]}>Altera o status para paga e cria um lançamento de despesa.</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.paymentTypeOption, { borderColor: colors.border }]}
                onPress={() => handleSelectPaymentType('markOnly')}
              >
                <View style={[styles.typeIconContainer, { backgroundColor: colors.success + '20' }]}>
                  <Ionicons name="checkmark-done-outline" size={24} color={colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.typeOptionTitle, { color: colors.foreground }]}>Apenas marcar como paga</Text>
                  <Text style={[styles.typeOptionDesc, { color: colors.mutedForeground }]}>Altera o status estritamente para fins visuais.</Text>
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.cancelBtn, { width: '100%' }]} onPress={() => setIsPaymentTypeModalOpen(false)}>
              <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODALS DE PAGAMENTO, ANTECIPAÇÃO E OPÇÕES */}
      <Modal visible={isPaymentModalOpen} transparent animationType='slide'>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Pagar Fatura</Text>
            <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
              O valor de {formatCurrency(pendingInvoice)} será debitado da conta selecionada abaixo:
            </Text>

            <View style={styles.accountSelection}>
              {debitAccounts.map((acc: Account) => (
                <TouchableOpacity
                  key={acc.id}
                  style={[
                    styles.accountOption,
                    { borderColor: sourceAccountId === acc.id ? colors.primary : colors.border, backgroundColor: sourceAccountId === acc.id ? colors.primary + '10' : 'transparent' },
                  ]}
                  onPress={() => setSourceAccountId(acc.id)}
                >
                  <Ionicons name={acc.icon as any} size={20} color={acc.color} />
                  <Text style={[styles.accountOptionName, { color: colors.foreground }]}>{acc.name}</Text>
                  {sourceAccountId === acc.id && <Ionicons name='checkmark' size={18} color={colors.primary} style={{ marginLeft: 'auto' }} />}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsPaymentModalOpen(false)}>
                <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: colors.primary }]} onPress={confirmPayment}>
                <Text style={styles.confirmBtnText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isAnticipateModalOpen} transparent animationType='slide'>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Antecipar Pagamento</Text>
            <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
              Dívida total pendente: {formatCurrency(globalPendingDebt)}
            </Text>

            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: colors.mutedForeground, marginBottom: 8 }}>
                Valor a antecipar
              </Text>
              <TextInput
                style={{ fontSize: 32, fontWeight: '700', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 4, color: colors.foreground }}
                value={anticipateAmountStr}
                onChangeText={setAnticipateAmountStr}
                placeholder="0,00"
                keyboardType="decimal-pad"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: colors.mutedForeground, marginBottom: 8 }}>
              Debitar de:
            </Text>
            <View style={styles.accountSelection}>
              {debitAccounts.map((acc: Account) => (
                <TouchableOpacity
                  key={acc.id}
                  style={[
                    styles.accountOption,
                    { borderColor: anticipateSourceAccountId === acc.id ? colors.primary : colors.border, backgroundColor: anticipateSourceAccountId === acc.id ? colors.primary + '10' : 'transparent' },
                  ]}
                  onPress={() => setAnticipateSourceAccountId(acc.id)}
                >
                  <Ionicons name={acc.icon as any} size={20} color={acc.color} />
                  <Text style={[styles.accountOptionName, { color: colors.foreground }]}>{acc.name}</Text>
                  {anticipateSourceAccountId === acc.id && <Ionicons name='checkmark' size={18} color={colors.primary} style={{ marginLeft: 'auto' }} />}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsAnticipateModalOpen(false)}>
                <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: colors.primary }]} onPress={confirmAnticipation}>
                <Text style={styles.confirmBtnText}>Antecipar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={optionsModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setOptionsModalVisible(false)}>
          <View style={[styles.optionsMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.optionsTitle, { color: colors.foreground }]}>{selectedTx?.description}</Text>
            <TouchableOpacity style={styles.optionBtn} onPress={handleEdit}>
              <Ionicons name="pencil-outline" size={20} color={colors.primary} /><Text style={[styles.optionText, { color: colors.foreground }]}>Editar Lançamento</Text>
            </TouchableOpacity>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={styles.optionBtn} onPress={() => { if (selectedTx) deleteTransaction(selectedTx.id, 'all'); setOptionsModalVisible(false); }}>
              <Ionicons name="trash-outline" size={20} color={colors.destructive} /><Text style={[styles.optionText, { color: colors.destructive }]}>Excluir Compra Inteira</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {isEditing && txToEdit && (
        <AddTransactionModal
          visible={isEditing}
          onClose={() => { setIsEditing(false); setTxToEdit(null); }}
          onAdd={addTransaction}
          onUpdate={updateTransaction as any}
          accounts={accounts}
          transactionToEdit={txToEdit}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { marginTop: 16, fontSize: 16, fontWeight: '500' },
  carouselContainer: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  carouselContent: { paddingHorizontal: 16, gap: 12 },
  cardSelectorItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 20 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  navBtn: { padding: 8 },
  monthTitle: { fontSize: 18, fontWeight: '700' },
  cardVisual: { marginVertical: 4, padding: 24, borderRadius: 24, minHeight: 210, justifyContent: 'space-between', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardBrand: { color: '#FFF', fontSize: 13, fontWeight: '900', letterSpacing: 2 },
  cardBody: { marginTop: 12 },
  cardLabel: { color: '#FFF', fontSize: 13, opacity: 0.8, marginBottom: 2 },
  cardAmount: { color: '#FFF', fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  limitContainer: { marginTop: 24, gap: 6 },
  limitBarBackground: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  limitBarFill: { height: '100%', backgroundColor: '#FF8C00' },
  limitInfo: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  limitValue: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  limitLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '500', marginTop: 2 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 16 },
  chip: { width: 42, height: 28, backgroundColor: '#cca633', borderRadius: 6, opacity: 0.9 },
  cardStatus: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  cardStatusText: { color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  actionButtonsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  payButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 16, gap: 8 },
  payButtonText: { fontSize: 16, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  itemCount: { fontSize: 12, marginTop: 2 },
  deleteAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,59,48,0.1)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  deleteAllText: { fontSize: 12, fontWeight: '700' },
  txContainer: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  emptyTxText: { padding: 24, textAlign: 'center', fontSize: 14 },
  txItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  txInfo: { flex: 1, gap: 4 },
  txDesc: { fontSize: 15, fontWeight: '500' },
  txDate: { fontSize: 12 },
  txAmount: { fontSize: 15, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, borderWidth: 1 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  modalSubtitle: { fontSize: 14, lineHeight: 20, marginBottom: 24 },
  accountSelection: { gap: 12, marginBottom: 32 },
  accountOption: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, gap: 12 },
  accountOptionName: { fontSize: 15, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  cancelBtnText: { fontSize: 15, fontWeight: '600' },
  confirmBtn: { flex: 1, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  optionsMenu: { width: '80%', maxWidth: 350, borderRadius: 16, padding: 20, borderWidth: 1 },
  optionsTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  optionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  optionText: { fontSize: 16, fontWeight: '500' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  paymentTypeOption: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, gap: 16 },
  typeIconContainer: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  typeOptionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  typeOptionDesc: { fontSize: 12, lineHeight: 16 },
});