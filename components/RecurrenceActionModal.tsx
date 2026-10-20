// components/RecurrenceActionModal.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

interface RecurrenceActionModalProps {
  visible: boolean;
  actionType: 'edit' | 'delete';
  busy?: boolean;
  onClose: () => void;
  onSelect: (mode: 'single' | 'future' | 'all') => void;
}

export function RecurrenceActionModal({ visible, actionType, onClose, onSelect, busy = false }: RecurrenceActionModalProps) {
  const { colors } = useTheme();
  
  const title = actionType === 'delete' ? 'Apagar Lançamento' : 'Editar Lançamento';
  const subtitle = busy ? 'Aguarde a conclusão da operação...' : 'Este lançamento faz parte de uma recorrência ou parcelamento. Como deseja prosseguir?';
  const verb = actionType === 'delete' ? 'Exclui' : 'Altera';
  const colorBase = actionType === 'delete' ? colors.destructive : colors.primary;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
      <View style={styles.overlay}>
        <View style={[styles.content, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
            <TouchableOpacity disabled={busy} accessibilityLabel="Fechar" onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>

          <View style={styles.optionsContainer}>
            <TouchableOpacity disabled={busy} style={[styles.optionBtn, { borderColor: colors.border }]} onPress={() => onSelect('single')}>
              <Ionicons name="document-outline" size={20} color={colors.foreground} />
              <View style={styles.optionTextWrap}>
                <Text style={[styles.optionTitle, { color: colors.foreground }]}>Somente este</Text>
                <Text style={[styles.optionDesc, { color: colors.mutedForeground }]}>{verb} apenas o lançamento selecionado.</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity disabled={busy} style={[styles.optionBtn, { borderColor: colors.border }]} onPress={() => onSelect('future')}>
              <Ionicons name="documents-outline" size={20} color={colors.foreground} />
              <View style={styles.optionTextWrap}>
                <Text style={[styles.optionTitle, { color: colors.foreground }]}>Este e os seguintes</Text>
                <Text style={[styles.optionDesc, { color: colors.mutedForeground }]}>{verb} este e os lançamentos seguintes da série.</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity disabled={busy} style={[styles.optionBtn, { borderColor: colors.border }]} onPress={() => onSelect('all')}>
              <Ionicons name="copy-outline" size={20} color={colorBase} />
              <View style={styles.optionTextWrap}>
                <Text style={[styles.optionTitle, { color: colorBase }]}>Todas as recorrências</Text>
                <Text style={[styles.optionDesc, { color: colors.mutedForeground }]}>{verb} todos os lançamentos desta série, passados e futuros.</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  content: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 24, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '700' },
  closeBtn: { padding: 4 },
  subtitle: { fontSize: 14, marginBottom: 24, lineHeight: 20 },
  optionsContainer: { gap: 12 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, gap: 16 },
  optionTextWrap: { flex: 1 },
  optionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  optionDesc: { fontSize: 12 },
});
