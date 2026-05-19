import { CreateGoalInput } from '../constants/types'

export interface ValidationResult {
  valid: boolean
  errors: Record<string, string>
}

/**
 * Validates the goal creation/edit form input.
 *
 * Rules:
 * - name: 1-50 characters, must not be whitespace-only
 * - targetAmount: between 0.01 and 999,999,999.99
 * - deadline: if provided, must be today or a future date
 */
export function validateGoalForm(input: CreateGoalInput): ValidationResult {
  const errors: Record<string, string> = {}

  // Name validation
  if (!input.name || input.name.length === 0) {
    errors.name = 'O nome da meta é obrigatório'
  } else if (input.name.trim().length === 0) {
    errors.name = 'O nome da meta deve conter pelo menos um caractere visível'
  } else if (input.name.length > 50) {
    errors.name = 'O nome da meta deve ter no máximo 50 caracteres'
  }

  // Target amount validation
  if (input.targetAmount === undefined || input.targetAmount === null) {
    errors.targetAmount = 'O valor da meta é obrigatório'
  } else if (input.targetAmount <= 0) {
    errors.targetAmount = 'O valor da meta deve ser maior que zero'
  } else if (input.targetAmount > 999_999_999.99) {
    errors.targetAmount = 'O valor da meta não pode exceder R$ 999.999.999,99'
  }

  // Deadline validation (optional, but if provided must be today or future)
  if (input.deadline !== null && input.deadline !== undefined) {
    const deadlineDate = new Date(input.deadline)
    if (isNaN(deadlineDate.getTime())) {
      errors.deadline = 'A data limite é inválida'
    } else {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const deadlineDay = new Date(deadlineDate)
      deadlineDay.setHours(0, 0, 0, 0)

      if (deadlineDay.getTime() < today.getTime()) {
        errors.deadline = 'A data limite deve ser hoje ou uma data futura'
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  }
}

/**
 * Validates a deposit amount.
 *
 * Rules:
 * - amount must be greater than 0
 * - amount must not exceed 999,999,999.99
 */
export function validateDepositAmount(amount: number): ValidationResult {
  const errors: Record<string, string> = {}

  if (amount === undefined || amount === null || isNaN(amount)) {
    errors.amount = 'O valor do depósito é inválido'
  } else if (amount <= 0) {
    errors.amount = 'O valor do depósito deve ser maior que zero'
  } else if (amount > 999_999_999.99) {
    errors.amount = 'O valor do depósito não pode exceder R$ 999.999.999,99'
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  }
}

/**
 * Validates a withdrawal amount.
 *
 * Rules:
 * - amount must be greater than 0
 * - amount must not exceed the current accumulated amount
 */
export function validateWithdrawalAmount(amount: number, accumulated: number): ValidationResult {
  const errors: Record<string, string> = {}

  if (amount === undefined || amount === null || isNaN(amount)) {
    errors.amount = 'O valor da retirada é inválido'
  } else if (amount <= 0) {
    errors.amount = 'O valor da retirada deve ser maior que zero'
  } else if (amount > accumulated) {
    errors.amount = 'O valor da retirada não pode ser maior que o saldo acumulado'
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  }
}
