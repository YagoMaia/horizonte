import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useStoreContext } from '@/context/StoreContext';
import { HomeSection } from '@/constants/types';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const SECTION_LABELS: Record<string, string> = {
  balance: 'Saldo Atual',
  accounts: 'Contas e Cartões',
  projects: 'Projetos Ativos',
  goals: 'Acompanhamento de Metas',
  transactions: 'Lançamentos',
};

const SECTION_ICONS: Record<string, any> = {
  balance: 'wallet-outline',
  accounts: 'card-outline',
  projects: 'briefcase-outline',
  goals: 'flag-outline',
  transactions: 'list-outline',
};

export function HomeLayoutModal({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const { homeLayout, updateHomeLayout } = useStoreContext();
  const [localLayout, setLocalLayout] = useState<HomeSection[]>([]);

  useEffect(() => {
    if (visible) {
      setLocalLayout(homeLayout);
    }
  }, [visible, homeLayout]);

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newLayout = [...localLayout];
    const temp = newLayout[index - 1];
    newLayout[index - 1] = newLayout[index];
    newLayout[index] = temp;
    setLocalLayout(newLayout);
  };

  const moveDown = (index: number) => {
    if (index === localLayout.length - 1) return;
    const newLayout = [...localLayout];
    const temp = newLayout[index + 1];
    newLayout[index + 1] = newLayout[index];
    newLayout[index] = temp;
    setLocalLayout(newLayout);
  };

  const toggleVisibility = (index: number) => {
    const newLayout = [...localLayout];
    newLayout[index] = { ...newLayout[index], visible: !newLayout[index].visible };
    setLocalLayout(newLayout);
  };

  const handleSave = async () => {
    await updateHomeLayout(localLayout);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.foreground }]}>Personalizar Tela Inicial</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            {localLayout.map((section, index) => (
              <View key={section.id} style={[styles.item, { borderBottomColor: colors.border }]}>
                <View style={styles.itemInfo}>
                  <Ionicons name={SECTION_ICONS[section.id]} size={20} color={section.visible ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.itemLabel, { color: section.visible ? colors.foreground : colors.mutedForeground }]}>
                    {SECTION_LABELS[section.id]}
                  </Text>
                </View>

                <View style={styles.itemActions}>
                  <Switch
                    value={section.visible}
                    onValueChange={() => toggleVisibility(index)}
                  />
                  <View style={styles.arrows}>
                    <TouchableOpacity onPress={() => moveUp(index)} disabled={index === 0}>
                      <Ionicons name="chevron-up" size={24} color={index === 0 ? colors.border : colors.foreground} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => moveDown(index)} disabled={index === localLayout.length - 1}>
                      <Ionicons name="chevron-down" size={24} color={index === localLayout.length - 1 ? colors.border : colors.foreground} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Salvar Alterações</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    padding: 20,
    gap: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  footer: {
    padding: 20,
    paddingBottom: 40,
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
