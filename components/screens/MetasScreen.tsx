import { financialDate, goalForecast } from '@/lib/financialDate';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useStoreContext } from '@/context/StoreContext';

const GOAL_COLORS = [
  '#FF3B30', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA', '#007AFF', '#5856D6', '#FF2D55', '#E91E63', '#00BCD4'
];

export function MetasScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { goals, addGoal, updateGoal, deleteGoal, getGoalSavedAmount, today } = useStoreContext();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalContribution, setNewGoalContribution] = useState('');
  const [newGoalSaved, setNewGoalSaved] = useState('');
  const [newGoalColor, setNewGoalColor] = useState(GOAL_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const formatCurrencyMask = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    const amountNumber = Number(cleanValue) / 100;
    return amountNumber.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const openNewGoalModal = () => {
    setEditingGoalId(null);
    setNewGoalName('');
    setNewGoalTarget('');
    setNewGoalContribution('');
    setNewGoalSaved('');
    setNewGoalColor(GOAL_COLORS[0]);
    setFormError('');
    setModalVisible(true);
  };

  const handleEditGoal = (goal: any) => {
    setEditingGoalId(goal.id);
    setNewGoalName(goal.name);
    setNewGoalTarget(formatCurrencyMask(String(goal.targetAmount * 100)));
    setNewGoalContribution(formatCurrencyMask(String(goal.monthlyContribution * 100)));
    setNewGoalSaved(formatCurrencyMask(String((goal.savedAmount || 0) * 100)));
    setNewGoalColor(goal.color);
    setFormError('');
    setModalVisible(true);
  };

  const handleDeleteGoal = (id: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm('Tem certeza que deseja excluir esta meta?')) {
        deleteGoal(id).catch(() => Alert.alert('Não foi possível excluir', 'Tente novamente. Seus dados foram preservados.'));
      }
    } else {
      Alert.alert(
        'Excluir Meta',
        'Tem certeza que deseja excluir esta meta?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Excluir', style: 'destructive', onPress: () => deleteGoal(id).catch(() => Alert.alert('Não foi possível excluir', 'Tente novamente. Seus dados foram preservados.')) },
        ]
      );
    }
  };

  const handleAddGoal = async () => {
    const name = newGoalName.trim();
    const targetNumeric = parseFloat(newGoalTarget.replace(/\./g, '').replace(',', '.'));
    const contribNumeric = parseFloat(newGoalContribution.replace(/\./g, '').replace(',', '.'));
    const savedNumeric = newGoalSaved ? parseFloat(newGoalSaved.replace(/\./g, '').replace(',', '.')) : 0;

    if (!name) {
      setFormError('Informe um nome para a meta.');
      return;
    }
    if (!Number.isFinite(targetNumeric) || targetNumeric <= 0 || !Number.isFinite(contribNumeric) || contribNumeric <= 0 || !Number.isFinite(savedNumeric) || savedNumeric < 0) {
      setFormError('Use valores válidos. Alvo e aporte devem ser maiores que zero.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const goal = { name, targetAmount: targetNumeric, monthlyContribution: contribNumeric, savedAmount: savedNumeric, color: newGoalColor, icon: 'star' };
      if (editingGoalId) await updateGoal({ ...goal, id: editingGoalId });
      else await addGoal(goal);
      setModalVisible(false);
    } catch {
      setFormError('Não foi possível salvar a meta. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Metas</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={openNewGoalModal}
          accessibilityRole="button"
          accessibilityLabel="Criar nova meta"
        >
          <Ionicons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {goals.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="flag-outline" size={64} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Você ainda não tem nenhuma meta.
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.mutedForeground }]}>
              Crie uma meta para planejar quanto tempo falta para alcançar seus objetivos.
            </Text>
          </View>
        ) : (
          goals.map(goal => {
            const savedAmount = getGoalSavedAmount(goal.id);
            const remainingAmount = Math.max(0, goal.targetAmount - savedAmount);
            const timeString = goalForecast(remainingAmount, goal.monthlyContribution, financialDate(today));

            return (
              <View
                key={goal.id}
                style={[styles.goalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.goalHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.goalIcon, { backgroundColor: goal.color + '20' }]}>
                      <Ionicons name="flag" size={16} color={goal.color} />
                    </View>
                    <Text style={[styles.goalName, { color: colors.foreground }]} numberOfLines={1}>{goal.name}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Editar meta ${goal.name}`} onPress={() => handleEditGoal(goal)} hitSlop={10}>
                      <Ionicons name="pencil-outline" size={20} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Excluir meta ${goal.name}`} onPress={() => handleDeleteGoal(goal.id)} hitSlop={10}>
                      <Ionicons name="trash-outline" size={20} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.goalValues}>
                  <View style={styles.valueItem}>
                    <Text style={[styles.valueLabel, { color: colors.mutedForeground }]}>Alvo</Text>
                    <Text style={[styles.valueText, { color: colors.foreground }]}>
                      {formatCurrency(goal.targetAmount)}
                    </Text>
                  </View>
                  <View style={styles.valueItem}>
                    <Text style={[styles.valueLabel, { color: colors.mutedForeground }]}>Aporte Mensal</Text>
                    <Text style={[styles.valueText, { color: colors.success }]}>
                      {formatCurrency(goal.monthlyContribution)}
                    </Text>
                  </View>
                </View>

                <View style={[styles.progressContainer, { backgroundColor: goal.color + '10', borderColor: goal.color + '30' }]}>
                  <Ionicons name={remainingAmount <= 0 ? "checkmark-circle" : "time-outline"} size={18} color={goal.color} />
                  <Text style={[styles.progressText, { color: goal.color }]}>
                    {remainingAmount <= 0 ? timeString : `Previsão: ${timeString}`}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Modal Nova Meta */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border, paddingTop: Math.max(insets.top, 16) }]}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {editingGoalId ? 'Editar Meta' : 'Nova Meta'}
              </Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Fechar formulário" onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: insets.bottom + 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {!!formError && <Text accessibilityRole="alert" style={[styles.formError, { color: colors.destructive }]}>{formError}</Text>}
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Nome da Meta</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="Ex: Carro Novo"
                placeholderTextColor={colors.mutedForeground}
                value={newGoalName}
                onChangeText={setNewGoalName}
                onFocus={() => setFormError('')}
              />

              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Valor Alvo</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="0,00"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                value={newGoalTarget}
                onChangeText={(text) => setNewGoalTarget(formatCurrencyMask(text))}
                onFocus={() => setFormError('')}
              />

              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Aporte Mensal (Quanto consegue guardar?)</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="0,00"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                value={newGoalContribution}
                onChangeText={(text) => setNewGoalContribution(formatCurrencyMask(text))}
                onFocus={() => setFormError('')}
              />

              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Valor Inicial Guardado (Opcional)</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="0,00"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                value={newGoalSaved}
                onChangeText={(text) => setNewGoalSaved(formatCurrencyMask(text))}
                onFocus={() => setFormError('')}
              />

              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Cor de Destaque</Text>
              <View style={styles.colorGrid}>
                {GOAL_COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setNewGoalColor(c)}
                    accessibilityRole="radio"
                    accessibilityLabel={`Usar cor ${c}`}
                    accessibilityState={{ selected: newGoalColor === c }}
                    style={[
                      styles.colorOption,
                      { backgroundColor: c },
                      newGoalColor === c && styles.colorOptionSelected
                    ]}
                  >
                    {newGoalColor === c && <Ionicons name="checkmark" size={16} color="#FFF" />}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                onPress={handleAddGoal}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="Salvar meta"
              >
                <Text style={styles.saveBtnText}>{saving ? 'Salvando...' : 'Salvar Meta'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
    gap: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  goalCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 16,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalName: {
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  goalValues: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  valueItem: {
    flex: 1,
  },
  valueLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  valueText: {
    fontSize: 18,
    fontWeight: '700',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: { padding: 20 },
  inputLabel: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 20,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  colorOption: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorOptionSelected: {
    borderWidth: 2,
    borderColor: '#FFF',
  },
  modalFooter: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saveBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  formError: { fontSize: 14, fontWeight: '600', marginBottom: 16 },
});
