// hooks/useSavingsGoals.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SavingsGoal,
  GoalDeposit,
  GoalRecurrence,
  CreateGoalInput,
  UpdateGoalInput,
  CreateGoalRecurrenceInput,
} from '@/constants/types';
import { recalculateAccumulated } from '@/lib/goalUtils';

const STORAGE_KEY = '@horizonte:savings_goals';

interface StorageData {
  goals: SavingsGoal[];
  deposits: GoalDeposit[];
  recurrences: GoalRecurrence[];
}

export interface UseSavingsGoalsReturn {
  goals: SavingsGoal[];
  deposits: GoalDeposit[];
  recurrences: GoalRecurrence[];
  loading: boolean;
  error: string | null;

  createGoal: (input: CreateGoalInput) => Promise<SavingsGoal>;
  updateGoal: (id: string, input: UpdateGoalInput) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  addDeposit: (goalId: string, amount: number, accountId?: string) => Promise<void>;
  deleteDeposit: (depositId: string) => Promise<void>;
  addWithdrawal: (goalId: string, amount: number, accountId?: string) => Promise<void>;

  // Recurrence CRUD
  createRecurrence: (input: CreateGoalRecurrenceInput) => Promise<GoalRecurrence>;
  cancelRecurrence: (id: string) => Promise<void>;

  // Called once on app startup — processes any overdue monthly deposits
  processOverdueRecurrences: (
    addTransaction: (tx: any) => Promise<any>
  ) => Promise<void>;

  // Synchronizes paid goal transfers from transactions store with goal deposits
  syncWithTransactions: (transactions: any[]) => Promise<void>;

  retry: () => Promise<void>;
}

