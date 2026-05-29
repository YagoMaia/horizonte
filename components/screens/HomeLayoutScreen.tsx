import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useStoreContext } from '@/context/StoreContext';
import { HomeSection } from '@/constants/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SECTION_LABELS: Record<string, string> = {
  balance: 'Saldo Atual',
  accounts: 'Contas e Cartões',
  projects: 'Projetos Ativos',
  goals: 'Metas',
  transactions: 'Lançamentos',
};

const SECTION_ICONS: Record<string, any> = {
  balance: 'wallet-outline',
  accounts: 'card-outline',
  projects: 'briefcase-outline',
  goals: 'flag-outline',
  transactions: 'list-outline',
};

export function HomeLayoutScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { homeLayout, updateHomeLayout } = useStoreContext();
  const [localLayout, setLocalLayout] = useState<HomeSection[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLocalLayout(homeLayout);
  }, [homeLayout]);

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newLayout = [...localLayout];
    const temp = newLayout[index - 1];
    newLayout[index - 1] = newLayout[index];
    newLayout[index] = temp;
    setLocalLayout(newLayout);
    setHasChanges(true);
  };

  const moveDown = (index: number) => {
    if (index === localLayout.length - 1) return;
    const newLayout = [...localLayout];
    const temp = newLayout[index + 1];
    newLayout[index + 1] = newLayout[index];
    newLayout[index] = temp;
    setLocalLayout(newLayout);
    setHasChanges(true);
  };

  const toggleVisibility = (index: number) => {
    const newLayout = [...localLayout];
    newLayout[index] = { ...newLayout[index], visible: !newLayout[index].visible };
    setLocalLayout(newLayout);
    setHasChanges(true);
  };

  const handleSave = async () => {
    await updateHomeLayout(localLayout);
    setHasChanges(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Personalizar Tela Inicial</Text>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.description, { color: colors.mutedForeground }]}>
          Organize os blocos da tela inicial arrastando para cima ou para baixo. Você também pode ocultar seções que não deseja ver.
        </Text>

        <View style={[styles.listContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {localLayout.map((section, index) => (
            <View key={section.id} style={[styles.item, { borderBottomColor: index === localLayout.length - 1 ? 'transparent' : colors.border }]}>
              <View style={styles.itemInfo}>
                <View style={[styles.iconContainer, { backgroundColor: section.visible ? colors.primary + '15' : colors.border }]}>
                  <Ionicons name={SECTION_ICONS[section.id]} size={20} color={section.visible ? colors.primary : colors.mutedForeground} />
                </View>
                <Text style={[styles.itemLabel, { color: section.visible ? colors.foreground : colors.mutedForeground }]}>
                  {SECTION_LABELS[section.id]}
                </Text>
              </View>

              <View style={styles.itemActions}>
                <Switch
                  value={section.visible}
                  onValueChange={() => toggleVisibility(index)}
                  trackColor={{ true: colors.primary, false: colors.border }}
                />
                <View style={styles.arrows}>
                  <TouchableOpacity 
                    onPress={() => moveUp(index)} 
                    disabled={index === 0}
                    style={[styles.arrowBtn, { opacity: index === 0 ? 0.3 : 1 }]}
                  >
                    <Ionicons name="chevron-up" size={20} color={colors.foreground} />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => moveDown(index)} 
                    disabled={index === localLayout.length - 1}
                    style={[styles.arrowBtn, { opacity: index === localLayout.length - 1 ? 0.3 : 1 }]}
                  >
                    <Ionicons name="chevron-down" size={20} color={colors.foreground} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>

        {hasChanges && (
          <TouchableOpacity 
            style={[styles.saveBtn, { backgroundColor: colors.primary }]} 
            onPress={handleSave}
            activeOpacity={0.8}
          >
            <Text style={styles.saveBtnText}>Salvar Alterações</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  content: {
    padding: 20,
  },
  description: {
    fontSize: 14,
    marginBottom: 24,
    lineHeight: 20,
  },
  listContainer: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  arrows: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  arrowBtn: {
    padding: 4,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    borderRadius: 8,
  },
  saveBtn: {
    marginTop: 32,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
