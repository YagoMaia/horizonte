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
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useStoreContext } from '@/context/StoreContext';
import {
  formatCurrency,
  formatDateShort,
  getInvoiceForTx,
  getTransactionVisuals,
} from '@/lib/utils';
import { Account, Transaction } from '@/constants/types';

import { AddTransactionModal } from '../AddTransactionModal';
import { ConfirmDeleteModal } from '../ConfirmDeleteModal';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const MONTH_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const ALL_CARDS_VIRTUAL_ACCOUNT: Account = {
  id: 'all',
  name: 'Todos os Cartões',
  color: '#334155',
  type: 'cartao_credito',
  icon: 'albums',
  balance: 0,
};

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; emoji: string; color: string; bgOpacity: string }> = {
  PAGA:        { label: 'Paga',         emoji: '✅', color: '#22c55e', bgOpacity: '22' },
  ZERADA:      { label: 'Zerada',       emoji: '⬜', color: '#94a3b8', bgOpacity: '18' },
  ABERTA:      { label: 'Em Aberto',    emoji: '🔓', color: '#f59e0b', bgOpacity: '22' },
  FUTURA:      { label: 'Futura',       emoji: '🔮', color: '#a78bfa', bgOpacity: '22' },
  CONSOLIDADA: { label: 'Consolidada',  emoji: '📋', color: '#60a5fa', bgOpacity: '22' },
};

// ─── Invoice Timeline Item ────────────────────────────────────────────────────
interface TimelineMonth {
  month: number;
  year: number;
  offset: number;
  total: number;
  pending: number;
  status: string;
}

function buildTimelineForCard(
  card: Account,
  transactions: Transaction[],
  centeredOffset: number,
): TimelineMonth[] {
  const result: TimelineMonth[] = [];
  const today = new Date();
  const openInvoiceValue = getInvoiceForTx(today.toISOString(), card).value;

  for (let delta = centeredOffset - 2; delta <= centeredOffset + 2; delta++) {
    const base = new Date();
    base.setMonth(base.getMonth() + delta);
    const inv = getInvoiceForTx(base.toISOString(), card);
    const tValue = inv.value;

    const invTxs = transactions.filter((tx: Transaction) => {
      if (tx.accountId !== card.id || tx.paymentMethod !== 'credito') return false;
      return getInvoiceForTx(tx.date, card).value === tValue;
    });

    const total = invTxs.reduce((s, tx) => s + (tx.type === 'receita' ? -tx.amount : tx.amount), 0);
    const pending = invTxs.filter(t => !t.paid).reduce((s, tx) => s + (tx.type === 'receita' ? -tx.amount : tx.amount), 0);

    let status = 'ABERTA';
    if (tValue < openInvoiceValue && pending <= 0 && total > 0) status = 'PAGA';
    else if (tValue > openInvoiceValue) status = 'FUTURA';
    else if (total <= 0) status = 'ZERADA';

    result.push({ month: inv.viewMonth, year: inv.viewYear, offset: delta, total, pending, status });
  }
  return result;
}

