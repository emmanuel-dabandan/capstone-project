import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  ImageBackground,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';

// Fill in the assigned coordinator names here once available
const STRAND_COORDINATORS: Record<string, string> = {
  HUMSS: '',
  CBF: '',
};

const getCoordinatorByStrand = (strand: string) => {
  const key = strand.trim().toUpperCase();
  return STRAND_COORDINATORS[key] || '';
};

export default function ProfileScreen() {
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const isOnboarding = onboarding === 'true';

  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState({
    firstName: '',
    lastName: '',
    lrn: '',
    strand: '',
    email: '',
    coordinator: '',
    gradeLevel: '',
    contactNumber: '',
    address: '',
  });

  // --- Edit Details Modal State (LRN & Strand are locked) ---
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editGradeLevel, setEditGradeLevel] = useState('');
  const [editContact, setEditContact] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  // --- Change Password Modal State ---
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const fetchProfileData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const { data, error } = await supabase
        .from('students')
        .select('first_name, last_name, lrn_number, strand, email, als_coordinator, grade_level, contact_number, address, profile_completed')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        const strandValue = data.strand || '';
        const assignedCoordinator = data.als_coordinator || getCoordinatorByStrand(strandValue);

        const loadedData = {
          firstName: data.first_name || '',
          lastName: data.last_name || '',
          lrn: data.lrn_number || '',
          strand: strandValue,
          email: data.email || user.email || '',
          coordinator: assignedCoordinator,
          gradeLevel: data.grade_level || '',
          contactNumber: data.contact_number || '',
          address: data.address || '',
        };

        setUserData(loadedData);

        if (isOnboarding || !data.profile_completed) {
          setEditFirstName(loadedData.firstName);
          setEditLastName(loadedData.lastName);
          setEditGradeLevel(loadedData.gradeLevel);
          setEditContact(loadedData.contactNumber);
          setEditAddress(loadedData.address);
          setEditModalVisible(true);
        }
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, []);

  const openEditModal = () => {
    setEditFirstName(userData.firstName);
    setEditLastName(userData.lastName);
    setEditGradeLevel(userData.gradeLevel);
    setEditContact(userData.contactNumber);
    setEditAddress(userData.address);
    setEditModalVisible(true);
  };

  const handleSaveDetails = async () => {
    if (
      !editFirstName.trim() ||
      !editLastName.trim() ||
      !editGradeLevel.trim() ||
      !editContact.trim() ||
      !editAddress.trim()
    ) {
      Alert.alert('Incomplete Profile', 'Please fill out all required profile fields before continuing.');
      return;
    }

    try {
      setIsSavingDetails(true);
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const updates = {
        first_name: editFirstName.trim(),
        last_name: editLastName.trim(),
        grade_level: editGradeLevel.trim(),
        contact_number: editContact.trim(),
        address: editAddress.trim(),
        profile_completed: true,
      };

      const { error } = await supabase
        .from('students')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      setUserData(prev => ({
        ...prev,
        firstName: updates.first_name,
        lastName: updates.last_name,
        gradeLevel: updates.grade_level,
        contactNumber: updates.contact_number,
        address: updates.address,
      }));

      setEditModalVisible(false);

      if (isOnboarding) {
        Alert.alert('Profile Complete!', 'Welcome to Learnify. You are all set!', [
          { text: 'Continue', onPress: () => router.replace('/home' as any) },
        ]);
      } else {
        Alert.alert('Success', 'Profile details updated successfully!');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update profile details.');
    } finally {
      setIsSavingDetails(false);
    }
  };

  const handleSavePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Invalid Password', 'Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New passwords do not match.');
      return;
    }

    try {
      setIsUpdatingPassword(true);
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setPasswordModalVisible(false);
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Success', 'Password changed successfully!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update password.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2e64e5" />
      </View>
    );
  }

  return (
    <ImageBackground
      source={require('../../assets/images/image.png')}
      style={styles.backgroundContainer}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ headerShown: false }} />

        {/* Header */}
        <View style={styles.headerBar}>
          {!isOnboarding && (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backIconText}>←</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>
            {isOnboarding ? 'Complete Your Profile' : 'My Account'}
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {/* Tab 1: Profile Overview */}
          <View style={styles.profileCard}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>
                {userData.firstName ? userData.firstName.charAt(0).toUpperCase() : '👤'}
              </Text>
            </View>

            <Text style={styles.fullName}>
              {userData.firstName || userData.lastName
                ? `${userData.firstName} ${userData.lastName}`.trim()
                : 'Not set'}
            </Text>
            <Text style={styles.lrnText}>LRN: {userData.lrn || 'Not set'}</Text>

            <View style={styles.profileActions}>
              <TouchableOpacity
                style={styles.actionButton}
                activeOpacity={0.8}
                onPress={openEditModal}
              >
                <Text style={styles.actionButtonText}>Edit Details</Text>
              </TouchableOpacity>
              {!isOnboarding && (
                <TouchableOpacity
                  style={styles.actionButton}
                  activeOpacity={0.8}
                  onPress={() => setPasswordModalVisible(true)}
                >
                  <Text style={styles.actionButtonText}>Change Password</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Tab 2: ALS Details */}
          <View style={styles.infoCard}>
            <View style={styles.cardHeaderDark}>
              <Text style={styles.cardHeaderTitle}>ALS Details</Text>
            </View>

            <View style={styles.cardBody}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>ALS Coordinator</Text>
                <Text style={styles.infoValue}>
                  {userData.coordinator || 'To be assigned'}
                </Text>
              </View>
              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Current Strand</Text>
                <Text style={styles.infoValue}>{userData.strand || 'Not set'}</Text>
              </View>
              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Current Grade Level</Text>
                <Text style={styles.infoValue}>{userData.gradeLevel || 'Not set'}</Text>
              </View>
            </View>
          </View>

          {/* Tab 3: Contact Info */}
          <View style={styles.infoCard}>
            <View style={styles.cardHeaderDark}>
              <Text style={styles.cardHeaderTitle}>Contact Info</Text>
            </View>

            <View style={styles.cardBody}>
              <View style={styles.infoRowColumn}>
                <Text style={styles.infoLabel}>Contact Number</Text>
                <Text style={styles.infoValue}>{userData.contactNumber || 'Not set'}</Text>
              </View>
              <View style={styles.divider} />

              <View style={styles.infoRowColumn}>
                <Text style={styles.infoLabel}>Email Address</Text>
                <Text style={styles.infoValueAddress}>{userData.email || 'Not set'}</Text>
              </View>
              <View style={styles.divider} />

              <View style={styles.infoRowColumn}>
                <Text style={styles.infoLabel}>Address</Text>
                <Text style={styles.infoValueAddress}>{userData.address || 'Not set'}</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* --- Edit / Complete Profile Details Modal --- */}
        <Modal visible={editModalVisible} transparent={true} animationType="slide">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <View style={styles.modalContent}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.modalTitle}>
                  {isOnboarding ? 'Complete Your Profile' : 'Edit Profile Details'}
                </Text>
                {isOnboarding && (
                  <Text style={styles.onboardingSubtitle}>
                    Please add your details first before starting your modules.
                  </Text>
                )}

                <Text style={styles.inputLabel}>First Name *</Text>
                <TextInput
                  style={styles.inputField}
                  value={editFirstName}
                  onChangeText={setEditFirstName}
                  placeholder="Enter first name"
                />

                <Text style={styles.inputLabel}>Last Name *</Text>
                <TextInput
                  style={styles.inputField}
                  value={editLastName}
                  onChangeText={setEditLastName}
                  placeholder="Enter last name"
                />

                <Text style={styles.inputLabel}>Current Grade Level *</Text>
                <TextInput
                  style={styles.inputField}
                  value={editGradeLevel}
                  onChangeText={setEditGradeLevel}
                  placeholder="e.g. Grade 11 or Grade 12"
                />

                <Text style={styles.inputLabel}>Contact Number *</Text>
                <TextInput
                  style={styles.inputField}
                  value={editContact}
                  onChangeText={setEditContact}
                  placeholder="e.g. 09123456789"
                  keyboardType="phone-pad"
                />

                <Text style={styles.inputLabel}>Address *</Text>
                <TextInput
                  style={[styles.inputField, { height: 70, textAlignVertical: 'top' }]}
                  value={editAddress}
                  onChangeText={setEditAddress}
                  placeholder="Enter your full address"
                  multiline={true}
                />

                <View style={styles.modalButtonsRow}>
                  {!isOnboarding && (
                    <TouchableOpacity
                      style={[styles.modalBtn, styles.cancelBtn]}
                      onPress={() => setEditModalVisible(false)}
                    >
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.modalBtn, styles.saveBtn]}
                    onPress={handleSaveDetails}
                    disabled={isSavingDetails}
                  >
                    {isSavingDetails ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.saveBtnText}>
                        {isOnboarding ? 'Save & Continue' : 'Save Changes'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* --- Change Password Modal --- */}
        <Modal visible={passwordModalVisible} transparent={true} animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Change Password</Text>

              <Text style={styles.inputLabel}>New Password</Text>
              <TextInput
                style={styles.inputField}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="At least 6 characters"
                secureTextEntry={true}
              />

              <Text style={styles.inputLabel}>Confirm New Password</Text>
              <TextInput
                style={styles.inputField}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter new password"
                secureTextEntry={true}
              />

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => {
                    setPasswordModalVisible(false);
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, styles.saveBtn]}
                  onPress={handleSavePassword}
                  disabled={isUpdatingPassword}
                >
                  {isUpdatingPassword ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText}>Update Password</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundContainer: { flex: 1, width: '100%', height: '100%' },
  safeArea: { flex: 1, backgroundColor: 'rgba(245, 245, 245, 0)' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  scrollContainer: { padding: 20, paddingBottom: 50 },

  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 20, paddingBottom: 20, paddingHorizontal: 20 },
  backButton: { position: 'absolute', left: 20, top: 15, padding: 5, justifyContent: 'center', alignItems: 'center', paddingTop: 50 },
  backIconText: { fontSize: 32, fontWeight: 'bold', color: '#fefefe', marginTop: -65 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#333' },

  profileCard: { backgroundColor: 'rgba(255, 255, 255, 0.15)', borderRadius: 20, padding: 25, alignItems: 'center', borderWidth: 1, borderColor: '#ddd', marginBottom: 20 },
  avatarContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#2e64e5', justifyContent: 'center', alignItems: 'center', marginBottom: 15, borderWidth: 3, borderColor: '#eef3ff' },
  avatarText: { fontSize: 40, color: '#fff', fontWeight: 'bold' },
  fullName: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  lrnText: { fontSize: 14, color: '#666', marginBottom: 20 },

  profileActions: { flexDirection: 'row', gap: 15, width: '100%', justifyContent: 'center' },
  actionButton: { backgroundColor: '#2e64e5', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, flex: 1, alignItems: 'center' },
  actionButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  infoCard: { backgroundColor: 'rgba(255, 255, 255, 0.75)', borderRadius: 20, borderWidth: 1, borderColor: '#ddd', marginBottom: 20, overflow: 'hidden' },
  cardHeaderDark: { backgroundColor: '#2e64e5', paddingVertical: 15, paddingHorizontal: 20 },
  cardHeaderTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  cardBody: { padding: 20 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  infoRowColumn: { flexDirection: 'column', alignItems: 'flex-start', paddingVertical: 5 },
  infoLabel: { fontSize: 14, color: '#888', fontWeight: '600', marginBottom: 4 },
  infoValue: { fontSize: 15, color: '#333', fontWeight: 'bold' },
  infoValueAddress: { fontSize: 15, color: '#333', fontWeight: 'bold', lineHeight: 22, marginTop: 4 },

  divider: { height: 1, backgroundColor: '#eee', marginVertical: 12 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 25, elevation: 10, maxHeight: '88%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 8, textAlign: 'center' },
  onboardingSubtitle: { fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 12 },
  inputLabel: { fontSize: 12, fontWeight: 'bold', color: '#666', marginBottom: 4, marginTop: 10 },
  inputField: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 14, backgroundColor: '#fafafa', color: '#333' },
  modalButtonsRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#ddd' },
  cancelBtnText: { color: '#666', fontWeight: 'bold' },
  saveBtn: { backgroundColor: '#2e64e5' },
  saveBtnText: { color: '#fff', fontWeight: 'bold' },
});