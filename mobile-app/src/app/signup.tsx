import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, ScrollView, Alert, ImageBackground } from 'react-native';
import { router, Stack } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function SignUpScreen() {
  const [authStep, setAuthStep] = useState(1); 
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  
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

  const CODE_LENGTH = 8;

  const validatePassword = (pass: string) => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    return regex.test(pass);
  };

  const handleSignUpAndSendOTP = async () => {
    setPasswordError('');

    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      Alert.alert("Missing Information", "Please fill out all fields.");
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }
    if (!validatePassword(password)) {
      setPasswordError('Password does not meet security requirements.');
      return;
    }
    if (isEnrolled === null || (isEnrolled && !lrn.trim()) || !strand) {
      Alert.alert("Missing Information", "Please complete the school details.");
      return;
    }

    try {
      const { error: authError } = await supabase.auth.signUp({
        email: email,
        password: password,
      });
      if (authError) throw authError;
      
      console.log("MOVING TO STEP 2 WITH NEW UI"); // Sanity check in terminal
      setAuthStep(2); 

    } catch (error: any) {
      Alert.alert("Sign Up Failed", error.message);
    }
  };

  const handleVerifyCode = async () => {
    if (otpCode.length !== CODE_LENGTH) {
      Alert.alert("Missing Code", "Please enter the full 8-digit code.");
      return;
    }
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email, token: otpCode, type: 'signup' 
      });
      if (error) throw error;

      if (data.user) {
        await supabase.from('students').insert([{
            id: data.user.id, first_name: firstName, last_name: lastName,
            email: email, lrn_number: isEnrolled ? lrn : null, 
            is_dr_jose_rizal_student: isEnrolled, strand: strand 
        }]);
      }
      await supabase.auth.signOut();
      Alert.alert("Verified!", "Your account is ready.");
      router.replace('/' as any); 
    } catch (error: any) {
      Alert.alert("Verification Failed", "Incorrect code.");
    }
  };

  return (
    <ImageBackground source={require('../../assets/images/bg.jpeg')} style={styles.backgroundContainer} resizeMode="cover">
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        
        {authStep === 1 && (
          <View style={styles.headerBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backIconText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Sign Up</Text>
          </View>
        )}

        {authStep === 1 && (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Step 1 Form fields remain exactly the same */}
            <View style={styles.formContainer}>
              <Text style={styles.inputLabel}>First Name</Text>
              <View style={styles.inputWrapper}><TextInput style={styles.textInput} value={firstName} onChangeText={setFirstName} /></View>
              
              <Text style={styles.inputLabel}>Last Name</Text>
              <View style={styles.inputWrapper}><TextInput style={styles.textInput} value={lastName} onChangeText={setLastName} /></View>
              
              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={styles.inputWrapper}><TextInput style={styles.textInput} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" /></View>
              
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputWrapper}>
                <TextInput style={styles.textInput} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}><Text style={styles.showHideText}>{showPassword ? 'Hide' : 'Show'}</Text></TouchableOpacity>
              </View>
              
              <Text style={styles.inputLabel}>Re-enter Password</Text>
              <View style={styles.inputWrapper}>
                <TextInput style={styles.textInput} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showConfirmPassword} />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}><Text style={styles.showHideText}>{showConfirmPassword ? 'Hide' : 'Show'}</Text></TouchableOpacity>
              </View>
              {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

              <Text style={styles.inputLabel}>Are you enrolled in Dr. Jose P. Rizal Senior High School?</Text>
              <View style={styles.radioContainer}>
                <TouchableOpacity style={[styles.radioButton, isEnrolled === true && styles.radioSelected]} onPress={() => setIsEnrolled(true)}>
                  <Text style={[styles.radioText, isEnrolled === true && styles.radioTextSelected]}>Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.radioButton, isEnrolled === false && styles.radioSelected]} onPress={() => { setIsEnrolled(false); setLrn(''); }}>
                  <Text style={[styles.radioText, isEnrolled === false && styles.radioTextSelected]}>No</Text>
                </TouchableOpacity>
              </View>

              {isEnrolled && (
                <View style={styles.conditionalContainer}>
                  <Text style={styles.inputLabel}>LRN</Text>
                  <View style={styles.inputWrapper}><TextInput style={styles.textInput} value={lrn} onChangeText={setLrn} keyboardType="numeric" /></View>
                </View>
              )}

              <Text style={styles.inputLabel}>Select Learning Strand</Text>
              <View style={styles.dropdownContainer}>
                <TouchableOpacity style={[styles.dropdownHeader, showDropdown && styles.dropdownHeaderOpen]} onPress={() => setShowDropdown(!showDropdown)}>
                  <Text style={styles.dropdownHeaderText}>{strand || 'Select a strand...'}</Text>
                </TouchableOpacity>
                {showDropdown && (
                  <View style={styles.dropdownList}>
                    <TouchableOpacity style={styles.dropdownItem} onPress={() => { setStrand('HUMMS'); setShowDropdown(false); }}><Text>HUMMS</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.dropdownItem} onPress={() => { setStrand('CBF'); setShowDropdown(false); }}><Text>CBF</Text></TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        )}

        {/* 🟢 STEP 2: The New OTP UI */}
        {authStep === 2 && (
          <View style={styles.otpMainContainer}>
            <View style={styles.otpCard}>
              <Text style={styles.cardTitle}>Check your !</Text>
              <Text style={styles.cardSubtitle}>We sent an 8-digit verification code to {email}.</Text>

              <View style={styles.otpContainer}>
                {Array(CODE_LENGTH).fill(0).map((_, index) => {
                  const isActive = otpCode.length === index;
                  return (
                    <View key={index} style={[styles.otpBox, isActive && styles.otpBoxActive]}>
                      <Text style={styles.otpText}>{otpCode[index] || ''}</Text>
                    </View>
                  );
                })}
                <TextInput
                  value={otpCode}
                  onChangeText={(text) => setOtpCode(text.replace(/[^0-9]/g, '').substring(0, CODE_LENGTH))}
                  keyboardType="number-pad"
                  autoFocus={true}
                  style={styles.hiddenInputOverlay}
                  caretHidden={true}
                />
              </View>

              <TouchableOpacity style={styles.verifyButton} activeOpacity={0.8} onPress={handleVerifyCode}>
                <Text style={styles.verifyButtonText}>Verify & Complete Sign Up</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.backToEmailButton} activeOpacity={0.6} onPress={() => setAuthStep(1)}>
                <Text style={styles.backToEmailText}>← Back to Edit Email</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {authStep === 1 && (
          <View style={styles.footerButtonContainer}>
            <TouchableOpacity style={styles.footerButton} onPress={handleSignUpAndSendOTP}>
              <Text style={styles.footerButtonText}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundContainer: { flex: 1, width: '100%', height: '100%' },
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
  dropdownList: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderTopWidth: 0, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
  dropdownItem: { padding: 15 },
  footerButtonContainer: { position: 'absolute', bottom: 30, left: 20, right: 20 },
  footerButton: { backgroundColor: '#2e64e5', paddingVertical: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 15 }, 
  footerButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  otpMainContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  otpCard: { width: '100%', backgroundColor: '#ffffff', borderRadius: 16, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#000', marginBottom: 10 },
  cardSubtitle: { fontSize: 14, color: '#555', textAlign: 'center', marginBottom: 25, lineHeight: 20 },
  otpContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 25, position: 'relative' },
  otpBox: { width: 35, height: 45, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fafafa' },
  otpBoxActive: { borderColor: '#2e64e5', backgroundColor: '#ffffff', borderWidth: 2 },
  otpText: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  hiddenInputOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, zIndex: 99 },
  verifyButton: { width: '100%', paddingVertical: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
  verifyButtonText: { color: '#2e64e5', fontSize: 16, fontWeight: '600' },
  backToEmailButton: { paddingVertical: 10 },
  backToEmailText: { color: '#666', fontSize: 14 }
});