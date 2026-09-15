// Shared palette for the Horizonte interface.
export const baseColors = {
  light: {
    background: '#F7F4EF', foreground: '#292520',
    card: '#FFFFFF', cardForeground: '#292520',
    secondary: '#EEE9E2', secondaryForeground: '#49423B',
    muted: '#F0EBE5', mutedForeground: '#75695F',
    accent: '#FBE9DF', accentForeground: '#923B1C',
    destructive: '#B73535', destructiveForeground: '#FFFFFF',
    success: '#28734F', successForeground: '#FFFFFF', successLight: '#E6F2E9',
    warning: '#97530A', warningForeground: '#FFFFFF', warningLight: '#FFF0D7',
    dangerLight: '#FCE9E5', border: '#E5DED5', input: '#E5DED5',
    info: '#245F93', infoLight: '#E6EFF7',
    categoryInvestment: '#28734F', categoryFixed: '#245F93',
    categoryVariable: '#97530A', categoryOther: '#71459C', chartBalance: '#6D3FA0',
    hero: '#302823', heroForeground: '#FFF9F3', heroMuted: '#D6C8BC',
    heroAccent: '#FFB38A', heroSurface: '#473A31',
  },
  dark: {
    background: '#171513', foreground: '#F8F1E9',
    card: '#24211E', cardForeground: '#F8F1E9',
    secondary: '#332E29', secondaryForeground: '#E8DDD2',
    muted: '#302A25', mutedForeground: '#B7A99C',
    accent: '#442C21', accentForeground: '#FFB38A',
    destructive: '#FF9791', destructiveForeground: '#291513',
    success: '#91CDA6', successForeground: '#142C1D', successLight: '#233A2B',
    warning: '#F2BF78', warningForeground: '#2E2111', warningLight: '#3B2D1C',
    dangerLight: '#432724', border: '#403830', input: '#403830',
    info: '#8FC4F4', infoLight: '#21384B',
    categoryInvestment: '#91CDA6', categoryFixed: '#8FC4F4',
    categoryVariable: '#F2BF78', categoryOther: '#D1B4EF', chartBalance: '#D1B4EF',
    hero: '#332920', heroForeground: '#FFF9F3', heroMuted: '#D6C8BC',
    heroAccent: '#FFB38A', heroSurface: '#493A2D',
  },
}
export type ColorScheme = 'light' | 'dark'
const channels = (hex: string) => hex.slice(1).match(/.{2}/g)!.map(v => parseInt(v, 16))
const luminance = (hex: string) => channels(hex).reduce((sum, value, i) => {
  const srgb = value / 255
  const linear = srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
  return sum + linear * [0.2126, 0.7152, 0.0722][i]
}, 0)
export const contrastRatio = (a: string, b: string) => {
  const values = [luminance(a), luminance(b)]
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05)
}
const mix = (color: string, target: string, amount: number) => {
  const destination = channels(target)
  return '#' + channels(color).map((value, i) =>
    Math.round(value + (destination[i] - value) * amount).toString(16).padStart(2, '0')
  ).join('')
}
export const getThemeColors = (scheme: ColorScheme, primaryColor: string) => {
  const base = baseColors[scheme]
  const primary = /^#[0-9a-f]{6}$/i.test(primaryColor) ? primaryColor : '#E64A19'
  // Text accents stay legible, including the black preference in dark mode.
  let primaryText = primary
  const target = scheme === 'dark' ? '#FFFFFF' : '#000000'
  for (let step = 1; step <= 20 && Math.min(
    contrastRatio(primaryText, base.card), contrastRatio(primaryText, base.background),
    contrastRatio(primaryText, mix(base.card, primaryText, 0.10))
  ) < 4.5; step++) primaryText = mix(primary, target, step / 20)
  return {
    ...base, primary, primaryText,
    primarySoft: mix(base.card, primaryText, 0.10),
    primaryForeground: contrastRatio(primary, '#FFFFFF') >= contrastRatio(primary, '#000000')
      ? '#FFFFFF' : '#000000',
    ring: primaryText,
  }
}
export const Colors = {
  light: getThemeColors('light', '#E64A19'),
  dark: getThemeColors('dark', '#FF7043'),
}
export type ThemeColors = typeof Colors.light
export const PRIMARY_COLORS = [
  { label: 'Laranja', value: '#E64A19' },
  { label: 'Azul', value: '#1976D2' },
  { label: 'Verde', value: '#388E3C' },
  { label: 'Roxo', value: '#7B1FA2' },
  { label: 'Preto', value: '#212121' },
]
export const Layout = { page: 20, gap: 16, cardRadius: 24, controlRadius: 14, maxWidth: 760 }

