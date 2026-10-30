import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View, Switch, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseBank | null>(null), [candidate, setCandidate] = useState<PurchaseCandidate | null>(null);
  const [kind, setKind] = useState<PurchaseKind>('credito'), [accountId, setAccountId] = useState(''), [amount, setAmount] = useState(''), [description, setDescription] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const [tab, setTab] = useState<'banks' | 'review'>('banks');
  const [editingKind, setEditingKind] = useState<PurchaseKind>('credito');
  const [showOriginal, setShowOriginal] = useState(false);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [editing?.packageName, candidate?.id, tab]);
  const [pendingPage, setPendingPage] = useState(0), [appPage, setAppPage] = useState(0);
  const [installments, setInstallments] = useState('1'), [amountBasis, setAmountBasis] = useState<'total' | 'installment' | undefined>(), [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const run = async (fn: () => Promise<unknown>) => { if (busyRef.current) return; busyRef.current = true; setBusy(true); setError(''); try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Tente novamente.'); } finally { busyRef.current = false; setBusy(false); } };
  const rgb = colors.primary.replace('#', '').match(/.{2}/g)?.map(v => { const n = parseInt(v, 16) / 255; return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4); }) || [0, 0, 0];
  const primaryInk = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 > 0.179 ? '#121212' : '#FFFFFF';
  const button = (label: string, fn: () => void, selected = false, variant: 'primary' | 'secondary' | 'danger' = 'secondary', icon?: React.ComponentProps<typeof Ionicons>['name']) => {
    const ink = variant === 'primary' ? primaryInk : variant === 'danger' ? colors.destructive : colors.foreground;
    return <TouchableOpacity key={label} disabled={busy} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected, disabled: busy }} onPress={fn} style={[styles.button, { opacity: busy ? 0.6 : 1, borderColor: selected || variant === 'primary' ? colors.primary : colors.border, backgroundColor: variant === 'primary' ? colors.primary : selected ? colors.primary + '14' : colors.card }]}>
      {busy && variant === 'primary' ? <ActivityIndicator color={ink} /> : icon ? <Ionicons name={icon} size={20} color={ink} /> : selected ? <Ionicons name="checkmark-circle" size={18} color={colors.primary} /> : null}
      <Text style={[styles.buttonLabel, { color: ink }]}>{label}</Text>
    </TouchableOpacity>;
  };
  const surface = [styles.card, { backgroundColor: colors.card, borderColor: colors.border }];
  const inputStyle = [styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }];
  const muted = { color: colors.mutedForeground };
  const modeLabel = { off: 'Desativado', review: 'Revisar antes', auto: 'Automático' };
  const modeHelp = { off: 'Compras desta modalidade não serão importadas.', review: 'Você confere os dados e confirma cada lançamento.', auto: 'Compras identificadas com segurança são lançadas. Dúvidas e possíveis duplicatas ficam para revisão.' };
  const sectionTitle = (title: string, subtitle?: string) => <View style={styles.sectionHeading}><Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>{subtitle && <Text style={[styles.body, muted]}>{subtitle}</Text>}</View>;
  const compatible = (type: PurchaseKind) => accounts.filter(a => type === 'credito' ? a.type === 'cartao_credito' : a.type !== 'cartao_credito');
  const startReview = (item: PurchaseCandidate) => {
    setShowOriginal(false); setEditing(null); setCandidate(item); setKind(item.kind || 'credito'); setAmount(item.amount ? item.amount.toFixed(2).replace('.', ',') : ''); setDescription('');
    const bank = importer.state.banks.find(b => b.packageName === item.packageName);
    setAccountId(destinationFor(item, item.kind ? bank?.[item.kind] : undefined, accounts)?.id || ''); setError('');
    setInstallments(String(item.installments && item.installments > 1 ? item.installments : 1)); setAmountBasis(undefined); setConfirmDuplicate(false);
  };
  const pageSize = 20;
  const filteredApps = apps.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));
  const page = Math.min(pendingPage, Math.max(0, Math.ceil(importer.state.pending.length / pageSize) - 1));
  const liveCandidate = candidate && importer.state.pending.find(p => p.id === candidate.id);
  useEffect(() => { if (candidate && !liveCandidate) setCandidate(null); }, [candidate, liveCandidate]);
  const count = /^\d+$/.test(installments) ? Number(installments) : NaN;
  let total = NaN;
  try { total = parseMoney(amount) * (count > 1 && amountBasis === 'installment' ? count : 1); } catch { /* Incomplete input is validated on confirmation. */ }
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }]}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={[styles.back, { backgroundColor: colors.card, borderColor: colors.border }]}><Ionicons name="arrow-back" size={22} color={colors.foreground} /></TouchableOpacity>
        <View style={{ flex: 1 }}><Text style={[styles.eyebrow, { color: colors.primary }]}>HORIZONTE</Text><Text style={[styles.pageTitle, { color: colors.foreground }]}>Importar notificações</Text></View>
        {importer.supported && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Atualizar capturas e permissões" disabled={busy} onPress={() => void run(importer.scan)} style={styles.back}>{busy ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="refresh-outline" size={22} color={colors.primary} />}</TouchableOpacity>}
      </View>
      {!!(error || importer.error) && <View style={[styles.notice, { backgroundColor: colors.dangerLight }]}><Ionicons name="alert-circle-outline" size={22} color={colors.destructive} /><Text accessibilityRole="alert" style={[styles.body, { color: colors.destructive, flex: 1 }]}>{error || importer.error}</Text></View>}
      {!importer.supported ? <View style={surface}><View style={[styles.symbol, { backgroundColor: colors.primary + '14' }]}><Ionicons name="notifications-outline" size={28} color={colors.primary} /></View>{sectionTitle('Suas compras, com menos digitação', 'Configure seus bancos e confira as compras antes de lançar.')}<Text style={[styles.body, muted]}>Disponível no novo APK Android. O Expo Go e a versão web não possuem acesso às notificações de outros aplicativos.</Text></View> : <>
        {!editing && !candidate && <>
          <View style={[...surface, { borderTopColor: importer.access ? colors.success : colors.primary, borderTopWidth: 3 }]}>
            <View style={styles.row}><View style={[styles.symbol, { backgroundColor: importer.access ? colors.successLight : colors.primary + '14' }]}><Ionicons name={importer.access ? 'shield-checkmark-outline' : 'notifications-outline'} size={24} color={importer.access ? colors.success : colors.primary} /></View><View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.foreground }]}>{importer.access ? 'Acesso permitido' : 'Permita o acesso às notificações'}</Text><Text style={[styles.body, muted]}>{importer.access ? 'Configure um banco abaixo para capturar suas compras.' : 'Primeiro, autorize o Horizonte nas configurações do Android.'}</Text></View></View>
            {!importer.access && button('Autorizar acesso no Android', () => void run(async () => { await captureNative()!.openSettings(); }), false, 'primary', 'lock-open-outline')}
            {importer.access && button('Gerenciar acesso no Android', () => void run(async () => { await captureNative()!.openSettings(); }), false, 'secondary', 'settings-outline')}
            <Text style={[styles.hint, muted]}>Somente aplicativos escolhidos por você. Os dados ficam no aparelho.</Text>
          </View>
          <View style={[styles.tabs, { backgroundColor: colors.muted }]}>{(['banks', 'review'] as const).map(value => <TouchableOpacity key={value} accessibilityRole="tab" accessibilityState={{ selected: tab === value, disabled: busy }} disabled={busy} onPress={() => setTab(value)} style={[styles.tab, { backgroundColor: tab === value ? colors.card : 'transparent' }]}><Ionicons name={value === 'banks' ? 'business-outline' : 'receipt-outline'} size={18} color={tab === value ? colors.primary : colors.mutedForeground} /><Text style={[styles.tabLabel, { color: tab === value ? colors.foreground : colors.mutedForeground }]}>{value === 'banks' ? 'Bancos' : 'Para revisar (' + importer.state.pending.length + ')'}</Text></TouchableOpacity>)}</View>
        </>}
        {!!importer.dropped && <View style={[styles.notice, { backgroundColor: colors.warningLight }]}><Text style={[styles.body, { color: colors.foreground }]}>{importer.dropped} capturas antigas excederam o limite da fila. Confira seu histórico no banco.</Text></View>}
        {!editing && !candidate && tab === 'banks' && <>
          {sectionTitle('Seus bancos', 'Escolha de onde vêm as notificações e como cada compra será lançada.')}
          {importer.state.banks.map(bank => <TouchableOpacity key={bank.packageName} disabled={busy} accessibilityRole="button" accessibilityLabel={bank.name + ' — ' + (bank.enabled ? 'ativo' : 'desativado')} onPress={() => { setEditing(bank); setEditingKind('credito'); }} style={surface}>
            <View style={styles.row}><View style={[styles.symbol, { backgroundColor: colors.secondary }]}><Ionicons name="business-outline" size={24} color={colors.primary} /></View><View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.foreground }]}>{bank.name}</Text><Text style={[styles.hint, { color: bank.enabled ? colors.success : colors.mutedForeground }]}>{bank.enabled ? 'Captura ativada' : 'Captura desativada'}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} /></View>
            <View style={[styles.bankSummary, { borderColor: colors.border }]}><Text style={[styles.body, muted]}>Crédito · {modeLabel[bank.credito.mode]}</Text><Text style={[styles.body, muted]}>Débito · {modeLabel[bank.debito.mode]}</Text></View>
          </TouchableOpacity>)}
          {!importer.state.banks.length && <View style={surface}>{sectionTitle('Comece pelo seu banco', 'Adicione o aplicativo que envia os avisos de compra. Depois, escolha o cartão ou a conta de destino.')}</View>}
          {button('Adicionar banco', () => void run(async () => { setApps((await captureNative()!.getApps()).sort((a, b) => a.name.localeCompare(b.name))); setSearch(''); setAppPage(0); setPickerOpen(true); }), false, 'primary', 'add-circle-outline')}
          {pickerOpen && <View style={surface}>
            {sectionTitle('Escolha o aplicativo')}
            <TextInput accessibilityLabel="Buscar aplicativo" value={search} onChangeText={value => { setSearch(value); setAppPage(0); }} placeholder="Buscar pelo nome do banco" placeholderTextColor={colors.mutedForeground} style={inputStyle} />
            {filteredApps.slice(appPage * pageSize, (appPage + 1) * pageSize).map(app => <View key={app.packageName}>{button(app.name, () => { setEditing(importer.state.banks.find(b => b.packageName === app.packageName) || { ...app, enabled: false, credito: { mode: 'review', accountId: '' }, debito: { mode: 'review', accountId: '' } }); setEditingKind('credito'); setApps([]); setPickerOpen(false); }, false, 'secondary', 'business-outline')}</View>)}
            {!filteredApps.length && <Text style={[styles.body, muted]}>Nenhum aplicativo encontrado. Tente outro nome.</Text>}
            {appPage > 0 && button('Aplicativos anteriores', () => setAppPage(appPage - 1))}
            {(appPage + 1) * pageSize < filteredApps.length && button('Mais aplicativos', () => setAppPage(appPage + 1))}
            {button('Fechar lista de aplicativos', () => { setApps([]); setPickerOpen(false); })}
          </View>}
          <View style={[styles.notice, { backgroundColor: colors.secondary }]}><Ionicons name="information-circle-outline" size={22} color={colors.mutedForeground} /><Text style={[styles.body, { ...muted, flex: 1 }]}>Com o Horizonte fechado, as capturas ficam guardadas e são processadas ao reabrir. O reconhecimento depende da mensagem enviada pelo banco.</Text></View>
        </>}
        {editing && <>
          {button('Voltar aos bancos', () => setEditing(null), false, 'secondary', 'arrow-back')}
          {sectionTitle(editing.name, 'Defina regras diferentes para crédito e débito.')}
          <View style={surface}><View style={styles.row}><View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.foreground }]}>Capturar compras</Text><Text style={[styles.body, muted]}>Ativa a leitura das notificações deste banco.</Text></View><Switch disabled={busy} accessibilityLabel="Ativar captura deste aplicativo" value={editing.enabled} onValueChange={enabled => setEditing({ ...editing, enabled })} /></View></View>
          <View style={styles.row}>{(['credito', 'debito'] as const).map(type => <View key={type} style={{ flex: 1, minWidth: 110 }}>{button(type === 'credito' ? 'Crédito' : 'Débito', () => setEditingKind(type), editingKind === type, 'secondary', type === 'credito' ? 'card-outline' : 'wallet-outline')}</View>)}</View>
          {(['credito', 'debito'] as const).filter(type => type === editingKind).map(type => <View key={type} style={surface}>
            {sectionTitle('Como lançar as compras?', type === 'credito' ? 'Compras no cartão entram na fatura, sem marcar o pagamento.' : 'Compras no débito entram como despesas realizadas.')}
            <View style={styles.row}>{(['off', 'review', 'auto'] as PurchaseMode[]).map(mode => <TouchableOpacity key={mode} disabled={busy} accessibilityRole="radio" accessibilityLabel={(type === 'credito' ? 'Crédito' : 'Débito') + ': ' + modeLabel[mode]} accessibilityState={{ checked: editing[type].mode === mode, disabled: busy }} onPress={() => setEditing({ ...editing, [type]: { ...editing[type], mode } })} style={[styles.mode, { borderColor: editing[type].mode === mode ? colors.primary : colors.border, backgroundColor: editing[type].mode === mode ? colors.primary + '14' : colors.background }]}><Text style={[styles.buttonLabel, { color: colors.foreground }]}>{modeLabel[mode]}</Text></TouchableOpacity>)}</View>
            <Text style={[styles.body, muted]}>{modeHelp[editing[type].mode]}</Text>
            {editing[type].mode !== 'off' && <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              {sectionTitle(type === 'credito' ? 'Cartão de destino' : 'Conta de destino', 'Escolha o destino padrão para esta modalidade.')}
              {compatible(type).map(a => button(a.name, () => setEditing({ ...editing, [type]: { ...editing[type], accountId: a.id } }), editing[type].accountId === a.id))}
              {!compatible(type).length && <Text style={[styles.body, muted]}>Cadastre {type === 'credito' ? 'um cartão' : 'uma conta'} para usar esta modalidade.</Text>}
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              {sectionTitle('Identificação pelo final', 'Associe os quatro últimos dígitos para direcionar a compra corretamente. Cartões virtuais podem ter finais separados por vírgula.')}
              {compatible(type).map(a => <View key={a.id} style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Finais de {a.name}</Text>
                <TextInput accessibilityLabel={'Finais ' + type + ' ' + a.name} editable={!busy} value={(editing[type].destinations || []).filter(d => d.accountId === a.id).map(d => d.lastFour).join(',')} onChangeText={value => setEditing({ ...editing, [type]: { ...editing[type], destinations: [...(editing[type].destinations || []).filter(d => d.accountId !== a.id), ...(value ? value.split(',').map(lastFour => ({ accountId: a.id, lastFour: lastFour.trim() })) : [])] } })} placeholder="Ex.: 1234,5678" placeholderTextColor={colors.mutedForeground} style={inputStyle} />
              </View>)}
              <View style={[styles.notice, { backgroundColor: colors.secondary }]}><View style={{ flex: 1 }}><Text style={[styles.fieldLabel, { color: colors.foreground }]}>Se a mensagem não informar o final</Text><Text style={[styles.body, muted]}>Permitir o destino padrão. Sem esta opção, a compra fica para revisão.</Text></View><Switch disabled={busy} accessibilityLabel={'Permitir destino sem final ' + type} value={!!editing[type].allowWithoutIdentifier} onValueChange={allowWithoutIdentifier => setEditing({ ...editing, [type]: { ...editing[type], allowWithoutIdentifier } })} /></View>
              <Text style={[styles.hint, muted]}>Um final diferente dos cadastrados sempre exige revisão.</Text>
            </>}
          </View>)}
          {button('Salvar regras', () => void run(async () => { await importer.saveBanks([...importer.state.banks.filter(b => b.packageName !== editing.packageName), editing]); setEditing(null); }), false, 'primary', 'checkmark-outline')}
          {button('Cancelar edição', () => setEditing(null))}
        </>}
        {!editing && !candidate && tab === 'review' && <>
          {sectionTitle('Compras para revisar', 'Confira o valor, a modalidade e o destino antes de confirmar.')}
          {!importer.state.pending.length && <View style={[...surface, styles.empty]}><View style={[styles.symbol, { backgroundColor: colors.successLight }]}><Ionicons name="checkmark-done-outline" size={28} color={colors.success} /></View><Text style={[styles.cardTitle, { color: colors.foreground }]}>Tudo em dia</Text><Text style={[styles.body, muted, { textAlign: 'center' }]}>Quando uma compra precisar da sua confirmação, ela aparecerá aqui.</Text></View>}
          {importer.state.pending.slice(page * pageSize, (page + 1) * pageSize).map(item => <TouchableOpacity key={item.id} disabled={busy} accessibilityRole="button" accessibilityLabel={'Revisar compra ' + item.title} onPress={() => startReview(item)} style={surface}>
            <View style={styles.row}><View style={{ flex: 1 }}><Text style={[styles.hint, muted]}>{item.title} · {new Date(item.timestamp).toLocaleDateString('pt-BR')}</Text><Text numberOfLines={2} style={[styles.cardTitle, { color: colors.foreground }]}>{item.description}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} /></View>
            <Text style={[styles.amount, { color: colors.foreground }]}>{item.amount ? formatCurrency(item.amount) : 'Conferir valor'}</Text>
            <Text style={[styles.hint, { color: item.possibleDuplicate ? colors.warning : colors.mutedForeground }]}>{item.possibleDuplicate ? 'Possível duplicata' : item.kind === 'credito' ? 'Crédito · conferir dados' : item.kind === 'debito' ? 'Débito · conferir dados' : 'Conferir modalidade'}</Text>
          </TouchableOpacity>)}
          {importer.state.pending.length > pageSize && <Text style={[styles.hint, muted]}>Página {page + 1} de {Math.ceil(importer.state.pending.length / pageSize)}</Text>}
          {page > 0 && button('Pendências anteriores', () => setPendingPage(page - 1))}
          {(page + 1) * pageSize < importer.state.pending.length && button('Próximas pendências', () => setPendingPage(page + 1))}
        </>}
        {candidate && liveCandidate && <>
          {button('Voltar às compras', () => setCandidate(null), false, 'secondary', 'arrow-back')}
          {sectionTitle('Conferir compra', candidate.title + ' · ' + new Date(candidate.timestamp).toLocaleDateString('pt-BR'))}
          <View style={surface}>
            <Text style={[styles.body, muted]}>{liveCandidate.reason || 'Confira os dados abaixo para registrar esta compra.'}</Text>
            <View style={styles.field}><Text style={[styles.fieldLabel, { color: colors.foreground }]}>Valor da compra</Text><TextInput accessibilityLabel="Valor da compra importada" value={amount} onChangeText={value => { setAmount(value); setConfirmDuplicate(false); }} keyboardType="decimal-pad" style={[inputStyle, styles.amountInput]} /></View>
            <View style={styles.field}><Text style={[styles.fieldLabel, { color: colors.foreground }]}>Descrição</Text><TextInput accessibilityLabel="Descrição da compra importada" value={description} onChangeText={setDescription} style={inputStyle} /></View>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Como foi a compra?</Text>
            <View style={styles.row}>{(['credito', 'debito'] as const).map(type => button(type === 'credito' ? 'Crédito' : 'Débito', () => { setKind(type); setAccountId(''); setConfirmDuplicate(false); if (type === 'debito') setInstallments('1'); }, kind === type))}</View>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{kind === 'credito' ? 'Em qual cartão?' : 'De qual conta saiu?'}</Text>
            {compatible(kind).map(a => button(a.name, () => { setAccountId(a.id); setConfirmDuplicate(false); }, accountId === a.id))}
            {!compatible(kind).length && <Text style={[styles.body, muted]}>Cadastre {kind === 'credito' ? 'um cartão' : 'uma conta'} para confirmar.</Text>}
            {kind === 'credito' && <View style={styles.field}><Text style={[styles.fieldLabel, { color: colors.foreground }]}>Quantidade de parcelas</Text><Text style={[styles.hint, muted]}>Use 1 para compra à vista.</Text><TextInput accessibilityLabel="Quantidade de parcelas importadas" value={installments} onChangeText={value => { setInstallments(value); setConfirmDuplicate(false); }} keyboardType="number-pad" style={inputStyle} />{count > 1 && <><Text style={[styles.fieldLabel, { color: colors.foreground }]}>O valor digitado corresponde a:</Text>{button('Valor total da compra', () => { setAmountBasis('total'); setConfirmDuplicate(false); }, amountBasis === 'total')}{button('Valor de cada parcela', () => { setAmountBasis('installment'); setConfirmDuplicate(false); }, amountBasis === 'installment')}</>}</View>}
            {Number.isFinite(total) && total > 0 && (count === 1 || amountBasis) && <View style={[styles.total, { backgroundColor: colors.primary + '10' }]}><Text style={[styles.hint, muted]}>Total a registrar</Text><Text style={[styles.amount, { color: colors.foreground }]}>{formatCurrency(total)}</Text><Text style={[styles.body, muted]}>{count > 1 ? count + ' parcelas no crédito' : 'Compra à vista'}</Text></View>}
            {liveCandidate.possibleDuplicate && <View style={[styles.notice, { backgroundColor: colors.warningLight }]}><View style={{ flex: 1 }}><Text style={[styles.fieldLabel, { color: colors.foreground }]}>Possível duplicata</Text><Text style={[styles.body, { color: colors.foreground }]}>Já existe um lançamento parecido. Confirme somente se for outra compra.</Text></View><Switch accessibilityLabel="Confirmar que é outra compra" disabled={busy} value={confirmDuplicate} onValueChange={setConfirmDuplicate} /></View>}
            {button('Confirmar lançamento', () => void run(async () => { await importer.review(candidate, kind, accountId, parseMoney(amount), description, { installments: count, amountBasis, confirmDuplicate }); setCandidate(null); }), false, 'primary', 'checkmark-circle-outline')}
            {button('Descartar sugestão', () => void run(async () => { await importer.dismiss(candidate.id); setCandidate(null); }), false, 'danger', 'trash-outline')}
          </View>
          {button(showOriginal ? 'Ocultar notificação original' : 'Ver notificação original', () => setShowOriginal(!showOriginal), showOriginal, 'secondary', 'document-text-outline')}
          {showOriginal && <View style={surface}><Text selectable style={[styles.body, muted]}>{candidate.title}: {candidate.text}</Text></View>}
        </>}
      </>}
    </ScrollView>
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 16, width: '100%', maxWidth: 680, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.8, marginBottom: 4 },
  pageTitle: { fontSize: 23, fontWeight: '800', letterSpacing: -0.6 },
  title: { fontSize: 19, fontWeight: '700', letterSpacing: -0.3 },
  cardTitle: { fontSize: 17, fontWeight: '700', lineHeight: 24 },
  body: { fontSize: 14, lineHeight: 21 }, hint: { fontSize: 12, lineHeight: 18 },
  sectionHeading: { gap: 6 },
  card: { borderWidth: 1, padding: 18, borderRadius: 22, gap: 14 },
  symbol: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  button: { minHeight: 50, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 15, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonLabel: { fontSize: 14, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
  input: { borderWidth: 1, padding: 14, borderRadius: 14, fontSize: 16, minHeight: 52 },
  amountInput: { fontSize: 26, fontWeight: '700', minHeight: 68 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  notice: { padding: 14, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', padding: 5, borderRadius: 17, gap: 4 },
  tab: { flex: 1, minWidth: 110, minHeight: 48, padding: 10, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  tabLabel: { fontSize: 13, fontWeight: '700', flexShrink: 1, textAlign: 'center' },
  mode: { minWidth: 85, flexGrow: 1, flexBasis: '28%', minHeight: 48, borderRadius: 12, borderWidth: 1, padding: 10, justifyContent: 'center' },
  bankSummary: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 6 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  field: { gap: 8 }, fieldLabel: { fontSize: 14, fontWeight: '600', lineHeight: 21 },
  amount: { fontSize: 25, fontWeight: '800', letterSpacing: -0.5 },
  total: { padding: 16, borderRadius: 16, gap: 5 },
  empty: { alignItems: 'center', paddingVertical: 30 },
});
