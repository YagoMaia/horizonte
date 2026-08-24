// components/screens/HorizonteScreen.tsx
import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Modal,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useStoreContext } from "@/context/StoreContext";
import { useSavingsGoals } from "@/hooks/useSavingsGoals";
import { formatCurrency, formatDateShort, getTransactionVisuals } from "@/lib/utils";
import AsyncStorage from "@react-native-async-storage/async-storage";

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const MONTH_ABBR = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];
const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getWeekDay(year: number, month: number, day: number) {
  return WEEK_DAYS[new Date(year, month, day).getDay()];
}
function formatShort(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

// 👉 NOVA FUNÇÃO: Formatação compacta (ex: 1.1K, -200)
function formatCompactK(value: number): string {
  const isNeg = value < 0;
  const absVal = Math.abs(value);
  if (absVal >= 1000) {
    return (
      (isNeg ? "-" : "") +
      (absVal / 1000).toFixed(absVal % 1000 >= 100 ? 1 : 0) +
      "K"
    );
  }
  return (isNeg ? "-" : "") + absVal.toFixed(0);
}

export function HorizonteScreen() {
  const { colors } = useTheme();
  const { transactions, accounts, getEffectiveBudget, saveMonthlyBudget } =
    useStoreContext();
  const { goals } = useSavingsGoals();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<any | null>(null);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [activeAccountIds, setActiveAccountIds] = useState<string[]>([]);
  const [activeGoalIds, setActiveGoalIds] = useState<string[]>([]);
  const [budgetInput, setBudgetInput] = useState<string>("");

  // 👉 NOVO ESTADO: Alternar entre Lista e Mapa de Calor
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const currentBudget = getEffectiveBudget(year, month);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const savedAccounts = await AsyncStorage.getItem(
          "@horizonte:active_accounts",
        );
        if (savedAccounts) setActiveAccountIds(JSON.parse(savedAccounts));
        else setActiveAccountIds(accounts.map((a) => a.id));

        const savedGoals = await AsyncStorage.getItem("@horizonte:active_goals");
        if (savedGoals) setActiveGoalIds(JSON.parse(savedGoals));

        const savedView = await AsyncStorage.getItem("@horizonte:view_mode");
        if (savedView) setViewMode(savedView as "list" | "grid");
      } catch (e) {
        console.error(e);
      }
    };
    loadConfig();
  }, [accounts]);

  useEffect(() => {
    if (configModalVisible) {
      setBudgetInput(
        currentBudget > 0 ? currentBudget.toFixed(2).replace(".", ",") : "",
      );
    }
  }, [configModalVisible, currentBudget]);

  const toggleAccount = async (id: string) => {
    const newIds = activeAccountIds.includes(id)
      ? activeAccountIds.filter((aId) => aId !== id)
      : [...activeAccountIds, id];
    setActiveAccountIds(newIds);
    await AsyncStorage.setItem(
      "@horizonte:active_accounts",
      JSON.stringify(newIds),
    );
  };

  const toggleGoal = async (id: string) => {
    const newIds = activeGoalIds.includes(id)
      ? activeGoalIds.filter((gId) => gId !== id)
      : [...activeGoalIds, id];
    setActiveGoalIds(newIds);
    await AsyncStorage.setItem("@horizonte:active_goals", JSON.stringify(newIds));
  };

  const saveBudget = async () => {
    const value = parseFloat(budgetInput.replace(",", "."));
    if (!isNaN(value)) await saveMonthlyBudget(year, month, value);
    setConfigModalVisible(false);
  };

  const toggleViewMode = async () => {
    const newMode = viewMode === "list" ? "grid" : "list";
    setViewMode(newMode);
    await AsyncStorage.setItem("@horizonte:view_mode", newMode);
  };

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  // Saldo das contas ativas + saldo acumulado das metas ativas no Horizonte
  const activeGoalsBalance = goals
    .filter((g) => activeGoalIds.includes(g.id))
    .reduce((s, g) => s + g.accumulatedAmount, 0);

  const activeBalance = accounts
    .filter(
      (a) => activeAccountIds.includes(a.id) && a.type !== "cartao_credito",
    )
    .reduce((s, a) => s + a.balance, 0) + activeGoalsBalance;

  // Set de IDs de metas ativas para uso no motor de projeção
  const activeGoalIdSet = new Set(activeGoalIds);

  // 👉 O MOTOR CONTÍNUO MULTI-MÊS
  const { resultsMap, firstNegativeDate } = useMemo(() => {
    const isPast =
      year < today.getFullYear() ||
      (year === today.getFullYear() && month < today.getMonth());
    const startYear = isPast ? year : today.getFullYear();
    const startMonth = isPast ? month : today.getMonth();

    // 1. Descobre o saldo exato no início do mês de partida (desfazendo o futuro)
    // Consideramos apenas as contas ativas no planejamento
    let openingBalance = activeBalance;
    
    // Transações já pagas que aconteceram do início do mês de partida até hoje
    // Precisamos retroceder o saldo até o dia 01 do mês de partida
    // IDs de contas ativas que NÃO são cartão de crédito (afetam o saldo real)
    const activeCashAccountIds = new Set(
      accounts
        .filter(a => activeAccountIds.includes(a.id) && a.type !== 'cartao_credito')
        .map(a => a.id)
    );

    const txsToUndo = transactions.filter((tx) => {
      if (!tx.paid) return false;
      // Transações de cartão de crédito não afetam o saldo das contas bancárias diretamente.
      // O impacto no caixa vem das faturas virtuais (creditExpense) ou do pagamento da fatura (paymentMethod='debito').
      if (tx.paymentMethod === 'credito') return false;
      const d = new Date(tx.date);
      const isFromStartMonthOnwards = d.getFullYear() > startYear || (d.getFullYear() === startYear && d.getMonth() >= startMonth);
      return isFromStartMonthOnwards;
    });

    txsToUndo.forEach((tx) => {
      const isFromActiveAccount = activeCashAccountIds.has(tx.accountId);
      const isToActiveAccount = tx.type === 'transferencia' && tx.targetAccountId && activeCashAccountIds.has(tx.targetAccountId);

      // Transferências para/de metas ATIVAS no Horizonte são neutras (o saldo da meta já está incluído no activeBalance)
      const goalId = tx.targetAccountId?.startsWith('goal_')
        ? tx.targetAccountId.replace('goal_', '')
        : tx.accountId?.startsWith('goal_')
        ? tx.accountId.replace('goal_', '')
        : null;
      const isActiveGoalTransfer = goalId !== null && activeGoalIdSet.has(goalId);
      if (isActiveGoalTransfer) return; // Ignora — o saldo da meta já está contabilizado

      if (tx.type === 'receita' && isFromActiveAccount) openingBalance -= tx.amount;
      else if (tx.type === 'despesa' && isFromActiveAccount) openingBalance += tx.amount;
      else if (tx.type === 'transferencia') {
        if (isFromActiveAccount) openingBalance += tx.amount; // Saiu da conta ativa, devolvemos
        if (isToActiveAccount) openingBalance -= tx.amount;   // Entrou na conta ativa, removemos
      }
    });

    let runningBalance = openingBalance;
    const resultsMap: Record<string, any[]> = {};
    let firstNegDate: string | null = null;

    let simYear = startYear;
    let simMonth = startMonth;

    // Alvo final: até o fim do próximo ano (máximo 1 ano à frente do ano atual)
    const horizonEnd = new Date(today.getFullYear() + 1, 11, 31);
    
    // Alvo visual: O mês que o utilizador escolheu + 2 meses para a frente (para encher a grelha)
    let visualEndYear = year;
    let visualEndMonth = month + 2;
    if (visualEndMonth > 11) {
      visualEndMonth -= 12;
      visualEndYear++;
    }

    const visualEndDate = new Date(visualEndYear, visualEndMonth, 31);
    const calculationEndDate = visualEndDate > horizonEnd ? visualEndDate : horizonEnd;

    // 👉 PRÉ-CÁLCULO DE FATURAS DE CARTÃO DE CRÉDITO (NÃO PAGAS)
    const virtualInvoiceTxs: Record<string, any[]> = {};
    accounts.filter(a => a.type === 'cartao_credito').forEach(card => {
      const closingDay = card.closingDay || 25;
      const dueDay = card.dueDay || 5;
      
      const cardUnpaidTxs = transactions.filter(tx => 
        tx.accountId === card.id && tx.paymentMethod === 'credito' && !tx.paid
      );
      
      const invoiceTotals: Record<string, number> = {};
      
      cardUnpaidTxs.forEach(tx => {
        const d = new Date(tx.date);
        let m = d.getMonth() + 1;
        let y = d.getFullYear();
        if (d.getDate() >= closingDay) m += 1;
        if (dueDay < closingDay) m += 1;
        while (m > 12) { m -= 12; y += 1; }
        
        const invoiceMonth = m - 1;
        const invoiceYear = y;
        const dateKey = `${invoiceYear}-${invoiceMonth}-${dueDay}`;
        
        invoiceTotals[dateKey] = (invoiceTotals[dateKey] || 0) + (tx.type === 'receita' ? -tx.amount : tx.amount);
      });
      
      Object.entries(invoiceTotals).forEach(([dateKey, amount]) => {
        if (amount > 0) {
          if (!virtualInvoiceTxs[dateKey]) virtualInvoiceTxs[dateKey] = [];
          const [y, m, d] = dateKey.split('-').map(Number);
          virtualInvoiceTxs[dateKey].push({
            id: `virtual-invoice-${card.id}-${dateKey}`,
            description: `Fatura ${card.name}`,
            amount: amount,
            type: 'despesa',
            date: new Date(y, m, d).toISOString(),
            accountId: card.id,
            paymentMethod: 'debito', // Para não ser filtrado no effectiveDayTxs
            paid: false,
            isVirtual: true, // Tag para identificar que impacta o caixa independente da conta
          });
        }
      });
    });

    // 2. Roda a fita do tempo
    while (new Date(simYear, simMonth, 1) <= calculationEndDate) {
      const simDaysCount = getDaysInMonth(simYear, simMonth);
      const simBudget = getEffectiveBudget(simYear, simMonth);
      const monthKey = `${simYear}-${simMonth}`;
      const monthDays = [];

      const monthTxs = transactions.filter((tx) => {
        const d = new Date(tx.date);
        return d.getFullYear() === simYear && d.getMonth() === simMonth;
      });

      const txsByDay: Record<number, any[]> = {};
      monthTxs.forEach((tx) => {
        const day = new Date(tx.date).getDate();
        if (!txsByDay[day]) txsByDay[day] = [];
        txsByDay[day].push(tx);
      });

      let accumulatedMonthlyExpense = 0;
      let frozenFutureDailyPlan = 0;

      for (let d = 1; d <= simDaysCount; d++) {
        const dbTxs = txsByDay[d] || [];
        const vTxs = virtualInvoiceTxs[`${simYear}-${simMonth}-${d}`] || [];
        const dayTxs = [...dbTxs, ...vTxs];
        
        const effectiveDayTxs = dayTxs.filter(tx => tx.paymentMethod !== 'credito');

        const income = effectiveDayTxs
          .filter((t) => {
            if (t.isVirtual) return t.type === 'receita';
            if (t.type === 'receita' && activeCashAccountIds.has(t.accountId)) return true;
            if (t.type === 'transferencia' && t.targetAccountId && activeCashAccountIds.has(t.targetAccountId) && !activeCashAccountIds.has(t.accountId)) {
              // Resgates de metas ATIVAS são neutros — o saldo delas já está em activeBalance.
              // Contar o resgate como income causaria dupla contagem positiva.
              const srcGoalId = t.accountId?.startsWith('goal_') ? t.accountId.replace('goal_', '') : null;
              if (srcGoalId && activeGoalIdSet.has(srcGoalId)) return false;
              return true;
            }
            return false;
          })
          .reduce((s, t) => s + t.amount, 0);

        const expense = effectiveDayTxs
          .filter((t) => {
            if (t.isVirtual) return false;
            if (t.type === 'despesa' && activeCashAccountIds.has(t.accountId)) return true;
            return false;
          })
          .reduce((s, t) => s + t.amount, 0);

        // Transferências impactam o saldo mas não são classificadas como "gasto"
        // Transferências para/de metas ATIVAS são neutras — o saldo delas já está no activeBalance
        const transferOut = effectiveDayTxs
          .filter((t) => {
            if (t.type !== 'transferencia') return false;
            if (!activeCashAccountIds.has(t.accountId)) return false;
            // Metas ativas: aporte é neutro (vai de uma "conta ativa" para outra)
            const tGoalId = t.targetAccountId?.startsWith('goal_')
              ? t.targetAccountId.replace('goal_', '')
              : null;
            if (tGoalId && activeGoalIdSet.has(tGoalId)) return false;
            // Resgates de metas ativas: também neutros
            const sGoalId = t.accountId?.startsWith('goal_')
              ? t.accountId.replace('goal_', '')
              : null;
            if (sGoalId && activeGoalIdSet.has(sGoalId)) return false;
            return !t.targetAccountId || !activeCashAccountIds.has(t.targetAccountId);
          })
          .reduce((s, t) => s + t.amount, 0);

        // Faturas de cartão de crédito (transações virtuais de fatura)
        const creditExpense = effectiveDayTxs
          .filter((t) => t.isVirtual && t.type === 'despesa')
          .reduce((s, t) => s + t.amount, 0);

        const dayDate = new Date(simYear, simMonth, d);
        const isDayPast =
          dayDate <
          new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const isDayToday =
          d === today.getDate() &&
          simMonth === today.getMonth() &&
          simYear === today.getFullYear();

        if (isDayPast) accumulatedMonthlyExpense += expense;

        let dailyPlan = 0;
        if (simBudget > 0) {
          if (isDayPast || isDayToday) {
            const remainingBudget = simBudget - accumulatedMonthlyExpense;
            const remainingDays = simDaysCount - d + 1;
            dailyPlan =
              remainingBudget > 0 ? remainingBudget / remainingDays : 0;
            if (isDayToday) frozenFutureDailyPlan = dailyPlan;
          } else {
            const isFutureMonthSim =
              simMonth > today.getMonth() || simYear > today.getFullYear();
            dailyPlan = isFutureMonthSim
              ? simBudget / simDaysCount
              : frozenFutureDailyPlan;
          }
        }

        const dayNet = income - expense - transferOut - creditExpense;
        if (isDayPast) {
          runningBalance += dayNet;
        } else {
          runningBalance += dayNet - dailyPlan;
        }

        if (runningBalance < 0 && !firstNegDate && !isDayPast && dayDate <= horizonEnd) {
          firstNegDate = dayDate.toISOString();
        }

        monthDays.push({
          day: d,
          weekDay: getWeekDay(simYear, simMonth, d),
          income,
          expense,
          transferOut,
          creditExpense,
          dailyPlan,
          balance: runningBalance,
          isPast: isDayPast,
          isToday: isDayToday,
          fullDate: dayDate.toISOString(),
          transactions: dayTxs,
        });
      }

      resultsMap[monthKey] = monthDays;
      simMonth++;
      if (simMonth > 11) {
        simMonth = 0;
        simYear++;
      }
    }

    return { resultsMap, firstNegativeDate: firstNegDate };
  }, [transactions, activeBalance, activeAccountIds, activeGoalIdSet, activeGoalIds, year, month, getEffectiveBudget, today]);

  // Extrai o mês focado para o Modo Lista e Resumo
  const focusedMonthKey = `${year}-${month}`;
  const days = resultsMap[focusedMonthKey] || [];

  const totalIncome = days.reduce((s, d) => s + d.income, 0);
  const totalExpense = days.reduce((s, d) => s + d.expense, 0);
  const totalTransferOut = days.reduce((s, d) => s + (d.transferOut || 0), 0);
  const totalCreditExpense = days.reduce((s, d) => s + (d.creditExpense || 0), 0);
  // Saídas totais = gastos diretos + faturas de cartão de crédito
  const totalExpenseWithCredit = totalExpense + totalCreditExpense;
  const endBalance =
    days.length > 0 ? days[days.length - 1].balance : activeBalance;
  const currentDailyPlan =
    days.find((d) => d.isToday || (!d.isPast && currentBudget > 0))
      ?.dailyPlan || 0;

  // 👉 LÓGICA DO MAPA DE CALOR (GRID)
  const renderHeatmapGrid = () => {
    const columns = [0, 1, 2].map((offset) => {
      let y = year;
      let m = month + offset;
      if (m > 11) {
        m -= 12;
        y++;
      }
      return { year: y, month: m, key: `${y}-${m}` };
    });

    const rows = Array.from({ length: 31 }, (_, i) => i + 1);

    const getHeatmapColor = (balance: number) => {
      if (balance < 0) return colors.destructive + "30"; // Vermelho
      if (balance < 500) return colors.warning + "30"; // Amarelo
      return colors.success + "30"; // Verde
    };

    return (
      <View style={styles.gridWrapper}>
        <View style={[styles.gridHeader, { borderBottomColor: colors.border }]}>
          <View style={styles.gridDayCol}>
            <Text
              style={[styles.gridColTitle, { color: colors.mutedForeground }]}
            >
              Dia
            </Text>
          </View>
          {columns.map((col) => (
            <View key={col.key} style={styles.gridCol}>
              <Text style={[styles.gridColTitle, { color: colors.foreground }]}>
                {MONTH_ABBR[col.month]}/{col.year.toString().slice(-2)}
              </Text>
            </View>
          ))}
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {rows.map((dayNum) => (
            <View
              key={dayNum}
              style={[styles.gridRow, { borderBottomColor: colors.border }]}
            >
              <View style={styles.gridDayCol}>
                <Text
                  style={[
                    styles.gridDayText,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {dayNum}
                </Text>
              </View>
              {columns.map((col) => {
                const dayData = resultsMap[col.key]?.find(
                  (d: any) => d.day === dayNum,
                );
                if (!dayData)
                  return (
                    <View
                      key={`${col.key}-${dayNum}`}
                      style={styles.gridCell}
                    />
                  ); // Mês sem dia 31

                const bgColor = getHeatmapColor(dayData.balance);
                const textColor =
                  dayData.balance < 0 ? colors.destructive : colors.foreground;

                return (
                  <TouchableOpacity
                    key={`${col.key}-${dayNum}`}
                    style={[styles.gridCell, { backgroundColor: bgColor }]}
                    onPress={() => setSelectedDay(dayData)}
                  >
                    <Text style={[styles.gridCellText, { color: textColor }]}>
                      {formatCompactK(dayData.balance)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* BANNER DE ALERTA CRÍTICO */}
      {firstNegativeDate && (() => {
        const negDate = new Date(firstNegativeDate);
        const negMonth = negDate.getMonth();
        const negYear = negDate.getFullYear();
        const isInCurrentView = negMonth === month && negYear === year;
        const mesNome = MONTH_NAMES[negMonth];
        return (
          <View style={[styles.alertBanner, { backgroundColor: isInCurrentView ? colors.destructive : '#F57C00' }]}>
            <Ionicons name="warning" size={20} color="#FFF" />
            <Text style={styles.alertText}>
              {isInCurrentView
                ? `Saldo negativo previsto em ${mesNome} — revise seus gastos ou aportes`
                : `Saldo negativo previsto em ${mesNome} ${negYear}`}
            </Text>
          </View>
        );
      })()}

      {/* HEADER E NAVEGAÇÃO DE MESES */}
      <View
        style={[
          styles.monthNav,
          { borderBottomColor: colors.border, backgroundColor: colors.card },
        ]}
      >
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </TouchableOpacity>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Text style={[styles.monthTitle, { color: colors.foreground }]}>
            {MONTH_NAMES[month]} {year}
          </Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <TouchableOpacity
              onPress={toggleViewMode}
              style={[styles.configBtn, { backgroundColor: colors.secondary }]}
            >
              <Ionicons
                name={viewMode === "list" ? "grid" : "list"}
                size={16}
                color={colors.foreground}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setConfigModalVisible(true)}
              style={[styles.configBtn, { backgroundColor: colors.secondary }]}
            >
              <Ionicons name="options" size={16} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
          <Ionicons
            name="chevron-forward"
            size={22}
            color={colors.foreground}
          />
        </TouchableOpacity>
      </View>

      {/* STRIP DE RESUMO */}
      <View
        style={[
          styles.budgetCard,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.budgetRow}>
          <View style={styles.budgetInfo}>
            <Text
              style={[
                styles.budgetLabel,
                { color: colors.mutedForeground },
              ]}
            >
              Saldo Disponível{" "}
              {activeAccountIds.length > 0 &&
                `(${activeAccountIds.length})`}
            </Text>
            <Text
              style={[styles.budgetValue, { color: colors.foreground }]}
            >
              {formatCurrency(activeBalance)}
            </Text>
            {activeGoalIds.length > 0 && activeGoalsBalance > 0 && (
              <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>
                {`inclui ${activeGoalIds.length} meta${activeGoalIds.length > 1 ? 's' : ''} · `}
                <Text style={{ color: '#388E3C' }}>{formatCurrency(activeGoalsBalance)}</Text>
              </Text>
            )}
          </View>
          <View style={styles.budgetRight}>
            <Text
              style={[styles.dailyLabel, { color: colors.mutedForeground }]}
            >
              Meta Diária Hoje
            </Text>
            {currentBudget > 0 ? (
              <Text style={[styles.dailyValue, { color: colors.primary }]}>
                {formatShort(currentDailyPlan)}
              </Text>
            ) : (
              <TouchableOpacity onPress={() => setConfigModalVisible(true)}>
                <Text
                  style={[
                    styles.dailyValue,
                    { color: colors.mutedForeground, fontSize: 12 },
                  ]}
                >
                  Definir Meta
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <View
        style={[
          styles.summaryStrip,
          {
            backgroundColor: colors.secondary,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.summaryItem}>
          <Text
            style={[styles.summaryLabel, { color: colors.mutedForeground }]}
          >
            Entradas
          </Text>
          <Text style={[styles.summaryValue, { color: colors.success }]}>
            +{formatShort(totalIncome)}
          </Text>
        </View>
        <View
          style={[
            styles.summaryDivider,
            { backgroundColor: colors.border },
          ]}
        />
        <View style={styles.summaryItem}>
          <Text
            style={[styles.summaryLabel, { color: colors.mutedForeground }]}
          >
            Saídas
          </Text>
          <Text
            style={[styles.summaryValue, { color: colors.destructive }]}
          >
            -{formatShort(totalExpenseWithCredit)}
          </Text>
        </View>
        <View
          style={[
            styles.summaryDivider,
            { backgroundColor: colors.border },
          ]}
        />
        <View style={styles.summaryItem}>
          <Text
            style={[styles.summaryLabel, { color: colors.mutedForeground }]}
          >
            Projeção Fim
          </Text>
          <Text
            style={[
              styles.summaryValue,
              {
                color:
                  endBalance >= 0 ? colors.success : colors.destructive,
              },
            ]}
          >
            {formatShort(endBalance)}
          </Text>
        </View>
      </View>

      {/* ÁREA DE RENDERIZAÇÃO (GRID OU LISTA) */}
      {viewMode === "grid" ? (
        renderHeatmapGrid()
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {days.map((d, idx) => {
            const rowBg = d.isToday
              ? colors.primary + "10"
              : idx % 2 === 0
                ? colors.card
                : colors.background;
            // Gasto total do dia = gastos diretos + fatura de crédito no vencimento
            const gastoTotalDia = d.expense + (d.creditExpense || 0);
            const economizou =
              currentBudget > 0 && d.dailyPlan > 0 && gastoTotalDia < d.dailyPlan;
            const excedeu =
              currentBudget > 0 && d.isPast && gastoTotalDia > d.dailyPlan;
            const valorDiferenca = Math.abs(d.dailyPlan - gastoTotalDia);
            const mostrarBadge = currentBudget > 0 && (d.isPast || d.isToday);

            const saldoBg =
              d.balance >= 0 ? colors.successLight : colors.dangerLight;
            const saldoColor =
              d.balance >= 0 ? colors.success : colors.destructive;

            return (
              <TouchableOpacity
                key={d.day}
                activeOpacity={0.7}
                onPress={() => setSelectedDay(d)}
                style={[
                  styles.row,
                  { backgroundColor: rowBg, borderBottomColor: colors.border },
                ]}
              >
                <View
                  style={[
                    styles.colDia,
                    {
                      backgroundColor: d.isToday
                        ? colors.primary + "15"
                        : "rgba(0,0,0,0.02)",
                    },
                  ]}
                >
                  <Text
                    style={[styles.dayNumber, { color: colors.foreground }]}
                  >
                    {d.day}
                  </Text>
                  <Text
                    style={[styles.weekDay, { color: colors.mutedForeground }]}
                  >
                    {d.weekDay}
                  </Text>
                </View>

                <View style={styles.colIndicators}>
                  <View style={styles.indicatorLine}>
                    <Ionicons
                      name="arrow-up-circle"
                      size={16}
                      color={d.income > 0 ? colors.success : colors.border}
                    />
                    <Text
                      style={[
                        styles.indicatorText,
                        {
                          color:
                            d.income > 0
                              ? colors.foreground
                              : colors.mutedForeground,
                        },
                      ]}
                    >
                      {formatShort(d.income)}
                    </Text>
                  </View>

                  <View style={styles.indicatorLine}>
                    <Ionicons
                      name="arrow-down-circle"
                      size={16}
                      color={d.expense > 0 ? colors.destructive : colors.border}
                    />
                    <Text
                      style={[
                        styles.indicatorText,
                        {
                          color:
                            d.expense > 0
                              ? colors.foreground
                              : colors.mutedForeground,
                          fontWeight: d.expense > 0 ? "700" : "400",
                        },
                      ]}
                    >
                      {formatShort(d.expense)}
                    </Text>
                  </View>

                  {d.transferOut > 0 && (
                    <View style={styles.indicatorLine}>
                      <Ionicons
                        name="swap-horizontal"
                        size={16}
                        color={colors.warning}
                      />
                      <Text
                        style={[
                          styles.indicatorText,
                          { color: colors.foreground },
                        ]}
                      >
                        {formatShort(d.transferOut)}
                      </Text>
                    </View>
                  )}

                  {d.creditExpense > 0 && (
                    <View style={styles.indicatorLine}>
                      <Ionicons
                        name="card-outline"
                        size={16}
                        color={colors.destructive}
                      />
                      <Text
                        style={[
                          styles.indicatorText,
                          { color: colors.foreground },
                        ]}
                      >
                        {formatShort(d.creditExpense)}
                      </Text>
                    </View>
                  )}

                  {currentBudget > 0 && (
                    <View style={styles.indicatorLine}>
                      <View
                        style={[
                          styles.miniBadge,
                          { backgroundColor: colors.primary },
                        ]}
                      >
                        <Text style={styles.miniBadgeText}>M</Text>
                      </View>
                      <Text
                        style={[
                          styles.indicatorText,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        {formatShort(d.dailyPlan || 0)}
                      </Text>

                      {mostrarBadge && (
                        <>
                          {economizou && (
                            <View
                              style={[
                                styles.savingBadge,
                                { backgroundColor: colors.success + "20" },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.savingText,
                                  { color: colors.success },
                                ]}
                              >{`+ ${formatShort(valorDiferenca)}`}</Text>
                            </View>
                          )}
                          {excedeu && (
                            <View
                              style={[
                                styles.savingBadge,
                                { backgroundColor: colors.destructive + "20" },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.savingText,
                                  { color: colors.destructive },
                                ]}
                              >{`- ${formatShort(valorDiferenca)}`}</Text>
                            </View>
                          )}
                        </>
                      )}
                    </View>
                  )}
                </View>

                <View
                  style={[styles.colSaldoVisual, { backgroundColor: saldoBg }]}
                >
                  <Text style={[styles.saldoTextLarge, { color: saldoColor }]}>
                    {formatShort(d.balance)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 50 }} />
        </ScrollView>
      )}

      {/* MODAL DE CONFIGURAÇÃO (Omitido por brevidade, mantém-se EXATAMENTE igual ao seu original) */}
      <Modal
        visible={configModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setConfigModalVisible(false)}
      >
        {/* ... (Seu modal de configuração de contas e orçamento que já funcionava perfeitamente) ... */}
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View
              style={[
                styles.configModalContent,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              {/* ... Todo o seu código de inputs, ScrollView e Switch das contas ... */}
              <View
                style={[
                  styles.modalHeader,
                  { borderBottomColor: colors.border },
                ]}
              >
                <View>
                  <Text
                    style={[styles.modalTitle, { color: colors.foreground }]}
                  >
                    Configurações
                  </Text>
                  <Text
                    style={[
                      styles.modalDate,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    Ajuste seu planejamento
                  </Text>
                </View>
              </View>

              <ScrollView
                style={{ maxHeight: 350 }}
                showsVerticalScrollIndicator={false}
              >
                <View style={{ marginBottom: 20 }}>
                  <Text
                    style={[styles.configLabel, { color: colors.foreground }]}
                  >
                    Orçamento Mensal (Meta)
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: colors.mutedForeground,
                      marginBottom: 8,
                    }}
                  >
                    Defina um limite de gastos para o mês.
                  </Text>
                  <View
                    style={[
                      styles.budgetInputContainer,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        marginRight: 8,
                        fontSize: 16,
                      }}
                    >
                      R$
                    </Text>
                    <TextInput
                      style={[styles.budgetInput, { color: colors.foreground }]}
                      keyboardType="decimal-pad"
                      placeholder="0,00"
                      placeholderTextColor={colors.mutedForeground}
                      value={budgetInput}
                      onChangeText={setBudgetInput}
                    />
                  </View>
                </View>

                <Text
                  style={[
                    styles.configLabel,
                    { color: colors.foreground, marginBottom: 8 },
                  ]}
                >
                  Contas no Planejamento
                </Text>
                {accounts.map((acc) => {
                  const isActive = activeAccountIds.includes(acc.id);
                  return (
                    <TouchableOpacity
                      key={acc.id}
                      activeOpacity={0.7}
                      onPress={() => toggleAccount(acc.id)}
                      style={[
                        styles.accountOption,
                        {
                          backgroundColor: isActive
                            ? colors.primary + "15"
                            : colors.background,
                          borderColor: isActive
                            ? colors.primary
                            : colors.border,
                        },
                      ]}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <View
                          style={[
                            styles.accountOptionIcon,
                            { backgroundColor: acc.color + "20" },
                          ]}
                        >
                          <Ionicons
                            name={acc.icon as any}
                            size={16}
                            color={acc.color}
                          />
                        </View>
                        <View>
                          <Text
                            style={[
                              styles.accountOptionName,
                              { color: colors.foreground },
                            ]}
                          >
                            {acc.name}
                          </Text>
                        </View>
                      </View>
                      <View
                        style={[
                          styles.checkbox,
                          {
                            borderColor: isActive
                              ? colors.primary
                              : colors.border,
                            backgroundColor: isActive
                              ? colors.primary
                              : "transparent",
                          },
                        ]}
                      >
                        {isActive && (
                          <Ionicons name="checkmark" size={14} color="#FFF" />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}

                {/* ── Seção de Metas ── */}
                {goals.length > 0 && (
                  <>
                    <Text
                      style={[
                        styles.configLabel,
                        { color: colors.foreground, marginTop: 20, marginBottom: 4 },
                      ]}
                    >
                      Metas no Planejamento
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 8 }}>
                      Metas marcadas têm seu saldo incluído no Horizonte e seus aportes não reduzem a projeção.
                    </Text>
                    {goals.map((goal) => {
                      const isGoalActive = activeGoalIds.includes(goal.id);
                      const pct = goal.targetAmount > 0
                        ? Math.min(100, Math.round((goal.accumulatedAmount / goal.targetAmount) * 100))
                        : 0;
                      return (
                        <TouchableOpacity
                          key={goal.id}
                          activeOpacity={0.7}
                          onPress={() => toggleGoal(goal.id)}
                          style={[
                            styles.accountOption,
                            {
                              backgroundColor: isGoalActive
                                ? '#388E3C15'
                                : colors.background,
                              borderColor: isGoalActive
                                ? '#388E3C'
                                : colors.border,
                            },
                          ]}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View style={[styles.accountOptionIcon, { backgroundColor: '#388E3C20' }]}>
                              <Ionicons name="flag-outline" size={16} color="#388E3C" />
                            </View>
                            <View>
                              <Text style={[styles.accountOptionName, { color: colors.foreground }]}>
                                {goal.name}
                              </Text>
                              <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                                {pct}% concluído · R$ {goal.accumulatedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </Text>
                            </View>
                          </View>
                          <View
                            style={[
                              styles.checkbox,
                              {
                                borderColor: isGoalActive ? '#388E3C' : colors.border,
                                backgroundColor: isGoalActive ? '#388E3C' : 'transparent',
                              },
                            ]}
                          >
                            {isGoalActive && (
                              <Ionicons name="checkmark" size={14} color="#FFF" />
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )}
              </ScrollView>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.foreground }]}
                onPress={saveBudget}
              >
                <Text
                  style={[styles.saveBtnText, { color: colors.background }]}
                >
                  Salvar Configurações
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* MODAL DE DETALHES DO DIA */}
      <Modal
        visible={!!selectedDay}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSelectedDay(null)}
      >
        <View style={styles.modalOverlayBottom}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View
              style={[styles.modalHeader, { borderBottomColor: colors.border }]}
            >
              <View>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  Detalhes do Dia
                </Text>
                <Text
                  style={[styles.modalDate, { color: colors.mutedForeground }]}
                >
                  {selectedDay ? formatDateShort(selectedDay.fullDate) : ""}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedDay(null)}
                style={[
                  styles.closeBtn,
                  { backgroundColor: colors.background },
                ]}
              >
                <Ionicons name="close" size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              {!selectedDay?.transactions ||
              selectedDay.transactions.length === 0 ? (
                <View style={styles.emptyModal}>
                  <Ionicons
                    name="calendar-clear-outline"
                    size={32}
                    color={colors.border}
                  />
                  <Text
                    style={[
                      styles.emptyModalText,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    Nenhuma movimentação neste dia.
                  </Text>
                </View>
              ) : (
                selectedDay.transactions.map((tx: any, idx: number) => {
                  const visuals = getTransactionVisuals(tx.type, colors);
                  const isCredito = tx.paymentMethod === "credito";

                  return (
                    <View
                      key={tx.id}
                      style={[
                        styles.modalTxItem,
                        idx !== selectedDay.transactions.length - 1 && {
                          borderBottomColor: colors.border,
                          borderBottomWidth: StyleSheet.hairlineWidth,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.modalTxIcon,
                          { backgroundColor: visuals.bgColor },
                        ]}
                      >
                        <Ionicons
                          name={visuals.icon as any}
                          size={18}
                          color={visuals.color}
                        />
                      </View>
                      <View style={styles.modalTxInfo}>
                        <Text
                          style={[
                            styles.modalTxDesc,
                            { color: colors.foreground },
                          ]}
                          numberOfLines={1}
                        >
                          {tx.description}
                        </Text>
                        {isCredito && (
                          <View
                            style={[
                              styles.modalCreditBadge,
                              { backgroundColor: colors.secondary },
                            ]}
                          >
                            <Text
                              style={[
                                styles.modalCreditText,
                                { color: colors.mutedForeground },
                              ]}
                            >
                              CRÉDITO
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text
                        style={[styles.modalTxAmount, { color: visuals.color }]}
                      >
                        {visuals.prefix}
                        {formatCurrency(tx.amount)}
                      </Text>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  monthTitle: { fontSize: 18, fontWeight: "700" },
  navBtn: { padding: 8 },
  configBtn: { padding: 8, borderRadius: 12 },

  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  alertText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "700",
  },

  budgetCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  budgetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  budgetInfo: { gap: 2 },
  budgetLabel: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  budgetValue: { fontSize: 20, fontWeight: "700" },
  budgetRight: { alignItems: "flex-end", gap: 2 },
  dailyLabel: { fontSize: 10, fontWeight: "500", textTransform: "uppercase" },
  dailyValue: { fontSize: 16, fontWeight: "700" },

  summaryStrip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summaryItem: { flex: 1, alignItems: "center", gap: 1 },
  summaryLabel: { fontSize: 10, fontWeight: "500", textTransform: "uppercase" },
  summaryValue: { fontSize: 12, fontWeight: "700" },
  summaryDivider: { width: 1, height: 20 },

  row: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 90,
  },
  colDia: {
    width: 55,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "rgba(0,0,0,0.05)",
  },
  dayNumber: { fontSize: 18, fontWeight: "700" },
  weekDay: { fontSize: 11, textTransform: "capitalize" },
  colIndicators: { flex: 1, padding: 12, gap: 6, justifyContent: "center" },
  indicatorLine: { flexDirection: "row", alignItems: "center", gap: 10 },
  indicatorText: { fontSize: 13 },
  miniBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  miniBadgeText: { color: "#FFF", fontSize: 9, fontWeight: "bold" },
  savingBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  savingText: { fontSize: 11, fontWeight: "700" },
  colSaldoVisual: {
    width: 120,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingRight: 12,
  },
  saldoTextLarge: { fontSize: 15, fontWeight: "700" },

  // 👉 ESTILOS DO NOVO GRID (HEATMAP)
  gridWrapper: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  gridHeader: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 12,
    marginBottom: 8,
  },
  gridCol: { flex: 1, alignItems: "center", justifyContent: "center" },
  gridDayCol: { width: 30, alignItems: "center", justifyContent: "center" },
  gridColTitle: { fontSize: 14, fontWeight: "700" },
  gridRow: {
    flexDirection: "row",
    height: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  gridDayText: { fontSize: 13, fontWeight: "600" },
  gridCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 2,
    marginVertical: 4,
    borderRadius: 6,
  },
  gridCellText: { fontSize: 13, fontWeight: "700" },

  modalOverlayBottom: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    padding: 24,
    paddingBottom: 40,
    maxHeight: "80%",
    minHeight: "40%",
  },
  configModalContent: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    maxHeight: "100%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 16,
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", letterSpacing: -0.5 },
  modalDate: { fontSize: 13, fontWeight: "500", marginTop: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  modalScroll: { flexGrow: 1, marginTop: 8 },
  emptyModal: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
    gap: 12,
  },
  emptyModalText: { fontSize: 14, fontWeight: "500" },
  modalTxItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  modalTxIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTxInfo: { flex: 1, gap: 4, alignItems: "flex-start" },
  modalTxDesc: { fontSize: 15, fontWeight: "600" },
  modalTxAmount: { fontSize: 15, fontWeight: "700" },
  modalCreditBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modalCreditText: { fontSize: 9, fontWeight: "800" },

  accountOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  accountOptionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  accountOptionName: { fontSize: 14, fontWeight: "600" },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtn: {
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 16,
  },
  saveBtnText: { fontSize: 15, fontWeight: "700" },
  configLabel: { fontSize: 14, fontWeight: "700" },
  budgetInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
  },
  budgetInput: { flex: 1, fontSize: 18, fontWeight: "600" },
});
