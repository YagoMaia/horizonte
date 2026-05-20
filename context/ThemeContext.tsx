// context/ThemeContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react'
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadThemeSettings = async () => {
      try {
        const savedMode = await AsyncStorage.getItem(THEME_MODE_KEY)
        if (savedMode) setThemeModeState(savedMode as ThemeMode)
        
        const savedColor = await AsyncStorage.getItem(PRIMARY_COLOR_KEY)
        if (savedColor) setPrimaryColorState(savedColor)
      } catch (e) {
        console.error('Failed to load theme settings', e)
      } finally {
        setLoading(false)
      }
    }
    loadThemeSettings()
  }, [])

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode)
    await AsyncStorage.setItem(THEME_MODE_KEY, mode)
  }

  const setPrimaryColor = async (color: string) => {
    setPrimaryColorState(color)
    await AsyncStorage.setItem(PRIMARY_COLOR_KEY, color)
  }

  const activeScheme = themeMode === 'system' ? systemScheme : themeMode
  const colors = getThemeColors(activeScheme, primaryColor)
  const isDark = activeScheme === 'dark'

  if (loading) {
    return null; // Prevents FOUC
  }

  return (
    <ThemeContext.Provider
      value={{
        colors,
        isDark,
        scheme: activeScheme,
        themeMode,
        setThemeMode,
        primaryColor,
        setPrimaryColor,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useThemeContext() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useThemeContext must be used inside ThemeProvider')
  return ctx
}
