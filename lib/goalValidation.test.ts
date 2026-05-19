import { validateGoalForm, validateDepositAmount, validateWithdrawalAmount } from './goalValidation'
import { CreateGoalInput } from '../constants/types'

const validInput: CreateGoalInput = {
  name: 'Viagem',
  targetAmount: 5000,
  deadline: null,
  icon: 'flag-outline',
  color: '#6200ee',
}

describe('validateGoalForm', () => {
  it('returns valid for a correct input without deadline', () => {
    const result = validateGoalForm(validInput)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual({})
  })

  it('returns valid for a correct input with today as deadline', () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const input = { ...validInput, deadline: today.toISOString() }
    const result = validateGoalForm(input)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual({})
  })

  it('returns valid for a correct input with future deadline', () => {
    const future = new Date()
    future.setDate(future.getDate() + 30)
    const input = { ...validInput, deadline: future.toISOString() }
    const result = validateGoalForm(input)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual({})
  })

  it('rejects empty name', () => {
    const input = { ...validInput, name: '' }
    const result = validateGoalForm(input)
    expect(result.valid).toBe(false)
    expect(result.errors.name).toBe('O nome da meta é obrigatório')
  })

  it('rejects whitespace-only name', () => {
    const input = { ...validInput, name: '   ' }
    const result = validateGoalForm(input)
    expect(result.valid).toBe(false)
    expect(result.errors.name).toBe('O nome da meta deve conter pelo menos um caractere visível')
  })

  it('rejects name longer than 50 characters', () => {
    const input = { ...validInput, name: 'a'.repeat(51) }
    const result = validateGoalForm(input)
    expect(result.valid).toBe(false)
    expect(result.errors.name).toBe('O nome da meta deve ter no máximo 50 caracteres')
  })

  it('accepts name with exactly 50 characters', () => {
    const input = { ...validInput, name: 'a'.repeat(50) }
    const result = validateGoalForm(input)
    expect(result.valid).toBe(true)
  })

  it('accepts name with exactly 1 character', () => {
    const input = { ...validInput, name: 'A' }
    const result = validateGoalForm(input)
    expect(result.valid).toBe(true)
  })

  it('rejects zero target amount', () => {
    const input = { ...validInput, targetAmount: 0 }
    const result = validateGoalForm(input)
    expect(result.valid).toBe(false)
    expect(result.errors.targetAmount).toBe('O valor da meta deve ser maior que zero')
  })

  it('rejects negative target amount', () => {
    const input = { ...validInput, targetAmount: -100 }
    const result = validateGoalForm(input)
    expect(result.valid).toBe(false)
    expect(result.errors.targetAmount).toBe('O valor da meta deve ser maior que zero')
  })

  it('rejects target amount exceeding maximum', () => {
    const input = { ...validInput, targetAmount: 1_000_000_000 }
    const result = validateGoalForm(input)
    expect(result.valid).toBe(false)
    expect(result.errors.targetAmount).toBe('O valor da meta não pode exceder R$ 999.999.999,99')
  })

  it('accepts target amount at minimum (0.01)', () => {
    const input = { ...validInput, targetAmount: 0.01 }
    const result = validateGoalForm(input)
    expect(result.valid).toBe(true)
  })

  it('accepts target amount at maximum (999999999.99)', () => {
    const input = { ...validInput, targetAmount: 999_999_999.99 }
    const result = validateGoalForm(input)
    expect(result.valid).toBe(true)
  })

  it('rejects deadline in the past', () => {
    const past = new Date()
    past.setDate(past.getDate() - 1)
    const input = { ...validInput, deadline: past.toISOString() }
    const result = validateGoalForm(input)
    expect(result.valid).toBe(false)
    expect(result.errors.deadline).toBe('A data limite deve ser hoje ou uma data futura')
  })

  it('collects multiple errors at once', () => {
    const past = new Date()
    past.setDate(past.getDate() - 1)
    const input: CreateGoalInput = {
      name: '',
      targetAmount: -5,
      deadline: past.toISOString(),
      icon: 'flag-outline',
      color: '#000',
    }
    const result = validateGoalForm(input)
    expect(result.valid).toBe(false)
    expect(Object.keys(result.errors)).toHaveLength(3)
    expect(result.errors.name).toBeDefined()
    expect(result.errors.targetAmount).toBeDefined()
    expect(result.errors.deadline).toBeDefined()
  })
})

describe('validateDepositAmount', () => {
  it('returns valid for a positive amount within range', () => {
    const result = validateDepositAmount(100)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual({})
  })

  it('accepts minimum deposit (0.01)', () => {
    const result = validateDepositAmount(0.01)
    expect(result.valid).toBe(true)
  })

  it('accepts maximum deposit (999999999.99)', () => {
    const result = validateDepositAmount(999_999_999.99)
    expect(result.valid).toBe(true)
  })

  it('rejects zero amount', () => {
    const result = validateDepositAmount(0)
    expect(result.valid).toBe(false)
    expect(result.errors.amount).toBe('O valor do depósito deve ser maior que zero')
  })

  it('rejects negative amount', () => {
    const result = validateDepositAmount(-50)
    expect(result.valid).toBe(false)
    expect(result.errors.amount).toBe('O valor do depósito deve ser maior que zero')
  })

  it('rejects amount exceeding maximum', () => {
    const result = validateDepositAmount(1_000_000_000)
    expect(result.valid).toBe(false)
    expect(result.errors.amount).toBe('O valor do depósito não pode exceder R$ 999.999.999,99')
  })

  it('rejects NaN', () => {
    const result = validateDepositAmount(NaN)
    expect(result.valid).toBe(false)
    expect(result.errors.amount).toBe('O valor do depósito é inválido')
  })
})

describe('validateWithdrawalAmount', () => {
  it('returns valid for amount within accumulated', () => {
    const result = validateWithdrawalAmount(50, 100)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual({})
  })

  it('accepts withdrawal equal to accumulated', () => {
    const result = validateWithdrawalAmount(100, 100)
    expect(result.valid).toBe(true)
  })

  it('rejects zero amount', () => {
    const result = validateWithdrawalAmount(0, 100)
    expect(result.valid).toBe(false)
    expect(result.errors.amount).toBe('O valor da retirada deve ser maior que zero')
  })

  it('rejects negative amount', () => {
    const result = validateWithdrawalAmount(-10, 100)
    expect(result.valid).toBe(false)
    expect(result.errors.amount).toBe('O valor da retirada deve ser maior que zero')
  })

  it('rejects amount greater than accumulated', () => {
    const result = validateWithdrawalAmount(150, 100)
    expect(result.valid).toBe(false)
    expect(result.errors.amount).toBe('O valor da retirada não pode ser maior que o saldo acumulado')
  })

  it('rejects NaN', () => {
    const result = validateWithdrawalAmount(NaN, 100)
    expect(result.valid).toBe(false)
    expect(result.errors.amount).toBe('O valor da retirada é inválido')
  })
})
