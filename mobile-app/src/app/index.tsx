import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';

export default function WelcomeScreen() {
  return (
    <View style={styles.container}>
      {/* Logo Section */}
      <View style={styles.logoContainer}>
        <Image 
          source={{ uri: 'https://cdn-icons-png.flaticon.com/512/2941/2941573.png' }} 
          style={styles.logoImage} 
        />
        <Text style={styles.logoPlaceholder}>ASCEND</Text>
        <Text style={styles.subText}>ALS Learning Platform</Text>
      </View>

      {/* Navigation Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.loginButton} 
          activeOpacity={0.7}
          onPress={() => router.push('/login')}
        >
          <Text style={styles.loginText}>Login</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.signupButton} 
          activeOpacity={0.7}
          onPress={() => router.push('/signup')}
        >
          <Text style={styles.signupText}>Sign Up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', justifyContent: 'space-between', padding: 20 },
  logoContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  logoImage: { width: 120, height: 120, marginBottom: 15 },
  logoPlaceholder: { fontSize: 42, fontWeight: '900', color: '#2e64e5', letterSpacing: 2 },
  subText: { fontSize: 16, color: '#666', marginTop: 10 },
  buttonContainer: { marginBottom: 40, gap: 15 },
  loginButton: { backgroundColor: '#2e64e5', paddingVertical: 15, borderRadius: 10, alignItems: 'center' },
  loginText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  signupButton: { backgroundColor: 'transparent', paddingVertical: 15, borderRadius: 10, alignItems: 'center', borderWidth: 2, borderColor: '#2e64e5' },
  signupText: { color: '#2e64e5', fontSize: 18, fontWeight: 'bold' }
});