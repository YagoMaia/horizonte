import { contrastRatio, getThemeColors, PRIMARY_COLORS } from '@/constants/theme'

describe.each(['light', 'dark'] as const)('Theme %s', scheme => {
  test.each(PRIMARY_COLORS)('$label has legible text and actions', ({ value }) => {
    const colors = getThemeColors(scheme, value)
    for (const [foreground, background] of [
      ['foreground', 'background'], ['mutedForeground', 'card'], ['primaryText', 'card'],
      ['primaryText', 'primarySoft'], ['primaryForeground', 'primary'], ['heroMuted', 'hero'],
      ['heroForeground', 'hero'], ['destructiveForeground', 'destructive'],
    ] as const) expect(contrastRatio(colors[foreground], colors[background])).toBeGreaterThanOrEqual(4.5)
  })
  test('invalid persisted colors have a safe fallback', () => {
    expect(getThemeColors(scheme, 'invalid').primary).toBe('#E64A19')
  })
})
