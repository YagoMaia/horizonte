import React, { useRef, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View, Switch, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useStoreContext } from '@/context/StoreContext';
import { usePurchaseImportContext } from '@/context/PurchaseImportContext';
import { captureNative } from '@/services/purchaseCapture';
import { PurchaseBank, PurchaseCandidate, PurchaseKind, PurchaseMode, destinationFor } from '@/lib/purchaseImport';
import { parseMoney } from '@/lib/cardInvoices';
import { formatCurrency } from '@/lib/utils';

export default function NotificationImportScreen() {
  const router = useRouter(), { colors } = useTheme(), insets = useSafeAreaInsets();
  const { accounts } = useStoreContext(), importer = usePurchaseImportContext();
  const [apps, setApps] = useState<{ name: string; packageName: string }[]>([]), [search, setSearch] = useState('');
  const [editing, setEditing] = useState<PurchaseBank | null>(null), [candidate, setCandidate] = useState<PurchaseCandidate | null>(null);
  const [kind, setKind] = useState<PurchaseKind>('credito'), [accountId, setAccountId] = useState(''), [amount, setAmount] = useState(''), [description, setDescription] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [pendingPage, setPendingPage] = useState(0), [appPage, setAppPage] = useState(0);
  const [installments, setInstallments] = useState('1'), [amountBasis, setAmountBasis] = useState<'total' | 'installment' | undefined>(), [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const run = async (fn: () => Promise<unknown>) => { if (busyRef.current) return; busyRef.current = true; setBusy(true); setError(''); try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Tente novamente.'); } finally { busyRef.current = false; setBusy(false); } };
  const button = (label: string, fn: () => void, selected = false) => <TouchableOpacity key={label} disabled={busy} accessibilityRole="button" accessibilityState={{ selected, disabled: busy }} onPress={fn} style={[styles.button, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + '20' : colors.card }]}><Text style={{ color: colors.foreground }}>{label}</Text></TouchableOpacity>;
  const compatible = (type: PurchaseKind) => accounts.filter(a => type === 'credito' ? a.type === 'cartao_credito' : a.type !== 'cartao_credito');
  const startReview = (item: PurchaseCandidate) => {
    setEditing(null); setCandidate(item); setKind(item.kind || 'credito'); setAmount(item.amount ? item.amount.toFixed(2).replace('.', ',') : ''); setDescription(item.description);
    const bank = importer.state.banks.find(b => b.packageName === item.packageName);
    setAccountId(destinationFor(item, item.kind ? bank?.[item.kind] : undefined, accounts)?.id || ''); setError('');
    setInstallments(String(item.installments && item.installments > 1 ? item.installments : 1)); setAmountBasis(undefined); setConfirmDuplicate(false);
  };
  const pageSize = 20;
  const filteredApps = apps.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));
  const page = Math.min(pendingPage, Math.max(0, Math.ceil(importer.state.pending.length / pageSize) - 1));
  const liveCandidate = candidate && importer.state.pending.find(p => p.id === candidate.id);
  const count = /^\d+$/.test(installments) ? Number(installments) : NaN;
  let total = NaN;
  try { total = parseMoney(amount) * (count > 1 && amountBasis === 'installment' ? count : 1); } catch { /* Incomplete input is validated on confirmation. */ }
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32, gap: 12 }}>
    {button('Voltar', () => router.back())}
    <Text style={[styles.title, { color: colors.foreground }]}>Compras por notificação</Text>
    <Text style={{ color: colors.mutedForeground }}>O Horizonte lê somente notificações dos aplicativos que você ativar abaixo. Os dados ficam neste aparelho. Com o app fechado, as capturas são guardadas e processadas ao reabrir. A identificação depende do texto enviado pelo banco.</Text>
    {!importer.supported ? <Text style={{ color: colors.foreground }}>Disponível no novo APK Android. O Expo Go e a versão web não possuem acesso às notificações de outros aplicativos.</Text> : <>
      <Text style={{ color: colors.foreground }}>Acesso às notificações: {importer.access ? 'permitido' : 'não autorizado'}</Text>
      {button('Autorizar acesso no Android', () => void run(async () => { await captureNative()!.openSettings(); }))}
      {button('Atualizar capturas e permissões', () => void run(importer.scan))}
      {!!importer.dropped && <Text style={{ color: colors.destructive }}>{importer.dropped} capturas antigas excederam o limite da fila. Confira seu histórico no banco.</Text>}
      {button('Escolher aplicativo', () => void run(async () => { setApps((await captureNative()!.getApps()).sort((a, b) => a.name.localeCompare(b.name))); setAppPage(0); }))}
      {!!apps.length && <View style={styles.card}>
        <TextInput accessibilityLabel="Buscar aplicativo" value={search} onChangeText={value => { setSearch(value); setAppPage(0); }} placeholder="Nome do banco" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} />
        <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }}>{filteredApps.slice(appPage * pageSize, (appPage + 1) * pageSize).map(app => button(app.name + ' (' + app.packageName + ')', () => { setEditing(importer.state.banks.find(b => b.packageName === app.packageName) || { ...app, enabled: false, credito: { mode: 'review', accountId: '' }, debito: { mode: 'review', accountId: '' } }); setCandidate(null); setApps([]); }))}</ScrollView>
        {appPage > 0 && button('Aplicativos anteriores', () => setAppPage(appPage - 1))}
        {(appPage + 1) * pageSize < filteredApps.length && button('Mais aplicativos', () => setAppPage(appPage + 1))}
      </View>}
      {importer.state.banks.map(bank => button(`${bank.name} — ${bank.enabled ? 'ativo' : 'desativado'}`, () => { setEditing(bank); setCandidate(null); }))}
      {editing && <View style={[styles.card, { borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>{editing.name}</Text>
        <View style={styles.row}><Text style={{ color: colors.foreground, flex: 1 }}>Capturar compras deste aplicativo</Text><Switch disabled={busy} accessibilityLabel="Ativar captura deste aplicativo" value={editing.enabled} onValueChange={enabled => setEditing({ ...editing, enabled })} /></View>
        {(['credito', 'debito'] as const).map(type => <View key={type} style={{ gap: 8 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>{type === 'credito' ? 'Crédito' : 'Débito'}</Text>
          <View style={styles.row}>{(['off', 'review', 'auto'] as PurchaseMode[]).map(mode => button(`${type}: ${{ off: 'Desativado', review: 'Revisar antes', auto: 'Automático' }[mode]}`, () => setEditing({ ...editing, [type]: { ...editing[type], mode } }), editing[type].mode === mode))}</View>
          <Text style={{ color: colors.mutedForeground }}>Destino padrão</Text>
          {compatible(type).map(a => button(a.name, () => setEditing({ ...editing, [type]: { ...editing[type], accountId: a.id } }), editing[type].accountId === a.id))}
          <Text style={{ color: colors.mutedForeground }}>Associe os quatro últimos dígitos informados nas notificações. Para cartões virtuais, informe os finais separados por vírgula.</Text>
          {compatible(type).map(a => <View key={a.id}>
            <Text style={{ color: colors.foreground }}>{a.name} — finais no {type === 'credito' ? 'crédito' : 'débito'}</Text>
            <TextInput accessibilityLabel={`Finais ${type} ${a.name}`} editable={!busy} value={(editing[type].destinations || []).filter(d => d.accountId === a.id).map(d => d.lastFour).join(',')} onChangeText={value => setEditing({ ...editing, [type]: { ...editing[type], destinations: [...(editing[type].destinations || []).filter(d => d.accountId !== a.id), ...(value ? value.split(',').map(lastFour => ({ accountId: a.id, lastFour: lastFour.trim() })) : [])] } })} placeholder="1234,5678" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} />
          </View>)}
          <View style={styles.row}><Text style={{ color: colors.foreground, flex: 1 }}>Usar destino padrão se a mensagem não informar o final</Text><Switch disabled={busy} accessibilityLabel={`Permitir destino sem final ${type}`} value={!!editing[type].allowWithoutIdentifier} onValueChange={allowWithoutIdentifier => setEditing({ ...editing, [type]: { ...editing[type], allowWithoutIdentifier } })} /></View>
          <Text style={{ color: colors.mutedForeground }}>Final diferente dos cadastrados sempre exige revisão. Sem final, a importação automática só usa o destino padrão se você permitir acima.</Text>
          {!compatible(type).length && <Text style={{ color: colors.mutedForeground }}>Cadastre {type === 'credito' ? 'um cartão' : 'uma conta'} para usar esta modalidade.</Text>}
        </View>)}
        {button('Salvar regras', () => void run(async () => { await importer.saveBanks([...importer.state.banks.filter(b => b.packageName !== editing.packageName), editing]); setEditing(null); }))}
        {button('Cancelar edição', () => setEditing(null))}
      </View>}
      <Text style={[styles.title, { color: colors.foreground }]}>Compras para revisar ({importer.state.pending.length})</Text>
      {importer.state.pending.slice(page * pageSize, (page + 1) * pageSize).map(item => <View key={item.id}>{button(`${new Date(item.timestamp).toLocaleDateString('pt-BR')} — ${item.title} — ${item.amount ? formatCurrency(item.amount) : 'Conferir valor'}`, () => startReview(item))}</View>)}
      {!!importer.state.pending.length && <Text style={{ color: colors.mutedForeground }}>Página {page + 1} de {Math.ceil(importer.state.pending.length / pageSize)}</Text>}
      {page > 0 && button('Pendências anteriores', () => setPendingPage(page - 1))}
      {(page + 1) * pageSize < importer.state.pending.length && button('Próximas pendências', () => setPendingPage(page + 1))}
      {candidate && liveCandidate && <View style={[styles.card, { borderColor: colors.border }]}>
        <Text style={{ color: colors.foreground }}>{candidate.title}: {candidate.text}</Text>
        <Text style={{ color: colors.mutedForeground }}>{liveCandidate.reason || 'Confira valor, modalidade, destino e parcelas.'}</Text>
        <TextInput accessibilityLabel="Valor da compra importada" value={amount} onChangeText={value => { setAmount(value); setConfirmDuplicate(false); }} keyboardType="decimal-pad" style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} />
        <TextInput accessibilityLabel="Descrição da compra importada" value={description} onChangeText={setDescription} style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} />
        <View style={styles.row}>{(['credito', 'debito'] as const).map(type => button(type === 'credito' ? 'Crédito' : 'Débito', () => { setKind(type); setAccountId(''); setConfirmDuplicate(false); if (type === 'debito') setInstallments('1'); }, kind === type))}</View>
        {compatible(kind).map(a => button(a.name, () => { setAccountId(a.id); setConfirmDuplicate(false); }, accountId === a.id))}
        {kind === 'credito' && <>
          <Text style={{ color: colors.foreground }}>Quantidade de parcelas (1 para compra à vista)</Text>
          <TextInput accessibilityLabel="Quantidade de parcelas importadas" value={installments} onChangeText={value => { setInstallments(value); setConfirmDuplicate(false); }} keyboardType="number-pad" style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} />
          {count > 1 && <><Text style={{ color: colors.foreground }}>O valor digitado corresponde a:</Text>{button('Valor total da compra', () => setAmountBasis('total'), amountBasis === 'total')}{button('Valor de cada parcela', () => setAmountBasis('installment'), amountBasis === 'installment')}</>}
        </>}
        {Number.isFinite(total) && total > 0 && (count === 1 || amountBasis) && <Text style={{ color: colors.foreground }}>Total a registrar: {formatCurrency(total)}{count > 1 ? ` em ${count} parcelas` : ''}</Text>}
        {liveCandidate.possibleDuplicate && <View style={styles.row}><Text style={{ color: colors.destructive, flex: 1 }}>Possível duplicata. Confirme somente se esta for outra compra.</Text><Switch accessibilityLabel="Confirmar que é outra compra" disabled={busy} value={confirmDuplicate} onValueChange={setConfirmDuplicate} /></View>}
        {button('Confirmar lançamento', () => void run(async () => { await importer.review(candidate, kind, accountId, parseMoney(amount), description, { installments: count, amountBasis, confirmDuplicate }); setCandidate(null); }))}
        {button('Descartar sugestão', () => void run(async () => { await importer.dismiss(candidate.id); setCandidate(null); }))}
        {button('Fechar revisão', () => setCandidate(null))}
      </View>}
    </>}
    {!!(error || importer.error) && <Text accessibilityRole="alert" style={{ color: colors.destructive }}>{error || importer.error}</Text>}
  </ScrollView></KeyboardAvoidingView>;
}
const styles = StyleSheet.create({ title: { fontSize: 18, fontWeight: '700' }, button: { minHeight: 48, padding: 12, borderRadius: 12, borderWidth: 1, marginVertical: 3 }, input: { borderWidth: 1, padding: 12, borderRadius: 10, fontSize: 16, minHeight: 48 }, row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }, card: { borderWidth: 1, padding: 12, borderRadius: 14, gap: 10 } });
