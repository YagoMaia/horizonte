import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { formatCurrency } from '@/lib/utils';
import { financialDate } from '@/lib/financialDate';
import { buildTotalsData, TotalsChartFilter, TotalsPeriod } from '@/lib/totals';
import { useToday } from '@/hooks/useToday';
import { useStoreContext } from '@/context/StoreContext';
import { CategoryDonutChart } from '../CategoryDonutChart';
import { CategoryTransactionsModal } from '../CategoryTransactionsModal';
import { PeriodBarChart } from '../PeriodBarChart';

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const money = formatCurrency;

export function TotaisScreen() {
  const { colors } = useTheme();
  const { transactions, showPending, setShowPending, totaisLayout } = useStoreContext();
  const todayKey = useToday();
  const today = useMemo(() => financialDate(todayKey), [todayKey]);
  const [period, setPeriod] = useState<TotalsPeriod>('mes');
  const [selectedChart, setSelectedChart] = useState<TotalsChartFilter>('total');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => financialDate(todayKey).getFullYear());
  const [refDate, setRefDate] = useState(() => financialDate(todayKey));

  const movePeriod = (offset: number) => setRefDate(value => {
    const next = new Date(value.getFullYear(), value.getMonth(), 1, 12);
    if (period === 'semana') next.setDate(value.getDate() + offset * 7);
    else if (period === 'mes') next.setMonth(next.getMonth() + offset);
    else next.setFullYear(next.getFullYear() + offset);
    return next;
  });
  const setCurrentPeriod = () => setRefDate(financialDate(todayKey));
  const openPicker = () => { setPickerYear(refDate.getFullYear()); setPickerOpen(true); };
  const label = useMemo(() => {
    if (period === 'ano') return String(refDate.getFullYear());
    if (period === 'mes') return `${MONTH_NAMES[refDate.getMonth()]} ${refDate.getFullYear()}`;
    const start = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 12);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start); end.setDate(end.getDate() + 6);
    return `${start.getDate()} ${MONTH_NAMES[start.getMonth()].slice(0, 3)} - ${end.getDate()} ${MONTH_NAMES[end.getMonth()].slice(0, 3)}`;
  }, [period, refDate]);
  const totals = useMemo(() => buildTotalsData({ transactions, period, refDate, today, includePending: showPending }), [transactions, period, refDate, today, showPending]);
  const chartTransactions = selectedChart === 'debito' ? totals.debit : selectedChart === 'credito' ? totals.credit : totals.transactions;
  const status = showPending ? 'Inclui lançamentos previstos' : 'Somente lançamentos realizados até hoje';

  return <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.topRow}>
      <View style={[styles.segmented, { backgroundColor: colors.secondary }]}>
        {(['semana', 'mes', 'ano'] as TotalsPeriod[]).map(value => <TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{ selected: period === value }} accessibilityLabel={`Exibir ${value}`} style={[styles.segBtn, period === value && { backgroundColor: colors.card }]} onPress={() => { setPeriod(value); setCurrentPeriod(); }}><Text style={[styles.segText, { color: period === value ? colors.foreground : colors.mutedForeground }]}>{value[0].toUpperCase() + value.slice(1)}</Text></TouchableOpacity>)}
      </View>
    </View>
    <View style={[styles.periodNav, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Período anterior" onPress={() => movePeriod(-1)} style={styles.navBtn}><Ionicons name="chevron-back" size={22} color={colors.foreground} /></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Escolher período" onPress={period === 'semana' ? setCurrentPeriod : openPicker} style={styles.periodTitleButton}><Text numberOfLines={1} style={[styles.periodTitle, { color: colors.foreground }]}>{label}</Text><Text style={[styles.currentHint, { color: colors.mutedForeground }]}>{period === 'semana' ? 'Toque para voltar ao atual' : 'Toque para escolher'}</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Próximo período" onPress={() => movePeriod(1)} style={styles.navBtn}><Ionicons name="chevron-forward" size={22} color={colors.foreground} /></TouchableOpacity>
    </View>
    <TouchableOpacity accessibilityRole="switch" accessibilityState={{ checked: showPending }} accessibilityLabel="Incluir lançamentos previstos" onPress={() => setShowPending(!showPending)} style={[styles.pendingControl, { backgroundColor: colors.secondary, borderColor: colors.border }]}><Ionicons name={showPending ? 'calendar-outline' : 'checkmark-circle-outline'} size={18} color={colors.primary} /><Text style={[styles.pendingText, { color: colors.foreground }]}>{status}</Text></TouchableOpacity>
    {totaisLayout.filter(section => section.visible).map(section => {
      if (section.id === 'stats') return <View key="stats"><Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Cálculos do período</Text><View style={[styles.stats, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Stat label="Performance" value={money(totals.performance)} status={totals.performance >= 0 ? 'Sobrou dinheiro' : 'Faltou dinheiro'} color={totals.performance >= 0 ? colors.success : colors.destructive} />
        <Stat label="Economizado" value={`${totals.savingsPercent.toFixed(0)}%`} status={totals.savingsPercent > 0 ? 'Guardado' : 'Nada guardado'} color={colors.foreground} />
        <Stat label="Custo de vida" value={money(totals.expense)} status={totals.expense > totals.income ? 'Acima da renda' : 'Dentro da renda'} color={colors.foreground} />
        <Stat label="Diário médio" value={money(totals.dailyAverage)} status="Média de gastos" color={colors.foreground} last />
      </View></View>;
      if (section.id === 'category') return <CategoryDonutChart key="category" transactions={chartTransactions} title="Gastos por categoria" headerComponent={<View style={[styles.chartSelector, { backgroundColor: colors.secondary }]}>{(['debito', 'credito', 'total'] as TotalsChartFilter[]).map(value => <TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{ selected: selectedChart === value }} accessibilityLabel={`Exibir gastos no ${value}`} style={[styles.chartSelectorBtn, selectedChart === value && { backgroundColor: colors.card }]} onPress={() => setSelectedChart(value)}><Text style={[styles.chartSelectorText, { color: selectedChart === value ? colors.foreground : colors.mutedForeground }]}>{value === 'debito' ? 'Débito' : value === 'credito' ? 'Crédito' : 'Total'}</Text></TouchableOpacity>)}</View>} onCategoryPress={setSelectedCategory} />;
      if (section.id === 'period') return <PeriodBarChart key="period" transactions={chartTransactions} period={period} refDate={refDate} title="Evolução dos gastos" />;
      return null;
    })}
    {selectedCategory && <CategoryTransactionsModal category={selectedCategory} transactions={chartTransactions} onClose={() => setSelectedCategory(null)} />}
    <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}><View style={styles.pickerOverlay}><View style={[styles.picker, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={styles.pickerHeader}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Ano anterior" style={styles.navBtn} onPress={() => setPickerYear(year => year - 1)}><Ionicons name="chevron-back" size={22} color={colors.foreground} /></TouchableOpacity><Text style={[styles.pickerTitle, { color: colors.foreground }]}>{period === 'mes' ? `Escolher mês de ${pickerYear}` : 'Escolher ano'}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Ano seguinte" style={styles.navBtn} onPress={() => setPickerYear(year => year + 1)}><Ionicons name="chevron-forward" size={22} color={colors.foreground} /></TouchableOpacity></View><View style={styles.pickerGrid}>{period === 'mes' ? MONTH_NAMES.map((month, index) => <TouchableOpacity key={month} accessibilityRole="button" accessibilityState={{ selected: refDate.getFullYear() === pickerYear && refDate.getMonth() === index }} style={[styles.pickerCell, refDate.getFullYear() === pickerYear && refDate.getMonth() === index && { backgroundColor: colors.primary }]} onPress={() => { setRefDate(new Date(pickerYear, index, 1, 12)); setPickerOpen(false); }}><Text style={{ color: refDate.getFullYear() === pickerYear && refDate.getMonth() === index ? '#FFF' : colors.foreground, fontWeight: '700' }}>{month.slice(0, 3)}</Text></TouchableOpacity>) : Array.from({ length: 12 }, (_, index) => pickerYear - 5 + index).map(year => <TouchableOpacity key={year} accessibilityRole="button" accessibilityState={{ selected: refDate.getFullYear() === year }} style={[styles.pickerCell, refDate.getFullYear() === year && { backgroundColor: colors.primary }]} onPress={() => { setRefDate(new Date(year, 0, 1, 12)); setPickerOpen(false); }}><Text style={{ color: refDate.getFullYear() === year ? '#FFF' : colors.foreground, fontWeight: '700' }}>{year}</Text></TouchableOpacity>)}</View><TouchableOpacity accessibilityRole="button" style={styles.closePicker} onPress={() => setPickerOpen(false)}><Text style={{ color: colors.primary, fontWeight: '800' }}>Fechar</Text></TouchableOpacity></View></View></Modal>
  </ScrollView>;
}

function Stat({ label, value, status, color, last = false }: { label: string; value: string; status: string; color: string; last?: boolean }) {
  const { colors } = useTheme();
  return <View style={[styles.statRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}><View><Text style={[styles.statLabel, { color: colors.foreground }]}>{label}</Text><Text style={[styles.statStatus, { color: colors.mutedForeground }]}>{status}</Text></View><Text style={[styles.statValue, { color }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 12 }, topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, segmented: { flexDirection: 'row', flex: 1, borderRadius: 12, padding: 3 }, segBtn: { minHeight: 44, flex: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, segText: { fontSize: 13, fontWeight: '700' }, iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth }, periodNav: { minHeight: 64, flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 4 }, navBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 }, periodTitleButton: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48, paddingHorizontal: 6 }, periodTitle: { fontSize: 16, fontWeight: '800' }, currentHint: { fontSize: 11, marginTop: 2 }, pendingControl: { minHeight: 44, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingHorizontal: 12 }, pendingText: { fontSize: 12, fontWeight: '600' }, sectionTitle: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginLeft: 4, marginBottom: 8 }, stats: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' }, statRow: { minHeight: 74, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 }, statLabel: { fontSize: 15, fontWeight: '700' }, statStatus: { fontSize: 12, marginTop: 3 }, statValue: { fontSize: 16, fontWeight: '800', textAlign: 'right' }, chartSelector: { flexDirection: 'row', borderRadius: 10, padding: 3, marginBottom: 12 }, chartSelectorBtn: { flex: 1, minHeight: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, chartSelectorText: { fontSize: 12, fontWeight: '700' }, pickerOverlay: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.5)' }, picker: { width: '100%', maxWidth: 440, alignSelf: 'center', borderRadius: 20, borderWidth: 1, padding: 16 }, pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, pickerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800' }, pickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, pickerCell: { width: '31%', minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, closePicker: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
});
