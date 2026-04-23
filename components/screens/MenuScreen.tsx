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
  const { accounts, transactions, tags, totalBalance, clearAllData } = useStoreContext()

  // --- FUNÇÃO DE EXPORTAÇÃO HÍBRIDA (MOBILE + WEB) ---
  const handleExportData = async () => {
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

      const fileName = `Horizonte_Export_${new Date().getTime()}.csv`

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

      const fileUri = FileSystem.cacheDirectory + fileName
      await FileSystem.writeAsStringAsync(fileUri, csvString, {
        encoding: FileSystem.EncodingType.UTF8,
      })

      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Exportar dados Financeiros',
        UTI: 'public.comma-separated-values-text',
      })

    } catch (error) {
      console.error(error)
      const msg = 'Não foi possível exportar os dados.'
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Erro', msg)
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

        {/* 👉 NOVO BOTÃO DE GERENCIAR TAGS */}
        <MenuItem
          icon="pricetags-outline"
          label="Gerenciar Tags"
          onPress={onNavigateToTags}
          colors={colors}
        />

        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
          <MenuItem
            icon="moon-outline"
            label="Tema escuro"
            value="Automático"
            colors={colors}
          />
        </View>
        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
          <MenuItem
            icon="language-outline"
            label="Idioma"
            value="Português (BR)"
            colors={colors}
          />
        </View>
        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
          <MenuItem
            icon="cash-outline"
            label="Moeda"
            value="BRL (R$)"
            colors={colors}
          />
        </View>
      </View>

      {/* Dados */}
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>DADOS</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MenuItem
          icon="cloud-download-outline"
          label="Exportar para Excel"
          onPress={handleExportData}
          colors={colors}
        />
      </View>

      {/* About */}
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>SOBRE</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MenuItem
          icon="information-circle-outline"
          label="Versão"
          value="1.0.0"
          colors={colors}
        />
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
              if (window.confirm('Atenção: Isso irá apagar todos os seus dados permanentemente. Tem certeza?')) {
                clearAllData()
              }
            } else {
              Alert.alert(
                'Atenção',
                'Isso irá apagar todos os seus dados permanentemente. Tem certeza?',
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Apagar', style: 'destructive', onPress: clearAllData }
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
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 8,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 8,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '700',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
  },
  profileSub: {
    fontSize: 13,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    gap: 2,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginTop: 8,
    marginLeft: 4,
  },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
  },
  menuValue: {
    fontSize: 14,
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 8,
  },
})