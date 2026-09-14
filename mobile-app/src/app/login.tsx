import React, { useState } from 'react';
import { StyleSheet, Text, View, Button, TextInput } from 'react-native';
import { router } from 'expo-router';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    // We will connect this to Supabase later!
    console.log("Logging in!", { email, password });
    router.replace('/dashboard' as any); 
  };

  return (
    <View style={styles.container}>
      <View style={{ marginBottom: 20, alignItems: 'flex-start' }}>
        <Button title="← Cancel" onPress={() => router.back()} color="#6c757d" />
      </View>
      
      <Text style={styles.header}>Welcome Back</Text>

      <View style={styles.card}>
        <TextInput style={styles.input} placeholder="Email Address" value={email} onChangeText={setEmail} autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <Button title="Login" onPress={handleLogin} color="#2e64e5" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', justifyContent: 'center', paddingHorizontal: 20 },
  header: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  card: { backgroundColor: '#ffffff', padding: 20, borderRadius: 10, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  input: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginBottom: 15, fontSize: 16 }
});