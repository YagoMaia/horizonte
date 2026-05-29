// components/screens/MenuScreen.tsx
import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  Switch,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { formatCurrency } from '@/lib/utils'
import { useStoreContext } from '@/context/StoreContext'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import * as DocumentPicker from 'expo-document-picker'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Notifications from 'expo-notifications'
import { requestPermissions } from '@/services/notificationService'
import { PRIMARY_COLORS } from '@/constants/theme'
import { TagManagementModal } from '../TagManagementModal'
import { AdjustmentManagementModal } from '../AdjustmentManagementModal'

interface MenuItemProps {
  icon: string
  label: string
  value?: string
  onPress?: () => void
  danger?: boolean
  colors: any
}

function MenuItem({ icon, label, value, onPress, danger, colors }: MenuItemProps) {
  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <View style={[styles.menuIcon, { backgroundColor: danger ? colors.dangerLight : colors.secondary }]}>
        <Ionicons
          name={icon as any}
          size={18}
          color={danger ? colors.destructive : colors.primary}
        />
      </View>
      <Text style={[styles.menuLabel, { color: danger ? colors.destructive : colors.foreground }]}>
        {label}
      </Text>
      {value && (
        <Text style={[styles.menuValue, { color: colors.mutedForeground }]}>{value}</Text>
      )}
      {onPress && (
        <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
      )}
    </TouchableOpacity>
  )
}

interface MenuScreenProps {
  onNavigateToAccounts: () => void
  onNavigateToProjects: () => void
  onNavigateToMetas: () => void
  onNavigateToHomeLayout: () => void
}

