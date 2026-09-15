import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // NEW: State to toggle password visibility
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing Information", "Please enter both your email and password.");
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) throw error;
      router.replace('/dashboard' as any);

    } catch (error: any) {
      Alert.alert("Login Failed", "Invalid email or password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <View style={styles.content}>
        
        {/* 🟠 Header Section */}
        <Text style={styles.headerTitle}>Welcome to ASCEND</Text>
        <Text style={styles.subText}>Log in to continue your self-paced learning.</Text>

        {/* 🟠 Login Form */}
        <Text style={styles.inputLabel}>Email Address</Text>
        <View style={styles.inputWrapper}>
          <TextInput 
            style={styles.textInput} 
            value={email} 
            onChangeText={setEmail} 
            placeholder="Email Address" 
            autoCapitalize="none" 
            keyboardType="email-address" 
          />
        </View>

        <Text style={styles.inputLabel}>Password</Text>
        <View style={styles.inputWrapper}>
          <TextInput 
            style={styles.textInput} 
            value={password} 
            onChangeText={setPassword} 
            placeholder="Password" 
            secureTextEntry={!showPassword} // <-- Linked to state
          />
          {/* --- Show/Hide Toggle --- */}
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Text style={styles.showHideText}>{showPassword ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        </View>

        {/* 🟠 Login Button */}
        <TouchableOpacity 
          style={[styles.loginButton, isLoading && styles.loginButtonDisabled]} 
          onPress={handleLogin} 
          disabled={isLoading}
          activeOpacity={0.8}
        >
          <Text style={styles.loginButtonText}>
            {isLoading ? "Logging in..." : "Log In"}
          </Text>
        </TouchableOpacity>

        {/* 🟠 Route to Sign Up */}
        <View style={styles.signupContainer}>
          <Text style={styles.signupText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/signup' as any)}>
            <Text style={styles.signupLink}>Sign Up</Text>
          </TouchableOpacity>
        </View>

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 25 },
  
  headerTitle: { fontSize: 32, fontWeight: 'bold', color: '#2e64e5', textAlign: 'center', marginBottom: 10 },
  subText: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 40 },

  inputLabel: { fontSize: 15, color: '#333', fontWeight: '600', marginBottom: 8, marginTop: 10 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#ddd', paddingVertical: 12, paddingHorizontal: 10, marginBottom: 15 },
  textInput: { flex: 1, fontSize: 16, color: '#333' },
  
  // New Show/Hide Text Style
  showHideText: { fontSize: 14, color: '#2e64e5', fontWeight: '600', paddingHorizontal: 5 },

  loginButton: { backgroundColor: '#2e64e5', paddingVertical: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 15, marginTop: 30 }, 
  loginButtonDisabled: { backgroundColor: '#8ba6eb' },
  loginButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  signupContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 30 },
  signupText: { fontSize: 15, color: '#555' },
  signupLink: { fontSize: 15, color: '#2e64e5', fontWeight: 'bold' }
});