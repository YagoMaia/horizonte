// components/screens/SaldosScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  FlatList,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import {
  calculateCreditCardInvoice,
  formatCurrency,
  formatDateShort,
} from '@/lib/utils';
import { useStoreContext } from '@/context/StoreContext';
import { Transaction, Account } from '@/constants/types';
import { TransactionDetailModal } from '../TransactionDetailModal';
import { AddTransactionModal } from '../AddTransactionModal';

// 👉 IMPORTAÇÕES NOVAS PARA O SWIPE
import {
  GestureHandlerRootView,
  Swipeable,
} from 'react-native-gesture-handler';

export function SaldosScreen() {
  const { colors } = useTheme();
  const {
    accounts,
    tags,
    transactions,
    totalBalance,
    monthlyIncome,
    monthlyExpense,
    addTransaction,
    updateTransaction,
    deleteTransaction, // 👉 PRECISAMOS DESSA FUNÇÃO PARA O SWIPE DE DELETAR
    loading,
    showPending,
    setShowPending,
  } = useStoreContext();

  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(20);

  // 👉 CONTROLE DOS SWIPES ABERTOS (Para fechar o anterior ao abrir um novo)
  // Utilizamos um Ref para guardar as referências dos itens da lista
  const rowRefs = React.useRef(new Map()).current;
  let currentlyOpenRowId: string | null = null;

  const closeCurrentlyOpenRow = () => {
    if (currentlyOpenRowId && rowRefs.get(currentlyOpenRowId)) {
      rowRefs.get(currentlyOpenRowId).close();
    }
  };

  const displayedTransactions = useMemo(() => {
    return transactions
      .filter((tx) => (showPending ? true : tx.paid === true))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, showPending]);

  const paginatedTransactions = useMemo(() => {
    return displayedTransactions.slice(0, displayLimit);
  }, [displayedTransactions, displayLimit]);

  const handleLoadMore = () => {
    if (displayLimit < displayedTransactions.length) {
      setDisplayLimit((prev) => prev + 20);
    }
  };

  React.useEffect(() => {
    setDisplayLimit(20);
    closeCurrentlyOpenRow(); // Fecha swipes abertos ao mudar filtro
  }, [showPending]);

  // 👉 AÇÕES DE SWIPE (Funções disparadas pelos botões)

  const handleTogglePaid = (tx: Transaction) => {
    closeCurrentlyOpenRow();
    // Inverte o status de pago
    updateTransaction({ ...tx, paid: !tx.paid });
  };

  const handleDeletePrompt = (txId: string) => {
    Alert.alert(
      'Apagar Lançamento',
      'Tem certeza que deseja excluir esta transação?',
      [
        { text: 'Cancelar', style: 'cancel', onPress: closeCurrentlyOpenRow },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: () => {
            closeCurrentlyOpenRow();
            deleteTransaction(txId);
          },
        },
      ],
    );
  };

  // 👉 RENDERIZAÇÃO DOS BOTÕES OCULTOS NO SWIPE

  // O que aparece quando desliza da Esquerda para a Direita (Toggle Status)
  const renderLeftActions = (tx: Transaction) => {
    const isPaid = tx.paid;
    const actionColor = isPaid ? colors.warning : colors.success;
    const actionIcon = isPaid ? 'time-outline' : 'checkmark-circle-outline';
    const actionLabel = isPaid ? 'Tornar\nPendente' : 'Marcar\nPago';

    return (
      <TouchableOpacity
        style={[
          styles.hiddenAction,
          styles.hiddenActionLeft,
          { backgroundColor: actionColor },
        ]}
        onPress={() => handleTogglePaid(tx)}
      >
        <Ionicons name={actionIcon} size={24} color='#FFF' />
        <Text style={styles.hiddenActionText}>{actionLabel}</Text>
      </TouchableOpacity>
    );
  };

  // O que aparece quando desliza da Direita para a Esquerda (Deletar)
  const renderRightActions = (txId: string) => {
    return (
      <TouchableOpacity
        style={[
          styles.hiddenAction,
          styles.hiddenActionRight,
          { backgroundColor: colors.destructive },
        ]}
        onPress={() => handleDeletePrompt(txId)}
      >
        <Ionicons name='trash-outline' size={24} color='#FFF' />
        <Text style={styles.hiddenActionText}>Apagar</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size='large' color={colors.primary} />
      </View>
    );
  }

  // CABEÇALHO DA LISTA
  const renderHeader = () => (
    <View style={{ gap: 16, paddingBottom: 8 }}>
      {/* Card de Saldo Total */}
      <View style={[styles.balanceCard, { backgroundColor: colors.primary }]}>
        <Text style={styles.balanceLabel}>Saldo Total</Text>
        <Text style={styles.balanceValue}>{formatCurrency(totalBalance)}</Text>
        <View style={styles.balanceRow}>
          <View style={styles.balanceStat}>
            <Ionicons
              name='arrow-up-circle'
              size={16}
              color='rgba(255,255,255,0.8)'
            />
            <Text style={styles.balanceStatText}>
              {formatCurrency(monthlyIncome)}
            </Text>
          </View>
          <View style={styles.balanceDivider} />
          <View style={styles.balanceStat}>
            <Ionicons
              name='arrow-down-circle'
              size={16}
              color='rgba(255,255,255,0.8)'
            />
            <Text style={styles.balanceStatText}>
              {formatCurrency(monthlyExpense)}
            </Text>
          </View>
        </View>
      </View>

      {/* Seção de Contas e Cartões */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Contas e Cartões
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.accountsRow}>
          {accounts.map((acc: Account) => {
            const isCreditCard = acc.type === 'cartao_credito';
            let currentInvoice = 0;

            if (isCreditCard) {
              currentInvoice = calculateCreditCardInvoice(acc, transactions);
            }

            const cardLimit =
              acc.creditLimit || (acc.balance > 0 ? acc.balance : 0);
            const availableLimit = Math.max(0, cardLimit - currentInvoice);
            const mainDisplayValue = isCreditCard
              ? availableLimit
              : acc.balance;

            return (
              <View
                key={acc.id}
                style={[
                  styles.accountCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View
                  style={[
                    styles.accountIcon,
                    { backgroundColor: acc.color + '15' },
                  ]}
                >
                  <Ionicons
                    name={acc.icon as any}
                    size={18}
                    color={acc.color}
                  />
                </View>
                <View style={styles.accountTextContainer}>
                  <Text
                    style={[
                      styles.accountName,
                      { color: colors.mutedForeground },
                    ]}
                    numberOfLines={1}
                  >
                    {acc.name}
                  </Text>
                  <Text
                    style={[
                      styles.accountBalance,
                      { color: colors.foreground },
                    ]}
                  >
                    {isCreditCard && cardLimit === 0
                      ? 'Lim. não definido'
                      : formatCurrency(mainDisplayValue)}
                  </Text>
                  {isCreditCard && (
                    <Text
                      style={[
                        styles.secondaryText,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      Fatura: {formatCurrency(currentInvoice)}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Cabeçalho de Lançamentos */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Lançamentos
        </Text>
        <View style={styles.filterToggle}>
          <Text style={[styles.filterText, { color: colors.mutedForeground }]}>
            Mostrar previstos
          </Text>
          <Switch
            value={showPending}
            onValueChange={setShowPending}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor='#ffffff'
            style={{ transform: [{ scale: 0.8 }] }}
          />
        </View>
      </View>
    </View>
  );

  // ITEM INDIVIDUAL DA LISTA
  const renderItem = ({
    item: tx,
    index,
  }: {
    item: Transaction;
    index: number;
  }) => {
    const isFirst = index === 0;
    const isLast = index === paginatedTransactions.length - 1;
    const isReceita = tx.type === 'receita';
    const isCredito = tx.paymentMethod === 'credito';
    const amountColor = isReceita
      ? colors.success
      : tx.type === 'transferencia'
        ? colors.primary
        : colors.destructive;

    const tag =
      tx.tagIds?.length > 0 ? tags.find((t) => t.id === tx.tagIds[0]) : null;
    const account = accounts.find((a) => a.id === tx.accountId);

    const iconColor = tag
      ? tag.color
      : isReceita
        ? colors.success
        : colors.destructive;
    const iconName = tag ? tag.icon : isReceita ? 'arrow-up' : 'arrow-down';

    // O corpo principal do item (a parte branca que desliza)
    const ItemContent = () => (
      <TouchableOpacity
        style={[
          styles.txItem,
          { backgroundColor: colors.card, borderColor: colors.border },
          isFirst && styles.txItemFirst,
          isLast && styles.txItemLast,
          !isLast && { borderBottomWidth: StyleSheet.hairlineWidth },
        ]}
        onPress={() => setSelectedTx(tx)}
        activeOpacity={1} // Alterado para 1 para evitar conflito tátil com o Swipe
      >
        <View style={[styles.txIcon, { backgroundColor: iconColor + '15' }]}>
          <Ionicons name={iconName as any} size={18} color={iconColor} />
        </View>

        <View style={styles.txInfo}>
          <Text
            style={[styles.txDesc, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {tx.description}
          </Text>

          <View style={styles.txMeta}>
            <Text style={[styles.txDateText, { color: colors.primary }]}>
              {formatDateShort(tx.date)}
            </Text>
            <View style={[styles.txDot, { backgroundColor: colors.border }]} />
            <Text
              style={[styles.txMetaText, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {tag?.name || 'Sem categoria'}
            </Text>
            <View style={[styles.txDot, { backgroundColor: colors.border }]} />
            <Text
              style={[styles.txMetaText, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {account?.name || 'Conta externa'}
            </Text>
          </View>
        </View>

        <View style={styles.txRight}>
          <Text style={[styles.txAmount, { color: amountColor }]}>
            {isReceita ? '+' : tx.type === 'transferencia' ? '' : '-'}
            {formatCurrency(tx.amount)}
          </Text>

          <View style={styles.badgesContainer}>
            {isCredito && (
              <View
                style={[
                  styles.smallBadge,
                  { backgroundColor: colors.secondary },
                ]}
              >
                <Text
                  style={[
                    styles.smallBadgeText,
                    { color: colors.mutedForeground },
                  ]}
                >
                  CRÉDITO
                </Text>
              </View>
            )}
            {!tx.paid && (
              <View
                style={[
                  styles.smallBadge,
                  { backgroundColor: colors.warningLight },
                ]}
              >
                <Text
                  style={[styles.smallBadgeText, { color: colors.warning }]}
                >
                  PREV
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );

    // 👉 COMPONENTE SWIPEABLE ENVOLVENDO O ITEM
    return (
      <Swipeable
        ref={(ref) => {
          if (ref) {
            rowRefs.set(tx.id, ref);
          }
        }}
        renderLeftActions={() => renderLeftActions(tx)}
        renderRightActions={() => renderRightActions(tx.id)}
        onSwipeableWillOpen={() => {
          // Fecha qualquer outro item aberto antes de abrir este
          if (currentlyOpenRowId && currentlyOpenRowId !== tx.id) {
            closeCurrentlyOpenRow();
          }
          currentlyOpenRowId = tx.id;
        }}
        onSwipeableWillClose={() => {
          if (currentlyOpenRowId === tx.id) {
            currentlyOpenRowId = null;
          }
        }}
        // Limita a área de resistência visual para não quebrar os cantos arredondados
        containerStyle={[
          isFirst && styles.txItemFirst,
          isLast && styles.txItemLast,
          { overflow: 'hidden' },
        ]}
      >
        <ItemContent />
      </Swipeable>
    );
  };

  return (
    // 👉 GESTURE HANDLER ROOT VIEW: Necessário para o Swipe funcionar no Android
    <GestureHandlerRootView style={{ flex: 1 }}>
      <FlatList
        data={paginatedTransactions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View
            style={[
              styles.emptyState,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Ionicons
              name='receipt-outline'
              size={40}
              color={colors.mutedForeground}
            />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Nenhum lançamento
            </Text>
          </View>
        }
      />

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
          onUpdate={updateTransaction}
          accounts={accounts}
          tags={tags}
          transactionToEdit={selectedTx}
        />
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 32 },
  balanceCard: { borderRadius: 20, padding: 24, gap: 4 },
  balanceLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '500',
  },
  balanceValue: {
    color: '#FFF',
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -1,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  balanceStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  balanceStatText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '500',
  },
  balanceDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  filterToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterText: { fontSize: 13, fontWeight: '500' },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  accountsRow: { flexDirection: 'row', gap: 12, paddingRight: 16 },
  accountCard: {
    width: 140,
    borderRadius: 20,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'space-between',
    minHeight: 120,
  },
  accountIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  accountTextContainer: { gap: 2 },
  accountName: { fontSize: 13, fontWeight: '500' },
  accountBalance: { fontSize: 18, fontWeight: '600', letterSpacing: -0.5 },
  secondaryText: { fontSize: 11, fontWeight: '400', marginTop: 2 },

  emptyState: {
    alignItems: 'center',
    padding: 40,
    gap: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyText: { fontSize: 14, fontWeight: '500' },

  // ESTILOS DA LISTA E DOS ITENS
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  txItemFirst: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  txItemLast: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },

  txIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txInfo: { flex: 1, gap: 4 },
  txDesc: { fontSize: 15, fontWeight: '600' },
  txMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  txDateText: { fontSize: 12, fontWeight: '700' },
  txMetaText: { fontSize: 12, fontWeight: '400' },
  txDot: { width: 3, height: 3, borderRadius: 1.5 },
  txRight: { alignItems: 'flex-end', gap: 4 },
  txAmount: { fontSize: 15, fontWeight: '700' },
  badgesContainer: { flexDirection: 'row', gap: 4 },
  smallBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  smallBadgeText: { fontSize: 9, fontWeight: '800' },

  // 👉 NOVOS ESTILOS PARA OS BOTÕES OCULTOS DO SWIPE
  hiddenAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
  },
  hiddenActionLeft: {
    // Esse estilo faz o fundo da ação preencher o buraco, mas sem quebrar as bordas arredondadas do componente pai
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  hiddenActionRight: {
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
  },
  hiddenActionText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