export function MenuScreen({ onNavigateToAccounts, onNavigateToProjects, onNavigateToMetas, onNavigateToHomeLayout }: MenuScreenProps) {
  const { colors, themeMode, setThemeMode, primaryColor, setPrimaryColor } = useTheme()
  // Puxamos a função 'monthlyBudgets' caso você a tenha exportado no StoreContext
  const { 
    accounts, 
    transactions, 
    tags, // 👉 Puxando tags para o backup
    monthlyBudgets, 
    totalBalance, 
    clearAllData,
    syncBalances,
    purgeAdjustments,
    notificationPreferences,
    toggleNotificationPreference,
    updateNotificationTime
  } = useStoreContext()

  const [themeModalVisible, setThemeModalVisible] = useState(false)
  const [colorModalVisible, setColorModalVisible] = useState(false)
  const [tagModalVisible, setTagModalVisible] = useState(false) // 👉 Novo estado
  const [adjustmentModalVisible, setAdjustmentModalVisible] = useState(false) // 👉 Novo estado
  const [timePickerVisible, setTimePickerVisible] = useState(false)
  const [editingTimeKey, setEditingTimeKey] = useState<'dailyReminderTime' | 'expenseReminderTime' | 'creditCardAlertTime' | null>(null)
  const [tempHour, setTempHour] = useState(0)
  const [tempMinute, setTempMinute] = useState(0)

  const openTimePicker = (key: 'dailyReminderTime' | 'expenseReminderTime' | 'creditCardAlertTime') => {
    const time = notificationPreferences[key] || { hour: 0, minute: 0 }
    setTempHour(time.hour)
    setTempMinute(time.minute)
    setEditingTimeKey(key)
    setTimePickerVisible(true)
  }

  const handleSaveTime = async () => {
    if (editingTimeKey) {
      await updateNotificationTime(editingTimeKey, tempHour, tempMinute)
      setTimePickerVisible(false)
      setEditingTimeKey(null)
    }
  }

  const formatTime = (time: { hour: number; minute: number }) => {
    if (!time) return '00:00'
    return `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`
  }

  const themeModeLabel = {
    light: 'Claro',
    dark: 'Escuro',
    system: 'Automático'
  }[themeMode]

  const currentColorLabel = PRIMARY_COLORS.find(c => c.value === primaryColor)?.label || 'Customizada'

  const handleSyncBalances = async () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Isso irá recalcular o saldo de todas as suas contas com base no histórico de transações. Deseja continuar?')) {
        await syncBalances(transactions, accounts);
        alert('Saldos sincronizados com sucesso!');
      }
    } else {
      Alert.alert(
        'Sincronizar Saldos',
        'Isso irá recalcular o saldo de todas as suas contas com base no histórico de transações. Útil para corrigir erros de integridade. Deseja continuar?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { 
            text: 'Sincronizar', 
            onPress: async () => {
              await syncBalances(transactions, accounts);
              Alert.alert('Sucesso', 'Saldos sincronizados com sucesso!');
            } 
          }
        ]
      )
    }
  }

  const handlePurgeAdjustments = async () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Isso irá EXCLUIR TODOS os lançamentos de Ajuste de Saldo do seu histórico. Use com cuidado. Deseja continuar?')) {
        await purgeAdjustments();
        alert('Ajustes removidos com sucesso!');
      }
    } else {
      Alert.alert(
        'Limpar Ajustes de Saldo',
        'Isso irá EXCLUIR TODOS os lançamentos de Ajuste de Saldo do seu histórico. Use com cuidado. Deseja continuar?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { 
            text: 'Limpar Ajustes', 
            style: 'destructive',
            onPress: async () => {
              await purgeAdjustments();
              Alert.alert('Sucesso', 'Ajustes removidos com sucesso!');
            } 
          }
        ]
      )
    }
  }

  const handleTestNotification = async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Notificação de Teste 🚀',
          body: 'Isso é um teste de notificação funcionando no Android 13+!',
          sound: true,
        },
        trigger: {
          seconds: 5,
          channelId: 'default',
        },
      });
      if (Platform.OS === 'web') {
        alert('A notificação aparecerá em 5 segundos.');
      } else {
        Alert.alert('Sucesso', 'A notificação aparecerá em 5 segundos. Oculte o app para testar em segundo plano.');
      }
    } catch (error) {
      console.error(error);
      if (Platform.OS === 'web') alert('Erro ao agendar a notificação de teste.');
      else Alert.alert('Erro', 'Não foi possível agendar a notificação de teste.');
    }
  }

  // --- EXPORTAR PARA EXCEL (CSV) ---
  const handleExportCSV = async () => {
    try {
      if (transactions.length === 0) {
        Alert.alert('Aviso', 'Não há dados para exportar.')
        return
      }

      const BOM = '\uFEFF';
      let csvString = BOM + 'Data;Tipo;Descricao;Valor;Conta;Tag;Status\n'

      transactions.forEach((tx) => {
        const dateObj = new Date(tx.date)
        const day = String(dateObj.getDate()).padStart(2, '0')
        const month = String(dateObj.getMonth() + 1).padStart(2, '0')
        const year = dateObj.getFullYear()
        const formattedDate = `${day}/${month}/${year}`

        const type = tx.type === 'receita' ? 'Receita' : 'Despesa'
        const amount = tx.amount.toFixed(2).replace('.', ',')
        const account = accounts.find((a) => a.id === tx.accountId)?.name || 'N/A'
        const tag = (tx as any).tag || 'N/A'
        const status = tx.paid ? 'Pago' : 'Pendente'

        const cleanDescription = tx.description.replace(/;/g, ',')

        csvString += `${formattedDate};${type};${cleanDescription};${amount};${account};${tag};${status}\n`
      })

      const fileName = `Horizonte_Relatorio_${new Date().getTime()}.csv`

      if (Platform.OS === 'web') {
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', fileName)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        return
      }

      const fileUri = FileSystem.documentDirectory + fileName
      await FileSystem.writeAsStringAsync(fileUri, csvString, {
        encoding: FileSystem.EncodingType.UTF8,
      })

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Exportar Relatório Excel' })
      }
    } catch (error) {
      console.error(error)
      Alert.alert('Erro', 'Não foi possível exportar os dados para CSV.')
    }
  }

  // --- CRIAR BACKUP (JSON COMPLETO) ---
  const handleCreateBackup = async () => {
    try {
      // Reúne todos os dados estruturais do aplicativo
      const backupData = {
        version: "1.0",
        timestamp: new Date().toISOString(),
        data: {
          accounts,
          transactions,
          tags, // 👉 Incluindo tags no backup
          monthlyBudgets: monthlyBudgets || {}
        }
      };

      const jsonString = JSON.stringify(backupData);
      const fileName = `Horizonte_Backup_${new Date().getTime()}.json`;

      if (Platform.OS === 'web') {
        const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      // Usa documentDirectory para arquivos que o usuário deve ter acesso/compartilhar
      const fileUri = FileSystem.documentDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, jsonString, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Salvar Backup Seguro' });
      } else {
        Alert.alert('Aviso', 'O compartilhamento de arquivos não está disponível neste dispositivo.');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Erro', 'Falha ao criar o arquivo de backup.');
    }
  }

  // --- RESTAURAR BACKUP (LÊ JSON E SOBRESCREVE) ---
  const handleRestoreBackup = async () => {
    try {
      let fileContent: string;

      if (Platform.OS === 'web') {
        const result = await DocumentPicker.getDocumentAsync({
          type: 'application/json',
        });

        if (result.canceled || !result.assets || result.assets.length === 0) return;

        const file = result.assets[0].file;
        if (!file) {
          Alert.alert('Erro', 'Não foi possível acessar o arquivo selecionado.');
          return;
        }

        fileContent = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = (e) => reject(new Error('Erro ao ler arquivo'));
          reader.readAsText(file);
        });
      } else {
        // 1. Pede para o usuário escolher o arquivo
        const result = await DocumentPicker.getDocumentAsync({
          type: 'application/json',
          copyToCacheDirectory: true,
        });

        if (result.canceled || !result.assets || result.assets.length === 0) return;

        const fileUri = result.assets[0].uri;
        fileContent = await FileSystem.readAsStringAsync(fileUri);
      }
      
      // 2. Faz o parse do JSON
      let parsedData;
      try {
        parsedData = JSON.parse(fileContent);
      } catch (e) {
        Alert.alert('Erro', 'O arquivo selecionado não é um backup válido do Horizonte.');
        return;
      }

      // 3. Valida a estrutura básica do arquivo
      const extractedData = parsedData.data ? parsedData.data : parsedData; // Compatibilidade legada
      if (!extractedData.accounts || !extractedData.transactions) {
        Alert.alert('Erro', 'O arquivo de backup está corrompido ou incompleto.');
        return;
      }

      const performRestore = async () => {
        try {
          // Gravamos diretamente no AsyncStorage para garantir integridade estrutural
          await AsyncStorage.setItem('@horizonte:accounts', JSON.stringify(extractedData.accounts));
          await AsyncStorage.setItem('@horizonte:transactions', JSON.stringify(extractedData.transactions));
          if (extractedData.tags) {
            await AsyncStorage.setItem('@horizonte:tags', JSON.stringify(extractedData.tags));
          }
          if (extractedData.monthlyBudgets) {
            await AsyncStorage.setItem('@horizonte:monthly_budgets', JSON.stringify(extractedData.monthlyBudgets));
          }

          // Exige recarregamento para que os React Hooks puxem a nova base limpa
          const successMessage = Platform.OS === 'web' 
            ? 'Backup restaurado com sucesso! A página será recarregada.' 
            : 'Backup restaurado. Por favor, feche e abra o aplicativo novamente para carregar os novos dados.';
          
          Alert.alert('Sucesso!', successMessage);
          
          if (Platform.OS === 'web') {
            setTimeout(() => window.location.reload(), 1500);
          }
        } catch (err) {
          Alert.alert('Erro', 'Falha ao gravar os dados restaurados no dispositivo.');
        }
      };

      // 4. Confirmação crítica de substituição
      if (Platform.OS === 'web') {
        if (window.confirm(`Isso irá apagar todos os dados atuais e restaurar o backup com ${extractedData.transactions.length} lançamentos. Tem certeza?`)) {
          await performRestore();
        }
      } else {
        Alert.alert(
          'Restaurar Dados',
          `Isso irá apagar todos os dados atuais e restaurar o backup com ${extractedData.transactions.length} lançamentos. Tem certeza?`,
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Sim, Restaurar',
              style: 'destructive',
              onPress: performRestore
            }
          ]
        );
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Erro', 'Ocorreu um problema ao tentar ler o arquivo de backup.');
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile */}
      <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>H</Text>
        </View>
        <View>
          <Text style={[styles.profileName, { color: colors.foreground }]}>Horizonte</Text>
          <Text style={[styles.profileSub, { color: colors.mutedForeground }]}>
            Gestão Financeira Pessoal
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.foreground }]}>{accounts.length}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Contas</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.foreground }]}>{transactions.length}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Lançamentos</Text>
        </View>
      </View>

      {/* Settings - Gerenciamento */}
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>GERENCIAMENTO</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MenuItem 
          icon="wallet-outline" 
          label="Gerenciar Contas" 
          onPress={onNavigateToAccounts}
          colors={colors} 
        />
        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
          <MenuItem
            icon="folder-open-outline"
            label="Gerenciar Projetos"
            colors={colors}
            onPress={onNavigateToProjects}
          />
        </View>
        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
          <MenuItem
            icon="flag-outline"
            label="Gerenciar Metas"
            colors={colors}
            onPress={onNavigateToMetas}
          />
        </View>
        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
          <MenuItem 
            icon="pricetags-outline" 
            label="Gerenciar Categorias" 
            onPress={() => setTagModalVisible(true)}
            colors={colors} 
          />
        </View>
        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
          <MenuItem 
            icon="construct-outline" 
            label="Ajustes de Saldo" 
            onPress={() => setAdjustmentModalVisible(true)}
            colors={colors} 
          />
        </View>
      </View>

      {/* Settings - Aparência */}
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>APARÊNCIA</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MenuItem 
          icon="options-outline" 
          label="Personalizar Tela Inicial" 
          onPress={onNavigateToHomeLayout}
          colors={colors} 
        />
        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
          <MenuItem 
            icon="moon-outline" 
            label="Tema escuro" 
            value={themeModeLabel} 
            onPress={() => setThemeModalVisible(true)}
            colors={colors} 
          />
        </View>
        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
          <MenuItem 
            icon="color-palette-outline" 
            label="Cor principal" 
            value={currentColorLabel} 
            onPress={() => setColorModalVisible(true)}
            colors={colors} 
          />
        </View>
      </View>

      {/* Notificações */}
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>NOTIFICAÇÕES</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.switchItem}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Text style={[styles.switchLabel, { color: colors.foreground }]}>Lembretes Diários</Text>
            <Text style={[styles.switchDesc, { color: colors.mutedForeground }]}>Lembrar de registrar os gastos do dia.</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity 
              onPress={() => openTimePicker('dailyReminderTime')}
              disabled={!(notificationPreferences?.dailyReminders ?? true)}
              style={[
                styles.editIconContainer, 
                { opacity: (notificationPreferences?.dailyReminders ?? true) ? 1 : 0.3 }
              ]}
            >
              <Ionicons name="pencil" size={20} color="#FFF" />
            </TouchableOpacity>
            <Switch
              value={notificationPreferences?.dailyReminders ?? true}
              onValueChange={async (val) => {
                const granted = await requestPermissions()
                if (granted) {
                  await toggleNotificationPreference('dailyReminders', val)
                } else {
                  if (Platform.OS === 'web') alert('Permissão necessária para notificações.');
                  else Alert.alert('Erro', 'Permissão de notificação negada.');
                }
              }}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        </View>

        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
          <View style={styles.switchItem}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={[styles.switchLabel, { color: colors.foreground }]}>Lembrete de Despesas</Text>
              <Text style={[styles.switchDesc, { color: colors.mutedForeground }]}>Avisar sobre o pagamento de despesas registradas.</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity 
                onPress={() => openTimePicker('expenseReminderTime')}
                disabled={!(notificationPreferences?.expenseReminders ?? true)}
                style={[
                  styles.editIconContainer, 
                  { opacity: (notificationPreferences?.expenseReminders ?? true) ? 1 : 0.3 }
                ]}
              >
                <Ionicons name="pencil" size={20} color="#FFF" />
              </TouchableOpacity>
              <Switch
                value={notificationPreferences?.expenseReminders ?? true}
                onValueChange={async (val) => {
                  const granted = await requestPermissions()
                  if (granted) {
                    await toggleNotificationPreference('expenseReminders', val)
                  } else {
                    if (Platform.OS === 'web') alert('Permissão necessária para notificações.');
                    else Alert.alert('Erro', 'Permissão de notificação negada.');
                  }
                }}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>
          </View>
        </View>

        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
          <View style={styles.switchItem}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={[styles.switchLabel, { color: colors.foreground }]}>Alertas de Cartão</Text>
              <Text style={[styles.switchDesc, { color: colors.mutedForeground }]}>Avisar sobre o vencimento da fatura dos cartões.</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity 
                onPress={() => openTimePicker('creditCardAlertTime')}
                disabled={!(notificationPreferences?.creditCardAlerts ?? true)}
                style={[
                  styles.editIconContainer, 
                  { opacity: (notificationPreferences?.creditCardAlerts ?? true) ? 1 : 0.3 }
                ]}
              >
                <Ionicons name="pencil" size={20} color="#FFF" />
              </TouchableOpacity>
              <Switch
                value={notificationPreferences?.creditCardAlerts ?? true}
                onValueChange={async (val) => {
                  const granted = await requestPermissions()
                  if (granted) {
                    await toggleNotificationPreference('creditCardAlerts', val)
                  } else {
                    if (Platform.OS === 'web') alert('Permissão necessária para notificações.');
                    else Alert.alert('Erro', 'Permissão de notificação negada.');
                  }
                }}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>
          </View>
        </View>
        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
          <MenuItem
            icon="flask-outline"
            label="Enviar Notificação de Teste"
            onPress={handleTestNotification}
            colors={colors}
          />
        </View>
      </View>

      {/* Dados e Backup (NOVA SESSÃO) */}
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>BACKUP E EXPORTAÇÃO</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MenuItem
          icon="download-outline"
          label="Criar Backup de Segurança"
          onPress={handleCreateBackup}
          colors={colors}
        />
        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
          <MenuItem
            icon="push-outline"
            label="Restaurar Backup"
            onPress={handleRestoreBackup}
            colors={colors}
          />
        </View>
        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
          <MenuItem
            icon="document-text-outline"
            label="Exportar para Excel (CSV)"
            onPress={handleExportCSV}
            colors={colors}
          />
        </View>
      </View>

      {/* Danger zone */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 8 }]}>
        <MenuItem
          icon="sync-outline"
          label="Sincronizar Saldos (Correção)"
          onPress={handleSyncBalances}
          colors={colors}
        />
        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
          <MenuItem
            icon="beaker-outline"
            label="Limpar Ajustes de Saldo"
            onPress={handlePurgeAdjustments}
            colors={colors}
          />
        </View>
        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
          <MenuItem
            icon="trash-outline"
            label="Limpar todos os dados"
            onPress={() => {
              if (Platform.OS === 'web') {
                if (window.confirm('Atenção: Isso irá apagar todos os dados permanentemente. Tem certeza?')) {
                  clearAllData()
                }
              } else {
                Alert.alert(
                  'Atenção Crítica',
                  'Isso irá apagar todos os seus dados permanentemente e não pode ser desfeito. Faça um backup antes. Tem certeza?',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Apagar Tudo', style: 'destructive', onPress: clearAllData }
                  ]
                )
              }
            }}
            danger
            colors={colors}
          />
        </View>
      </View>

      <Text style={[styles.footer, { color: colors.mutedForeground }]}>
        Horizonte · Gestão Financeira Pessoal
      </Text>
      <View style={{ height: 20 }} />

      {/* Modais de Tema e Cor */}
      <Modal visible={themeModalVisible} transparent animationType="fade" onRequestClose={() => setThemeModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Tema Escuro</Text>
            {[
              { id: 'system', label: 'Automático (Sistema)' },
              { id: 'light', label: 'Desativado (Claro)' },
              { id: 'dark', label: 'Ativado (Escuro)' }
            ].map(option => (
              <TouchableOpacity
                key={option.id}
                style={[styles.modalOption, themeMode === option.id && { backgroundColor: colors.primary + '15' }]}
                onPress={() => {
                  setThemeMode(option.id as any);
                  setThemeModalVisible(false);
                }}
              >
                <Text style={{ color: themeMode === option.id ? colors.primary : colors.foreground, fontSize: 16, fontWeight: themeMode === option.id ? '700' : '500' }}>
                  {option.label}
                </Text>
                {themeMode === option.id && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setThemeModalVisible(false)}>
              <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={colorModalVisible} transparent animationType="fade" onRequestClose={() => setColorModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Cor Principal</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, marginBottom: 24 }}>
              {PRIMARY_COLORS.map(color => (
                <TouchableOpacity
                  key={color.value}
                  style={[styles.colorCircle, { backgroundColor: color.value }, primaryColor === color.value && { borderWidth: 3, borderColor: colors.foreground }]}
                  onPress={() => {
                    setPrimaryColor(color.value);
                    setColorModalVisible(false);
                  }}
                />
              ))}
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setColorModalVisible(false)}>
              <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <TagManagementModal 
        visible={tagModalVisible} 
        onClose={() => setTagModalVisible(false)} 
      />
      <AdjustmentManagementModal
        visible={adjustmentModalVisible}
        onClose={() => setAdjustmentModalVisible(false)}
      />

      <Modal visible={timePickerVisible} transparent animationType="fade" onRequestClose={() => setTimePickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Selecionar Horário</Text>
            
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 24, marginBottom: 32 }}>
              <View style={{ alignItems: 'center', gap: 12 }}>
                <TouchableOpacity onPress={() => setTempHour(h => (h + 1) % 24)}>
                  <Ionicons name="chevron-up" size={32} color={colors.primary} />
                </TouchableOpacity>
                <Text style={{ fontSize: 42, fontWeight: '700', color: colors.foreground }}>
                  {String(tempHour).padStart(2, '0')}
                </Text>
                <TouchableOpacity onPress={() => setTempHour(h => (h - 1 + 24) % 24)}>
                  <Ionicons name="chevron-down" size={32} color={colors.primary} />
                </TouchableOpacity>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, fontWeight: '600' }}>HORA</Text>
              </View>

              <Text style={{ fontSize: 42, fontWeight: '700', color: colors.foreground, marginTop: -20 }}>:</Text>

              <View style={{ alignItems: 'center', gap: 12 }}>
                <TouchableOpacity onPress={() => setTempMinute(m => (m + 5) % 60)}>
                  <Ionicons name="chevron-up" size={32} color={colors.primary} />
                </TouchableOpacity>
                <Text style={{ fontSize: 42, fontWeight: '700', color: colors.foreground }}>
                  {String(tempMinute).padStart(2, '0')}
                </Text>
                <TouchableOpacity onPress={() => setTempMinute(m => (m - 5 + 60) % 60)}>
                  <Ionicons name="chevron-down" size={32} color={colors.primary} />
                </TouchableOpacity>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, fontWeight: '600' }}>MIN</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity 
                style={[styles.modalCloseBtn, { flex: 1, borderTopWidth: 0 }]} 
                onPress={() => setTimePickerVisible(false)}
              >
                <Text style={{ color: colors.mutedForeground, fontSize: 16, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalCloseBtn, { flex: 1, borderTopWidth: 0 }]} 
                onPress={handleSaveTime}
              >
                <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '700' }}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 8 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 8 },
  avatar: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFF', fontSize: 22, fontWeight: '700' },
  profileName: { fontSize: 18, fontWeight: '700' },
  profileSub: { fontSize: 13, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  statCard: { flex: 1, alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingVertical: 14, gap: 2 },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 11 },
  sectionTitle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginTop: 8, marginLeft: 4 },
  section: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  menuIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '400' },
  menuValue: { fontSize: 14 },
  switchItem: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  switchLabel: { fontSize: 15, fontWeight: '500' },
  switchDesc: { fontSize: 12, marginTop: 4 },
  timeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  footer: { textAlign: 'center', fontSize: 12, marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', borderRadius: 20, borderWidth: 1, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  modalOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8 },
  modalCloseBtn: { alignItems: 'center', paddingTop: 16, marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.1)' },
  colorCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  editIconContainer: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
})