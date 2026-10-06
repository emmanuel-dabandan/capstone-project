import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function PracticeScreen() {
  const { subject } = useLocalSearchParams<{ subject: string }>();

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={28} color="#333" />
      </TouchableOpacity>
      
      <View style={styles.content}>
        <Text style={styles.title}>Practice Mode</Text>
        <Text style={styles.subtitle}>Subject: {subject}</Text>
        <Text style={styles.info}>
          This is a safe space to review. Your score here will not be recorded in the final gradebook.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fcfaf8' },
  backButton: { padding: 20 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  subtitle: { fontSize: 18, color: '#2e64e5', marginBottom: 20, fontWeight: '600' },
  info: { fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 24 }
});