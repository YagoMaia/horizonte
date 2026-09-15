import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { AppModal } from './ui/AppModal';
import { AppButton } from './ui/AppButton';
import { FeedbackBanner } from './ui/FeedbackBanner';

interface ConfirmDeleteModalProps {
  visible: boolean;
  title: string;
  description: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  confirmText?: string;
  cancelText?: string;
}
export const ConfirmDeleteModal = React.memo(function ConfirmDeleteModal({
  visible, title, description, onClose, onConfirm, confirmText = 'Excluir', cancelText = 'Cancelar'
}: ConfirmDeleteModalProps) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  useEffect(() => { if (visible) setError(null); }, [visible]);
  const confirm = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch {
      setError('Não foi possível concluir a exclusão. Tente novamente.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <AppModal visible={visible} title={title} onClose={onClose} busy={busy}>
      <View style={[styles.icon, { backgroundColor: colors.dangerLight }]}>
        <Ionicons name="trash-outline" size={30} color={colors.destructive} accessible={false} />
      </View>
      <Text style={[styles.description, { color: colors.mutedForeground }]}>{description}</Text>
      {error && <FeedbackBanner tone="error" message={error} />}
      <AppButton label={confirmText} onPress={confirm} variant="danger" loading={busy} />
      <AppButton label={cancelText} onPress={onClose} variant="secondary" disabled={busy} />
    </AppModal>
  );
});
const styles = StyleSheet.create({
  icon: { width: 64, height: 64, borderRadius: 24, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  description: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
});