export function useSavingsGoals(): UseSavingsGoalsReturn {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [deposits, setDeposits] = useState<GoalDeposit[]>([]);
  const [recurrences, setRecurrences] = useState<GoalRecurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Write-lock pattern to serialize async operations (same as useStore)
  const writeLock = useRef<Promise<void>>(Promise.resolve());

  const withWriteLock = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const currentLock = writeLock.current;
    let resolve: () => void;
    writeLock.current = new Promise<void>((r) => { resolve = r; });
    return currentLock.then(fn).finally(() => resolve!());
  }, []);

  // Persist data to AsyncStorage
  const persist = useCallback(async (data: StorageData): Promise<void> => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, []);

  // Sort goals by createdAt descending (most recent first)
  const sortGoals = useCallback((goalsToSort: SavingsGoal[]): SavingsGoal[] => {
    return [...goalsToSort].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, []);

  // Load data from AsyncStorage
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const raw = await AsyncStorage.getItem(STORAGE_KEY);

      if (raw === null) {
        setGoals([]);
        setDeposits([]);
        setRecurrences([]);
        setLoading(false);
        return;
      }

      let parsed: StorageData;
      try {
        parsed = JSON.parse(raw);
      } catch (parseError) {
        console.error('Dados de metas corrompidos no AsyncStorage:', parseError);
        setGoals([]);
        setDeposits([]);
        setRecurrences([]);
        setLoading(false);
        return;
      }

      // Validate structure - treat malformed as empty
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !Array.isArray(parsed.goals) ||
        !Array.isArray(parsed.deposits)
      ) {
        console.error('Estrutura de dados de metas inválida no AsyncStorage');
        setGoals([]);
        setDeposits([]);
        setRecurrences([]);
        setLoading(false);
        return;
      }

      const loadedDeposits = parsed.deposits;
      const loadedRecurrences: GoalRecurrence[] = Array.isArray(parsed.recurrences)
        ? parsed.recurrences
        : [];

      // Recalculate accumulatedAmount from deposits for each goal
      const loadedGoals = parsed.goals.map((goal) => {
        const goalDeposits = loadedDeposits.filter((d) => d.goalId === goal.id);
        return {
          ...goal,
          accumulatedAmount: recalculateAccumulated(goalDeposits),
        };
      });

      setDeposits(loadedDeposits);
      setGoals(sortGoals(loadedGoals));
      setRecurrences(loadedRecurrences);
      setLoading(false);
    } catch (e) {
      console.error('Erro ao carregar metas:', e);
      setError('Não foi possível carregar as metas. Tente novamente.');
      setLoading(false);
    }
  }, [sortGoals]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Retry function for load failures
  const retry = useCallback(async () => {
    await loadData();
  }, [loadData]);

  // Create a new savings goal
  const createGoal = useCallback(
    (input: CreateGoalInput) => withWriteLock(async () => {
      const now = new Date().toISOString();
      const newGoal: SavingsGoal = {
        id: Date.now().toString(),
        name: input.name,
        targetAmount: input.targetAmount,
        accumulatedAmount: 0,
        deadline: input.deadline,
        icon: input.icon,
        color: input.color,
        createdAt: now,
        updatedAt: now,
      };

      const newGoals = sortGoals([...goals, newGoal]);
      const newData: StorageData = { goals: newGoals, deposits, recurrences };

      try {
        await persist(newData);
        setGoals(newGoals);
        return newGoal;
      } catch (e) {
        console.error('Erro ao salvar meta:', e);
        throw new Error('Não foi possível salvar a meta. Tente novamente.');
      }
    }),
    [goals, deposits, recurrences, sortGoals, persist, withWriteLock],
  );

  // Update an existing goal
  const updateGoal = useCallback(
    (id: string, input: UpdateGoalInput) => withWriteLock(async () => {
      const existingGoal = goals.find((g) => g.id === id);
      if (!existingGoal) {
        throw new Error('Meta não encontrada.');
      }

      const updatedGoal: SavingsGoal = {
        ...existingGoal,
        name: input.name,
        targetAmount: input.targetAmount,
        deadline: input.deadline,
        icon: input.icon,
        color: input.color,
        updatedAt: new Date().toISOString(),
      };

      const newGoals = sortGoals(goals.map((g) => (g.id === id ? updatedGoal : g)));
      const newData: StorageData = { goals: newGoals, deposits, recurrences };

      try {
        await persist(newData);
        setGoals(newGoals);
      } catch (e) {
        console.error('Erro ao atualizar meta:', e);
        throw new Error('Não foi possível atualizar a meta. Tente novamente.');
      }
    }),
    [goals, deposits, recurrences, sortGoals, persist, withWriteLock],
  );

  // Delete a goal and all associated deposits and recurrences
  const deleteGoal = useCallback(
    (id: string) => withWriteLock(async () => {
      const newGoals = goals.filter((g) => g.id !== id);
      const newDeposits = deposits.filter((d) => d.goalId !== id);
      const newRecurrences = recurrences.filter((r) => r.goalId !== id);
      const newData: StorageData = { goals: newGoals, deposits: newDeposits, recurrences: newRecurrences };

      try {
        await persist(newData);
        setGoals(newGoals);
        setDeposits(newDeposits);
        setRecurrences(newRecurrences);
      } catch (e) {
        console.error('Erro ao excluir meta:', e);
        throw new Error('Não foi possível excluir a meta. Tente novamente.');
      }
    }),
    [goals, deposits, recurrences, persist, withWriteLock],
  );

  // Add a deposit to a goal
  const addDeposit = useCallback(
    (goalId: string, amount: number, accountId?: string) => withWriteLock(async () => {
      const goal = goals.find((g) => g.id === goalId);
      if (!goal) {
        throw new Error('Meta não encontrada.');
      }

      const newDeposit: GoalDeposit = {
        id: Date.now().toString(),
        goalId,
        amount,
        date: new Date().toISOString(),
        accountId,
        source: 'manual',
      };

      const newDeposits = [...deposits, newDeposit];
      const newGoals = sortGoals(
        goals.map((g) =>
          g.id === goalId
            ? { ...g, accumulatedAmount: g.accumulatedAmount + amount, updatedAt: new Date().toISOString() }
            : g
        )
      );
      const newData: StorageData = { goals: newGoals, deposits: newDeposits, recurrences };

      try {
        await persist(newData);
        setGoals(newGoals);
        setDeposits(newDeposits);
      } catch (e) {
        throw new Error('Não foi possível registrar o depósito. Tente novamente.');
      }
    }),
    [goals, deposits, recurrences, sortGoals, persist, withWriteLock],
  );

  // Delete a deposit
  const deleteDeposit = useCallback(
    (depositId: string) => withWriteLock(async () => {
      const deposit = deposits.find((d) => d.id === depositId);
      if (!deposit) {
        throw new Error('Depósito não encontrado.');
      }

      const newDeposits = deposits.filter((d) => d.id !== depositId);
      const newGoals = sortGoals(
        goals.map((g) =>
          g.id === deposit.goalId
            ? { ...g, accumulatedAmount: g.accumulatedAmount - deposit.amount, updatedAt: new Date().toISOString() }
            : g
        )
      );
      const newData: StorageData = { goals: newGoals, deposits: newDeposits, recurrences };

      try {
        await persist(newData);
        setGoals(newGoals);
        setDeposits(newDeposits);
      } catch (e) {
        throw new Error('Não foi possível excluir o depósito. Tente novamente.');
      }
    }),
    [deposits, goals, recurrences, sortGoals, persist, withWriteLock],
  );

  // Add a withdrawal from a goal (stored as negative deposit)
  const addWithdrawal = useCallback(
    (goalId: string, amount: number, accountId?: string) => withWriteLock(async () => {
      const goal = goals.find((g) => g.id === goalId);
      if (!goal) {
        throw new Error('Meta não encontrada.');
      }

      const newDeposit: GoalDeposit = {
        id: Date.now().toString(),
        goalId,
        amount: -amount,
        date: new Date().toISOString(),
        accountId,
        source: 'manual',
      };

      const newDeposits = [...deposits, newDeposit];
      const newGoals = sortGoals(
        goals.map((g) =>
          g.id === goalId
            ? { ...g, accumulatedAmount: g.accumulatedAmount - amount, updatedAt: new Date().toISOString() }
            : g
        )
      );
      const newData: StorageData = { goals: newGoals, deposits: newDeposits, recurrences };

      try {
        await persist(newData);
        setGoals(newGoals);
        setDeposits(newDeposits);
      } catch (e) {
        console.error('Erro ao registrar retirada:', e);
        throw new Error('Não foi possível registrar a retirada. Tente novamente.');
      }
    }),
    [goals, deposits, recurrences, sortGoals, persist, withWriteLock],
  );

  // --- RECURRENCE CRUD ---

  // Create a new monthly recurrence for a goal
  const createRecurrence = useCallback(
    (input: CreateGoalRecurrenceInput) => withWriteLock(async () => {
      const goal = goals.find((g) => g.id === input.goalId);
      if (!goal) throw new Error('Meta não encontrada.');

      // Deactivate any existing active recurrence for this goal
      const updatedOld = recurrences.map((r) =>
        r.goalId === input.goalId && r.active ? { ...r, active: false } : r
      );

      const now = new Date().toISOString();
      const newRecurrence: GoalRecurrence = {
        id: Date.now().toString(),
        goalId: input.goalId,
        amount: input.amount,
        accountId: input.accountId,
        dayOfMonth: input.dayOfMonth,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        lastProcessedDate: null,
        active: true,
        createdAt: now,
      };

      const newRecurrences = [...updatedOld, newRecurrence];
      const newData: StorageData = { goals, deposits, recurrences: newRecurrences };

      try {
        await persist(newData);
        setRecurrences(newRecurrences);
        return newRecurrence;
      } catch (e) {
        console.error('Erro ao criar recorrência:', e);
        throw new Error('Não foi possível criar o aporte recorrente. Tente novamente.');
      }
    }),
    [goals, deposits, recurrences, persist, withWriteLock],
  );

  // Cancel (deactivate) a recurrence
  const cancelRecurrence = useCallback(
    (id: string) => withWriteLock(async () => {
      const newRecurrences = recurrences.map((r) =>
        r.id === id ? { ...r, active: false } : r
      );
      const newData: StorageData = { goals, deposits, recurrences: newRecurrences };

      try {
        await persist(newData);
        setRecurrences(newRecurrences);
      } catch (e) {
        console.error('Erro ao cancelar recorrência:', e);
        throw new Error('Não foi possível cancelar o aporte recorrente. Tente novamente.');
      }
    }),
    [goals, deposits, recurrences, persist, withWriteLock],
  );

  /**
   * Called once on app startup (from app/index.tsx).
   * For each active recurrence, checks whether a new monthly deposit is due
   * and, if so, adds the GoalDeposit AND fires an addTransaction to debit the
   * source account — keeping the two data stores in sync.
   */
  const processOverdueRecurrences = useCallback(
    (addTransaction: (tx: any) => Promise<any>) =>
      withWriteLock(async () => {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return;

        let data: StorageData;
        try {
          data = JSON.parse(raw);
        } catch {
          return;
        }

        if (!Array.isArray(data.recurrences)) return;

        const today = new Date();
        today.setHours(23, 59, 59, 999);

        let changed = false;
        let updatedDeposits = [...data.deposits];
        let updatedGoals = [...data.goals];
        const updatedRecurrences = [...data.recurrences];

        for (let ri = 0; ri < updatedRecurrences.length; ri++) {
          const rec = updatedRecurrences[ri];
          if (!rec.active) continue;

          // Check end date
          if (rec.endDate && new Date(rec.endDate) < today) {
            updatedRecurrences[ri] = { ...rec, active: false };
            changed = true;
            continue;
          }

          // Determine all months that should have been processed since startDate
          const startDate = new Date(rec.startDate);
          const lastProcessed = rec.lastProcessedDate
            ? new Date(rec.lastProcessedDate)
            : null;

          // Build the list of due dates (YYYY-MM combos) not yet processed
          const dueDates: Date[] = [];
          let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

          while (cursor <= today) {
            const dueDate = new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(rec.dayOfMonth, 28));

            // Only process if dueDate is today or past AND after lastProcessed
            if (dueDate <= today) {
              const alreadyDone =
                (lastProcessed !== null && dueDate.getFullYear() < lastProcessed.getFullYear()) ||
                (lastProcessed !== null &&
                  dueDate.getFullYear() === lastProcessed.getFullYear() &&
                  dueDate.getMonth() <= lastProcessed.getMonth());

              if (!alreadyDone) {
                dueDates.push(dueDate);
              }
            }

            // Advance one month
            cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
          }

          if (dueDates.length === 0) continue;

          // Process each overdue date
          for (const dueDate of dueDates) {
            // Skip if past the goal's deadline (goal already ended)
            const goalSnapshot = updatedGoals.find((g) => g.id === rec.goalId);
            if (!goalSnapshot) continue;

            // 1. Add GoalDeposit record
            const newDeposit: GoalDeposit = {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              goalId: rec.goalId,
              amount: rec.amount,
              date: dueDate.toISOString(),
              accountId: rec.accountId,
              source: 'recurrence',
            };
            updatedDeposits = [...updatedDeposits, newDeposit];

            // 2. Update goal's accumulatedAmount in memory
            updatedGoals = updatedGoals.map((g) =>
              g.id === rec.goalId
                ? {
                    ...g,
                    accumulatedAmount: g.accumulatedAmount + rec.amount,
                    updatedAt: dueDate.toISOString(),
                  }
                : g
            );

            // 3. Fire addTransaction to debit from source account
            try {
              await addTransaction({
                description: `Aporte: ${goalSnapshot.name}`,
                amount: rec.amount,
                type: 'transferencia',
                date: dueDate.toISOString(),
                accountId: rec.accountId,
                targetAccountId: `goal_${rec.goalId}`,
                paid: true,
                recurrence: 'unica',
                paymentMethod: 'debito',
              });
            } catch (txErr) {
              console.error('Erro ao registrar transação do aporte recorrente:', txErr);
            }

            changed = true;
          }

          // Update lastProcessedDate to the most recent due date processed
          if (dueDates.length > 0) {
            const latest = dueDates[dueDates.length - 1];
            updatedRecurrences[ri] = {
              ...rec,
              lastProcessedDate: latest.toISOString(),
            };
          }
        }

        if (!changed) return;

        const newData: StorageData = {
          goals: updatedGoals,
          deposits: updatedDeposits,
          recurrences: updatedRecurrences,
        };

        await persist(newData);
        setGoals(sortGoals(updatedGoals));
        setDeposits(updatedDeposits);
        setRecurrences(updatedRecurrences);
      }),
    [sortGoals, persist, withWriteLock],
  );

  /**
   * Synchronizes paid goal transfer transactions with GoalDeposits.
   * This ensures that any recurring or manual transfer targeting a goal
   * that is marked as paid is properly recorded as an accumulated deposit.
   */
  const syncWithTransactions = useCallback(
    (transactions: any[]) =>
      withWriteLock(async () => {
        if (!Array.isArray(transactions)) return;

        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return;

        let data: StorageData;
        try {
          data = JSON.parse(raw);
        } catch {
          return;
        }

        if (!Array.isArray(data.goals) || !Array.isArray(data.deposits)) return;

        const existingDeposits = [...data.deposits];
        const depositMap = new Map<string, GoalDeposit>();
        existingDeposits.forEach((d) => depositMap.set(d.id, d));
        const goalsById = new Map(data.goals.map((goal) => [goal.id, goal]));
        const goalTransactions = transactions.filter((tx) =>
          tx.type === 'transferencia' &&
          (tx.targetAccountId?.startsWith('goal_') || tx.accountId?.startsWith('goal_')),
        );

        let changed = false;

        // Process all transactions
        for (const tx of goalTransactions) {
          // 1. Aportes/Depósitos na meta
          if (tx.type === 'transferencia' && tx.targetAccountId?.startsWith('goal_')) {
            const goalId = tx.targetAccountId.replace('goal_', '');
            if (!goalsById.has(goalId)) continue;

            const depositId = `tx_${tx.id}`;
            const existing = depositMap.get(depositId) || depositMap.get(tx.id);

            if (tx.paid) {
              const isTxRecurring = (tx.recurrence && tx.recurrence !== 'unica') || !!tx.groupId || tx.id.includes('-');
              if (!existing || existing.amount !== tx.amount || existing.goalId !== goalId) {
                const newDeposit: GoalDeposit = {
                  id: depositId,
                  goalId,
                  amount: tx.amount,
                  date: tx.date,
                  accountId: tx.accountId,
                  source: isTxRecurring ? 'recurrence' : 'manual',
                };
                if (existing) {
                  const idx = existingDeposits.findIndex((d) => d.id === existing.id);
                  if (idx !== -1) existingDeposits[idx] = newDeposit;
                } else {
                  existingDeposits.push(newDeposit);
                }
                depositMap.set(depositId, newDeposit);
                changed = true;
              }
            } else {
              if (existing) {
                const idx = existingDeposits.findIndex((d) => d.id === existing.id);
                if (idx !== -1) existingDeposits.splice(idx, 1);
                depositMap.delete(existing.id);
                changed = true;
              }
            }
          }

          // 2. Resgates/Retiradas da meta
          if (tx.type === 'transferencia' && tx.accountId?.startsWith('goal_')) {
            const goalId = tx.accountId.replace('goal_', '');
            if (!goalsById.has(goalId)) continue;

            const depositId = `tx_withdraw_${tx.id}`;
            const existing = depositMap.get(depositId) || depositMap.get(tx.id);

            if (tx.paid) {
              const isTxRecurring = (tx.recurrence && tx.recurrence !== 'unica') || !!tx.groupId || tx.id.includes('-');
              if (!existing || existing.amount !== -tx.amount || existing.goalId !== goalId) {
                const newDeposit: GoalDeposit = {
                  id: depositId,
                  goalId,
                  amount: -tx.amount,
                  date: tx.date,
                  accountId: tx.targetAccountId,
                  source: isTxRecurring ? 'recurrence' : 'manual',
                };
                if (existing) {
                  const idx = existingDeposits.findIndex((d) => d.id === existing.id);
                  if (idx !== -1) existingDeposits[idx] = newDeposit;
                } else {
                  existingDeposits.push(newDeposit);
                }
                depositMap.set(depositId, newDeposit);
                changed = true;
              }
            } else {
              if (existing) {
                const idx = existingDeposits.findIndex((d) => d.id === existing.id);
                if (idx !== -1) existingDeposits.splice(idx, 1);
                depositMap.delete(existing.id);
                changed = true;
              }
            }
          }
        }

        // Clean up any tx_ deposits whose transactions were deleted
        const txIdSet = new Set(transactions.map((t) => t.id));
        const cleanedDeposits = existingDeposits.filter((d) => {
          if (d.id.startsWith('tx_withdraw_')) {
            const rawTxId = d.id.replace('tx_withdraw_', '');
            if (!txIdSet.has(rawTxId)) {
              changed = true;
              return false;
            }
          } else if (d.id.startsWith('tx_')) {
            const rawTxId = d.id.replace('tx_', '');
            if (!txIdSet.has(rawTxId)) {
              changed = true;
              return false;
            }
          }
          return true;
        });

        if (!changed) return;

        const updatedGoals = sortGoals(
          data.goals.map((goal) => {
            const goalDeposits = cleanedDeposits.filter((d) => d.goalId === goal.id);
            return {
              ...goal,
              accumulatedAmount: recalculateAccumulated(goalDeposits),
            };
          })
        );

        const newData: StorageData = {
          goals: updatedGoals,
          deposits: cleanedDeposits,
          recurrences: data.recurrences,
        };

        await persist(newData);
        setDeposits(cleanedDeposits);
        setGoals(updatedGoals);
      }),
    [sortGoals, persist, withWriteLock]
  );

  return {
    goals,
    deposits,
    recurrences,
    loading,
    error,
    createGoal,
    updateGoal,
    deleteGoal,
    addDeposit,
    deleteDeposit,
    addWithdrawal,
    createRecurrence,
    cancelRecurrence,
    processOverdueRecurrences,
    syncWithTransactions,
    retry,
  };
}
