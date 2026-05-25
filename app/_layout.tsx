// app/_layout.tsx
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ThemeProvider as NavThemeProvider, DefaultTheme, DarkTheme } from '@react-navigation/native'
import * as SystemUI from 'expo-system-ui'
import { StoreProvider } from '@/context/StoreContext'
import { ThemeProvider, useThemeContext } from '@/context/ThemeContext'
import * as NotificationService from '../services/notificationService'

import { TransitionSpecs, HeaderStyleInterpolators } from '@react-navigation/stack';

function AppContent() {
  const { isDark, colors } = useThemeContext()

  useEffect(() => {
    async function setupNotifications() {
      const granted = await NotificationService.requestPermissions()
      if (granted) {
        await NotificationService.scheduleDailyReminder()
      }
    }
    setupNotifications()
  }, [])

  useEffect(() => {
    // Set the root view background color natively to prevent white flashes
    SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  const navTheme = isDark ? DarkTheme : DefaultTheme;
  const customNavTheme = {
    ...navTheme,
    colors: {
      ...navTheme.colors,
      background: colors.background,
    },
  };

  const fastTransitionSpec = {
    open: {
      animation: 'timing',
      config: {
        duration: 250, // 👈 Reduzido de 400-500ms (padrão) para 250ms
      },
    },
    close: {
      animation: 'timing',
      config: {
        duration: 200,
      },
    },
  };

  return (
    <NavThemeProvider value={customNavTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ 
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}>
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen 
          name="add-transaction" 
          options={{ 
            presentation: 'modal', 
            animation: 'slide_from_bottom',
            gestureEnabled: true,
            transitionSpec: fastTransitionSpec as any,
          }} 
        />
        <Stack.Screen 
          name="transaction/[id]" 
          options={{ 
            presentation: 'modal', 
            animation: 'slide_from_bottom',
            gestureEnabled: true,
            transitionSpec: fastTransitionSpec as any,
          }} 
        />
      </Stack>
    </NavThemeProvider>
  )
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <StoreProvider>
            <AppContent />
          </StoreProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
