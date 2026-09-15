import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Colors } from '@/constants/theme'
import { SavingsGoal } from '@/constants/types'
import { AppButton } from '@/components/ui/AppButton'
import { FormField } from '@/components/ui/FormField'
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal'
import { GoalFormModal } from '@/components/GoalFormModal'
import { GoalsScreen } from '@/components/screens/GoalsScreen'

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ colors: Colors.light }) }))

test('busy buttons expose state and suppress duplicate actions', () => {
  const onPress = jest.fn()
  render(<AppButton label="Salvar" onPress={onPress} loading />)
  const button = screen.getByRole('button', { name: 'Salvar' })
  expect(button.props.accessibilityState).toEqual({ disabled: true, busy: true })
  fireEvent.press(button)
  expect(onPress).not.toHaveBeenCalled()
})

test('fields retain their label and announce validation errors', () => {
  render(<FormField label="Nome" value="" error="Informe o nome" />)
  expect(screen.getByLabelText('Nome').props.accessibilityHint).toBe('Informe o nome')
  expect(screen.getByRole('alert').props.children).toBe('Informe o nome')
})

test('confirmation waits for completion and keeps failed actions open for retry', async () => {
  let fail!: (reason: Error) => void
  const onConfirm = jest.fn(() => new Promise<void>((_, reject) => { fail = reject }))
  const onClose = jest.fn()
  render(<ConfirmDeleteModal visible title="Excluir meta?" description="Esta ação remove sua meta."
    onConfirm={onConfirm} onClose={onClose} />)
  fireEvent.press(screen.getByRole('button', { name: 'Excluir' }))
  fireEvent.press(screen.getByRole('button', { name: 'Excluir' }))
  expect(onConfirm).toHaveBeenCalledTimes(1)
  expect(onClose).not.toHaveBeenCalled()
  await act(async () => { fail(new Error('falha de armazenamento')) })
  expect(screen.getByText('Não foi possível concluir a exclusão. Tente novamente.')).toBeTruthy()
  expect(onClose).not.toHaveBeenCalled()
  onConfirm.mockResolvedValueOnce()
  fireEvent.press(screen.getByRole('button', { name: 'Excluir' }))
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
})

test('canceling a confirmation does not delete anything', () => {
  const onConfirm = jest.fn(), onClose = jest.fn()
  render(<ConfirmDeleteModal visible title="Excluir?" description="Confirme a exclusão."
    onConfirm={onConfirm} onClose={onClose} />)
  fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }))
  expect(onClose).toHaveBeenCalledTimes(1)
  expect(onConfirm).not.toHaveBeenCalled()
})

test('goal form validates input and keeps entered data after a save failure', async () => {
  const onSubmit = jest.fn().mockRejectedValueOnce(new Error('Falha ao salvar')).mockResolvedValueOnce(undefined)
  const onClose = jest.fn()
  render(<GoalFormModal visible onSubmit={onSubmit} onClose={onClose} />)
  fireEvent.press(screen.getByRole('button', { name: 'Criar Meta' }))
  expect(onSubmit).not.toHaveBeenCalled()
  fireEvent.changeText(screen.getByLabelText('Nome da meta'), 'Minha reserva')
  fireEvent.changeText(screen.getByLabelText('Valor da meta (R$)'), '100000')
  fireEvent.press(screen.getByRole('button', { name: 'Criar Meta' }))
  await screen.findByText('Falha ao salvar')
  expect(screen.getByLabelText('Nome da meta').props.value).toBe('Minha reserva')
  expect(onClose).not.toHaveBeenCalled()
  fireEvent.press(screen.getByRole('button', { name: 'Criar Meta' }))
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Minha reserva', targetAmount: 1000 }))
})

test('goal screen can transition from loading to empty, populated and error states', async () => {
  const goal: SavingsGoal = { id: 'goal-1', name: 'Minha reserva', targetAmount: 1000, accumulatedAmount: 0,
    deadline: null, icon: 'flag-outline', color: '#E64A19', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  const props = { onGoalPress: jest.fn(), goals: [] as SavingsGoal[], loading: true, error: null as string | null,
    createGoal: jest.fn().mockResolvedValue(goal), retry: jest.fn().mockResolvedValue(undefined) }
  const result = render(<GoalsScreen {...props} />)
  expect(screen.getByText('Carregando suas metas…')).toBeTruthy()
  result.rerender(<GoalsScreen {...props} loading={false} />)
  expect(screen.getByRole('button', { name: 'Criar minha primeira meta' })).toBeTruthy()
  result.rerender(<GoalsScreen {...props} loading={false} goals={[goal]} />)
  expect(screen.getByText('Minha reserva')).toBeTruthy()
  result.rerender(<GoalsScreen {...props} loading={false} error="Falha de leitura" />)
  fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }))
  await waitFor(() => expect(props.retry).toHaveBeenCalledTimes(1))
})
