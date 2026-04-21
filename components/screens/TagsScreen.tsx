// components/screens/TagsScreen.tsx
import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/hooks/useTheme'
import { useStoreContext } from '@/context/StoreContext'
import { Tag } from '@/constants/types'

const TAG_COLORS = [
  '#FF7043', '#42A5F5', '#66BB6A', '#AB47BC',
  '#FFA726', '#26C6DA', '#9CCC65', '#8D6E63',
  '#EC407A', '#7E57C2', '#26A69A', '#78909C',
]

export function TagsScreen() {
  const { colors } = useTheme()
  const { tags, transactions, saveTags } = useStoreContext()
  const insets = useSafeAreaInsets()
  const [modalVisible, setModalVisible] = useState(false)
  const [editTag, setEditTag] = useState<Tag | null>(null)
  const [name, setName] = useState('')
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0])

  const openAdd = () => {
    setEditTag(null)
    setName('')
    setSelectedColor(TAG_COLORS[0])
    setModalVisible(true)
  }

  const openEdit = (tag: Tag) => {
    setEditTag(tag)
    setName(tag.name)
    setSelectedColor(tag.color)
    setModalVisible(true)
  }

  const handleSave = async () => {
    if (!name.trim()) return
    if (editTag) {
      const updated = tags.map(t => t.id === editTag.id ? { ...t, name: name.trim(), color: selectedColor } : t)
      await saveTags(updated)
    } else {
      const newTag: Tag = {
        id: Date.now().toString(),
        name: name.trim(),
        color: selectedColor,
        icon: 'pricetag',
      }
      await saveTags([...tags, newTag])
    }
    setModalVisible(false)
  }

  const handleDelete = (tag: Tag) => {
    Alert.alert(
      'Excluir tag',
      `Tem certeza que deseja excluir "${tag.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await saveTags(tags.filter(t => t.id !== tag.id))
          }
        }
      ]
    )
  }

  const getTagCount = (tagId: string) =>
    transactions.filter(t => t.tagIds.includes(tagId)).length

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>Tags</Text>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={openAdd}
          >
            <Ionicons name="add" size={18} color="#FFF" />
            <Text style={styles.addBtnText}>Nova tag</Text>
          </TouchableOpacity>
        </View>

        {/* Tags list */}
        <View style={[styles.list, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {tags.map((tag, idx) => (
            <View
              key={tag.id}
              style={[
                styles.tagItem,
                idx < tags.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }
              ]}
            >
              <View style={[styles.tagColor, { backgroundColor: tag.color }]} />
              <View style={styles.tagInfo}>
                <Text style={[styles.tagName, { color: colors.foreground }]}>{tag.name}</Text>
                <Text style={[styles.tagCount, { color: colors.mutedForeground }]}>
                  {getTagCount(tag.id)} lançamentos
                </Text>
              </View>
              <View style={styles.tagActions}>
                <TouchableOpacity
                  onPress={() => openEdit(tag)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="pencil-outline" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(tag)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[styles.modal, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {editTag ? 'Editar tag' : 'Nova tag'}
            </Text>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
              onPress={handleSave}
            >
              <Text style={styles.saveBtnText}>Salvar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Nome</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={name}
              onChangeText={setName}
              placeholder="Ex: Alimentação"
              placeholderTextColor={colors.mutedForeground}
              autoFocus
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Cor</Text>
            <View style={styles.colorGrid}>
              {TAG_COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: color },
                    selectedColor === color && styles.colorSwatchSelected
                  ]}
                  onPress={() => setSelectedColor(color)}
                >
                  {selectedColor === color && (
                    <Ionicons name="checkmark" size={16} color="#FFF" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  tagColor: {
    width: 12,
    height: 40,
    borderRadius: 4,
  },
  tagInfo: {
    flex: 1,
  },
  tagName: {
    fontSize: 15,
    fontWeight: '500',
  },
  tagCount: {
    fontSize: 12,
    marginTop: 2,
  },
  tagActions: {
    flexDirection: 'row',
    gap: 16,
  },
  modal: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveBtnText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  modalContent: {
    padding: 20,
    gap: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
})
