// components/screens/GoalDetailScreen.tsx
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { SavingsGoal, GoalDeposit, GoalRecurrence, CreateGoalInput, Account, UpdateGoalInput, CreateGoalRecurrenceInput } from '@/constants/types';
import { useStoreContext } from '@/context/StoreContext';
import {
  calculateProgress,
  calculateRemainingDays,
  calculateOverdueDays,
  calculateRemainingAmount,
  isRecurringGoalDeposit,
} from '@/lib/goalUtils';
import { formatCurrency, formatDate } from '@/lib/utils';
import { GoalFormModal } from '../GoalFormModal';
import { GoalDepositModal } from '../GoalDepositModal';
import { GoalWithdrawModal } from '../GoalWithdrawModal';
import { ConfirmDeleteModal } from '../ConfirmDeleteModal';
import { GoalRecurrenceModal } from '../GoalRecurrenceModal';

interface GoalDetailScreenProps {
  goal: SavingsGoal;
  onBack: () => void;
  goals: SavingsGoal[];
  deposits: GoalDeposit[];
  recurrences: GoalRecurrence[];
  addDeposit: (goalId: string, amount: number, accountId?: string) => Promise<void>;
  addWithdrawal: (goalId: string, amount: number, accountId?: string) => Promise<void>;
  deleteDeposit: (depositId: string) => Promise<void>;
  updateGoal: (goalId: string, data: UpdateGoalInput) => Promise<void>;
  deleteGoal: (goalId: string) => Promise<void>;
  createRecurrence: (input: CreateGoalRecurrenceInput) => Promise<any>;
  cancelRecurrence: (recurrenceId: string) => Promise<void>;
}

