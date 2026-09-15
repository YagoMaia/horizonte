import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Account } from '@/constants/types'
import { Colors } from '@/constants/theme'
import HomePage from '@/app/index'
import { CartaoScreen } from '@/components/screens/CartaoScreen'
import { buildTransactionIndexes } from '@/lib/transactionIndexes'

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ colors: Colors.light, isDark: false,
  themeMode: 'light', primaryColor: '#E64A19', setThemeMode: jest.fn(), setPrimaryColor: jest.fn() }) }))
jest.mock('@/context/StoreContext', () => ({ useStoreContext: () => mockStore }))
jest.mock('@/hooks/useSavingsGoals', () => ({ useSavingsGoals: () => mockSavings }))
jest.mock('@/hooks/useTrips', () => ({ useTrips: () => ({ trips: [] }) }))
jest.mock('@/components/AddTransactionModal', () => ({
  AddTransactionModal: ({ visible, initialAccountId }: any) => {
    const React = require('react')
    const { Text } = require('react-native')
    return visible ? React.createElement(Text, { testID: 'new-transaction' }, initialAccountId ?? 'sem-conta') : null
  },
}))
jest.mock('@/components/TransactionDetailModal', () => ({ TransactionDetailModal: () => null }))
jest.mock('@/components/RecurrenceActionModal', () => ({ RecurrenceActionModal: () => null }))
jest.mock('@/components/TripFormModal', () => ({ TripFormModal: () => null }))
jest.mock('@/components/screens/HorizonteScreen', () => ({ HorizonteScreen: () => {
  const { Text } = require('react-native'); return <Text>Projeção aberta</Text>
} }))
jest.mock('@/components/screens/ContasScreen', () => ({ ContasScreen: () => {
  const { Text } = require('react-native'); return <Text>Contas abertas</Text>
} }))
jest.mock('@/components/screens/GoalsScreen', () => ({ GoalsScreen: () => {
  const { Text } = require('react-native'); return <Text>Metas abertas</Text>
} }))
jest.mock('@/components/screens/GoalDetailScreen', () => ({ GoalDetailScreen: () => null }))
jest.mock('@/components/screens/ReportsScreen', () => ({ ReportsScreen: () => {
  const { Text } = require('react-native'); return <Text>Análises abertas</Text>
} }))
jest.mock('@/components/screens/OrcamentoScreen', () => ({ OrcamentoScreen: () => {
  const { Text } = require('react-native'); return <Text>Orçamento aberto</Text>
} }))
jest.mock('@/components/screens/ViagensScreen', () => ({ ViagensScreen: () => {
  const { Text } = require('react-native'); return <Text>Viagens abertas</Text>
} }))
jest.mock('@/components/screens/TripDetailScreen', () => ({ TripDetailScreen: () => null }))

const mockAccounts: Account[] = [
  { id: 'bank', name: 'Conta corrente', type: 'corrente', balance: 2000, color: '#1976D2', icon: 'wallet' },
  { id: 'card-a', name: 'Cartão A', type: 'cartao_credito', balance: 0, color: '#388E3C', icon: 'card',
    closingDay: 10, dueDay: 17, creditLimit: 3000 },
  { id: 'card-b', name: 'Cartão B', type: 'cartao_credito', balance: 0, color: '#7B1FA2', icon: 'card',
    closingDay: 15, dueDay: 22, creditLimit: 5000 },
]
const mockStore = { accounts: mockAccounts, transactions: [], loading: false, totalBalance: 2000,
  transactionIndexes: buildTransactionIndexes([]),
  addTransaction: jest.fn(), monthlyBudgets: {}, clearAllData: jest.fn() }
const mockSavings = { goals: [], deposits: [], loading: false, processOverdueRecurrences: jest.fn(),
  syncWithTransactions: jest.fn(), addDeposit: jest.fn() }

beforeEach(() => { mockStore.accounts = mockAccounts })

test('opens the tapped credit card from Home and uses it for the next transaction', async () => {
  render(<HomePage />)
  fireEvent.press(await screen.findByRole('button', { name: 'Abrir cartão Cartão B' }))
  expect(screen.getByRole('tab', { name: 'Cartão B' }).props.accessibilityState.selected).toBe(true)
  expect(screen.getByRole('tab', { name: 'Todos os cartões' }).props.accessibilityState.selected).toBe(false)
  fireEvent.press(screen.getByRole('button', { name: 'Novo lançamento' }))
  expect(screen.getByTestId('new-transaction').props.children).toBe('card-b')
})

test('can open another card after returning Home; ordinary accounts have no card action', async () => {
  render(<HomePage />)
  expect(screen.queryByRole('button', { name: 'Abrir cartão Conta corrente' })).toBeNull()
  fireEvent.press(await screen.findByRole('button', { name: 'Abrir cartão Cartão B' }))
  fireEvent.press(screen.getByRole('tab', { name: 'Início' }))
  fireEvent.press(await screen.findByRole('button', { name: 'Abrir cartão Cartão A' }))
  expect(screen.getByRole('tab', { name: 'Cartão A' }).props.accessibilityState.selected).toBe(true)
})

test('opening Cards through Menu retains the default consolidated view', async () => {
  render(<HomePage />)
  fireEvent.press(await screen.findByRole('button', { name: 'Abrir cartão Cartão B' }))
  fireEvent.press(screen.getByRole('tab', { name: 'Menu' }))
  fireEvent.press(screen.getByRole('button', { name: 'Cartões' }))
  expect(screen.getByRole('tab', { name: 'Todos os cartões' }).props.accessibilityState.selected).toBe(true)
})

test('all primary destinations and Menu shortcuts remain reachable', async () => {
  render(<HomePage />)
  fireEvent.press(screen.getByRole('tab', { name: 'Horizonte' }))
  expect(screen.getByText('Projeção aberta')).toBeTruthy()
  fireEvent.press(screen.getByRole('tab', { name: 'Metas' }))
  expect(screen.getByText('Metas abertas')).toBeTruthy()
  for (const [label, destination] of [['Orçamento', 'Orçamento aberto'], ['Análises', 'Análises abertas'], ['Viagens', 'Viagens abertas']]) {
    fireEvent.press(screen.getByRole('tab', { name: 'Menu' }))
    fireEvent.press(screen.getByRole('button', { name: label }))
    expect(screen.getByText(destination)).toBeTruthy()
  }
  fireEvent.press(screen.getByRole('button', { name: 'Gerenciar contas' }))
  expect(screen.getByText('Contas abertas')).toBeTruthy()
  fireEvent.press(screen.getByRole('tab', { name: 'Início' }))
  expect(await screen.findByText('Seu amanhã começa aqui.')).toBeTruthy()
})

test('invalid initial IDs fall back; removing the selected card selects the remaining card', async () => {
  const onSelectCard = jest.fn()
  const result = render(<CartaoScreen initialCardId="bank" onSelectCard={onSelectCard} />)
  expect(screen.getByRole('tab', { name: 'Todos os cartões' }).props.accessibilityState.selected).toBe(true)
  fireEvent.press(screen.getByRole('tab', { name: 'Cartão B' }))
  expect(onSelectCard).toHaveBeenLastCalledWith(mockAccounts[2])
  mockStore.accounts = mockAccounts.slice(0, 2)
  result.rerender(<CartaoScreen onSelectCard={onSelectCard} />)
  await waitFor(() => expect(onSelectCard).toHaveBeenLastCalledWith(mockAccounts[1]))
})
