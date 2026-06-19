// components/screens/GoalsScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useSavingsGoals } from '@/hooks/useSavingsGoals';
import { calculateProgress } from '@/lib/goalUtils';
import { formatCurrency } from '@/lib/utils';
import { SavingsGoal, GoalDeposit, GoalRecurrence, CreateGoalInput } from '@/constants/types';
import { GoalFormModal } from '../GoalFormModal';

interface GoalsScreenProps {
  onGoalPress: (goal: SavingsGoal) => void;
  goals: SavingsGoal[];
  loading: boolean;
  error: string | null;
  createGoal: (input: CreateGoalInput) => Promise<void>;
  retry: () => Promise<void>;
}

export function GoalsScreen({ onGoalPress, goals, loading, error, createGoal, retry }: GoalsScreenProps) {
  const { colors } = useTheme();
  const [formModalVisible, setFormModalVisible] = useState(false);

  const handleCreateGoal = async (input: CreateGoalInput) => {
    await createGoal(input);
  };

  // Loading state
  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.destructive} />
        <Text style={[styles.errorText, { color: colors.foreground }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          onPress={retry}
        >
          <Text style={styles.retryBtnText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Empty state
  if (goals.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="trophy-outline" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Nenhuma meta criada. Comece definindo seu primeiro objetivo!
            </Text>
            <TouchableOpacity
              style={[styles.newGoalBtn, { backgroundColor: colors.primary }]}
              onPress={() => setFormModalVisible(true)}
            >
              <Ionicons name="add" size={20} color="#FFF" />
              <Text style={styles.newGoalBtnText}>Nova Meta</Text>
            </TouchableOpacity>
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

  // Goals list
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Section title + Nova Meta button */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Minhas Metas</Text>
          <TouchableOpacity
            style={[styles.headerBtn, { backgroundColor: colors.primary }]}
            onPress={() => setFormModalVisible(true)}
          >
            <Ionicons name="add" size={18} color="#FFF" />
            <Text style={styles.headerBtnText}>Nova Meta</Text>
          </TouchableOpacity>
        </View>

        {/* Goal cards */}
        <View style={styles.goalsList}>
          {goals.map((goal) => {
            const progress = calculateProgress(goal.accumulatedAmount, goal.targetAmount);
            const isCompleted = goal.accumulatedAmount >= goal.targetAmount;

            return (
              <TouchableOpacity
                key={goal.id}
                style={[styles.goalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => onGoalPress(goal)}
                activeOpacity={0.7}
              >
                {/* Goal header: icon + name + checkmark */}
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
                  {isCompleted && (
                    <View style={[styles.checkmark, { backgroundColor: '#4CAF50' }]}>
                      <Ionicons name="checkmark" size={14} color="#FFF" />
                    </View>
                  )}
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

                {/* Progress percentage */}
                <Text style={[styles.progressText, { color: colors.mutedForeground }]}>
                  {progress}% concluído
                </Text>
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
    padding: 16,
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
    padding: 16,
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
  emptyState: {
    alignItems: 'center',
    padding: 40,
    gap: 16,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
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