export function GoalDetailScreen({ goal: initialGoal, onBack, goals, deposits: allDeposits, recurrences, addDeposit, addWithdrawal, deleteDeposit, updateGoal, deleteGoal, createRecurrence, cancelRecurrence }: GoalDetailScreenProps) {
  const { colors } = useTheme();
  const { accounts, addTransaction, deleteTransaction, transactions } = useStoreContext();

  // Use live data from hook if available, fallback to props
  const goal = goals.find((g) => g.id === initialGoal.id) || initialGoal;
  const deposits = allDeposits.filter((d) => d.goalId === goal.id);

  // Active recurrence for this goal (at most one)
  const activeRecurrence = useMemo(
    () => recurrences.find((r) => r.goalId === goal.id && r.active) ?? null,
    [recurrences, goal.id]
  );

  const [showEditModal, setShowEditModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);

  // Derived values
  const progress = calculateProgress(goal.accumulatedAmount, goal.targetAmount);
  const remaining = calculateRemainingAmount(goal.targetAmount, goal.accumulatedAmount);
  const remainingDays = calculateRemainingDays(goal.deadline);
  const overdueDays = calculateOverdueDays(goal.deadline);

  // Deposits sorted by date descending
  const sortedDeposits = useMemo(() => {
    return [...deposits].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [deposits]);

  // Handlers
  const handleDeposit = async (amount: number, accountId: string) => {
    // A transação adicionada será capturada pelo syncWithTransactions 
    // que criará o registro de depósito e atualizará o saldo da meta automaticamente.
    await addTransaction({
      description: `Reserva: ${goal.name}`,
      amount: amount,
      type: 'transferencia',
      date: new Date().toISOString(),
      accountId: accountId, // Source account
      targetAccountId: `goal_${goal.id}`, // Destination (virtual goal ID)
      paid: true,
      recurrence: 'unica',
      paymentMethod: 'debito',
    });
  };

  const handleCreateRecurrence = async (
    amount: number,
    accountId: string,
    dayOfMonth: number,
    _hasEndDate: boolean,
    endDate?: string
  ) => {
    await createRecurrence({
      goalId: goal.id,
      amount,
      accountId,
      dayOfMonth,
      startDate: new Date().toISOString(),
      endDate: endDate ?? null,
    });
  };

  const handleCancelRecurrence = async () => {
    if (activeRecurrence) {
      await cancelRecurrence(activeRecurrence.id);
    }
  };

  const handleWithdraw = async (amount: number, accountId: string) => {
    // A transação adicionada será capturada pelo syncWithTransactions 
    // que criará o registro de retirada e atualizará o saldo da meta automaticamente.
    await addTransaction({
      description: `Resgate: ${goal.name}`,
      amount: amount,
      type: 'transferencia',
      date: new Date().toISOString(),
      accountId: `goal_${goal.id}`, // Source (virtual goal ID)
      targetAccountId: accountId, // Destination account
      paid: true,
      recurrence: 'unica',
      paymentMethod: 'debito',
    });
  };

  const handleEdit = async (input: CreateGoalInput) => {
    await updateGoal(goal.id, input);
  };

  const handleDelete = async () => {
    await deleteGoal(goal.id);
    onBack();
  };

  const renderDepositItem = ({ item }: { item: GoalDeposit }) => {
    const isWithdrawal = item.amount < 0;
    const isRecurring = !isWithdrawal && isRecurringGoalDeposit(item);

    const iconBg = isWithdrawal
      ? colors.destructive + '15'
      : isRecurring
        ? colors.primary + '15'
        : colors.success + '15';

    const iconColor = isWithdrawal
      ? colors.destructive
      : isRecurring
        ? colors.primary
        : colors.success;

    const iconName = isWithdrawal
      ? 'arrow-down-outline'
      : isRecurring
        ? 'repeat'
        : 'hand-left-outline';

    const badgeLabel = isWithdrawal
      ? 'Resgate'
      : isRecurring
        ? 'Recorrente'
        : 'Manual';

    const badgeBg = isWithdrawal
      ? colors.destructive + '15'
      : isRecurring
        ? colors.primary + '15'
        : colors.mutedForeground + '15';

    const badgeColor = isWithdrawal
      ? colors.destructive
      : isRecurring
        ? colors.primary
        : colors.mutedForeground;

    return (
      <View
        style={[
          styles.depositItem,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={[styles.depositIcon, { backgroundColor: iconBg }]}>
          <Ionicons
            name={iconName as any}
            size={18}
            color={iconColor}
          />
        </View>
        <View style={styles.depositInfo}>
          <View style={styles.depositAmountRow}>
            <Text style={[styles.depositAmount, { color: isWithdrawal ? colors.destructive : colors.success }]}>
              {isWithdrawal ? '- ' : '+ '}{formatCurrency(Math.abs(item.amount))}
            </Text>
            <View style={[styles.depositBadge, { backgroundColor: badgeBg }]}>
              <Ionicons
                name={isWithdrawal ? 'arrow-down' : isRecurring ? 'repeat' : 'hand-left-outline'}
                size={10}
                color={badgeColor}
              />
              <Text style={[styles.depositBadgeText, { color: badgeColor }]}>
                {badgeLabel}
              </Text>
            </View>
          </View>
          <Text style={[styles.depositDate, { color: colors.mutedForeground }]}>
            {formatDate(item.date)}
          </Text>
        </View>
        <TouchableOpacity
          style={{ padding: 8, marginLeft: 'auto' }}
          onPress={() => {
            Alert.alert(
              'Excluir registro',
              isRecurring
                ? 'Este registro foi gerado pela recorrência automática. Tem certeza que deseja removê-lo?'
                : 'Tem certeza que deseja remover este registro manual da meta?',
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Excluir',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      // O syncWithTransactions cria depósitos com IDs determinísticos:
                      //   resgate  → 'tx_withdraw_<txId>'
                      //   aporte   → 'tx_<txId>'
                      // Invertendo o padrão, obtemos o txId com segurança sem fallback por valor+data.
                      let matchingTxId: string | null = null;
                      if (item.id.startsWith('tx_withdraw_')) {
                        matchingTxId = item.id.replace('tx_withdraw_', '');
                      } else if (item.id.startsWith('tx_')) {
                        matchingTxId = item.id.replace('tx_', '');
                      } else {
                        // Fallback para depósitos legados: tenta match exato por ID primeiro
                        const byId = transactions.find((t) => t.id === item.id);
                        if (byId) {
                          matchingTxId = byId.id;
                        }
                        // Sem fallback por valor+data para evitar deleção errada
                      }

                      if (matchingTxId) {
                        await deleteTransaction(matchingTxId);
                      }

                      // 2. Remover o registro de depósito da meta
                      await deleteDeposit(item.id);
                    } catch (e: any) {
                      Alert.alert('Erro', e.message || 'Falha ao excluir registro.');
                    }
                  },
                },
              ]
            );
          }}
        >
          <Ionicons name="trash-outline" size={20} color={colors.destructive} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
          {goal.name}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Goal info card */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Icon and name */}
          <View style={styles.goalHeader}>
            <View style={[styles.goalIcon, { backgroundColor: goal.color + '20' }]}>
              <Ionicons name={goal.icon as any} size={28} color={goal.color} />
            </View>
            <View style={styles.goalTitleContainer}>
              <Text style={[styles.goalName, { color: colors.foreground }]}>{goal.name}</Text>
              {progress >= 100 && (
                <View style={styles.completedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={[styles.completedText, { color: colors.success }]}>Concluída</Text>
                </View>
              )}
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressLabelRow}>
              <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>Progresso</Text>
              <Text style={[styles.progressPercent, { color: colors.foreground }]}>{progress}%</Text>
            </View>
            <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressBarFill,
                  { backgroundColor: goal.color, width: `${progress}%` },
                ]}
              />
            </View>
          </View>

          {/* Amounts */}
          <View style={styles.amountsGrid}>
            <View style={styles.amountItem}>
              <Text style={[styles.amountLabel, { color: colors.mutedForeground }]}>Meta</Text>
              <Text style={[styles.amountValue, { color: colors.foreground }]}>
                {formatCurrency(goal.targetAmount)}
              </Text>
            </View>
            <View style={styles.amountItem}>
              <Text style={[styles.amountLabel, { color: colors.mutedForeground }]}>Acumulado</Text>
              <Text style={[styles.amountValue, { color: colors.success }]}>
                {formatCurrency(goal.accumulatedAmount)}
              </Text>
            </View>
            <View style={styles.amountItem}>
              <Text style={[styles.amountLabel, { color: colors.mutedForeground }]}>Restante</Text>
              <Text style={[styles.amountValue, { color: remaining > 0 ? colors.foreground : colors.success }]}>
                {formatCurrency(remaining)}
              </Text>
            </View>
          </View>

          {/* Deadline info */}
          {goal.deadline && (
            <View style={styles.deadlineSection}>
              {overdueDays !== null && goal.accumulatedAmount < goal.targetAmount ? (
                <View style={[styles.deadlineWarning, { backgroundColor: colors.destructive + '15' }]}>
                  <Ionicons name="alert-circle" size={18} color={colors.destructive} />
                  <Text style={[styles.deadlineWarningText, { color: colors.destructive }]}>
                    Meta vencida — {overdueDays} {overdueDays === 1 ? 'dia' : 'dias'} em atraso
                  </Text>
                </View>
              ) : remainingDays !== null ? (
                <View style={[styles.deadlineInfo, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                  <Text style={[styles.deadlineInfoText, { color: colors.primary }]}>
                    {remainingDays} {remainingDays === 1 ? 'dia restante' : 'dias restantes'}
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.success + '15', borderColor: colors.success }]}
            onPress={() => setShowDepositModal(true)}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.success} />
            <Text style={[styles.actionBtnText, { color: colors.success }]}>Depositar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.warning + '15', borderColor: colors.warning }]}
            onPress={() => setShowWithdrawModal(true)}
          >
            <Ionicons name="remove-circle-outline" size={20} color={colors.warning} />
            <Text style={[styles.actionBtnText, { color: colors.warning }]}>Retirar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}
            onPress={() => setShowEditModal(true)}
          >
            <Ionicons name="create-outline" size={20} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>Editar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.destructive + '15', borderColor: colors.destructive }]}
            onPress={() => setShowDeleteModal(true)}
          >
            <Ionicons name="trash-outline" size={20} color={colors.destructive} />
            <Text style={[styles.actionBtnText, { color: colors.destructive }]}>Excluir</Text>
          </TouchableOpacity>
        </View>

        {/* Recurring deposit card */}
        <TouchableOpacity
          style={[
            styles.recurrenceCard,
            {
              backgroundColor: activeRecurrence ? colors.primary + '10' : colors.card,
              borderColor: activeRecurrence ? colors.primary + '40' : colors.border,
            },
          ]}
          onPress={() => setShowRecurrenceModal(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.recurrenceIconWrap, { backgroundColor: activeRecurrence ? colors.primary + '20' : colors.border + '60' }]}>
            <Ionicons
              name={activeRecurrence ? 'repeat' : 'repeat-outline'}
              size={20}
              color={activeRecurrence ? colors.primary : colors.mutedForeground}
            />
          </View>
          <View style={{ flex: 1 }}>
            {activeRecurrence ? (
              <>
                <Text style={[styles.recurrenceTitle, { color: colors.primary }]}>
                  Aporte mensal ativo
                </Text>
                <Text style={[styles.recurrenceSub, { color: colors.mutedForeground }]}>
                  {formatCurrency(activeRecurrence.amount)} todo dia {activeRecurrence.dayOfMonth}
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.recurrenceTitle, { color: colors.foreground }]}>
                  Configurar aporte mensal
                </Text>
                <Text style={[styles.recurrenceSub, { color: colors.mutedForeground }]}>
                  Automatize depósitos periódicos nesta meta
                </Text>
              </>
            )}
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>

        {/* Deposit history */}
        <View style={styles.historySection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Histórico de Depósitos
          </Text>

          {sortedDeposits.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="receipt-outline" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Nenhum depósito registrado ainda
              </Text>
            </View>
          ) : (
            <View style={styles.depositsList}>
              {sortedDeposits.map((deposit) => (
                <React.Fragment key={deposit.id}>
                  {renderDepositItem({ item: deposit })}
                </React.Fragment>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modals */}
      <GoalDepositModal
        visible={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        onConfirm={handleDeposit}
        currentAccumulated={goal.accumulatedAmount}
        targetAmount={goal.targetAmount}
        accounts={accounts}
      />

      <GoalWithdrawModal
        visible={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        onConfirm={handleWithdraw}
        currentAccumulated={goal.accumulatedAmount}
        accounts={accounts}
      />

      <GoalFormModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleEdit}
        initialData={{
          name: goal.name,
          targetAmount: goal.targetAmount,
          deadline: goal.deadline,
          icon: goal.icon,
          color: goal.color,
        }}
      />

      <ConfirmDeleteModal
        visible={showDeleteModal}
        title="Excluir meta?"
        description="Esta ação não pode ser desfeita."
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        confirmText="Excluir"
        cancelText="Cancelar"
      />

      <GoalRecurrenceModal
        visible={showRecurrenceModal}
        onClose={() => setShowRecurrenceModal(false)}
        onConfirm={handleCreateRecurrence}
        onCancel={activeRecurrence ? handleCancelRecurrence : undefined}
        accounts={accounts}
        goalName={goal.name}
        existingRecurrence={activeRecurrence}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  infoCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 16,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  goalIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalTitleContainer: {
    flex: 1,
    gap: 4,
  },
  goalName: {
    fontSize: 18,
    fontWeight: '700',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  completedText: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressSection: {
    gap: 8,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  amountsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  amountItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  amountValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  deadlineSection: {
    marginTop: 4,
  },
  deadlineWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
  },
  deadlineWarningText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  deadlineInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
  },
  deadlineInfoText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  recurrenceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  recurrenceIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recurrenceTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  recurrenceSub: {
    fontSize: 12,
    marginTop: 2,
  },
  historySection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    gap: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  depositsList: {
    gap: 8,
  },
  depositItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  depositIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  depositInfo: {
    flex: 1,
    gap: 2,
  },
  depositAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  depositAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  depositBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  depositBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  depositDate: {
    fontSize: 12,
  },
});
