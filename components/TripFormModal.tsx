import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { CreateTripInput, Trip } from '@/constants/types';

interface TripFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: CreateTripInput) => Promise<void>;
  tripToEdit?: Trip;
}

const COLOR_OPTIONS = ['#42A5F5', '#66BB6A', '#FFA726', '#EF5350', '#AB47BC', '#26C6DA', '#8D6E63', '#78909C'];
const ICON_OPTIONS = ['airplane-outline', 'bus-outline', 'car-outline', 'train-outline', 'boat-outline', 'business-outline', 'map-outline', 'sunny-outline', 'earth-outline'];

export const TripFormModal = React.memo(function TripFormModal({ visible, onClose, onSubmit, tripToEdit }: TripFormModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [notes, setNotes] = useState('');
  const [budget, setBudget] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [icon, setIcon] = useState(ICON_OPTIONS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible && tripToEdit) {
      setName(tripToEdit.name);
      setDestination(tripToEdit.destination || '');
      setNotes(tripToEdit.notes || '');
      setBudget(tripToEdit.budget ? (tripToEdit.budget * 100).toString() : '');
      const formatIsoToPtBr = (iso: string) => {
        const d = new Date(iso);
        return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
      };
      setStartDate(tripToEdit.startDate ? formatIsoToPtBr(tripToEdit.startDate) : '');
      setEndDate(tripToEdit.endDate ? formatIsoToPtBr(tripToEdit.endDate) : '');
      setColor(tripToEdit.color);
      setIcon(tripToEdit.icon);
    } else if (visible) {
      setName('');
      setDestination('');
      setNotes('');
      setBudget('');
      setStartDate('');
      setEndDate('');
      setColor(COLOR_OPTIONS[0]);
      setIcon(ICON_OPTIONS[0]);
    }
  }, [visible, tripToEdit]);

  const handleDateInput = (text: string, setter: (val: string) => void) => {
    let clean = text.replace(/\D/g, '');
    if (clean.length > 2) clean = clean.slice(0, 2) + '/' + clean.slice(2);
    if (clean.length > 5) clean = clean.slice(0, 5) + '/' + clean.slice(5, 9);
    setter(clean);
  };

  const handleAmountChange = (text: string) => {
    const cleanValue = text.replace(/\D/g, '');
    const amountNumber = Number(cleanValue) / 100;
    
    setBudget(amountNumber.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Erro', 'Nome da viagem é obrigatório.');
      return;
    }
    const isValidDate = (value: string) => {
      const [d, m, y] = value.split('/').map(Number);
      if (!d || !m || !y || y < 2000 || m < 1 || m > 12) return false;
      const date = new Date(y, m - 1, d);
      return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
    };
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      Alert.alert('Erro', 'Preencha as datas no formato DD/MM/AAAA.');
      return;
    }

    const parseDate = (ptBr: string) => {
      const [d, m, y] = ptBr.split('/');
      return `${y}-${m}-${d}`;
    };

    if (new Date(parseDate(endDate)).getTime() < new Date(parseDate(startDate)).getTime()) {
      Alert.alert('Erro', 'A data de volta deve ser igual ou posterior à data de ida.');
      return;
    }
    setIsSubmitting(true);
    try {
      let numericBudget: number | undefined = undefined;
      if (budget) {
        numericBudget = Number(budget.replace(/\./g, '').replace(',', '.'));
      }

      await onSubmit({
        name: name.trim(),
        destination: destination.trim() || undefined,
        notes: notes.trim() || undefined,
        startDate: parseDate(startDate),
        endDate: parseDate(endDate),
        budget: numericBudget && numericBudget > 0 ? numericBudget : undefined,
        color,
        icon,
      });
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Ocorreu um erro ao salvar a viagem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={Platform.OS !== 'ios'} presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined} onRequestClose={onClose}>
      <View style={[styles.container, Platform.OS !== 'ios' && { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border, marginTop: Platform.OS === 'ios' ? 0 : insets.top }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>{tripToEdit ? 'Editar Viagem' : 'Nova Viagem'}</Text>
          <TouchableOpacity onPress={handleSubmit} disabled={isSubmitting} style={[styles.saveBtn, { backgroundColor: colors.primary }]}>
            <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Salvar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Nome da Viagem</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
              value={name}
              onChangeText={setName}
              placeholder="Ex: Férias no Japão"
              placeholderTextColor={colors.mutedForeground}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Destino (Opcional)</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
              value={destination}
              onChangeText={setDestination}
              placeholder="Ex: Florianópolis, SC"
              placeholderTextColor={colors.mutedForeground}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Orçamento (Opcional)</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
              value={budget}
              onChangeText={handleAmountChange}
              keyboardType="numeric"
              placeholder="0,00"
              placeholderTextColor={colors.mutedForeground}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Data de Ida</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
                value={startDate}
                onChangeText={(t) => handleDateInput(t, setStartDate)}
                keyboardType="number-pad"
                placeholder="DD/MM/AAAA"
                placeholderTextColor={colors.mutedForeground}
                maxLength={10}
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Data de Volta</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
                value={endDate}
                onChangeText={(t) => handleDateInput(t, setEndDate)}
                keyboardType="number-pad"
                placeholder="DD/MM/AAAA"
                placeholderTextColor={colors.mutedForeground}
                maxLength={10}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Observações (Opcional)</Text>
            <TextInput
              style={[styles.input, styles.multilineInput, { color: colors.foreground, borderColor: colors.border }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Reservas, roteiro ou lembretes"
              placeholderTextColor={colors.mutedForeground}
              multiline
              textAlignVertical="top"
            />
          </View>

          <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 10 }]}>Cor</Text>
          <View style={styles.colorGrid}>
            {COLOR_OPTIONS.map(c => (
              <TouchableOpacity key={c} onPress={() => setColor(c)} style={[styles.colorSwatch, { backgroundColor: c, borderColor: color === c ? colors.foreground : 'transparent' }]}>
                {color === c && <Ionicons name="checkmark" size={20} color="#FFFFFF" />}
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 10 }]}>Ícone</Text>
          <View style={styles.iconGrid}>
            {ICON_OPTIONS.map(ic => (
              <TouchableOpacity key={ic} onPress={() => setIcon(ic)} style={[styles.iconSwatch, { backgroundColor: icon === ic ? colors.primary : colors.card, borderColor: colors.border }]}>
                <Ionicons name={ic as any} size={24} color={icon === ic ? colors.primaryForeground : colors.foreground} />
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '600' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  saveBtnText: { fontWeight: '600', fontSize: 14 },
  content: { padding: 20, gap: 20 },
  field: { gap: 8 },
  row: { flexDirection: 'row', gap: 16 },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  multilineInput: { minHeight: 84 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  iconSwatch: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
