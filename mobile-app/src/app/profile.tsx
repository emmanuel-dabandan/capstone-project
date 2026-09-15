import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function ProfileScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState({
    firstName: '',
    lastName: '',
    lrn: '',
    strand: '',
    email: '',
    // Placeholder states for future database columns
    coordinator: 'Mr. Juan Dela Cruz',
    gradeLevel: 'Grade 11',
    contactNumber: '+63 912 345 6789',
    address: 'Blk 10 Lt 3 Arellano St.\nMolino Homes II Salitran III\nDasmariñas City, Cavite 4114'
  });

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return;

        const { data, error } = await supabase
          .from('students')
          .select('first_name, last_name, lrn_number, strand, email')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        if (data) {
          setUserData(prev => ({
            ...prev,
            firstName: data.first_name || '',
            lastName: data.last_name || '',
            lrn: data.lrn_number || 'N/A',
            strand: data.strand || 'N/A',
            email: data.email || user.email || ''
          }));
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfileData();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b2313" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      
      {/* 🟠 Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backIconText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Account</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* 🟠 Tab 1: Profile Overview */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {userData.firstName ? userData.firstName.charAt(0).toUpperCase() : '👤'}
            </Text>
          </View>
          
          <Text style={styles.fullName}>{userData.firstName} {userData.lastName}</Text>
          <Text style={styles.lrnText}>LRN: {userData.lrn}</Text>

          <View style={styles.profileActions}>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Edit Details</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Change Password</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 🟠 Tab 2: ALS Details */}
        <View style={styles.infoCard}>
          <View style={styles.cardHeaderDark}>
            <Text style={styles.cardHeaderTitle}>📚 ALS Details</Text>
          </View>
          
          <View style={styles.cardBody}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>ALS Coordinator</Text>
              <Text style={styles.infoValue}>{userData.coordinator}</Text>
            </View>
            <View style={styles.divider} />
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Current Strand</Text>
              <Text style={styles.infoValue}>{userData.strand}</Text>
            </View>
            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Current Grade Level</Text>
              <Text style={styles.infoValue}>{userData.gradeLevel}</Text>
            </View>
          </View>
        </View>

        {/* 🟠 Tab 3: Contact Info */}
        <View style={styles.infoCard}>
          <View style={styles.cardHeaderDark}>
            <Text style={styles.cardHeaderTitle}>📞 Contact Info</Text>
          </View>
          
          <View style={styles.cardBody}>
            <View style={styles.infoRowColumn}>
              <Text style={styles.infoLabel}>Contact Number</Text>
              <Text style={styles.infoValue}>{userData.contactNumber}</Text>
            </View>
            <View style={styles.divider} />
            
            {/* 🟢 FIXED: Switched to infoRowColumn to prevent text overlap */}
            <View style={styles.infoRowColumn}>
              <Text style={styles.infoLabel}>Email Address</Text>
              <Text style={styles.infoValueAddress}>{userData.email}</Text>
            </View>
            <View style={styles.divider} />

            <View style={styles.infoRowColumn}>
              <Text style={styles.infoLabel}>Address</Text>
              <Text style={styles.infoValueAddress}>{userData.address}</Text>
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fcfaf8' }, // Light off-white to match the image theme
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fcfaf8' },
  scrollContainer: { padding: 20, paddingBottom: 50 },

  // Header Styles
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 20, paddingBottom: 20, paddingHorizontal: 20 },
  backButton: { position: 'absolute', left: 20, top: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: '#3b2313', justifyContent: 'center', alignItems: 'center' },
  backIconText: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginTop: -2 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#3b2313' },

  // Tab 1: Profile Overview
  profileCard: { backgroundColor: '#fff', borderRadius: 20, padding: 25, alignItems: 'center', borderWidth: 1, borderColor: '#e0d8d0', marginBottom: 20 },
  avatarContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#3b2313', justifyContent: 'center', alignItems: 'center', marginBottom: 15, borderWidth: 3, borderColor: '#eef3ff' },
  avatarText: { fontSize: 40, color: '#fff', fontWeight: 'bold' },
  fullName: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  lrnText: { fontSize: 14, color: '#666', marginBottom: 20 },
  
  profileActions: { flexDirection: 'row', gap: 15, width: '100%', justifyContent: 'center' },
  actionButton: { backgroundColor: '#3b2313', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, flex: 1, alignItems: 'center' },
  actionButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  // Tabs 2 & 3: Info Cards
  infoCard: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#e0d8d0', marginBottom: 20, overflow: 'hidden' },
  cardHeaderDark: { backgroundColor: '#3b2313', paddingVertical: 15, paddingHorizontal: 20 },
  cardHeaderTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  
  cardBody: { padding: 20 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  infoRowColumn: { flexDirection: 'column', alignItems: 'flex-start', paddingVertical: 5 },
  infoLabel: { fontSize: 14, color: '#888', fontWeight: '600', marginBottom: 4 },
  infoValue: { fontSize: 15, color: '#333', fontWeight: 'bold' },
  infoValueAddress: { fontSize: 15, color: '#333', fontWeight: 'bold', lineHeight: 22, marginTop: 4 },
  
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 12 },
});