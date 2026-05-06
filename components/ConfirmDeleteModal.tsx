import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

interface ConfirmDeleteModalProps {
  visible: boolean;
  title: string;
  description: string;
  onClose: () => void;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
}

export function ConfirmDeleteModal({
  visible,
  title,
  description,
  onClose,
  onConfirm,
  confirmText = 'Excluir',
  cancelText = 'Cancelar'
}: ConfirmDeleteModalProps) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity 
        activeOpacity={1} 
        style={styles.overlay} 
        onPress={onClose}
      >
        <View 
          style={[styles.content, { backgroundColor: colors.card, borderColor: colors.border }]}
          onStartShouldSetResponder={() => true} // Evita fechar ao clicar no conteúdo
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <View style={[styles.iconContainer, { backgroundColor: colors.destructive + '15' }]}>
            <Ionicons name="trash-outline" size={32} color={colors.destructive} />
          </View>
          
          <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>{description}</Text>

          <View style={styles.actions}>
            <TouchableOpacity 
              style={[styles.btn, styles.cancelBtn]} 
              onPress={onClose}
            >
              <Text style={[styles.btnText, { color: colors.mutedForeground }]}>{cancelText}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.btn, { backgroundColor: colors.destructive }]} 
              onPress={() => {
                onConfirm();
                onClose();
              }}
            >
              <Text style={[styles.btnText, { color: '#FFF', fontWeight: '700' }]}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  btn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: 'transparent',
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
