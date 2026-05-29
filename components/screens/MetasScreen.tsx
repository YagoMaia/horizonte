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
  const { goals, addGoal, updateGoal, deleteGoal, getGoalSavedAmount } = useStoreContext();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalContribution, setNewGoalContribution] = useState('');
  const [newGoalColor, setNewGoalColor] = useState(GOAL_COLORS[0]);

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
    setNewGoalColor(GOAL_COLORS[0]);
    setModalVisible(true);
  };

  const handleEditGoal = (goal: any) => {
    setEditingGoalId(goal.id);
    setNewGoalName(goal.name);
    setNewGoalTarget(formatCurrencyMask(String(goal.targetAmount * 100)));
    setNewGoalContribution(formatCurrencyMask(String(goal.monthlyContribution * 100)));
    setNewGoalColor(goal.color);
    setModalVisible(true);
  };

  const handleDeleteGoal = (id: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm('Tem certeza que deseja excluir esta meta?')) {
        deleteGoal(id);
      }
    } else {
      Alert.alert(
        'Excluir Meta',
        'Tem certeza que deseja excluir esta meta?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Excluir', style: 'destructive', onPress: () => deleteGoal(id) },
        ]
      );
    }
  };

  const handleAddGoal = async () => {
    if (!newGoalName.trim() || !newGoalTarget || !newGoalContribution) return;
    
    const targetNumeric = parseFloat(newGoalTarget.replace(/\./g, '').replace(',', '.'));
    const contribNumeric = parseFloat(newGoalContribution.replace(/\./g, '').replace(',', '.'));

    if (targetNumeric <= 0 || contribNumeric <= 0) {
      Alert.alert('Erro', 'Os valores devem ser maiores que zero.');
      return;
    }
    
    if (editingGoalId) {
      await updateGoal({
        id: editingGoalId,
        name: newGoalName.trim(),
        targetAmount: targetNumeric,
        monthlyContribution: contribNumeric,
        savedAmount: 0,
        color: newGoalColor,
        icon: 'star',
      });
    } else {
      await addGoal({
        name: newGoalName.trim(),
        targetAmount: targetNumeric,
        monthlyContribution: contribNumeric,
        savedAmount: 0,
        color: newGoalColor,
        icon: 'star',
      });
    }
    
    setModalVisible(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Metas</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={openNewGoalModal}
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
            const monthsEstimated = Math.ceil(remainingAmount / goal.monthlyContribution);
            const years = Math.floor(monthsEstimated / 12);
            const months = monthsEstimated % 12;
            
            let timeString = '';
            if (remainingAmount <= 0) {
              timeString = 'Meta Concluída! 🎉';
            } else {
              if (years > 0) timeString += `${years} ano${years > 1 ? 's' : ''}`;
              if (months > 0) timeString += `${years > 0 ? ' e ' : ''}${months} mê${months > 1 ? 's' : 's'}`;
              if (monthsEstimated === 1 && years === 0) timeString = '1 mês';
              if (monthsEstimated === 0) timeString = 'Concluindo este mês';
              
              const expectedDate = new Date();
              expectedDate.setMonth(expectedDate.getMonth() + monthsEstimated);
              const monthName = expectedDate.toLocaleString('pt-BR', { month: 'short' });
              timeString += ` (${monthName}/${expectedDate.getFullYear()})`;
            }

            return (
              <TouchableOpacity
                key={goal.id}
                style={[styles.goalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => handleEditGoal(goal)}
                activeOpacity={0.7}
              >
                <View style={styles.goalHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.goalIcon, { backgroundColor: goal.color + '20' }]}>
                      <Ionicons name="flag" size={16} color={goal.color} />
                    </View>
                    <Text style={[styles.goalName, { color: colors.foreground }]}>{goal.name}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteGoal(goal.id)}>
                    <Ionicons name="trash-outline" size={20} color={colors.destructive} />
                  </TouchableOpacity>
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
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Modal Nova Meta */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {editingGoalId ? 'Editar Meta' : 'Nova Meta'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Nome da Meta</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="Ex: Carro Novo"
                placeholderTextColor={colors.mutedForeground}
                value={newGoalName}
                onChangeText={setNewGoalName}
              />

              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Valor Alvo</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="0,00"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                value={newGoalTarget}
                onChangeText={(text) => setNewGoalTarget(formatCurrencyMask(text))}
              />

              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Aporte Mensal Planejado</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="0,00"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                value={newGoalContribution}
                onChangeText={(text) => setNewGoalContribution(formatCurrencyMask(text))}
              />

              <Text style={[styles.inputLabel, { color: colors.mutedForeground, marginTop: 16 }]}>Cor</Text>
              <View style={styles.colorGrid}>
                {GOAL_COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setNewGoalColor(c)}
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
              >
                <Text style={styles.saveBtnText}>Salvar Meta</Text>
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
  },
  goalValues: {
    flexDirection: 'row',
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
  modalBody: {
    padding: 20,
  },
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
});
