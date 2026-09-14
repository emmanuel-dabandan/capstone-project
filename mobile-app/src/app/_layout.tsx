import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      {/* Hide the top header on the Welcome screen */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      
      {/* Show standard headers with back buttons for Auth screens */}
      <Stack.Screen name="login" options={{ title: 'Login' }} />
      <Stack.Screen name="signup" options={{ title: 'Sign Up' }} />
      
      {/* The Dashboard and Lesson screens */}
      <Stack.Screen name="dashboard" options={{ title: 'ASCEND Dashboard', headerShown: false }} />
      <Stack.Screen name="lesson" options={{ title: 'CBF Lesson' }} />
    </Stack>
  );
}