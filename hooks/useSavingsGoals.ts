// hooks/useSavingsGoals.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SavingsGoal, GoalDeposit, CreateGoalInput, UpdateGoalInput } from '@/constants/types';
import { recalculateAccumulated } from '@/lib/goalUtils';

const STORAGE_KEY = '@horizonte:savings_goals';

interface StorageData {
  goals: SavingsGoal[];
  deposits: GoalDeposit[];
}

export interface UseSavingsGoalsReturn {
  goals: SavingsGoal[];
  deposits: GoalDeposit[];
  loading: boolean;
  error: string | null;

  createGoal: (input: CreateGoalInput) => Promise<SavingsGoal>;
  updateGoal: (id: string, input: UpdateGoalInput) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  addDeposit: (goalId: string, amount: number, accountId?: string) => Promise<void>;
  addWithdrawal: (goalId: string, amount: number, accountId?: string) => Promise<void>;
  retry: () => Promise<void>;
}

export function useSavingsGoals(): UseSavingsGoalsReturn {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [deposits, setDeposits] = useState<GoalDeposit[]>([]);
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
        setLoading(false);
        return;
      }

      let parsed: StorageData;
      try {
        parsed = JSON.parse(raw);
      } catch (parseError) {
        // Malformed data: treat as empty, log error, do NOT delete corrupted data
        console.error('Dados de metas corrompidos no AsyncStorage:', parseError);
        setGoals([]);
        setDeposits([]);
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
        setLoading(false);
        return;
      }

      const loadedDeposits = parsed.deposits;

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
      const newData: StorageData = { goals: newGoals, deposits };

      try {
        await persist(newData);
        setGoals(newGoals);
        return newGoal;
      } catch (e) {
        // Revert: don't update in-memory state on write failure
        console.error('Erro ao salvar meta:', e);
        throw new Error('Não foi possível salvar a meta. Tente novamente.');
      }
    }),
    [goals, deposits, sortGoals, persist, withWriteLock],
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
      const newData: StorageData = { goals: newGoals, deposits };

      try {
        await persist(newData);
        setGoals(newGoals);
      } catch (e) {
        // Revert: don't update in-memory state on write failure
        console.error('Erro ao atualizar meta:', e);
        throw new Error('Não foi possível atualizar a meta. Tente novamente.');
      }
    }),
    [goals, deposits, sortGoals, persist, withWriteLock],
  );

  // Delete a goal and all associated deposits
  const deleteGoal = useCallback(
    (id: string) => withWriteLock(async () => {
      const newGoals = goals.filter((g) => g.id !== id);
      const newDeposits = deposits.filter((d) => d.goalId !== id);
      const newData: StorageData = { goals: newGoals, deposits: newDeposits };

      try {
        await persist(newData);
        setGoals(newGoals);
        setDeposits(newDeposits);
      } catch (e) {
        // Revert: don't update in-memory state on write failure
        console.error('Erro ao excluir meta:', e);
        throw new Error('Não foi possível excluir a meta. Tente novamente.');
      }
    }),
    [goals, deposits, persist, withWriteLock],
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
      };

      const newDeposits = [...deposits, newDeposit];
      const newGoals = sortGoals(
        goals.map((g) =>
          g.id === goalId
            ? { ...g, accumulatedAmount: g.accumulatedAmount + amount, updatedAt: new Date().toISOString() }
            : g
        )
      );
      const newData: StorageData = { goals: newGoals, deposits: newDeposits };

      try {
        await persist(newData);
        setGoals(newGoals);
        setDeposits(newDeposits);
      } catch (e) {
        // Revert: don't update in-memory state on write failure
        console.error('Erro ao registrar depósito:', e);
        throw new Error('Não foi possível registrar o depósito. Tente novamente.');
      }
    }),
    [goals, deposits, sortGoals, persist, withWriteLock],
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
      };

      const newDeposits = [...deposits, newDeposit];
      const newGoals = sortGoals(
        goals.map((g) =>
          g.id === goalId
            ? { ...g, accumulatedAmount: g.accumulatedAmount - amount, updatedAt: new Date().toISOString() }
            : g
        )
      );
      const newData: StorageData = { goals: newGoals, deposits: newDeposits };

      try {
        await persist(newData);
        setGoals(newGoals);
        setDeposits(newDeposits);
      } catch (e) {
        // Revert: don't update in-memory state on write failure
        console.error('Erro ao registrar retirada:', e);
        throw new Error('Não foi possível registrar a retirada. Tente novamente.');
      }
    }),
    [goals, deposits, sortGoals, persist, withWriteLock],
  );

  return {
    goals,
    deposits,
    loading,
    error,
    createGoal,
    updateGoal,
    deleteGoal,
    addDeposit,
    addWithdrawal,
    retry,
  };
}
