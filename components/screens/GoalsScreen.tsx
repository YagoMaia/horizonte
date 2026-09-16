// components/screens/GoalsScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/hooks/useTheme';
import { calculateProgress } from '@/lib/goalUtils';
import { formatCurrency } from '@/lib/utils';
import { SavingsGoal, CreateGoalInput } from '@/constants/types';
import { GoalFormModal } from '../GoalFormModal';
import { ScreenState } from '../ui/ScreenState';
import { AppButton } from '../ui/AppButton';
import { FeedbackBanner } from '../ui/FeedbackBanner';

interface GoalsScreenProps {
  onGoalPress: (goal: SavingsGoal) => void;
  goals: SavingsGoal[];
  loading: boolean;
  error: string | null;
  createGoal: (input: CreateGoalInput) => Promise<SavingsGoal>;
  retry: () => Promise<void>;
}

export function GoalsScreen({ onGoalPress, goals, loading, error, createGoal, retry }: GoalsScreenProps) {
  const { colors } = useTheme();
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState('');
  const [activeGoalIds, setActiveGoalIds] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem('@horizonte:active_goals').then((raw) => {
      if (raw) setActiveGoalIds(JSON.parse(raw));
    }).catch(() => {});
  }, []);

  const handleCreateGoal = async (input: CreateGoalInput) => {
    await createGoal(input);
    setMessage('Meta criada. Seu próximo passo já tem um destino.');
  };

  const sortedGoals = React.useMemo(() => {
    return [...goals].sort((a, b) => {
      const aCompleted = a.accumulatedAmount >= a.targetAmount;
      const bCompleted = b.accumulatedAmount >= b.targetAmount;

      // 1. Concluídas sempre por último
      if (aCompleted && !bCompleted) return 1;
      if (!aCompleted && bCompleted) return -1;

      // 2. Metas com prazo vêm primeiro (ordenadas pelo prazo mais próximo)
      if (a.deadline && b.deadline) {
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      if (a.deadline && !b.deadline) return -1;
      if (!a.deadline && b.deadline) return 1;

      // 3. Empate (sem prazo) -> data de criação (mais recentes primeiro)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [goals]);

  const handleRetry = async () => {
    setRetrying(true);
    setRetryError('');
    try { await retry(); } catch { setRetryError('Não foi possível carregar suas metas. Tente novamente.'); }
    finally { setRetrying(false); }
  };

  if (loading || error) {
    return (
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
        <ScreenState kind={loading ? 'loading' : 'error'} title={loading ? 'Carregando suas metas…' : 'Vamos tentar novamente?'}
          description={loading ? 'Estamos organizando seus planos.' : retryError || error || undefined}
          action={loading ? undefined : { label: 'Tentar novamente', onPress: handleRetry, loading: retrying }} />
      </ScrollView>
    );
  }

  // Empty state
  if (goals.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.content}>
          <ScreenState
            kind="empty"
            title="Comece pela sua primeira meta"
            description="Defina um valor e acompanhe seu progresso até chegar lá."
            action={{ label: 'Criar minha primeira meta', onPress: () => setFormModalVisible(true) }}
          />
        </ScrollView>
        <GoalFormModal
          visible={formModalVisible}
          onClose={() => setFormModalVisible(false)}
          onSubmit={handleCreateGoal}
        />
      </View>
    );
  }



  // Goals list
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {message ? <FeedbackBanner message={message} /> : null}
        {/* Section title + Nova Meta button */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Minhas Metas</Text>
          <AppButton label="Nova Meta" icon="add" onPress={() => setFormModalVisible(true)} />
        </View>

        {/* Goal cards */}
        <View style={styles.goalsList}>
          {sortedGoals.map((goal) => {
            const progress = calculateProgress(goal.accumulatedAmount, goal.targetAmount);
            const isCompleted = goal.accumulatedAmount >= goal.targetAmount;
            const isInHorizonte = activeGoalIds.includes(goal.id);

            return (
              <TouchableOpacity
                key={goal.id}
                style={[styles.goalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => onGoalPress(goal)}
                activeOpacity={0.7}
              >
                {/* Goal header: icon + name + badges */}
                <View style={styles.goalHeader}>
                  <View style={[styles.goalIcon, { backgroundColor: goal.color + '20' }]}>
                    <Ionicons name={goal.icon as any} size={22} color={goal.color} />
                  </View>
                  <Text
                    style={[styles.goalName, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {goal.name}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    {isInHorizonte && (
                      <View style={[styles.horizonteBadge, { backgroundColor: colors.infoLight, borderColor: colors.info }]}>
                        <Ionicons name="trending-up-outline" size={10} color={colors.info} />
                        <Text style={[styles.horizonteBadgeText, { color: colors.info }]}>Horizonte</Text>
                      </View>
                    )}
                    {isCompleted && (
                      <View style={[styles.checkmark, { backgroundColor: colors.success }]}>
                        <Ionicons name="checkmark" size={14} color={colors.successForeground} />
                      </View>
                    )}
                  </View>
                </View>

                {/* Amounts */}
                <View style={styles.amountsRow}>
                  <Text style={[styles.accumulatedAmount, { color: goal.color }]}>
                    {formatCurrency(goal.accumulatedAmount)}
                  </Text>
                  <Text style={[styles.targetAmount, { color: colors.mutedForeground }]}>
                    / {formatCurrency(goal.targetAmount)}
                  </Text>
                </View>

                {/* Progress bar */}
                <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        backgroundColor: goal.color,
                        width: `${progress}%`,
                      },
                    ]}
                  />
                </View>

                {/* Progress percentage + deadline */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                  <Text style={[styles.progressText, { color: colors.mutedForeground }]}>
                    {progress}% concluído
                  </Text>
                  {goal.deadline && !isCompleted && (() => {
                    const deadline = new Date(goal.deadline);
                    const now = new Date();
                    const diffMs = deadline.getTime() - now.getTime();
                    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                    const isLate = diffDays < 0;
                    const label = isLate
                      ? `Atrasado ${Math.abs(diffDays)}d`
                      : diffDays === 0
                      ? 'Vence hoje'
                      : diffDays <= 30
                      ? `${diffDays}d restantes`
                      : deadline.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
                    return (
                      <View style={[styles.deadlineBadge, { backgroundColor: isLate ? colors.dangerLight : colors.muted, borderColor: isLate ? colors.destructive : colors.border }]}>
                        <Ionicons name="calendar-outline" size={10} color={isLate ? colors.destructive : colors.mutedForeground} />
                        <Text style={[styles.deadlineText, { color: isLate ? colors.destructive : colors.mutedForeground }]}>{label}</Text>
                      </View>
                    );
                  })()}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <GoalFormModal
        visible={formModalVisible}
        onClose={() => setFormModalVisible(false)}
        onSubmit={handleCreateGoal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 16,
  },
  content: {
    padding: 20,
    paddingBottom: 32,
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  headerBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  goalsList: {
    gap: 16,
  },
  goalCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  goalIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  horizonteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  horizonteBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  accumulatedAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  targetAmount: {
    fontSize: 13,
    fontWeight: '500',
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '500',
  },
  deadlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  deadlineText: {
    fontSize: 10,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    padding: 24,
    gap: 16,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyTitle: { fontSize: 21, fontWeight: '700', textAlign: 'center', letterSpacing: -0.5 },
  emptyIllustration: {
    width: 216,
    maxWidth: '100%',
    height: 216,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  newGoalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 8,
  },
  newGoalBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 8,
  },
  retryBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
