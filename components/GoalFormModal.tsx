// components/GoalFormModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { CreateGoalInput } from '@/constants/types';
import { validateGoalForm } from '@/lib/goalValidation';

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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.content, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.foreground }]}>
                {isEditing ? 'Editar Meta' : 'Nova Meta'}
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            {saveError && (
              <View style={[styles.saveErrorContainer, { backgroundColor: colors.destructive + '15' }]}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
                <Text style={[styles.saveErrorText, { color: colors.destructive }]}>{saveError}</Text>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false} style={styles.form}>
              {/* Name field */}
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Nome da meta</Text>
                <TextInput
                  style={[
                    styles.input,
                    { color: colors.foreground, borderColor: errors.name ? colors.destructive : colors.border, backgroundColor: colors.secondary },
                  ]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Ex: Viagem, Carro novo..."
                  placeholderTextColor={colors.mutedForeground}
                  maxLength={50}
                />
                {errors.name && (
                  <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.name}</Text>
                )}
              </View>

              {/* Target amount field */}
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Valor da meta (R$)</Text>
                <TextInput
                  style={[
                    styles.input,
                    { color: colors.foreground, borderColor: errors.targetAmount ? colors.destructive : colors.border, backgroundColor: colors.secondary },
                  ]}
                  value={targetAmount}
                  onChangeText={handleAmountChange}
                  placeholder="0,00"
                  keyboardType="numeric"
                  placeholderTextColor={colors.mutedForeground}
                />
                {errors.targetAmount && (
                  <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.targetAmount}</Text>
                )}
              </View>

              {/* Deadline field */}
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Prazo (opcional)</Text>
                <TextInput
                  style={[
                    styles.input,
                    { color: colors.foreground, borderColor: errors.deadline ? colors.destructive : colors.border, backgroundColor: colors.secondary },
                  ]}
                  value={deadline}
                  onChangeText={handleDateChange}
                  placeholder="DD/MM/AAAA"
                  keyboardType="numeric"
                  placeholderTextColor={colors.mutedForeground}
                  maxLength={10}
                />
                {errors.deadline && (
                  <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.deadline}</Text>
                )}
              </View>

              {/* Icon selector */}
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Ícone</Text>
                <View style={styles.selectorGrid}>
                  {ICON_OPTIONS.map((iconName) => (
                    <TouchableOpacity
                      key={iconName}
                      style={[
                        styles.iconOption,
                        {
                          borderColor: icon === iconName ? color : colors.border,
                          backgroundColor: icon === iconName ? color + '20' : 'transparent',
                        },
                      ]}
                      onPress={() => setIcon(iconName)}
                    >
                      <Ionicons
                        name={iconName as any}
                        size={22}
                        color={icon === iconName ? color : colors.mutedForeground}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Color selector */}
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Cor</Text>
                <View style={styles.selectorGrid}>
                  {COLOR_OPTIONS.map((colorOption) => (
                    <TouchableOpacity
                      key={colorOption}
                      style={[
                        styles.colorOption,
                        {
                          backgroundColor: colorOption,
                          borderColor: color === colorOption ? colors.foreground : 'transparent',
                          borderWidth: color === colorOption ? 3 : 0,
                        },
                      ]}
                      onPress={() => setColor(colorOption)}
                    >
                      {color === colorOption && (
                        <Ionicons name="checkmark" size={16} color="#FFF" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            {/* Submit button */}
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primary }]}
              onPress={handleSubmit}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {isEditing ? 'Salvar Alterações' : 'Criar Meta'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  keyboardView: {
    justifyContent: 'flex-end',
  },
  content: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  saveErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  saveErrorText: {
    fontSize: 13,
    flex: 1,
  },
  form: {
    marginBottom: 16,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
  selectorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtn: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
