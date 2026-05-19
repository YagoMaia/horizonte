import fc from 'fast-check'

describe('Testing framework setup', () => {
  it('jest works', () => {
    expect(1 + 1).toBe(2)
  })

  it('fast-check works', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        return a + b === b + a
      })
    )
  })
})
