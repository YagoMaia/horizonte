import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  FlatList,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useStoreContext } from '@/context/StoreContext';
import { Tag } from '@/constants/types';

interface TagManagementModalProps {
  visible: boolean;
  onClose: () => void;
}

const ICON_OPTIONS = [
  'restaurant', 'cart', 'car', 'bus', 'heart', 'medical', 
  'book', 'school', 'home', 'construct', 'sunny', 'partly-sunny',
  'fitness', 'game-controller', 'gift', 'shirt', 'cash', 'card',
  'briefcase', 'hammer', 'paw', 'airplane', 'wine', 'cafe',
  'fast-food', 'pizza', 'barbell', 'bicycle', 'walk', 'umbrella',
  'build', 'flash', 'water', 'wifi', 'tv', 'phone-portrait',
  'ellipsis-horizontal', 'pricetag', 'bag-handle'
];

const COLOR_OPTIONS = [
  '#FF3B30', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA', '#007AFF', '#5856D6', '#FF2D55',
  '#8E8E93', '#AFB1B6', '#000000', '#55efc4', '#81ecec', '#74b9ff', '#a29bfe', '#dfe6e9',
  '#ffeaa7', '#fab1a0', '#ff7675', '#fd79a8', '#636e72', '#2d3436'
];

export function TagManagementModal({ visible, onClose }: TagManagementModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { tags, addTag, updateTag, deleteTag } = useStoreContext();

  const scrollRef = useRef<ScrollView>(null);

  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [label, setLabel] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(ICON_OPTIONS[0]);
  const [selectedColor, setSelectedColor] = useState(COLOR_OPTIONS[0]);

  const resetForm = () => {
    setEditingTag(null);
    setLabel('');
    setSelectedIcon(ICON_OPTIONS[0]);
    setSelectedColor(COLOR_OPTIONS[0]);
  };

  const handleEdit = (tag: Tag) => {
    setEditingTag(tag);
    setLabel(tag.label);
    setSelectedIcon(tag.icon);
    setSelectedColor(tag.color);

    // Rolar para o topo suavemente
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleSave = () => {
    if (!label.trim()) {
      Alert.alert('Erro', 'O nome da categoria é obrigatório.');
      return;
    }

    const tagData = {
      label: label.trim(),
      icon: selectedIcon,
      color: selectedColor,
    };

    if (editingTag) {
      updateTag({ ...tagData, id: editingTag.id });
    } else {
      addTag(tagData);
    }
    resetForm();
  };

  const handleDelete = (id: string) => {
    const performDelete = () => deleteTag(id);

    if (Platform.OS === 'web') {
      if (window.confirm('Tem certeza? Isso não afetará os lançamentos já criados, mas eles ficarão sem categoria visual.')) {
        performDelete();
      }
    } else {
      Alert.alert('Excluir Categoria', 'Tem certeza? Isso não afetará os lançamentos já criados, mas eles ficarão sem categoria visual.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: performDelete },
      ]);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 16 }]}>
          <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
            <Ionicons name="close" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Gerenciar Categorias</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView 
          ref={scrollRef}
          contentContainerStyle={styles.content} 
          keyboardShouldPersistTaps="handled"
        >
          {/* FORMULÁRIO */}
          <View style={[styles.form, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.formTitle, { color: colors.foreground }]}>
              {editingTag ? 'Editar Categoria' : 'Nova Categoria'}
            </Text>
            
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Nome</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
                value={label}
                onChangeText={setLabel}
                placeholder="Ex: Assinaturas, Freelance..."
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Ícone</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconGrid}>
                {ICON_OPTIONS.map(icon => (
                  <TouchableOpacity
                    key={icon}
                    style={[
                      styles.iconBtn,
                      { borderColor: colors.border },
                      selectedIcon === icon && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                    onPress={() => setSelectedIcon(icon)}
                  >
                    <Ionicons name={icon as any} size={20} color={selectedIcon === icon ? '#FFF' : colors.foreground} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Cor</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconGrid}>
                {COLOR_OPTIONS.map(color => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorBtn,
                      { backgroundColor: color },
                      selectedColor === color && { borderWidth: 3, borderColor: colors.foreground }
                    ]}
                    onPress={() => setSelectedColor(color)}
                  />
                ))}
              </ScrollView>
            </View>

            <View style={styles.formActions}>
              {editingTag && (
                <TouchableOpacity 
                  style={[styles.cancelBtn, { borderColor: colors.border }]} 
                  onPress={resetForm}
                >
                  <Text style={{ color: colors.mutedForeground }}>Cancelar</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={[styles.saveBtn, { backgroundColor: colors.primary }]} 
                onPress={handleSave}
              >
                <Text style={styles.saveBtnText}>{editingTag ? 'Atualizar' : 'Adicionar'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* LISTA */}
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground, marginTop: 24 }]}>Minhas Categorias</Text>
          <View style={styles.tagList}>
            {tags.map(tag => (
              <View key={tag.id} style={[styles.tagItem, { borderBottomColor: colors.border }]}>
                <View style={[styles.tagIcon, { backgroundColor: tag.color + '20' }]}>
                  <Ionicons name={tag.icon as any} size={20} color={tag.color} />
                </View>
                <Text style={[styles.tagName, { color: colors.foreground }]}>{tag.label}</Text>
                <View style={styles.tagActions}>
                  <TouchableOpacity onPress={() => handleEdit(tag)} style={styles.actionBtn}>
                    <Ionicons name="pencil" size={20} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(tag.id)} style={styles.actionBtn}>
                    <Ionicons name="trash" size={20} color={colors.destructive} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  content: { padding: 20 },
  form: { padding: 16, borderRadius: 16, borderWidth: 1, gap: 16 },
  formTitle: { fontSize: 16, fontWeight: '700' },
  field: { gap: 8 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
  iconGrid: { flexDirection: 'row', marginTop: 4 },
  iconBtn: { 
    width: 44, 
    height: 44, 
    borderRadius: 12, 
    borderWidth: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    marginRight: 8
  },
  colorBtn: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    marginRight: 10,
    marginBottom: 4
  },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  saveBtn: { flex: 2, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontWeight: '700' },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 12 },
  tagList: { gap: 2 },
  tagItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  tagIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  tagName: { flex: 1, fontSize: 15, fontWeight: '500' },
  tagActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
});
