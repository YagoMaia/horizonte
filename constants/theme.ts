// constants/theme.ts
export const baseColors = {
  light: {
    background: '#FAFAFA',
    foreground: '#1A1A1A',
    card: '#FFFFFF',
    cardForeground: '#1A1A1A',
    secondary: '#F5F5F5',
    secondaryForeground: '#333333',
    muted: '#F0F0F0',
    mutedForeground: '#737373',
    accent: '#F5F5F5',
    accentForeground: '#222222',
    destructive: '#D32F2F',
    destructiveForeground: '#FFFFFF',
    success: '#388E3C',
    successForeground: '#FFFFFF',
    successLight: '#E8F5E9',
    warning: '#F57C00',
    warningForeground: '#1A1A1A',
    warningLight: '#FFF3E0',
    dangerLight: '#FFEBEE',
    border: '#E8E8E8',
    input: '#E8E8E8',
  },
  dark: {
    background: '#121212',
    foreground: '#F0F0F0',
    card: '#1E1E1E',
    cardForeground: '#F0F0F0',
    secondary: '#2A2A2A',
    secondaryForeground: '#F0F0F0',
    muted: '#2A2A2A',
    mutedForeground: '#A0A0A0',
    accent: '#2A2A2A',
    accentForeground: '#F0F0F0',
    destructive: '#EF5350',
    destructiveForeground: '#F0F0F0',
    success: '#66BB6A',
    successForeground: '#1A1A1A',
    successLight: '#1B3A1D',
    warning: '#FFA726',
    warningForeground: '#1A1A1A',
    warningLight: '#3D2800',
    dangerLight: '#3D1A1A',
    border: '#2E2E2E',
    input: '#2E2E2E',
  },
}

export type ColorScheme = 'light' | 'dark'

export const getThemeColors = (scheme: ColorScheme, primaryColor: string) => {
  const base = baseColors[scheme]
  return {
    ...base,
    primary: primaryColor,
    primaryForeground: scheme === 'light' ? '#FFFFFF' : '#1A1A1A',
    ring: primaryColor,
  }
}

// Backward compatibility (default colors)
export const Colors = {
  light: getThemeColors('light', '#E64A19'),
  dark: getThemeColors('dark', '#FF7043'),
}

export type ThemeColors = typeof Colors.light

export const PRIMARY_COLORS = [
  { label: 'Laranja', value: '#E64A19' }, // Original
  { label: 'Azul', value: '#1976D2' },
  { label: 'Verde', value: '#388E3C' },
  { label: 'Roxo', value: '#7B1FA2' },
  { label: 'Preto', value: '#212121' },
]

