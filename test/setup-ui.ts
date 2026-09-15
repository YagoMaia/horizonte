// Native integrations are replaced; React Native rendering and application UI stay real.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'))
jest.mock('@expo/vector-icons', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return { Ionicons: (props: any) => React.createElement(Text, { accessible: false, testID: 'icon-' + props.name }) }
})
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native')
  return { SafeAreaView: View, SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }
})
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native')
  return { GestureHandlerRootView: View, Swipeable: View }
})
jest.mock('expo-file-system', () => ({}))
jest.mock('expo-sharing', () => ({}))
jest.mock('expo-document-picker', () => ({}))
