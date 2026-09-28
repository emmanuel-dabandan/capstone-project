import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    // 🟢 Wraps the entire navigation stack to enable complex gestures (like swiping) on Android
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        {/* 🟢 Added Home master screen */}
        <Stack.Screen name="home" /> 
        <Stack.Screen name="lesson" />
      </Stack>
    </GestureHandlerRootView>
  );
}