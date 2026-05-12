// app/_layout.tsx
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StoreProvider } from '@/context/StoreContext'
import { ThemeProvider, useThemeContext } from '@/context/ThemeContext'
import * as NotificationService from '../services/notificationService'

function AppContent() {
  const { isDark } = useThemeContext()

  useEffect(() => {
    async function setupNotifications() {
      const granted = await NotificationService.requestPermissions()
      if (granted) {
        await NotificationService.scheduleDailyReminder()
      }
    }
    setupNotifications()
  }, [])

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
      </Stack>
    </>
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
