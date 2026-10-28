import React, { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View, Switch, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useStoreContext } from '@/context/StoreContext';
import { usePurchaseImportContext } from '@/context/PurchaseImportContext';
import { captureNative } from '@/services/purchaseCapture';
import { PurchaseBank, PurchaseCandidate, PurchaseKind, PurchaseMode } from '@/lib/purchaseImport';
import { parseMoney } from '@/lib/cardInvoices';
import { formatCurrency } from '@/lib/utils';

export default function NotificationImportScreen() {
  const router = useRouter(), { colors } = useTheme(), insets = useSafeAreaInsets();
  const { accounts } = useStoreContext(), importer = usePurchaseImportContext();
  const [apps, setApps] = useState<{ name: string; packageName: string }[]>([]), [search, setSearch] = useState('');
  const [editing, setEditing] = useState<PurchaseBank | null>(null), [candidate, setCandidate] = useState<PurchaseCandidate | null>(null);
  const [kind, setKind] = useState<PurchaseKind>('credito'), [accountId, setAccountId] = useState(''), [amount, setAmount] = useState(''), [description, setDescription] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => { if (busy) return; setBusy(true); setError(''); try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Tente novamente.'); } finally { setBusy(false); } };
  const button = (label: string, fn: () => void, selected = false) => <TouchableOpacity key={label} disabled={busy} accessibilityRole="button" accessibilityState={{ selected, disabled: busy }} onPress={fn} style={[styles.button, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + '20' : colors.card }]}><Text style={{ color: colors.foreground }}>{label}</Text></TouchableOpacity>;
  const compatible = (type: PurchaseKind) => accounts.filter(a => type === 'credito' ? a.type === 'cartao_credito' : a.type !== 'cartao_credito');
  const startReview = (item: PurchaseCandidate) => {
    setEditing(null); setCandidate(item); setKind(item.kind || 'credito'); setAmount(item.amount ? item.amount.toFixed(2).replace('.', ',') : ''); setDescription(item.description);
    const bank = importer.state.banks.find(b => b.packageName === item.packageName);
    setAccountId(item.kind ? bank?.[item.kind].accountId || '' : ''); setError('');
  };
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32, gap: 12 }}>
    {button('Voltar', () => router.back())}
    <Text style={[styles.title, { color: colors.foreground }]}>Compras por notificação</Text>
    <Text style={{ color: colors.mutedForeground }}>O Horizonte lê somente notificações dos aplicativos que você ativar abaixo. Os dados ficam neste aparelho. Com o app fechado, as capturas são guardadas e processadas ao reabrir. A identificação depende do texto enviado pelo banco.</Text>
    {!importer.supported ? <Text style={{ color: colors.foreground }}>Disponível no novo APK Android. O Expo Go e a versão web não possuem acesso às notificações de outros aplicativos.</Text> : <>
      <Text style={{ color: colors.foreground }}>Acesso às notificações: {importer.access ? 'permitido' : 'não autorizado'}</Text>
      {button('Autorizar acesso no Android', () => void run(async () => { await captureNative()!.openSettings(); }))}
      {button('Atualizar capturas e permissões', () => void run(importer.scan))}
      {!!importer.dropped && <Text style={{ color: colors.destructive }}>{importer.dropped} capturas antigas excederam o limite da fila. Confira seu histórico no banco.</Text>}
      {button('Escolher aplicativo', () => void run(async () => setApps((await captureNative()!.getApps()).sort((a, b) => a.name.localeCompare(b.name)))))}
      {!!apps.length && <View style={styles.card}>
        <TextInput accessibilityLabel="Buscar aplicativo" value={search} onChangeText={setSearch} placeholder="Nome do banco" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} />
        <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }}>{apps.filter(a => a.name.toLowerCase().includes(search.toLowerCase())).map(app => button(app.name + ' (' + app.packageName + ')', () => { setEditing(importer.state.banks.find(b => b.packageName === app.packageName) || { ...app, enabled: false, credito: { mode: 'review', accountId: '' }, debito: { mode: 'review', accountId: '' } }); setApps([]); }))}</ScrollView>
      </View>}
      {importer.state.banks.map(bank => button(`${bank.name} — ${bank.enabled ? 'ativo' : 'desativado'}`, () => { setEditing(bank); setCandidate(null); }))}
      {editing && <View style={[styles.card, { borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>{editing.name}</Text>
        <View style={styles.row}><Text style={{ color: colors.foreground, flex: 1 }}>Capturar compras deste aplicativo</Text><Switch accessibilityLabel="Ativar captura deste aplicativo" value={editing.enabled} onValueChange={enabled => setEditing({ ...editing, enabled })} /></View>
        {(['credito', 'debito'] as const).map(type => <View key={type} style={{ gap: 8 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>{type === 'credito' ? 'Crédito' : 'Débito'}</Text>
          <View style={styles.row}>{(['off', 'review', 'auto'] as PurchaseMode[]).map(mode => button(`${type}: ${{ off: 'Desativado', review: 'Revisar antes', auto: 'Automático' }[mode]}`, () => setEditing({ ...editing, [type]: { ...editing[type], mode } }), editing[type].mode === mode))}</View>
          <Text style={{ color: colors.mutedForeground }}>Destino padrão</Text>
          {compatible(type).map(a => button(a.name, () => setEditing({ ...editing, [type]: { ...editing[type], accountId: a.id } }), editing[type].accountId === a.id))}
          {!compatible(type).length && <Text style={{ color: colors.mutedForeground }}>Cadastre {type === 'credito' ? 'um cartão' : 'uma conta'} para usar esta modalidade.</Text>}
        </View>)}
        {button('Salvar regras', () => void run(async () => { await importer.saveBanks([...importer.state.banks.filter(b => b.packageName !== editing.packageName), editing]); setEditing(null); }))}
        {button('Cancelar edição', () => setEditing(null))}
      </View>}
      <Text style={[styles.title, { color: colors.foreground }]}>Compras para revisar ({importer.state.pending.length})</Text>
      {importer.state.pending.map(item => button(`${new Date(item.timestamp).toLocaleDateString('pt-BR')} — ${item.title} — ${item.amount ? formatCurrency(item.amount) : 'Conferir valor'}`, () => startReview(item)))}
      {candidate && <View style={[styles.card, { borderColor: colors.border }]}>
        <Text style={{ color: colors.foreground }}>{candidate.title}: {candidate.text}</Text>
        <Text style={{ color: colors.mutedForeground }}>Confira valor e modalidade. Se for parcelada, use o formulário completo para registrar as parcelas e descarte esta sugestão.</Text>
        <TextInput accessibilityLabel="Valor da compra importada" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} />
        <TextInput accessibilityLabel="Descrição da compra importada" value={description} onChangeText={setDescription} style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} />
        <View style={styles.row}>{(['credito', 'debito'] as const).map(type => button(type === 'credito' ? 'Crédito' : 'Débito', () => { setKind(type); setAccountId(''); }, kind === type))}</View>
        {compatible(kind).map(a => button(a.name, () => setAccountId(a.id), accountId === a.id))}
        {button('Confirmar lançamento', () => void run(async () => { await importer.review(candidate, kind, accountId, parseMoney(amount), description); setCandidate(null); }))}
        {button('Descartar sugestão', () => void run(async () => { await importer.dismiss(candidate.id); setCandidate(null); }))}
        {button('Fechar revisão', () => setCandidate(null))}
      </View>}
    </>}
    {!!(error || importer.error) && <Text accessibilityRole="alert" style={{ color: colors.destructive }}>{error || importer.error}</Text>}
  </ScrollView></KeyboardAvoidingView>;
}
const styles = StyleSheet.create({ title: { fontSize: 18, fontWeight: '700' }, button: { minHeight: 48, padding: 12, borderRadius: 12, borderWidth: 1, marginVertical: 3 }, input: { borderWidth: 1, padding: 12, borderRadius: 10, fontSize: 16, minHeight: 48 }, row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }, card: { borderWidth: 1, padding: 12, borderRadius: 14, gap: 10 } });
