import React from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Stack } from 'expo-router';

export default function LessonScreen() {
  const moduleUrl = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
  const googleViewerUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(moduleUrl)}`;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'CBF Module' }} />
      <WebView source={{ uri: googleViewerUrl }} style={styles.webview} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  webview: { flex: 1 }
});