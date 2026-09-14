import React, { useState } from 'react';
import { StyleSheet, Text, View, Button, TextInput } from 'react-native';
import { router } from 'expo-router';

export default function SignUpScreen() {
  const [authStep, setAuthStep] = useState(1); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [lrn, setLrn] = useState('');

  const handleFinalSubmit = () => {
    console.log("Account Created!", { email, password, lrn });
    router.replace('/dashboard' as any); 
  };

  return (
    <View style={styles.container}>
      <View style={{ marginBottom: 20, alignItems: 'flex-start' }}>
        <Button title="← Cancel" onPress={() => router.back()} color="#6c757d" />
      </View>
      <Text style={styles.header}>Join ASCEND</Text>

      {authStep === 1 && (
        <View style={styles.card}>
          <Text style={styles.label}>Create an Account</Text>
          <TextInput style={styles.input} placeholder="Email Address" value={email} onChangeText={setEmail} autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
          <Button title="Next" onPress={() => setAuthStep(2)} color="#2e64e5" />
        </View>
      )}

      {authStep === 2 && (
        <View style={styles.card}>
          <Text style={styles.label}>Are you currently enrolled in Dr. Jose P. Rizal Senior High School?</Text>
          <View style={{ marginTop: 15, gap: 10 }}>
            <Button title="Yes, I am enrolled" onPress={() => setAuthStep(3)} color="#28a745" />
            <Button title="No, I am not" onPress={handleFinalSubmit} color="#6c757d" />
          </View>
        </View>
      )}

      {authStep === 3 && (
        <View style={styles.card}>
          <Text style={styles.label}>Enter your Learner Reference Number (LRN):</Text>
          <TextInput style={styles.input} placeholder="12-digit LRN" value={lrn} onChangeText={setLrn} keyboardType="numeric" />
          <View style={{ marginTop: 15, gap: 10 }}>
            <Button title="Complete Sign Up" onPress={handleFinalSubmit} color="#2e64e5" />
            <Button title="← Back" onPress={() => setAuthStep(2)} color="#6c757d" />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', justifyContent: 'center', paddingHorizontal: 20 },
  header: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  card: { backgroundColor: '#ffffff', padding: 20, borderRadius: 10, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  label: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 15, textAlign: 'center' },
  input: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginBottom: 15, fontSize: 16 }
});