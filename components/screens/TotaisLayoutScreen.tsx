import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useStoreContext } from '@/context/StoreContext';
import { TotaisSection } from '@/constants/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SECTION_LABELS: Record<string, string> = {
  stats: 'Cálculos do período',
  category: 'Gastos por Categoria',
  period: 'Evolução dos Gastos',
};

const SECTION_ICONS: Record<string, any> = {
  stats: 'calculator-outline',
  category: 'pie-chart-outline',
  period: 'bar-chart-outline',
};

export function TotaisLayoutScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { totaisLayout, updateTotaisLayout } = useStoreContext();
  const [localLayout, setLocalLayout] = useState<TotaisSection[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLocalLayout(totaisLayout);
  }, [totaisLayout]);

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
    await updateTotaisLayout(localLayout);
    setHasChanges(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Personalizar Totais</Text>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.description, { color: colors.mutedForeground }]}>
          Organize os gráficos da tela de Totais arrastando para cima ou para baixo. Você também pode ocultar seções que não deseja ver.
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
    marginBottom: 20,
    lineHeight: 20,
  },
  listContainer: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemLabel: {
    fontSize: 15,
    fontWeight: '500',
    flexShrink: 1,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
  },
  arrows: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  arrowBtn: {
    padding: 4,
  },
  saveBtn: {
    marginTop: 24,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
