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

// Suprime warning falso-positivo do Reanimated 3.16 com Switch nativo (bug conhecido)
import { LogBox as RNLogBox } from 'react-native'
RNLogBox.ignoreLogs([
  "It looks like you might be using shared value's .value inside reanimated inline style",
])


function AppContent() {
  const { isDark, colors } = useThemeContext()

  useEffect(() => {
    async function setupNotifications() {
      await NotificationService.requestPermissions()
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
            animationDuration: 250,
          }} 
        />
        <Stack.Screen 
          name="transaction/[id]" 
          options={{ 
            presentation: 'modal', 
            animation: 'slide_from_bottom',
            gestureEnabled: true,
            animationDuration: 250,
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
