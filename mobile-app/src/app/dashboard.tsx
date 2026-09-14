import React, { useState } from 'react';
import { StyleSheet, Text, View, Button, ScrollView, ActivityIndicator } from 'react-native';
import { router, Stack } from 'expo-router';

export default function DashboardScreen() {
  const [quiz, setQuiz] = useState('Press the button to generate a quiz!');
  const [loading, setLoading] = useState(false);

  const fetchQuiz = async () => {
    setLoading(true);
    try {
      const backendUrl = "https://glorious-happiness-x5955j7qpxqgfp4p9-8000.app.github.dev";
      const response = await fetch(`${backendUrl}/generate-quiz?topic=basic fractions`);
      const data = await response.json();
      setQuiz(data.quiz);
    } catch (error) {
      console.error(error);
      setQuiz('Error: Could not connect to the backend.');
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Dashboard', headerLeft: () => null }} />
      <Text style={styles.header}>ASCEND Dashboard</Text>
      
      <View style={styles.buttonContainer}>
        <Button title="Generate AI Quiz" onPress={fetchQuiz} color="#2e64e5" />
      </View>

      <View style={{ marginBottom: 20 }}>
        <Button title="Open CBF Lesson" onPress={() => router.push('/lesson' as any)} color="#28a745" />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2e64e5" style={{ marginTop: 20 }} />
      ) : (
        <ScrollView style={styles.quizBox}>
          <Text style={styles.quizText}>{quiz}</Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: 20, paddingHorizontal: 20, paddingBottom: 20 },
  header: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  buttonContainer: { marginBottom: 10 },
  quizBox: { flex: 1, backgroundColor: '#ffffff', padding: 15, borderRadius: 10, elevation: 3 },
  quizText: { fontSize: 16, lineHeight: 24, color: '#333' }
});