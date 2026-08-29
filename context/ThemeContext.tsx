// context/ThemeContext.tsx
import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getThemeColors, ThemeColors, PRIMARY_COLORS } from '@/constants/theme'

type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeContextType {
  colors: ThemeColors
  isDark: boolean
  scheme: 'light' | 'dark'
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
  primaryColor: string
  setPrimaryColor: (color: string) => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

const THEME_MODE_KEY = '@horizonte:theme_mode'
const PRIMARY_COLOR_KEY = '@horizonte:primary_color'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme() ?? 'light'
  
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system')
  const [primaryColor, setPrimaryColorState] = useState<string>(PRIMARY_COLORS[0].value)

  useEffect(() => {
    let isMounted = true
    const loadThemeSettings = async () => {
      try {
        const savedMode = await AsyncStorage.getItem(THEME_MODE_KEY)
        if (savedMode && isMounted) setThemeModeState(savedMode as ThemeMode)
        
        const savedColor = await AsyncStorage.getItem(PRIMARY_COLOR_KEY)
        if (savedColor && isMounted) setPrimaryColorState(savedColor)
      } catch (e) {
        console.error('Failed to load theme settings', e)
      }
    }
    loadThemeSettings()
    return () => { isMounted = false }
  }, [])

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode)
    await AsyncStorage.setItem(THEME_MODE_KEY, mode)
  }, [])

  const setPrimaryColor = useCallback(async (color: string) => {
    setPrimaryColorState(color)
    await AsyncStorage.setItem(PRIMARY_COLOR_KEY, color)
  }, [])

  const activeScheme = themeMode === 'system' ? systemScheme : themeMode
  const isDark = activeScheme === 'dark'
  const colors = useMemo(() => getThemeColors(activeScheme, primaryColor), [activeScheme, primaryColor])

  const contextValue = useMemo<ThemeContextType>(() => ({
    colors,
    isDark,
    scheme: activeScheme,
    themeMode,
    setThemeMode,
    primaryColor,
    setPrimaryColor,
  }), [colors, isDark, activeScheme, themeMode, setThemeMode, primaryColor, setPrimaryColor])

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useThemeContext() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useThemeContext must be used inside ThemeProvider')
  return ctx
}