// ─── Simulation types ─────────────────────────────────────────────────────────
interface SimulationResult {
  type: 'debito' | 'credito';
  amount: number;
  installments: number;
  installmentValue: number;
  impactedMonths: Array<{ month: number; year: number; value: number; originalInvoiceTotal: number }>;
  currentBalance: number;
  balanceAfterDebit: number;
}

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

  const [selectedCardId, setSelectedCardId] = useState<string | null>(
    creditCards.length > 1 ? 'all' : (creditCards.length === 1 ? creditCards[0].id : null),
  );

  useEffect(() => {
    if (creditCards.length === 1 && selectedCardId === 'all') {
      setSelectedCardId(creditCards[0].id);
    } else if (creditCards.length > 1 && selectedCardId === null) {
      setSelectedCardId('all');
    } else if (creditCards.length === 0 && selectedCardId !== null) {
      setSelectedCardId(null);
    }
  }, [creditCards, selectedCardId]);

  const selectedCard = useMemo(() => {
    if (selectedCardId === 'all') return ALL_CARDS_VIRTUAL_ACCOUNT;
    return creditCards.find((c: Account) => c.id === selectedCardId) || null;
  }, [creditCards, selectedCardId]);

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
  const [sourceAccountId, setSourceAccountId] = useState<string>('');
  const [isAnticipateModalOpen, setIsAnticipateModalOpen] = useState(false);
  const [anticipateAmountStr, setAnticipateAmountStr] = useState('');
  const [anticipateSourceAccountId, setAnticipateSourceAccountId] = useState<string>('');
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [txToEdit, setTxToEdit] = useState<Transaction | null>(null);
  const [showDeleteInvoiceConfirm, setShowDeleteInvoiceConfirm] = useState(false);
  const [showDeleteTransactionConfirm, setShowDeleteTransactionConfirm] = useState(false);

  // ─── Simulation state ──────────────────────────────────────────────────────
  const [isSimModalOpen, setIsSimModalOpen] = useState(false);
  const [simType, setSimType] = useState<'debito' | 'credito'>('debito');
  const [simAmountStr, setSimAmountStr] = useState('');
  const [simInstallmentsStr, setSimInstallmentsStr] = useState('1');
  const [simCardId, setSimCardId] = useState<string>('');
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);

  const {
    totalInvoice,
    pendingInvoice,
    targetMonth,
    targetYear,
    invoiceTransactions,
    availableLimit,
    limitUsagePercent,
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

    if (selectedCard.id === 'all') {
      let tInvoice = 0;
      let pInvoice = 0;
      let globalDebt = 0;
      let tLimit = 0;
      let tAvailable = 0;
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
          return getInvoiceForTx(tx.date, card).value >= openInvoiceValue;
        }).reduce((sum: number, tx: Transaction) => sum + (tx.type === 'receita' ? -tx.amount : tx.amount), 0);

        globalDebt += cardDebt;
        const cLimit = card.creditLimit || 0;
        tLimit += cLimit;
        tAvailable += Math.max(0, cLimit - cardDebt);
      });

      allTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const percent = tLimit > 0 ? Math.min((globalDebt / tLimit) * 100, 100) : 0;

      let status = 'CONSOLIDADA';
      if (pInvoice <= 0 && tInvoice > 0) { status = 'PAGA'; }
      else if (tInvoice <= 0) { status = 'ZERADA'; }

      const refInvoice = creditCards.length > 0 ? getInvoiceForTx(baseDate.toISOString(), creditCards[0]) : { viewMonth: baseDate.getMonth(), viewYear: baseDate.getFullYear() };

      return {
        totalInvoice: tInvoice, pendingInvoice: pInvoice, targetMonth: refInvoice.viewMonth, targetYear: refInvoice.viewYear,
        invoiceTransactions: allTxs, limit: tLimit, availableLimit: tAvailable, limitUsagePercent: percent,
        invoiceStatus: status, globalPendingDebt: globalDebt, isAll: true
      };
    }

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
        return getInvoiceForTx(tx.date, selectedCard).value >= openInvoiceValue;
      })
      .reduce((sum: number, tx: Transaction) => sum + (tx.type === 'receita' ? -tx.amount : tx.amount), 0);

    const cLimit = selectedCard.creditLimit || 0;
    const aLimit = Math.max(0, cLimit - globalPendingDebtValue);
    const percent = cLimit > 0 ? Math.min((globalPendingDebtValue / cLimit) * 100, 100) : 0;

    let status = 'ABERTA';
    if (tValue < openInvoiceValue && pInvoice <= 0 && tInvoice > 0) {
      status = 'PAGA';
    } else if (tValue > openInvoiceValue) {
      status = 'FUTURA';
    } else if (tInvoice <= 0) {
      status = 'ZERADA';
    }

    return {
      totalInvoice: tInvoice, pendingInvoice: pInvoice, targetMonth: tMonth, targetYear: tYear,
      invoiceTransactions: invTxs, limit: cLimit, availableLimit: aLimit, limitUsagePercent: percent,
      invoiceStatus: status, globalPendingDebt: globalPendingDebtValue, isAll: false
    };
  }, [selectedCard, transactions, monthOffset, colors, creditCards]);

  // Invoice timeline for the selected single card
  const invoiceTimeline = useMemo<TimelineMonth[]>(() => {
    if (!selectedCard || selectedCard.id === 'all') return [];
    return buildTimelineForCard(selectedCard, transactions, monthOffset);
  }, [selectedCard, transactions, monthOffset]);

  const debitAccounts = useMemo(() => accounts.filter((a: Account) => a.type !== 'cartao_credito'), [accounts]);

  const handlePayInvoice = () => {
    if (debitAccounts.length === 0) {
      Alert.alert('Aviso', 'Não tem nenhuma conta corrente cadastrada para pagar esta fatura.');
      return;
    }
    setSourceAccountId(debitAccounts[0].id);
    setIsPaymentModalOpen(true);
  };

  const confirmPayment = async () => {
    if (!selectedCard || !sourceAccountId || selectedCard.id === 'all') return;
    try {
      await payCreditCardInvoice(selectedCard.id, sourceAccountId, targetMonth, targetYear);
      setIsPaymentModalOpen(false);
      Alert.alert('Sucesso', 'Fatura paga com sucesso!');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível processar o pagamento.');
    }
  };

  const handleOpenAnticipate = () => {
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
  };

  const handleDeleteAllFromInvoice = () => {
    if (invoiceTransactions.length === 0 || isAll) return;
    setShowDeleteInvoiceConfirm(true);
  };

  const confirmDeleteAllFromInvoice = () => {
    const idsToDelete = invoiceTransactions.map((tx: Transaction) => tx.id);
    deleteMultipleTransactions(idsToDelete);
    setShowDeleteInvoiceConfirm(false);
  };

  const handleEdit = () => {
    setOptionsModalVisible(false);
    setTxToEdit(selectedTx);
    setIsEditing(true);
  };

  // ─── Simulation logic ─────────────────────────────────────────────────────
  const runSimulation = () => {
    const amount = parseFloat(simAmountStr.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Erro', 'Digite um valor válido maior que zero.');
      return;
    }

    const installments = Math.max(1, parseInt(simInstallmentsStr) || 1);
    const installmentValue = amount / installments;

    const currentBalance = accounts
      .filter((a: Account) => a.type !== 'cartao_credito')
      .reduce((s: number, a: Account) => s + a.balance, 0);

    const now = new Date();

    if (simType === 'debito') {
      setSimResult({
        type: 'debito',
        amount,
        installments: 1,
        installmentValue: amount,
        impactedMonths: [{ month: now.getMonth(), year: now.getFullYear(), value: amount, originalInvoiceTotal: 0 }],
        currentBalance,
        balanceAfterDebit: currentBalance - amount,
      });
    } else {
      // Crédito parcelado — calcula fatura de cada parcela
      const card = creditCards.find((c: Account) => c.id === simCardId) || creditCards[0];
      if (!card) {
        Alert.alert('Erro', 'Selecione um cartão para simular o crédito.');
        return;
      }

      const impacted: Array<{ month: number; year: number; value: number; originalInvoiceTotal: number }> = [];
      for (let i = 0; i < installments; i++) {
        const purchaseDate = new Date();
        purchaseDate.setMonth(purchaseDate.getMonth() + i);
        const inv = getInvoiceForTx(purchaseDate.toISOString(), card);

        // Calcular o total existente para essa fatura específica
        const invoiceTotalExistent = transactions
          .filter((tx: Transaction) => {
            if (tx.accountId !== card.id || tx.paymentMethod !== 'credito') return false;
            return getInvoiceForTx(tx.date, card).value === inv.value;
          })
          .reduce((sum: number, tx: Transaction) => sum + (tx.type === 'receita' ? -tx.amount : tx.amount), 0);

        const existing = impacted.find(m => m.month === inv.viewMonth && m.year === inv.viewYear);
        if (existing) {
          existing.value += installmentValue;
        } else {
          impacted.push({
            month: inv.viewMonth,
            year: inv.viewYear,
            value: installmentValue,
            originalInvoiceTotal: invoiceTotalExistent,
          });
        }
      }

      setSimResult({
        type: 'credito',
        amount,
        installments,
        installmentValue,
        impactedMonths: impacted,
        currentBalance,
        balanceAfterDebit: currentBalance,
      });
    }
  };

  const openSimModal = () => {
    setSimResult(null);
    setSimAmountStr('');
    setSimInstallmentsStr('1');
    setSimType('debito');
    if (creditCards.length > 0) setSimCardId(creditCards[0].id);
    setIsSimModalOpen(true);
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
    const visuals = getTransactionVisuals(tx.type, colors);
    const txCard = isAll ? accounts.find((a: Account) => a.id === tx.accountId) : null;

    return (
      <TouchableOpacity
        style={[styles.txItem, { borderBottomColor: colors.border }]}
        onPress={() => { setSelectedTx(tx); setOptionsModalVisible(true); }}
        activeOpacity={0.7}
      >
        <View style={[styles.txIcon, { backgroundColor: visuals.bgColor }]}>
          <Ionicons name={visuals.icon as any} size={18} color={visuals.color} />
        </View>
        <View style={styles.txInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.txDesc, { color: colors.foreground }]} numberOfLines={1}>{tx.description}</Text>
            {tx.paid && <Ionicons name='checkmark-circle' size={14} color={colors.success} />}
            {tx.totalInstallments && tx.totalInstallments > 1 && (
              <View style={[styles.installmentBadge, { backgroundColor: colors.primary + '20' }]}>
                <Text style={[styles.installmentBadgeText, { color: colors.primary }]}>
                  {tx.installmentNumber}/{tx.totalInstallments}x
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.txDate, { color: colors.mutedForeground }]}>
            {formatDateShort(tx.date)} {isAll && txCard ? `• ${txCard.name}` : ''}
          </Text>
        </View>
        <Text style={[styles.txAmount, { color: visuals.color }]}>{visuals.prefix}{formatCurrency(tx.amount)}</Text>
      </TouchableOpacity>
    );
  };

  const statusCfg = STATUS_CONFIG[invoiceStatus] || STATUS_CONFIG['ZERADA'];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Card selector carousel */}
      <View style={[styles.carouselContainer, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselContent}>
          {creditCards.length > 1 && (
            <TouchableOpacity
              onPress={() => setSelectedCardId('all')}
              style={[styles.cardSelectorItem, { backgroundColor: selectedCardId === 'all' ? colors.primary : 'transparent', borderColor: selectedCardId === 'all' ? colors.primary : colors.border }]}
            >
              <Ionicons name="albums" size={16} color={selectedCardId === 'all' ? '#FFF' : colors.foreground} style={{ marginRight: 6 }} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: selectedCardId === 'all' ? '#FFF' : colors.foreground }}>Todos</Text>
            </TouchableOpacity>
          )}

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

      {selectedCard && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {/* Month navigator */}
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

          {/* ─── Card Visual ──────────────────────────────────────── */}
          <View style={[styles.cardVisual, { backgroundColor: selectedCard.color }]}>
            <View style={styles.cardHeader}>
              <Ionicons name={selectedCard.icon as any} size={28} color="#FFF" />
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
              {/* ─── Status badge (improved) */}
              <View style={[styles.cardStatus, { backgroundColor: statusCfg.color + '30' }]}>
                <Text style={styles.cardStatusEmoji}>{statusCfg.emoji}</Text>
                <Text style={[styles.cardStatusText, { color: '#FFF' }]}>
                  {invoiceStatus === 'ABERTA' ? 'FATURA EM ABERTO' : `FATURA ${invoiceStatus}`}
                </Text>
              </View>
            </View>
          </View>

          {/* ─── Invoice Status Detail Card (below main card) ─────── */}
          <InvoiceStatusCard
            status={invoiceStatus}
            totalInvoice={totalInvoice}
            pendingInvoice={pendingInvoice}
            colors={colors}
            selectedCard={selectedCard}
          />

          {/* ─── Invoice Timeline (only for single card) ──────────── */}
          {!isAll && invoiceTimeline.length > 0 && (
            <View style={[styles.timelineContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground, marginBottom: 12 }]}>LINHA DO TEMPO</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {invoiceTimeline.map((item, idx) => {
                  const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG['ZERADA'];
                  const isCurrent = item.offset === monthOffset;
                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => setMonthOffset(item.offset)}
                      style={[
                        styles.timelineItem,
                        {
                          backgroundColor: isCurrent ? cfg.color + '22' : colors.secondary,
                          borderColor: isCurrent ? cfg.color : colors.border,
                          borderWidth: isCurrent ? 2 : StyleSheet.hairlineWidth,
                        },
                      ]}
                    >
                      <Text style={[styles.timelineMonth, { color: isCurrent ? cfg.color : colors.mutedForeground }]}>
                        {MONTH_ABBR[item.month]}
                      </Text>
                      <Text style={[styles.timelineEmoji]}>{cfg.emoji}</Text>
                      <Text style={[styles.timelineAmount, { color: item.total > 0 ? colors.destructive : colors.mutedForeground }]}>
                        {item.total > 0 ? formatCurrency(item.total) : 'Zerada'}
                      </Text>
                      {item.pending > 0 && (
                        <View style={[styles.timelinePendingDot, { backgroundColor: '#f59e0b' }]} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* ─── Action Buttons ───────────────────────────────────── */}
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

          {/* ─── Simulation Button ───────────────────────────────── */}
          <TouchableOpacity
            style={[styles.simButton, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}
            onPress={openSimModal}
          >
            <Ionicons name="calculator-outline" size={20} color={colors.primary} />
            <Text style={[styles.simButtonText, { color: colors.primary }]}>Simular Compra</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>

          {/* ─── Invoice items ────────────────────────────────────── */}
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

          <View style={[styles.txContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {invoiceTransactions.length === 0 ? (
              <Text style={[styles.emptyTxText, { color: colors.mutedForeground }]}>Nenhum gasto nesta fatura.</Text>
            ) : (
              <FlatList data={invoiceTransactions} keyExtractor={(item) => item.id} renderItem={renderTransaction} scrollEnabled={false} />
            )}
          </View>
        </ScrollView>
      )}

      {/* ─── Payment Modal ────────────────────────────────────────── */}
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
                  style={[styles.accountOption, { borderColor: sourceAccountId === acc.id ? colors.primary : colors.border, backgroundColor: sourceAccountId === acc.id ? colors.primary + '10' : 'transparent' }]}
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

      {/* ─── Anticipate Modal ─────────────────────────────────────── */}
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
                  style={[styles.accountOption, { borderColor: anticipateSourceAccountId === acc.id ? colors.primary : colors.border, backgroundColor: anticipateSourceAccountId === acc.id ? colors.primary + '10' : 'transparent' }]}
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

      {/* ─── Options Modal ────────────────────────────────────────── */}
      <Modal visible={optionsModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setOptionsModalVisible(false)}>
          <View style={[styles.optionsMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.optionsTitle, { color: colors.foreground }]}>{selectedTx?.description}</Text>
            <TouchableOpacity style={styles.optionBtn} onPress={handleEdit}>
              <Ionicons name="pencil-outline" size={20} color={colors.primary} /><Text style={[styles.optionText, { color: colors.foreground }]}>Editar Lançamento</Text>
            </TouchableOpacity>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={styles.optionBtn} onPress={() => { setOptionsModalVisible(false); setShowDeleteTransactionConfirm(true); }}>
              <Ionicons name="trash-outline" size={20} color={colors.destructive} /><Text style={[styles.optionText, { color: colors.destructive }]}>Excluir Compra Inteira</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Simulation Modal ─────────────────────────────────────── */}
      <Modal visible={isSimModalOpen} transparent animationType='slide'>
        <View style={styles.modalOverlay}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.simModalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Header */}
              <View style={styles.simHeader}>
                <View style={[styles.simIconBg, { backgroundColor: colors.primary + '20' }]}>
                  <Ionicons name="calculator" size={24} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: colors.foreground, marginBottom: 2 }]}>Simular Compra</Text>
                  <Text style={[styles.modalSubtitle, { color: colors.mutedForeground, marginBottom: 0 }]}>
                    Veja o impacto no seu horizonte financeiro
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setIsSimModalOpen(false)}>
                  <Ionicons name="close" size={24} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              {/* Type Toggle */}
              <View style={[styles.simTypeRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                {(['debito', 'credito'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => { setSimType(t); setSimResult(null); }}
                    style={[styles.simTypeBtn, simType === t && { backgroundColor: colors.card, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }]}
                  >
                    <Ionicons
                      name={t === 'debito' ? 'card-outline' : 'layers-outline'}
                      size={16}
                      color={simType === t ? colors.primary : colors.mutedForeground}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.simTypeBtnText, { color: simType === t ? colors.primary : colors.mutedForeground, fontWeight: simType === t ? '700' : '500' }]}>
                      {t === 'debito' ? 'Débito' : 'Crédito'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Amount input */}
              <View style={[styles.simInputBlock, { borderColor: colors.border }]}>
                <Text style={[styles.simInputLabel, { color: colors.mutedForeground }]}>VALOR DA COMPRA</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.simCurrencyPrefix, { color: colors.mutedForeground }]}>R$</Text>
                  <TextInput
                    style={[styles.simAmountInput, { color: colors.foreground }]}
                    value={simAmountStr}
                    onChangeText={(v) => { setSimAmountStr(v); setSimResult(null); }}
                    placeholder="0,00"
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
              </View>

              {simType === 'credito' && (
                <>
                  {/* Installments */}
                  <View style={[styles.simInputBlock, { borderColor: colors.border }]}>
                    <Text style={[styles.simInputLabel, { color: colors.mutedForeground }]}>NÚMERO DE PARCELAS</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <TouchableOpacity
                        onPress={() => { setSimInstallmentsStr(String(Math.max(1, parseInt(simInstallmentsStr || '1') - 1))); setSimResult(null); }}
                        style={[styles.installmentBtn, { borderColor: colors.border }]}
                      >
                        <Ionicons name="remove" size={20} color={colors.foreground} />
                      </TouchableOpacity>
                      <TextInput
                        style={[styles.installmentInput, { color: colors.foreground, borderColor: colors.border }]}
                        value={simInstallmentsStr}
                        onChangeText={(v) => { setSimInstallmentsStr(v.replace(/[^0-9]/g, '')); setSimResult(null); }}
                        keyboardType="number-pad"
                        textAlign="center"
                      />
                      <TouchableOpacity
                        onPress={() => { setSimInstallmentsStr(String(Math.min(48, parseInt(simInstallmentsStr || '1') + 1))); setSimResult(null); }}
                        style={[styles.installmentBtn, { borderColor: colors.border }]}
                      >
                        <Ionicons name="add" size={20} color={colors.foreground} />
                      </TouchableOpacity>
                      <Text style={[styles.installmentSuffix, { color: colors.mutedForeground }]}>
                        {parseInt(simInstallmentsStr) > 1
                          ? `= ${formatCurrency((parseFloat(simAmountStr.replace(',', '.')) || 0) / (parseInt(simInstallmentsStr) || 1))}/mês`
                          : 'parcela'}
                      </Text>
                    </View>
                  </View>

                  {/* Card selector for credit */}
                  {creditCards.length > 1 && (
                    <View style={{ marginBottom: 16 }}>
                      <Text style={[styles.simInputLabel, { color: colors.mutedForeground, marginBottom: 8 }]}>CARTÃO PARA SIMULAR</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                        {creditCards.map((card: Account) => (
                          <TouchableOpacity
                            key={card.id}
                            onPress={() => { setSimCardId(card.id); setSimResult(null); }}
                            style={[styles.simCardChip, {
                              backgroundColor: simCardId === card.id ? card.color : colors.secondary,
                              borderColor: simCardId === card.id ? card.color : colors.border,
                            }]}
                          >
                            <Ionicons name={card.icon as any} size={14} color={simCardId === card.id ? '#FFF' : card.color} />
                            <Text style={[styles.simCardChipText, { color: simCardId === card.id ? '#FFF' : colors.foreground }]}>{card.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </>
              )}

              {/* Run simulation button */}
              <TouchableOpacity
                style={[styles.runSimBtn, { backgroundColor: colors.primary }]}
                onPress={runSimulation}
              >
                <Ionicons name="flash" size={18} color="#FFF" />
                <Text style={styles.runSimBtnText}>Ver Impacto</Text>
              </TouchableOpacity>

              {/* ─── Result ──────────────────────────────────────── */}
              {simResult && (
                <View style={[styles.simResultContainer, { borderColor: colors.border }]}>
                  <Text style={[styles.simResultTitle, { color: colors.foreground }]}>📊 Resultado da Simulação</Text>

                  {/* Summary row */}
                  <View style={[styles.simSummaryRow, { backgroundColor: colors.secondary, borderRadius: 12 }]}>
                    <View style={styles.simSummaryItem}>
                      <Text style={[styles.simSummaryLabel, { color: colors.mutedForeground }]}>Saldo Atual</Text>
                      <Text style={[styles.simSummaryValue, { color: colors.foreground }]}>{formatCurrency(simResult.currentBalance)}</Text>
                    </View>
                    <View style={[styles.simSummaryDivider, { backgroundColor: colors.border }]} />
                    {simResult.type === 'debito' ? (
                      <View style={styles.simSummaryItem}>
                        <Text style={[styles.simSummaryLabel, { color: colors.mutedForeground }]}>Saldo Após</Text>
                        <Text style={[styles.simSummaryValue, { color: simResult.balanceAfterDebit < 0 ? colors.destructive : colors.success }]}>
                          {formatCurrency(simResult.balanceAfterDebit)}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.simSummaryItem}>
                        <Text style={[styles.simSummaryLabel, { color: colors.mutedForeground }]}>Total Parcelado</Text>
                        <Text style={[styles.simSummaryValue, { color: colors.warning }]}>{formatCurrency(simResult.amount)}</Text>
                      </View>
                    )}
                  </View>

                  {/* Debit warning */}
                  {simResult.type === 'debito' && simResult.balanceAfterDebit < 0 && (
                    <View style={[styles.simWarning, { backgroundColor: colors.dangerLight || colors.destructive + '18', borderColor: colors.destructive + '40' }]}>
                      <Ionicons name="warning" size={16} color={colors.destructive} />
                      <Text style={[styles.simWarningText, { color: colors.destructive }]}>
                        Esta compra deixaria seu saldo negativo em {formatCurrency(Math.abs(simResult.balanceAfterDebit))}.
                      </Text>
                    </View>
                  )}

                  {/* Impacted months */}
                  {simResult.type === 'credito' && (
                    <>
                      <Text style={[styles.simImpactTitle, { color: colors.mutedForeground }]}>
                        IMPACTO NAS FATURAS ({simResult.installments}x de {formatCurrency(simResult.installmentValue)})
                      </Text>
                      {simResult.impactedMonths.map((m, i) => {
                        const originalTotal = m.originalInvoiceTotal || 0;
                        const projectedTotal = originalTotal + m.value;
                        return (
                          <View key={i} style={[styles.simImpactRow, { borderBottomColor: colors.border, alignItems: 'center' }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <View style={[styles.simMonthDot, { backgroundColor: colors.primary }]} />
                              <View>
                                <Text style={[styles.simImpactMonth, { color: colors.foreground }]}>
                                  {MONTH_NAMES[m.month]} {m.year}
                                </Text>
                                <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>
                                  Atual: {formatCurrency(originalTotal)} • Parc: +{formatCurrency(m.value)}
                                </Text>
                              </View>
                            </View>
                            <Text style={[styles.simImpactValue, { color: colors.destructive, fontWeight: '700' }]}>
                              {formatCurrency(projectedTotal)}
                            </Text>
                          </View>
                        );
                      })}
                    </>
                  )}

                  {simResult.type === 'debito' && (
                    <View style={[styles.simImpactRow, { borderBottomColor: colors.border }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={[styles.simMonthDot, { backgroundColor: colors.primary }]} />
                        <Text style={[styles.simImpactMonth, { color: colors.foreground }]}>
                          {MONTH_NAMES[new Date().getMonth()]} {new Date().getFullYear()} (hoje)
                        </Text>
                      </View>
                      <Text style={[styles.simImpactValue, { color: colors.destructive }]}>
                        -{formatCurrency(simResult.amount)}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>

      <ConfirmDeleteModal
        visible={showDeleteInvoiceConfirm}
        title="Excluir faturas?"
        description="Atenção: Se houver compras parceladas nesta fatura, TODAS as parcelas (passadas e futuras) dessas compras também serão excluídas. Deseja continuar?"
        onClose={() => setShowDeleteInvoiceConfirm(false)}
        onConfirm={confirmDeleteAllFromInvoice}
      />

      <ConfirmDeleteModal
        visible={showDeleteTransactionConfirm}
        title="Excluir compra?"
        description={`Deseja excluir "${selectedTx?.description}"? Se for uma compra parcelada, todas as parcelas serão removidas.`}
        onClose={() => setShowDeleteTransactionConfirm(false)}
        onConfirm={() => { if (selectedTx) { deleteTransaction(selectedTx.id, 'all'); setShowDeleteTransactionConfirm(false); } }}
      />

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

// ─── Invoice Status Detail Card ────────────────────────────────────────────────
function InvoiceStatusCard({
  status, totalInvoice, pendingInvoice, colors, selectedCard,
}: {
  status: string; totalInvoice: number; pendingInvoice: number; colors: any; selectedCard: Account;
}) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['ZERADA'];
  if (selectedCard.id === 'all') return null;

  const messages: Record<string, string> = {
    PAGA: 'Esta fatura já foi paga integralmente. Parabéns! 🎉',
    ZERADA: 'Nenhum gasto nesta fatura. Seu cartão está sem uso neste mês.',
    ABERTA: pendingInvoice > 0
      ? `Ainda há ${formatCurrency(pendingInvoice)} pendentes de pagamento nesta fatura.`
      : 'Fatura em aberto, mas todos os itens estão marcados como pagos.',
    FUTURA: 'Esta fatura ainda não fechou. As compras realizadas aqui aparecerão na próxima fatura.',
    CONSOLIDADA: `Total consolidado de todos os cartões: ${formatCurrency(totalInvoice)}.`,
  };

  return (
    <View style={[invoiceCardStyles.container, { backgroundColor: cfg.color + '12', borderColor: cfg.color + '30' }]}>
      <View style={invoiceCardStyles.row}>
        <View style={[invoiceCardStyles.iconBg, { backgroundColor: cfg.color + '25' }]}>
          <Text style={{ fontSize: 20 }}>{cfg.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[invoiceCardStyles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
          <Text style={[invoiceCardStyles.message, { color: colors.mutedForeground }]}>
            {messages[status] || ''}
          </Text>
        </View>
      </View>

      {status === 'ABERTA' && pendingInvoice > 0 && (
        <View style={[invoiceCardStyles.pendingRow, { borderTopColor: cfg.color + '25' }]}>
          <Text style={[invoiceCardStyles.pendingLabel, { color: colors.mutedForeground }]}>A pagar</Text>
          <Text style={[invoiceCardStyles.pendingValue, { color: cfg.color }]}>{formatCurrency(pendingInvoice)}</Text>
        </View>
      )}
    </View>
  );
}

const invoiceCardStyles = StyleSheet.create({
  container: { borderRadius: 16, borderWidth: 1, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconBg: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statusLabel: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
  message: { fontSize: 13, lineHeight: 18 },
  pendingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  pendingLabel: { fontSize: 12, fontWeight: '600' },
  pendingValue: { fontSize: 18, fontWeight: '800' },
});

const styles = StyleSheet.create({
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { marginTop: 16, fontSize: 16, fontWeight: '500' },
  carouselContainer: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  carouselContent: { paddingHorizontal: 16, gap: 12 },
  cardSelectorItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
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
  cardStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  cardStatusEmoji: { fontSize: 14 },
  cardStatusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  // Timeline
  timelineContainer: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  timelineItem: { alignItems: 'center', padding: 12, borderRadius: 12, minWidth: 88, gap: 4, position: 'relative' },
  timelineMonth: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  timelineEmoji: { fontSize: 18 },
  timelineAmount: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  timelinePendingDot: { position: 'absolute', top: 8, right: 8, width: 6, height: 6, borderRadius: 3 },
  // Action buttons
  actionButtonsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  payButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 16, gap: 8 },
  payButtonText: { fontSize: 16, fontWeight: '700' },
  // Simulation button
  simButton: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, gap: 10 },
  simButtonText: { fontSize: 15, fontWeight: '700' },
  // Section
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, marginBottom: 8 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
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
  txIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  installmentBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  installmentBadgeText: { fontSize: 10, fontWeight: '700' },
  // Modals
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
  optionsMenu: { width: '80%', maxWidth: 350, borderRadius: 16, padding: 20, borderWidth: 1, alignSelf: 'center', marginTop: 'auto', marginBottom: 'auto' },
  optionsTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  optionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  optionText: { fontSize: 16, fontWeight: '500' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  // Simulation modal
  simModalContent: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 48, borderWidth: 1, gap: 16 },
  simHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  simIconBg: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  simTypeRow: { flexDirection: 'row', borderRadius: 14, padding: 4, borderWidth: StyleSheet.hairlineWidth },
  simTypeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  simTypeBtnText: { fontSize: 14 },
  simInputBlock: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14 },
  simInputLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6 },
  simCurrencyPrefix: { fontSize: 20, fontWeight: '600', marginRight: 8 },
  simAmountInput: { flex: 1, fontSize: 32, fontWeight: '800' },
  installmentBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  installmentInput: { width: 56, height: 40, borderRadius: 10, borderWidth: 1, fontSize: 18, fontWeight: '700' },
  installmentSuffix: { fontSize: 13, flex: 1 },
  simCardChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, gap: 6 },
  simCardChipText: { fontSize: 13, fontWeight: '600' },
  runSimBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 16, gap: 8 },
  runSimBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  // Simulation result
  simResultContainer: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 16, gap: 12 },
  simResultTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  simSummaryRow: { flexDirection: 'row', padding: 16 },
  simSummaryItem: { flex: 1, alignItems: 'center' },
  simSummaryLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  simSummaryValue: { fontSize: 18, fontWeight: '800' },
  simSummaryDivider: { width: 1, marginHorizontal: 8 },
  simWarning: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  simWarningText: { fontSize: 13, fontWeight: '600', flex: 1 },
  simImpactTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginTop: 4 },
  simImpactRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  simImpactMonth: { fontSize: 14, fontWeight: '500' },
  simImpactValue: { fontSize: 14, fontWeight: '700' },
  simMonthDot: { width: 8, height: 8, borderRadius: 4 },
});
