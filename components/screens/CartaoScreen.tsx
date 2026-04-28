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
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useStoreContext } from '@/context/StoreContext';
import {
  formatCurrency,
  formatDateShort,
} from '@/lib/utils';
import { Account, Transaction } from '@/constants/types';

import { AddTransactionModal } from '../AddTransactionModal';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function CartaoScreen() {
  const { colors } = useTheme();
  const {
    accounts,
    transactions,
    tags,
    payCreditCardInvoice,
    anticipateCreditCardPayment,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  } = useStoreContext() as any;

  const creditCards = useMemo(
    () => accounts.filter((a: Account) => a.type === 'cartao_credito'),
    [accounts],
  );

  // 'todos' será o nosso ID especial
  const [selectedCardId, setSelectedCardId] = useState<string | null>(
    creditCards.length > 0 ? 'todos' : null,
  );

  // Determina se estamos a visualizar um cartão específico ou o agregado ("todos")
  const isViewingAll = selectedCardId === 'todos';

  const selectedCard = useMemo(
    () => creditCards.find((c: Account) => c.id === selectedCardId) || null,
    [creditCards, selectedCardId],
  );

  const [monthOffset, setMonthOffset] = useState(0);

  useEffect(() => {
    setMonthOffset(0);
  }, [selectedCardId]);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [sourceAccountId, setSourceAccountId] = useState<string>('');

  const [isAnticipateModalOpen, setIsAnticipateModalOpen] = useState(false);
  const [anticipateAmountStr, setAnticipateAmountStr] = useState('');
  const [anticipateSourceAccountId, setAnticipateSourceAccountId] = useState<string>('');

  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [txToEdit, setTxToEdit] = useState<Transaction | null>(null);

  const getInvoiceForTx = (txDateStr: string, accountId: string) => {
    const card = accounts.find((c: Account) => c.id === accountId);
    const closingDay = card?.closingDay || 25;
    const dueDay = card?.dueDay || 5;
    const d = new Date(txDateStr);

    let m = d.getMonth() + 1;
    let y = d.getFullYear();

    if (d.getDate() >= closingDay) m += 1;
    if (dueDay < closingDay) m += 1;

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
    if (!selectedCard && !isViewingAll)
      return {
        totalInvoice: 0, pendingInvoice: 0, targetMonth: 0, targetYear: 2024,
        invoiceTransactions: [], limit: 0, availableLimit: 0, limitUsagePercent: 0,
        invoiceStatus: 'ZERADA', statusColor: colors.mutedForeground, globalPendingDebt: 0,
      };

    const baseDate = new Date();
    baseDate.setMonth(baseDate.getMonth() + monthOffset);

    // Para a vista "Todos", usamos as datas do calendário normal como referência base.
    // Vamos usar as regras do primeiro cartão ou um padrão para determinar o "Mês de Visualização".
    const defaultRefCardId = creditCards[0]?.id;
    const targetInvoice = getInvoiceForTx(baseDate.toISOString(), selectedCard ? selectedCard.id : defaultRefCardId);

    const tMonth = targetInvoice.viewMonth;
    const tYear = targetInvoice.viewYear;

    let invTxs: Transaction[] = [];
    let tInvoice = 0;
    let pInvoice = 0;
    let globalPendingDebtValue = 0;
    let totalLimit = 0;
    let totalAvailableLimit = 0;

    if (isViewingAll) {
      // Agregar dados de TODOS os cartões
      invTxs = transactions.filter((tx: Transaction) => {
        if (tx.paymentMethod !== 'credito') return false;
        // Na vista de todos, filtramos para que a fatura coincida com o mês/ano de visualização
        const txInv = getInvoiceForTx(tx.date, tx.accountId);
        return txInv.viewMonth === tMonth && txInv.viewYear === tYear;
      }).sort((a: Transaction, b: Transaction) => new Date(b.date).getTime() - new Date(a.date).getTime());

      tInvoice = invTxs.reduce((sum: number, tx: Transaction) => sum + (tx.type === 'receita' ? -tx.amount : tx.amount), 0);
      pInvoice = invTxs.filter((t: Transaction) => !t.paid).reduce((sum: number, tx: Transaction) => sum + (tx.type === 'receita' ? -tx.amount : tx.amount), 0);

      const openInvoiceDateStr = new Date().toISOString();

      globalPendingDebtValue = transactions
        .filter((tx: Transaction) => {
          if (tx.paymentMethod !== 'credito' || tx.paid) return false;
          const openInv = getInvoiceForTx(openInvoiceDateStr, tx.accountId);
          const txInv = getInvoiceForTx(tx.date, tx.accountId);
          return txInv.value >= openInv.value;
        })
        .reduce((sum: number, tx: Transaction) => sum + (tx.type === 'receita' ? -tx.amount : tx.amount), 0);

      totalLimit = creditCards.reduce((acc: number, card: Account) => acc + (card.creditLimit || 0), 0);
      totalAvailableLimit = Math.max(0, totalLimit - globalPendingDebtValue);

    } else if (selectedCard) {
      // Dados de UM cartão específico (lógica original)
      const tValue = targetInvoice.value;

      invTxs = transactions
        .filter((tx: Transaction) => {
          if (tx.accountId !== selectedCard.id || tx.paymentMethod !== 'credito') return false;
          const txInv = getInvoiceForTx(tx.date, tx.accountId);
          return txInv.value === tValue;
        })
        .sort((a: Transaction, b: Transaction) => new Date(b.date).getTime() - new Date(a.date).getTime());

      tInvoice = invTxs.reduce((sum: number, tx: Transaction) => sum + (tx.type === 'receita' ? -tx.amount : tx.amount), 0);
      pInvoice = invTxs.filter((t: Transaction) => !t.paid).reduce((sum: number, tx: Transaction) => sum + (tx.type === 'receita' ? -tx.amount : tx.amount), 0);

      const openInvoiceValue = getInvoiceForTx(new Date().toISOString(), selectedCard.id).value;

      globalPendingDebtValue = transactions
        .filter((tx: Transaction) => {
          if (tx.accountId !== selectedCard.id || tx.paymentMethod !== 'credito' || tx.paid) return false;
          const txInv = getInvoiceForTx(tx.date, tx.accountId);
          return txInv.value >= openInvoiceValue;
        })
        .reduce((sum: number, tx: Transaction) => sum + (tx.type === 'receita' ? -tx.amount : tx.amount), 0);

      totalLimit = selectedCard.creditLimit || 0;
      totalAvailableLimit = Math.max(0, totalLimit - globalPendingDebtValue);
    }

    const percent = totalLimit > 0 ? Math.min((globalPendingDebtValue / totalLimit) * 100, 100) : 0;

    let status = 'ABERTA';
    let color = colors.primary;

    // A lógica de estado (FUTURA, PAGA, etc) pode ficar ambígua ao agregar, vamos simplificar se for "Todos"
    if (isViewingAll) {
      const today = new Date();
      const currentTargetMonth = today.getMonth();
      const currentTargetYear = today.getFullYear();

      if (tYear > currentTargetYear || (tYear === currentTargetYear && tMonth > currentTargetMonth)) {
        status = 'FUTURA'; color = colors.warning;
      } else if (tInvoice <= 0) {
        status = 'ZERADA'; color = colors.mutedForeground;
      } else if (pInvoice <= 0 && tInvoice > 0) {
        status = 'PAGA'; color = colors.success;
      } else {
        status = 'ABERTA'; color = colors.primary;
      }
    } else if (selectedCard) {
      const openInvoiceValue = getInvoiceForTx(new Date().toISOString(), selectedCard.id).value;
      const tValue = targetInvoice.value;
      if (tValue < openInvoiceValue && pInvoice <= 0 && tInvoice > 0) {
        status = 'PAGA'; color = colors.success;
      } else if (tValue > openInvoiceValue) {
        status = 'FUTURA'; color = colors.warning;
      } else if (tInvoice <= 0) {
        status = 'ZERADA'; color = colors.mutedForeground;
      }
    }

    return {
      totalInvoice: tInvoice, pendingInvoice: pInvoice, targetMonth: tMonth, targetYear: tYear,
      invoiceTransactions: invTxs, limit: totalLimit, availableLimit: totalAvailableLimit, limitUsagePercent: percent,
      invoiceStatus: status, statusColor: color, globalPendingDebt: globalPendingDebtValue,
    };
  }, [selectedCard, isViewingAll, creditCards, transactions, monthOffset, colors]);

  const debitAccounts = useMemo(() => accounts.filter((a: Account) => a.type !== 'cartao_credito'), [accounts]);

  const handlePayInvoice = () => {
    if (isViewingAll) {
      Alert.alert('Aviso', 'Selecione um cartão específico para pagar a fatura.');
      return;
    }
    if (debitAccounts.length === 0) {
      Alert.alert('Aviso', 'Não tem nenhuma conta corrente cadastrada para pagar esta fatura.');
      return;
    }
    setSourceAccountId(debitAccounts[0].id);
    setIsPaymentModalOpen(true);
  };

  const confirmPayment = async () => {
    if (!selectedCard || !sourceAccountId || isViewingAll) return;
    try {
      await payCreditCardInvoice(selectedCard.id, sourceAccountId, targetMonth, targetYear);
      setIsPaymentModalOpen(false);
      Alert.alert('Sucesso', 'Fatura paga com sucesso!');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível processar o pagamento.');
    }
  };

  const handleOpenAnticipate = () => {
    if (isViewingAll) {
      Alert.alert('Aviso', 'Selecione um cartão específico para antecipar pagamentos.');
      return;
    }
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
  };

  const confirmAnticipation = async () => {
    if (!selectedCard || !anticipateSourceAccountId || isViewingAll) return;
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
      await anticipateCreditCardPayment(selectedCard.id, anticipateSourceAccountId, amount);
      setIsAnticipateModalOpen(false);
      Alert.alert('Sucesso', 'Fatura antecipada e limite liberado!');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível processar a antecipação.');
    }
  };

  const handleDeleteAllFromInvoice = () => {
    if (invoiceTransactions.length === 0) return;

    if (isViewingAll) {
      Alert.alert('Aviso', 'Selecione um cartão específico para realizar a exclusão em massa.');
      return;
    }

    const idsToDelete = invoiceTransactions.map((tx: Transaction) => tx.id);
    const alertMessage = 'Atenção: Se houver compras parceladas nesta fatura, TODAS as parcelas (passadas e futuras) dessas compras também serão excluídas. Deseja continuar?';

    if (Platform.OS === 'web') {
      if (window.confirm(`${alertMessage}\n\nTem certeza que deseja excluir todos os lançamentos desta fatura?`)) {
        idsToDelete.forEach((id: string) => deleteTransaction(id, 'all'));
      }
    } else {
      Alert.alert('Excluir Fatura', alertMessage, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir Todos', style: 'destructive', onPress: () => { idsToDelete.forEach((id: string) => deleteTransaction(id, 'all')); } }
      ]);
    }
  };

  const handleEdit = () => {
    setOptionsModalVisible(false);
    setTxToEdit(selectedTx);
    setIsEditing(true);
  };

  if (creditCards.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <Ionicons name='card-outline' size={64} color={colors.border} />
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhum cartão de crédito registado.</Text>
      </View>
    );
  }

  const renderTransaction = ({ item: tx }: { item: Transaction }) => {
    const isReceita = tx.type === 'receita';
    const amountColor = isReceita ? colors.success : colors.foreground;

    // Na vista "Todos", é útil ver qual o cartão da despesa
    const txCardName = isViewingAll ? creditCards.find((c: Account) => c.id === tx.accountId)?.name : null;

    return (
      <TouchableOpacity
        style={[styles.txItem, { borderBottomColor: colors.border }]}
        onPress={() => { setSelectedTx(tx); setOptionsModalVisible(true); }}
        activeOpacity={0.7}
      >
        <View style={styles.txInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.txDesc, { color: colors.foreground }]} numberOfLines={1}>{tx.description}</Text>
            {tx.paid && <Ionicons name='checkmark-circle' size={14} color={colors.success} />}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.txDate, { color: colors.mutedForeground }]}>{formatDateShort(tx.date)}</Text>
            {isViewingAll && txCardName && (
              <Text style={{ fontSize: 10, color: colors.primary, fontWeight: 'bold' }}>{txCardName}</Text>
            )}
          </View>
        </View>
        <Text style={[styles.txAmount, { color: amountColor }]}>{isReceita ? '+' : '-'}{formatCurrency(tx.amount)}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.carouselContainer, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselContent}>
          {/* 👉 BOTÃO "TODOS" */}
          <TouchableOpacity
            onPress={() => setSelectedCardId('todos')}
            style={[styles.cardSelectorItem, { backgroundColor: isViewingAll ? colors.foreground : 'transparent', borderColor: isViewingAll ? colors.foreground : colors.border }]}
          >
            <Ionicons name="card-outline" size={16} color={isViewingAll ? colors.background : colors.foreground} style={{ marginRight: 6 }} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: isViewingAll ? colors.background : colors.foreground }}>Todos</Text>
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

      {(selectedCard || isViewingAll) && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
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

          <View style={[styles.cardVisual, { backgroundColor: isViewingAll ? colors.card : selectedCard?.color, borderWidth: isViewingAll ? 1 : 0, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="card" size={28} color={isViewingAll ? colors.foreground : "#FFF"} />
              <Text style={[styles.cardBrand, { color: isViewingAll ? colors.foreground : "#FFF" }]}>
                {isViewingAll ? 'VISÃO GERAL' : selectedCard?.name.toUpperCase()}
              </Text>
            </View>

            <View style={styles.cardBody}>
              <Text style={[styles.cardLabel, { color: isViewingAll ? colors.mutedForeground : '#FFF' }]}>Valor total consolidado</Text>
              <Text style={[styles.cardAmount, { color: isViewingAll ? colors.foreground : '#FFF' }]}>{formatCurrency(totalInvoice)}</Text>

              <View style={styles.limitContainer}>
                <View style={[styles.limitBarBackground, { backgroundColor: isViewingAll ? colors.border : 'rgba(255,255,255,0.3)' }]}>
                  <View style={[styles.limitBarFill, { width: `${limitUsagePercent}%` }]} />
                </View>
                <View style={styles.limitInfo}>
                  <View>
                    <Text style={[styles.limitValue, { color: isViewingAll ? colors.foreground : '#FFF' }]}>{formatCurrency(globalPendingDebt)}</Text>
                    <Text style={[styles.limitLabel, { color: isViewingAll ? colors.mutedForeground : 'rgba(255,255,255,0.7)' }]}>Utilizado</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.limitValue, { color: isViewingAll ? colors.foreground : '#FFF' }]}>{formatCurrency(availableLimit)}</Text>
                    <Text style={[styles.limitLabel, { color: isViewingAll ? colors.mutedForeground : 'rgba(255,255,255,0.7)' }]}>Disponível</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.cardFooter}>
              {isViewingAll ? <View style={{ width: 42, height: 28 }} /> : <View style={styles.chip} />}
              <View style={[styles.cardStatus, isViewingAll && { backgroundColor: statusColor }]}>
                <Text style={[styles.cardStatusText, isViewingAll && { color: '#FFF' }]}>{invoiceStatus === 'ABERTA' ? 'EM ABERTO' : `FATURA ${invoiceStatus}`}</Text>
              </View>
            </View>
          </View>

          {/* Desabilita os botões se estivermos a ver 'Todos' */}
          <View style={[styles.actionButtonsRow, isViewingAll && { opacity: 0.5 }]}>
            <TouchableOpacity
              style={[styles.payButton, { backgroundColor: pendingInvoice > 0 ? colors.primary : colors.border, flex: 1 }]}
              disabled={pendingInvoice <= 0 || isViewingAll}
              onPress={handlePayInvoice}
            >
              <Ionicons name={pendingInvoice > 0 ? 'wallet-outline' : 'checkmark-circle-outline'} size={20} color={pendingInvoice > 0 ? '#FFF' : colors.mutedForeground} />
              <Text style={[styles.payButtonText, { color: pendingInvoice > 0 ? '#FFF' : colors.mutedForeground }]}>
                {pendingInvoice > 0 ? `Pagar Fatura` : 'Paga'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.payButton, { backgroundColor: globalPendingDebt > 0 ? colors.secondary : colors.border, marginLeft: 12, paddingHorizontal: 16 }]}
              disabled={globalPendingDebt <= 0 || isViewingAll}
              onPress={handleOpenAnticipate}
            >
              <Ionicons name="flash-outline" size={20} color={globalPendingDebt > 0 ? colors.foreground : colors.mutedForeground} />
              <Text style={[styles.payButtonText, { color: globalPendingDebt > 0 ? colors.foreground : colors.mutedForeground }]}>
                Antecipar
              </Text>
            </TouchableOpacity>
          </View>
          {isViewingAll && (
            <Text style={{ textAlign: 'center', fontSize: 11, color: colors.mutedForeground, marginTop: -8 }}>
              Selecione um cartão específico para pagar ou antecipar.
            </Text>
          )}

          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>ITENS DA FATURA</Text>
              <Text style={[styles.itemCount, { color: colors.mutedForeground }]}>{invoiceTransactions.length} itens</Text>
            </View>

            {invoiceTransactions.length > 0 && !isViewingAll && (
              <TouchableOpacity style={styles.deleteAllBtn} onPress={handleDeleteAllFromInvoice}>
                <Ionicons name="trash-outline" size={16} color={colors.destructive} />
                <Text style={[styles.deleteAllText, { color: colors.destructive }]}>Excluir Todos</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={[styles.txContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {invoiceTransactions.length === 0 ? (
              <Text style={[styles.emptyTxText, { color: colors.mutedForeground }]}>Nenhum gasto nesta fatura.</Text>
            ) : (
              <FlatList data={invoiceTransactions} keyExtractor={(item) => item.id} renderItem={renderTransaction} scrollEnabled={false} />
            )}
          </View>
        </ScrollView>
      )}

      {/* MODAL DE PAGAR FATURA */}
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

      {/* MODAL DE ANTECIPAR FATURA */}
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
          tags={tags}
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
});