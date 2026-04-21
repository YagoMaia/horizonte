// hooks/useTheme.ts
import { useColorScheme } from 'react-native'
import { Colors } from '@/constants/theme'

export function useTheme() {
  const scheme = useColorScheme() ?? 'light'
  const colors = Colors[scheme]
  return { colors, isDark: scheme === 'dark', scheme }
}
