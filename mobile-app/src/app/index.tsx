import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, ImageBackground, ScrollView, Animated } from 'react-native';
import { router, Stack } from 'expo-router';
import { supabase } from '../lib/supabase';

// 🟠 CUSTOM ANIMATION WRAPPER
const SlideUpView = ({ children, style }: { children: React.ReactNode, style?: any }) => {
  const slideAnim = useRef(new Animated.Value(40)).current; 
  const fadeAnim = useRef(new Animated.Value(0)).current;   

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400, 
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400, 
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  return (
    <Animated.View style={[style, { transform: [{ translateY: slideAnim }], opacity: fadeAnim }]}>
      {children}
    </Animated.View>
  );
};

export default function AuthScreen() {
  const [activeView, setActiveView] = useState<'welcome' | 'login' | 'signup'>('welcome');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [authStep, setAuthStep] = useState(1); 
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState<boolean | null>(null);
  const [lrn, setLrn] = useState('');
  const [strand, setStrand] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const CODE_LENGTH = 8;

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing Information", "Please enter both your email and password.");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace('/home' as any);
    } catch (error: any) {
      Alert.alert("Login Failed", "Invalid email or password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const validatePassword = (pass: string) => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    return regex.test(pass);
  };

  const handleSignUpAndSendOTP = async () => {
    setPasswordError('');
    if (!firstName.trim() || !lastName.trim() || !email.trim()) return Alert.alert("Missing Info", "Please fill out your name and email.");
    if (password !== confirmPassword) return setPasswordError('Passwords do not match.');
    if (!validatePassword(password)) return setPasswordError('Password does not meet the security requirements.');
    if (isEnrolled === null) return Alert.alert("Missing Info", "Please answer if you are enrolled.");
    if (isEnrolled && !lrn.trim()) return Alert.alert("Missing Info", "Please enter your 12-digit LRN.");
    if (!strand) return Alert.alert("Missing Info", "Please select a learning strand.");

    setIsLoading(true); 

    try {
      const { error: authError } = await supabase.auth.signUp({ email, password });
      if (authError) throw authError;
      setAuthStep(2); 
    } catch (error: any) {
      Alert.alert("Sign Up Failed", error.message);
    } finally {
      setIsLoading(false); 
    }
  };

  const handleVerifyCode = async () => {
    if (otpCode.length !== CODE_LENGTH) return Alert.alert("Missing Code", "Please enter the full 8-digit code.");
    
    setIsLoading(true); 

    try {
      const { data, error } = await supabase.auth.verifyOtp({ email, token: otpCode, type: 'signup' });
      if (error) throw error;

      if (data.user) {
        const { error: studentError } = await supabase.from('students').insert([{
          id: data.user.id, first_name: firstName, last_name: lastName, email, 
          lrn_number: isEnrolled ? lrn : null, is_dr_jose_rizal_student: isEnrolled, strand 
        }]);
        if (studentError) throw studentError;
      }

      await supabase.auth.signOut();
      Alert.alert("Verified!", "Your account is ready. Please log in.");
      
      setAuthStep(1);
      setActiveView('login');
      setPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      Alert.alert("Verification Failed", "Incorrect code or it has expired.");
    } finally {
      setIsLoading(false); 
    }
  };

  return (
    <ImageBackground 
      source={require('../../assets/images/bg.jpeg')} 
      style={styles.backgroundContainer}
      resizeMode="cover"
    >
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* =========================================
          VIEW 1: WELCOME SCREEN
      =========================================== */}
      {activeView === 'welcome' && (
        <SlideUpView style={styles.welcomeContainer}>
          <View style={styles.logoContainer}></View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.welcomeLoginBtn} activeOpacity={0.8} onPress={() => setActiveView('login')}>
              <Text style={styles.welcomeLoginText}>Login</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.welcomeSignupBtn} activeOpacity={0.8} onPress={() => setActiveView('signup')}>
              <Text style={styles.welcomeSignupText}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </SlideUpView>
      )}

      {/* =========================================
          VIEW 2: LOGIN SCREEN
      =========================================== */}
      {activeView === 'login' && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.loginContainer}>
          <SlideUpView style={styles.loginContent}>
            
            <TouchableOpacity onPress={() => setActiveView('welcome')} style={styles.loginBackButton}>
              <Text style={styles.backIconText}>←</Text>
            </TouchableOpacity>

            <Text style={styles.loginHeaderTitle}>Login to ALS EduPace</Text>
            <Text style={styles.loginSubText}>to continue your self-paced learning.</Text>

            <Text style={styles.inputLabel}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <TextInput style={styles.textInput} value={email} onChangeText={setEmail} placeholder="Email Address" autoCapitalize="none" keyboardType="email-address" />
            </View>

            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputWrapper}>
              <TextInput style={styles.textInput} value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry={!showPassword} />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Text style={styles.showHideText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.authLoginBtn, isLoading && styles.authLoginBtnDisabled]} onPress={handleLogin} disabled={isLoading} activeOpacity={0.8}>
              <Text style={styles.authLoginBtnText}>{isLoading ? "Logging in..." : "Log In"}</Text>
            </TouchableOpacity>

            <View style={styles.signupPromptContainer}>
              <Text style={styles.loginSignupPromptText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => setActiveView('signup')}>
                <Text style={styles.signupLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>

          </SlideUpView>
        </KeyboardAvoidingView>
      )}

      {/* =========================================
          VIEW 3: SIGN UP SCREEN
      =========================================== */}
      {activeView === 'signup' && (
        <SlideUpView style={styles.signupContainer}>
          
          {/* 🟢 STEP 1 HEADER: Hides completely when on Step 2 */}
          {authStep === 1 && (
            <View style={styles.headerBar}>
              <TouchableOpacity onPress={() => setActiveView('welcome')} style={styles.backButton}>
                <Text style={styles.backIconText}>←</Text>
              </TouchableOpacity>
              <Text style={styles.loginHeaderTitle}>Sign Up</Text>
            </View>
          )}

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

                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.inputWrapper}>
                  <TextInput style={styles.textInput} value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry={!showPassword} />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Text style={styles.showHideText}>{showPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.helperText}>Must be at least 8 characters, include an uppercase letter, a lowercase letter, a number, and a special character.</Text>

                <Text style={styles.inputLabel}>Re-enter Password</Text>
                <View style={[styles.inputWrapper, passwordError ? styles.inputErrorBorder : null, { marginBottom: 25 }]}>
                  <TextInput style={styles.textInput} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter Password" secureTextEntry={!showConfirmPassword} />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                    <Text style={styles.showHideText}>{showConfirmPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
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
                    <Text style={styles.inputLabel}>Learner Reference Number (LRN)</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput style={styles.textInput} value={lrn} onChangeText={setLrn} placeholder="12-digit LRN" keyboardType="numeric" />
                    </View>
                  </View>
                )}

                <Text style={styles.inputLabel}>Select Learning Strand</Text>
                <View style={styles.dropdownContainer}>
                  <TouchableOpacity style={[styles.dropdownHeader, showDropdown && styles.dropdownHeaderOpen]} onPress={() => setShowDropdown(!showDropdown)} activeOpacity={0.8}>
                    <Text style={[styles.dropdownHeaderText, !strand && {color: '#999'}]}>
                      {strand === 'HUMMS' ? 'HUMMS' : strand === 'CBF' ? 'CBF (Cookery, Bakery, and Food and Beverages)' : 'Select a strand...'}
                    </Text>
                    <Text style={styles.dropdownArrow}>{showDropdown ? '▲' : '▼'}</Text>
                  </TouchableOpacity>

                  {showDropdown && (
                    <View style={styles.dropdownList}>
                      <TouchableOpacity style={styles.dropdownItem} onPress={() => { setStrand('HUMMS'); setShowDropdown(false); }}>
                        <Text style={styles.dropdownItemText}>HUMMS</Text>
                      </TouchableOpacity>
                      <View style={styles.dropdownDivider} />
                      <TouchableOpacity style={styles.dropdownItem} onPress={() => { setStrand('CBF'); setShowDropdown(false); }}>
                        <Text style={styles.dropdownItemText}>CBF (Cookery, Bakery, and Food and Beverages)</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

              </View>
            </ScrollView>
          )}

          {/* 🟢 STEP 2: Centered 8-Box OTP Layout */}
          {authStep === 2 && (
            <View style={styles.otpMainContainer}>
              <View style={styles.otpCard}>
                
                <Text style={styles.cardTitle}>Check your email!</Text>
                <Text style={styles.cardSubtitle}>
                  We sent an 8-digit verification code to {email}.
                </Text>

                <View style={styles.otpContainer}>
                  {Array(CODE_LENGTH).fill(0).map((_, index) => {
                    const isActive = otpCode.length === index;
                    return (
                      <View key={index} style={[styles.otpBox, isActive && styles.otpBoxActive]}>
                        <Text style={styles.otpText}>{otpCode[index] || ''}</Text>
                      </View>
                    );
                  })}
                  
                  {/* Bulletproof Invisible Input */}
                  <TextInput
                    value={otpCode}
                    onChangeText={(text) => {
                      const numericValue = text.replace(/[^0-9]/g, '');
                      setOtpCode(numericValue.substring(0, CODE_LENGTH));
                    }}
                    keyboardType="number-pad"
                    maxLength={CODE_LENGTH}
                    autoFocus={true}
                    style={styles.hiddenInputOverlay}
                    caretHidden={true}
                  />
                </View>

                <TouchableOpacity 
                  style={[styles.verifyButton, isLoading && { opacity: 0.5 }]} 
                  activeOpacity={0.8} 
                  onPress={handleVerifyCode}
                  disabled={isLoading}
                >
                  <Text style={styles.verifyButtonText}>
                    {isLoading ? "Verifying..." : "Verify & Complete Sign Up"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.backToEmailButton} activeOpacity={0.6} onPress={() => setAuthStep(1)}>
                  <Text style={styles.backToEmailText}>← Back to Edit Email</Text>
                </TouchableOpacity>

              </View>
            </View>
          )}

          {authStep === 1 && (
            <View style={styles.footerButtonContainer}>
              <TouchableOpacity 
                style={[styles.footerButton, isLoading && styles.authLoginBtnDisabled]} 
                onPress={handleSignUpAndSendOTP} 
                activeOpacity={0.8}
                disabled={isLoading}
              >
                <Text style={styles.footerButtonText}>
                  {isLoading ? "Sending Code..." : "Sign Up"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </SlideUpView>
      )}

    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundContainer: { flex: 1, width: '100%', height: '100%' },

  welcomeContainer: { flex: 1, backgroundColor: 'rgba(255, 255, 255, 0)', justifyContent: 'space-between', padding: 20 },
  loginContainer: { flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.70)' },
  signupContainer: { flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.70)' },

  logoContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  buttonContainer: { marginBottom: 40, gap: 15 },
  welcomeLoginBtn: { backgroundColor: '#2e64e5', paddingVertical: 15, borderRadius: 10, alignItems: 'center' },
  welcomeLoginText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  welcomeSignupBtn: { backgroundColor: '#fff', paddingVertical: 15, borderRadius: 10, alignItems: 'center', borderWidth: 2, borderColor: '#2e64e5' },
  welcomeSignupText: { color: '#2e64e5', fontSize: 18, fontWeight: 'bold' },

  loginContent: { flex: 1, justifyContent: 'center', paddingHorizontal: 25 },
  loginBackButton: { position: 'absolute', top: 60, left: 20 },
  loginHeaderTitle: { fontSize: 32, fontWeight: 'bold', color: '#2e64e5', textAlign: 'center', marginBottom: 10 },
  loginSubText: { fontSize: 16, color: '#000000', textAlign: 'center', marginBottom: 40, paddingBottom: 120 },
  authLoginBtn: { backgroundColor: '#2e64e5', paddingVertical: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 15, marginTop: 30 }, 
  authLoginBtnDisabled: { backgroundColor: '#8ba6eb' },
  authLoginBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  signupPromptContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 30 },
  loginSignupPromptText: { fontSize: 15, color: '#555' },
  signupLink: { fontSize: 15, color: '#2e64e5', fontWeight: 'bold' },

  scrollContent: { paddingBottom: 150 }, 
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 20, marginBottom: 10 },
  backButton: { position: 'absolute', left: 20, paddingTop: 60 },
  backIconText: { fontSize: 32, fontWeight: 'bold', color: '#2e64e5', marginTop: -10 },
  formContainer: { flex: 1, paddingHorizontal: 25 },
  inputErrorBorder: { borderBottomColor: '#d9534f', borderBottomWidth: 2 },
  helperText: { fontSize: 12, color: '#000000', marginTop: 4, marginBottom: 5, lineHeight: 16 },
  errorText: { fontSize: 14, color: '#d9534f', marginTop: -20, marginBottom: 10, fontWeight: '600' },
  
  inputLabel: { fontSize: 16, color: '#000000', fontWeight: '600', marginBottom: 8, marginTop: 10, borderRadius: 15 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#ddd', paddingVertical: 12, paddingHorizontal: 10, marginBottom: 15, borderRadius: 15 },
  textInput: { flex: 1, fontSize: 16, color: '#333' },
  showHideText: { fontSize: 14, color: '#2e64e5', fontWeight: '600', paddingHorizontal: 5 },

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

  footerButtonContainer: { position: 'absolute', bottom: 30, left: 20, right: 20 },
  footerButton: { backgroundColor: '#2e64e5', paddingVertical: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 15 }, 
  footerButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  // --- 🟢 NEW: OTP Verification Step Styles ---
  otpMainContainer: {
    flex: 1,
    justifyContent: 'center', 
    alignItems: 'center',     
    paddingHorizontal: 20,
  },
  otpCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 10,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 20,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 25,
    position: 'relative', 
  },
  otpBox: {
    width: 30, 
    height: 42, 
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  otpBoxActive: {
    borderColor: '#2e64e5', 
    backgroundColor: '#ffffff',
    borderWidth: 2,
  },
  otpText: {
    fontSize: 16, 
    fontWeight: 'bold',
    color: '#333',
  },
  hiddenInputOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    zIndex: 99, 
  },
  verifyButton: {
    width: '100%',
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  verifyButtonText: {
    color: '#2e64e5',
    fontSize: 16,
    fontWeight: '600',
  },
  backToEmailButton: {
    paddingVertical: 10,
  },
  backToEmailText: {
    color: '#666',
    fontSize: 14,
  }
});

