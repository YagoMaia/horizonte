import React, { useState, useMemo } from 'react';
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
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useStoreContext } from '@/context/StoreContext';

const PROJECT_COLORS = [
  '#FF3B30', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA', '#007AFF', '#5856D6', '#FF2D55'
];

export function ProjetosScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { transactions, projects, getProjectStats, addProject, updateProject, deleteProject } = useStoreContext();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectBudget, setNewProjectBudget] = useState('');
  const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[0]);
  const [newProjectActive, setNewProjectActive] = useState(true);

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

  const openNewProjectModal = () => {
    setEditingProjectId(null);
    setNewProjectName('');
    setNewProjectBudget('');
    setNewProjectColor(PROJECT_COLORS[0]);
    setNewProjectActive(true);
    setModalVisible(true);
  };

  const handleEditProject = (project: any) => {
    setEditingProjectId(project.id);
    setNewProjectName(project.name);
    setNewProjectBudget(formatCurrencyMask(String(project.targetBudget * 100)));
    setNewProjectColor(project.color);
    setNewProjectActive(project.active !== false); // Default to true if undefined
    setModalVisible(true);
  };

  const handleDeleteProject = (id: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm('Tem certeza que deseja excluir este projeto? As transações vinculadas não serão apagadas, apenas desvinculadas.')) {
        deleteProject(id);
      }
    } else {
      Alert.alert(
        'Excluir Projeto',
        'Tem certeza que deseja excluir este projeto? As transações vinculadas não serão apagadas, apenas desvinculadas.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Excluir', style: 'destructive', onPress: () => deleteProject(id) },
        ]
      );
    }
  };

  const handleAddProject = async () => {
    if (!newProjectName.trim() || !newProjectBudget) return;
    
    const numericBudget = parseFloat(newProjectBudget.replace(/\./g, '').replace(',', '.'));
    
    if (editingProjectId) {
      await updateProject({
        id: editingProjectId,
        name: newProjectName.trim(),
        targetBudget: numericBudget,
        color: newProjectColor,
        active: newProjectActive,
      });
    } else {
      await addProject({
        name: newProjectName.trim(),
        targetBudget: numericBudget,
        color: newProjectColor,
        active: newProjectActive,
      });
    }

    setModalVisible(false);
    setEditingProjectId(null);
    setNewProjectName('');
    setNewProjectBudget('');
    setNewProjectColor(PROJECT_COLORS[0]);
    setNewProjectActive(true);
  };

  const projectStats = useMemo(() => {
    return projects.map((project) => {
      const stats = getProjectStats(project.id);

      const progress = project.targetBudget > 0 ? Math.min(stats.spent / project.targetBudget, 1) : 0;
      const isOverBudget = stats.spent > project.targetBudget;

      return {
        ...project,
        totalIncome: stats.income,
        totalSpent: stats.spent,
        available: stats.available,
        progress,
        isOverBudget,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, getProjectStats, transactions]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Projetos</Text>
          <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
            Centro de Custos
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.newProjectBtn, { backgroundColor: colors.primary }]}
          onPress={openNewProjectModal}
        >
          <Text style={styles.newProjectBtnText}>Novo Projeto</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {projectStats.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="briefcase-outline" size={64} color={colors.mutedForeground} style={{ opacity: 0.5 }} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhum projeto ativo</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Crie projetos para isolar e acompanhar gastos específicos (ex: Reforma, Viagem, Setup PC).
            </Text>
            {/* Auto mock data button for testing if requested */}
            <TouchableOpacity
              style={[styles.mockBtn, { borderColor: colors.primary }]}
              onPress={() => {
                addProject({ name: 'Robô Equilibrista', targetBudget: 400, color: '#5856D6', active: true });
                addProject({ name: 'Setup PC (Ryzen + 650W)', targetBudget: 2500, color: '#007AFF', active: true });
              }}
            >
              <Text style={{ color: colors.primary, fontWeight: '600' }}>Carregar Exemplos</Text>
            </TouchableOpacity>
          </View>
        ) : (
          projectStats.map((project) => {
            const isInactive = project.active === false;
            return (
              <View key={project.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: isInactive ? 0.6 : 1 }]}>
                <View style={styles.cardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, flex: 1 }}>
                    <View style={[styles.iconBox, { backgroundColor: isInactive ? colors.mutedForeground + '20' : project.color + '20' }]}>
                      <Ionicons name="briefcase-outline" size={18} color={isInactive ? colors.mutedForeground : project.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.projectName, { color: colors.foreground }]} numberOfLines={1}>
                        {project.name}
                        {isInactive && <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: 'normal' }}> (Inativo)</Text>}
                      </Text>
                      <Text style={[styles.spentText, { color: project.available < 0 && !isInactive ? colors.destructive : colors.primary, marginTop: 4, fontWeight: '600' }]}>
                        Disponível: {formatCurrency(project.available)}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => handleEditProject(project)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                      <Ionicons name="pencil-outline" size={20} color={colors.mutedForeground} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteProject(project.id)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                      <Ionicons name="trash-outline" size={20} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.progressContainer}>
                  <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { 
                          backgroundColor: isInactive ? colors.mutedForeground : (project.isOverBudget ? colors.destructive : project.color),
                          width: `${project.progress * 100}%` 
                        }
                      ]}
                    />
                  </View>
                  <View style={styles.budgetLabels}>
                    <Text style={[styles.budgetLabelText, { color: colors.mutedForeground }]}>
                      Juntei: {formatCurrency(project.totalIncome)}
                    </Text>
                    <Text style={[styles.budgetLabelText, { color: colors.mutedForeground }]}>
                      Gasto: {formatCurrency(project.totalSpent)} / Orç: {formatCurrency(project.targetBudget)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: colors.background }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {editingProjectId ? 'Editar Projeto' : 'Novo Projeto'}
            </Text>
            <TouchableOpacity onPress={handleAddProject} disabled={!newProjectName || !newProjectBudget}>
              <Text style={[styles.saveBtnText, { color: (!newProjectName || !newProjectBudget) ? colors.mutedForeground : colors.primary }]}>
                Salvar
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Nome do Projeto</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                value={newProjectName}
                onChangeText={setNewProjectName}
                placeholder="Ex: Reforma do Quarto"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Orçamento Alvo</Text>
              <TextInput
                style={[styles.amountInput, { color: colors.foreground, borderBottomColor: colors.border }]}
                value={newProjectBudget}
                onChangeText={(t) => setNewProjectBudget(formatCurrencyMask(t))}
                placeholder="0,00"
                keyboardType="numeric"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Cor do Projeto</Text>
              <View style={styles.colorRow}>
                {PROJECT_COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.colorCircle,
                      { backgroundColor: c },
                      newProjectColor === c && styles.colorCircleSelected
                    ]}
                    onPress={() => setNewProjectColor(c)}
                  />
                ))}
              </View>
            </View>
            
            <View style={[styles.field, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }]}>
              <View>
                <Text style={[styles.label, { color: colors.foreground, marginBottom: 2 }]}>Projeto Ativo</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Projetos inativos não aparecem no quadro da tela inicial.</Text>
              </View>
              <Switch
                value={newProjectActive}
                onValueChange={setNewProjectActive}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 28, fontWeight: '800' },
  headerSubtitle: { fontSize: 15, marginTop: 4 },
  newProjectBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  newProjectBtnText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  content: { padding: 20, gap: 16 },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectName: { fontSize: 16, fontWeight: '700' },
  spentText: { fontSize: 18, fontWeight: '800' },
  progressContainer: { gap: 8 },
  progressBarBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  budgetLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  budgetLabelText: { fontSize: 12, fontWeight: '500' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 17, fontWeight: '600' },
  saveBtnText: { fontSize: 16, fontWeight: '600' },
  modalContent: { padding: 20, gap: 24 },
  field: { gap: 8, marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  input: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 16 },
  amountInput: { fontSize: 32, fontWeight: '700', borderBottomWidth: 1, paddingBottom: 8 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  colorCircle: { width: 32, height: 32, borderRadius: 16 },
  colorCircleSelected: { borderWidth: 3, borderColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 3, elevation: 4 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  emptyText: { textAlign: 'center', fontSize: 14, lineHeight: 20, paddingHorizontal: 20 },
  mockBtn: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
});
