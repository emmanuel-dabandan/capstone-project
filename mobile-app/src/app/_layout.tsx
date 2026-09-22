import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    // 🟢 Hides the header globally across all screens in the app
    <Stack screenOptions={{ headerShown: false }}>
      
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="learn" />
      <Stack.Screen name="lesson" />
      
    </Stack>
  );
}