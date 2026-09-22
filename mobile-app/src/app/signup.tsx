import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, Button, ScrollView, Alert, ImageBackground } from 'react-native';
import { router, Stack } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function SignUpScreen() {
  const [authStep, setAuthStep] = useState(1); 
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  
  // Password States
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [isEnrolled, setIsEnrolled] = useState<boolean | null>(null);
  const [lrn, setLrn] = useState('');
  
  const [strand, setStrand] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  
  const [otpCode, setOtpCode] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const validatePassword = (pass: string) => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    return regex.test(pass);
  };

  const handleSignUpAndSendOTP = async () => {
    setPasswordError('');

    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      Alert.alert("Missing Information", "Please fill out your first name, last name, and email address.");
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    if (!validatePassword(password)) {
      setPasswordError('Password does not meet the security requirements.');
      return;
    }

    if (isEnrolled === null) {
      Alert.alert("Missing Information", "Please answer if you are enrolled in Dr. Jose P. Rizal Senior High School.");
      return;
    }

    if (isEnrolled && !lrn.trim()) {
      Alert.alert("Missing Information", "Please enter your 12-digit LRN.");
      return;
    }

    if (!strand) {
      Alert.alert("Missing Information", "Please select a learning strand.");
      return;
    }

    try {
      const { error: authError } = await supabase.auth.signUp({
        email: email,
        password: password,
      });

      if (authError) throw authError;
      setAuthStep(2); 

    } catch (error: any) {
      Alert.alert("Sign Up Failed", error.message);
    }
  };

  const handleVerifyCode = async () => {
    if (!otpCode) {
      Alert.alert("Missing Code", "Please enter the 8-digit code sent to your email.");
      return;
    }

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email,
        token: otpCode,
        type: 'signup' 
      });

      if (error) throw error;

      if (data.user) {
        const { error: studentError } = await supabase
          .from('students') 
          .insert([
            {
              id: data.user.id,
              first_name: firstName,
              last_name: lastName,
              email: email, 
              lrn_number: isEnrolled ? lrn : null, 
              is_dr_jose_rizal_student: isEnrolled,
              strand: strand 
            }
          ]);

        if (studentError) throw studentError;
      }

      await supabase.auth.signOut();
      Alert.alert("Verified!", "Your account is ready. Please log in.");
      router.replace('/' as any); 

    } catch (error: any) {
      Alert.alert("Verification Failed", "Incorrect code or it has expired. Please try again.");
    }
  };

  return (
    
    <ImageBackground 
      // NOTE: If you dragged bg.jpeg into the 'app' folder earlier, use require('./bg.jpeg') instead!
      source={require('../../assets/images/bg.jpeg')} 
      style={styles.backgroundContainer}
      resizeMode="cover"
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backIconText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sign Up</Text>
        </View>

        {authStep === 1 && (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.formContainer}>
              
              <Text style={styles.inputLabel}>First Name</Text>
              <View style={styles.inputWrapper}>
                <TextInput style={styles.textInput} value={firstName} onChangeText={setFirstName} placeholder="First Name" />
              </View>

              <Text style={styles.inputLabel}>Last Name</Text>
              <View style={styles.inputWrapper}>
                <TextInput style={styles.textInput} value={lastName} onChangeText={setLastName} placeholder="Last Name" />
              </View>

              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <TextInput style={styles.textInput} value={email} onChangeText={setEmail} placeholder="Email Address" autoCapitalize="none" keyboardType="email-address" />
              </View>

              {/* --- Password Field with Show/Hide --- */}
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputWrapper}>
                <TextInput 
                  style={styles.textInput} 
                  value={password} 
                  onChangeText={setPassword} 
                  placeholder="Password" 
                  secureTextEntry={!showPassword} 
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Text style={styles.showHideText}>{showPassword ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.helperText}>
                Must be at least 8 characters, include an uppercase letter, a lowercase letter, a number, and a special character.
              </Text>

              {/* --- Confirm Password Field with Show/Hide --- */}
              <Text style={styles.inputLabel}>Re-enter Password</Text>
              <View style={[styles.inputWrapper, passwordError ? styles.inputErrorBorder : null, { marginBottom: 25 }]}>
                <TextInput 
                  style={styles.textInput} 
                  value={confirmPassword} 
                  onChangeText={setConfirmPassword} 
                  placeholder="Re-enter Password" 
                  secureTextEntry={!showConfirmPassword} 
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  <Text style={styles.showHideText}>{showConfirmPassword ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
              {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

              <Text style={styles.inputLabel}>Are you enrolled in Dr. Jose P. Rizal Senior High School?</Text>
              <View style={styles.radioContainer}>
                <TouchableOpacity 
                  style={[styles.radioButton, isEnrolled === true && styles.radioSelected]} 
                  onPress={() => setIsEnrolled(true)}
                >
                  <Text style={[styles.radioText, isEnrolled === true && styles.radioTextSelected]}>Yes</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.radioButton, isEnrolled === false && styles.radioSelected]} 
                  onPress={() => { setIsEnrolled(false); setLrn(''); }}
                >
                  <Text style={[styles.radioText, isEnrolled === false && styles.radioTextSelected]}>No</Text>
                </TouchableOpacity>
              </View>

              {isEnrolled && (
                <View style={styles.conditionalContainer}>
                  <Text style={styles.inputLabel}>Learner Reference Number (LRN)</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput style={styles.textInput} value={lrn} onChangeText={setLrn} placeholder="12-digit LRN" keyboardType="numeric" />
                  </View>
                </View>
              )}

              {/* --- Inline Strand Dropdown (No Overlap) --- */}
              <Text style={styles.inputLabel}>Select Learning Strand</Text>
              <View style={styles.dropdownContainer}>
                <TouchableOpacity 
                  style={[styles.dropdownHeader, showDropdown && styles.dropdownHeaderOpen]} 
                  onPress={() => setShowDropdown(!showDropdown)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dropdownHeaderText, !strand && {color: '#999'}]}>
                    {strand === 'HUMMS' ? 'HUMMS' : strand === 'CBF' ? 'CBF (Cookery, Bakery, and Food and Beverages)' : 'Select a strand...'}
                  </Text>
                  <Text style={styles.dropdownArrow}>{showDropdown ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {showDropdown && (
                  <View style={styles.dropdownList}>
                    <TouchableOpacity 
                      style={styles.dropdownItem} 
                      onPress={() => { setStrand('HUMMS'); setShowDropdown(false); }}
                    >
                      <Text style={styles.dropdownItemText}>HUMMS</Text>
                    </TouchableOpacity>
                    <View style={styles.dropdownDivider} />
                    <TouchableOpacity 
                      style={styles.dropdownItem} 
                      onPress={() => { setStrand('CBF'); setShowDropdown(false); }}
                    >
                      <Text style={styles.dropdownItemText}>CBF (Cookery, Bakery, and Food and Beverages)</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

            </View>
          </ScrollView>
        )}

        {authStep === 2 && (
          <View style={styles.cardStepContainer}>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Check your email!</Text>
              <Text style={styles.subText}>We sent an 8-digit verification code to {email}.</Text>
              
              <TextInput 
                style={styles.otpInput} 
                placeholder="12345678" 
                value={otpCode} 
                onChangeText={setOtpCode} 
                keyboardType="number-pad" 
                maxLength={8} 
              />
              
              <View style={styles.buttonGap}>
                <Button title="Verify & Complete Sign Up" onPress={handleVerifyCode} color="#2e64e5" />
                <Button title="← Back to Edit Email" onPress={() => setAuthStep(1)} color="#6c757d" />
              </View>
            </View>
          </View>
        )}

        {authStep === 1 && (
          <View style={styles.footerButtonContainer}>
            <TouchableOpacity style={styles.footerButton} onPress={handleSignUpAndSendOTP} activeOpacity={0.8}>
              <Text style={styles.footerButtonText}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  // 🟢 NEW: Makes the background image fill the screen
  backgroundContainer: { flex: 1, width: '100%', height: '100%' },

  // 🟢 UPDATED: Changed from solid #f5f5f5 to a semi-transparent white overlay to match index.tsx
  container: { flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.70)' },
  scrollContent: { paddingBottom: 150 }, 

  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 20, marginBottom: 10 },
  backButton: { position: 'absolute', left: 20, paddingTop: 60 },
  backIconText: { fontSize: 32, fontWeight: 'bold', color: '#2e64e5', marginTop: -10 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#333' },

  formContainer: { flex: 1, paddingHorizontal: 25 },
  inputLabel: { fontSize: 15, color: '#333', fontWeight: '600', marginBottom: 8, marginTop: 15 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#ddd', paddingVertical: 12, paddingHorizontal: 10, marginBottom: 5 },
  inputErrorBorder: { borderBottomColor: '#d9534f', borderBottomWidth: 2 },
  textInput: { flex: 1, fontSize: 16, color: '#333' },
  
  showHideText: { fontSize: 14, color: '#2e64e5', fontWeight: '600', paddingHorizontal: 5 },

  helperText: { fontSize: 12, color: '#888', marginTop: 4, marginBottom: 5, lineHeight: 16 },
  errorText: { fontSize: 14, color: '#d9534f', marginTop: -20, marginBottom: 10, fontWeight: '600' },

  radioContainer: { flexDirection: 'row', gap: 15, marginBottom: 10 },
  radioButton: { flex: 1, paddingVertical: 12, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, alignItems: 'center', backgroundColor: '#fff' },
  radioSelected: { borderColor: '#2e64e5', backgroundColor: '#eef3ff', borderWidth: 2 },
  radioText: { fontSize: 15, color: '#555', fontWeight: '500' },
  radioTextSelected: { color: '#2e64e5', fontWeight: 'bold' },

  conditionalContainer: { marginTop: 5, padding: 15, backgroundColor: '#f0f4ff', borderRadius: 8, borderWidth: 1, borderColor: '#d0ddff' },

  dropdownContainer: { marginBottom: 30 },
  dropdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 15 },
  dropdownHeaderOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 },
  dropdownHeaderText: { fontSize: 15, color: '#333', flex: 1 },
  dropdownArrow: { fontSize: 14, color: '#666', marginLeft: 10 },
  dropdownList: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderTopWidth: 0, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
  dropdownItem: { padding: 15 },
  dropdownItemText: { fontSize: 15, color: '#333' },
  dropdownDivider: { height: 1, backgroundColor: '#eee' },

  cardStepContainer: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 40 },
  card: { backgroundColor: '#ffffff', padding: 25, borderRadius: 15, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 5 },
  cardLabel: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 15, textAlign: 'center' },
  subText: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20 },
  buttonGap: { gap: 15 },
  otpInput: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', padding: 15, borderRadius: 8, fontSize: 28, letterSpacing: 5, textAlign: 'center', color: '#333', marginBottom: 25 },

  footerButtonContainer: { position: 'absolute', bottom: 30, left: 20, right: 20 },
  footerButton: { backgroundColor: '#2e64e5', paddingVertical: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 15 }, 
  footerButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});