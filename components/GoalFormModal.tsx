import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { CreateGoalInput } from '@/constants/types';
import { validateGoalForm } from '@/lib/goalValidation';
import { AppModal } from './ui/AppModal';
import { AppButton } from './ui/AppButton';
import { FormField } from './ui/FormField';
import { FeedbackBanner } from './ui/FeedbackBanner';

const ICON_OPTIONS: string[] = [
  'flag-outline',
  'star-outline',
  'heart-outline',
  'airplane-outline',
  'home-outline',
  'car-outline',
  'school-outline',
  'gift-outline',
  'cash-outline',
  'wallet-outline',
  'trophy-outline',
  'diamond-outline',
];

const COLOR_OPTIONS: string[] = [
  '#E64A19',
  '#1976D2',
  '#388E3C',
  '#7B1FA2',
  '#D32F2F',
  '#F57C00',
  '#0097A7',
  '#C2185B',
  '#512DA8',
  '#00796B',
  '#AFB42B',
  '#5D4037',
];

interface GoalFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: CreateGoalInput) => Promise<void>;
  initialData?: {
    name: string;
    targetAmount: number;
    deadline: string | null;
    icon: string;
    color: string;
  };
}

export function GoalFormModal({ visible, onClose, onSubmit, initialData }: GoalFormModalProps) {
  const { colors } = useTheme();

  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [icon, setIcon] = useState('flag-outline');
  const [color, setColor] = useState(colors.primary);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isEditing = !!initialData;

  useEffect(() => {
    if (visible) {
      if (initialData) {
        setName(initialData.name);
        setTargetAmount(formatAmountDisplay(initialData.targetAmount));
        setDeadline(initialData.deadline ? formatDateDisplay(initialData.deadline) : '');
        setIcon(initialData.icon);
        setColor(initialData.color);
      } else {
        setName('');
        setTargetAmount('');
        setDeadline('');
        setIcon('flag-outline');
        setColor(colors.primary);
      }
      setErrors({});
      setSaveError(null);
    }
  }, [visible, initialData]);

  const formatAmountDisplay = (value: number): string => {
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDateDisplay = (isoDate: string): string => {
    const d = new Date(isoDate);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const parseDateInput = (dateStr: string): string | null => {
    if (!dateStr.trim()) return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts;
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  };

  const parseAmount = (text: string): number => {
    const cleaned = text.replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  };

  const handleAmountChange = (text: string) => {
    const cleanValue = text.replace(/\D/g, '');
    const amountNumber = Number(cleanValue) / 100;
    const formatted = amountNumber.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    setTargetAmount(formatted);
  };

  const handleDateChange = (text: string) => {
    // Auto-format date as DD/MM/YYYY
    let cleaned = text.replace(/\D/g, '');
    if (cleaned.length > 8) cleaned = cleaned.slice(0, 8);

    let formatted = '';
    if (cleaned.length > 4) {
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4)}`;
    } else if (cleaned.length > 2) {
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    } else {
      formatted = cleaned;
    }
    setDeadline(formatted);
  };

  const handleSubmit = async () => {
    if (saving) return;
    setSaveError(null);

    const parsedDeadline = parseDateInput(deadline);
    const parsedAmount = parseAmount(targetAmount);

    // If deadline field has text but couldn't be parsed, show error
    if (deadline.trim() && !parsedDeadline) {
      setErrors({ deadline: 'Data inválida. Use o formato DD/MM/AAAA' });
      return;
    }

    const input: CreateGoalInput = {
      name,
      targetAmount: parsedAmount,
      deadline: parsedDeadline,
      icon,
      color,
    };

    const result = validateGoalForm(input);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }

    setErrors({});
    setSaving(true);

    try {
      await onSubmit(input);
      onClose();
    } catch (err: any) {
      setSaveError(err?.message || 'Não foi possível salvar a meta. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };


  return (
    <AppModal visible={visible} title={isEditing ? 'Editar Meta' : 'Nova Meta'} onClose={onClose} busy={saving}>
      {saveError && <FeedbackBanner tone="error" message={saveError} />}
      <View>
        <FormField label="Nome da meta" value={name} onChangeText={setName}
          placeholder="Ex: Viagem, Carro novo..." maxLength={50} error={errors.name} editable={!saving} />
        <FormField label="Valor da meta (R$)" value={targetAmount} onChangeText={handleAmountChange}
          placeholder="0,00" keyboardType="decimal-pad" error={errors.targetAmount} editable={!saving} />
        <FormField label="Prazo (opcional)" value={deadline} onChangeText={handleDateChange}
          placeholder="DD/MM/AAAA" keyboardType="numeric" maxLength={10} error={errors.deadline}
          hint="Você também pode guardar dinheiro sem definir uma data." editable={!saving} />
      </View>
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.foreground }]}>Ícone</Text>
        <View style={styles.selectorGrid}>
          {ICON_OPTIONS.map((iconName, index) => (
            <TouchableOpacity key={iconName} disabled={saving} accessibilityRole="radio"
              accessibilityLabel={['Bandeira', 'Estrela', 'Coração', 'Viagem', 'Casa', 'Carro', 'Estudos', 'Presente', 'Dinheiro', 'Carteira', 'Troféu', 'Diamante'][index]}
              accessibilityState={{ checked: icon === iconName, disabled: saving }}
              style={[styles.option, { borderColor: icon === iconName ? colors.primaryText : colors.border,
                backgroundColor: icon === iconName ? colors.primarySoft : colors.card }]}
              onPress={() => setIcon(iconName)}>
              <Ionicons name={iconName as any} size={22} color={icon === iconName ? colors.primaryText : colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.foreground }]}>Cor</Text>
        <View style={styles.selectorGrid}>
          {COLOR_OPTIONS.map((option, index) => (
            <TouchableOpacity key={option} disabled={saving} accessibilityRole="radio"
              accessibilityLabel={['Laranja', 'Azul', 'Verde', 'Roxo', 'Vermelho', 'Âmbar', 'Ciano', 'Rosa', 'Violeta', 'Verde-azulado', 'Lima', 'Marrom'][index]}
              accessibilityState={{ checked: color === option, disabled: saving }}
              style={[styles.option, { borderColor: color === option ? colors.foreground : colors.border }]}
              onPress={() => setColor(option)}>
              <View style={[styles.swatch, { backgroundColor: option }]} />
              {color === option && <Ionicons name="checkmark-circle" size={18} color={colors.foreground} style={styles.check} />}
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <AppButton label={isEditing ? 'Salvar Alterações' : 'Criar Meta'} onPress={handleSubmit} loading={saving} />
    </AppModal>
  );
}
const styles = StyleSheet.create({
  field: { gap: 10 },
  label: { fontSize: 13, fontWeight: '600' },
  selectorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  option: { width: 48, height: 48, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 30, height: 30, borderRadius: 15 },
  check: { position: 'absolute', right: -4, bottom: -4 },
});
