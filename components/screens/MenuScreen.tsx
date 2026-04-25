// components/screens/MenuScreen.tsx
import React from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { formatCurrency } from '@/lib/utils'
import { useStoreContext } from '@/context/StoreContext'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import * as DocumentPicker from 'expo-document-picker'
import AsyncStorage from '@react-native-async-storage/async-storage'

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
  onNavigateToTags: () => void;
}

export function MenuScreen({ onNavigateToTags }: MenuScreenProps) {
  const { colors } = useTheme()
  // Puxamos a função 'monthlyBudgets' caso você a tenha exportado no StoreContext
  const { accounts, transactions, tags, monthlyBudgets, totalBalance, clearAllData } = useStoreContext()

  // --- EXPORTAR PARA EXCEL (CSV) ---
  const handleExportCSV = async () => {
    try {
      if (transactions.length === 0) {
        Alert.alert('Aviso', 'Não há dados para exportar.')
        return
      }

      const BOM = '\uFEFF';
      let csvString = BOM + 'Data;Tipo;Descricao;Valor;Categoria;Conta;Status\n'

      transactions.forEach((tx) => {
        const dateObj = new Date(tx.date)
        const day = String(dateObj.getDate()).padStart(2, '0')
        const month = String(dateObj.getMonth() + 1).padStart(2, '0')
        const year = dateObj.getFullYear()
        const formattedDate = `${day}/${month}/${year}`

        const type = tx.type === 'receita' ? 'Receita' : 'Despesa'
        const amount = tx.amount.toFixed(2).replace('.', ',')
        const category = tags.find((t) => t.id === tx.tagIds[0])?.name || 'Sem Categoria'
        const account = accounts.find((a) => a.id === tx.accountId)?.name || 'N/A'
        const status = tx.paid ? 'Pago' : 'Pendente'

        const cleanDescription = tx.description.replace(/;/g, ',')

        csvString += `${formattedDate};${type};${cleanDescription};${amount};${category};${account};${status}\n`
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
          tags,
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
      if (Platform.OS === 'web') {
        alert('A restauração de backup via arquivo ainda não está suportada na web.');
        return;
      }

      // 1. Pede para o usuário escolher o arquivo
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const fileUri = result.assets[0].uri;
      const fileContent = await FileSystem.readAsStringAsync(fileUri);
      
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

      // 4. Confirmação crítica de substituição
      Alert.alert(
        'Restaurar Dados',
        `Isso irá apagar todos os dados atuais e restaurar o backup com ${extractedData.transactions.length} lançamentos. Tem certeza?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Sim, Restaurar',
            style: 'destructive',
            onPress: async () => {
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
                Alert.alert(
                  'Sucesso!', 
                  'Backup restaurado. Por favor, feche e abra o aplicativo novamente para carregar os novos dados.'
                );
              } catch (err) {
                Alert.alert('Erro', 'Falha ao gravar os dados restaurados no dispositivo.');
              }
            }
          }
        ]
      );
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
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.foreground }]}>{tags.length}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Tags</Text>
        </View>
      </View>

      {/* Accounts section */}
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>CONTAS</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {accounts.map((acc, idx) => (
          <View
            key={acc.id}
            style={[
              styles.menuItem,
              idx < accounts.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }
            ]}
          >
            <View style={[styles.menuIcon, { backgroundColor: acc.color + '20' }]}>
              <Ionicons name={acc.icon as any} size={18} color={acc.color} />
            </View>
            <Text style={[styles.menuLabel, { color: colors.foreground }]}>{acc.name}</Text>
            <Text style={[styles.menuValue, { color: colors.mutedForeground }]}>
              {formatCurrency(acc.balance)}
            </Text>
          </View>
        ))}
        <View style={[styles.menuItem, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
          <View style={[styles.menuIcon, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="wallet" size={18} color={colors.primary} />
          </View>
          <Text style={[styles.menuLabel, { color: colors.foreground, fontWeight: '600' }]}>Total</Text>
          <Text style={[styles.menuValue, { color: colors.primary, fontWeight: '700' }]}>
            {formatCurrency(totalBalance)}
          </Text>
        </View>
      </View>

      {/* Settings */}
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>CONFIGURAÇÕES</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MenuItem icon="pricetags-outline" label="Gerenciar Tags" onPress={onNavigateToTags} colors={colors} />
        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
          <MenuItem icon="moon-outline" label="Tema escuro" value="Automático" colors={colors} />
        </View>
        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
          <MenuItem icon="language-outline" label="Idioma" value="Português (BR)" colors={colors} />
        </View>
        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
          <MenuItem icon="cash-outline" label="Moeda" value="BRL (R$)" colors={colors} />
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

      {/* About */}
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>SOBRE</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MenuItem icon="information-circle-outline" label="Versão" value="1.1.0" colors={colors} />
        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
          <MenuItem
            icon="star-outline"
            label="Avaliar o app"
            onPress={() => Alert.alert('Obrigado!', 'Sua avaliação é muito importante para nós 🧡')}
            colors={colors}
          />
        </View>
      </View>

      {/* Danger zone */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 8 }]}>
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

      <Text style={[styles.footer, { color: colors.mutedForeground }]}>
        Horizonte · Gestão Financeira Pessoal
      </Text>
      <View style={{ height: 20 }} />
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
  footer: { textAlign: 'center', fontSize: 12, marginTop: 8 },
})