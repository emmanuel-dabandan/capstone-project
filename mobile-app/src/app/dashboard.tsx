import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function DashboardScreen() {
  const [firstName, setFirstName] = useState('');
  const [strand, setStrand] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          router.replace('/' as any);
          return;
        }

        const { data, error } = await supabase
          .from('students')
          .select('first_name, strand')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        if (data) {
          setFirstName(data.first_name);
          setStrand(data.strand || 'Explorer'); 
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2e64e5" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      
      {/* 🟠 NEW: Top Navigation Bar */}
      <View style={styles.topNavBar}>
        {/* Left: Hamburger Menu */}
        <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
          <Text style={styles.hamburgerIcon}>☰</Text>
        </TouchableOpacity>

        {/* Middle: ASCEND Logo */}
        <Text style={styles.logoText}>ASCEND</Text>

        {/* Right: Notifications & Profile Avatar */}
        <View style={styles.rightNavContainer}>
          <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
            <Text style={styles.notifIcon}>🔔</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.profileAvatar} 
            activeOpacity={0.8}
            onPress={() => router.push('/profile' as any)} 
          >
            <Text style={styles.profileAvatarText}>
              {/* Dynamically pulls the first letter of their name! */}
              {firstName ? firstName.charAt(0).toUpperCase() : '👤'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 🟠 Main Scrollable Content */}
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* 1. "Welcome Back" Header */}
        <View style={styles.headerContainer}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.greetingText}>Welcome back,</Text>
            <Text style={styles.nameText}>{firstName}!</Text>
          </View>
          
          <View style={styles.badgeContainer}>
            <View style={styles.strandBadge}>
              <Text style={styles.strandBadgeText}>{strand}</Text>
            </View>
            <Text style={styles.syncIcon}>☁️ Sync: On</Text>
          </View>
        </View>

        {/* 2. "Continue Learning" Card */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Continue Learning</Text>
          
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.moduleTitle}>
                  {strand === 'CBF' ? 'Introduction to Food Safety' : strand === 'HUMMS' ? 'Philippine Politics' : 'Welcome to ASCEND'}
                </Text>
                <Text style={styles.moduleSubtitle}>Module 1 • Lesson 2</Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressWrapper}>
              <View style={styles.progressBarBackground}>
                <View style={[styles.progressBarFill, { width: '45%' }]} /> 
              </View>
              <Text style={styles.progressText}>45%</Text>
            </View>

            {/* Resume Button */}
            <TouchableOpacity style={styles.resumeButton} activeOpacity={0.8}>
              <Text style={styles.resumeButtonText}>Resume Lesson</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' }, 
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9f9f9' },

  // --- NEW: Top Nav Bar Styles ---
  topNavBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  iconButton: { padding: 5 },
  hamburgerIcon: { fontSize: 24, color: '#333', fontWeight: 'bold' },
  logoText: { fontSize: 20, fontWeight: '900', color: '#2e64e5', letterSpacing: 1.5 },
  
  rightNavContainer: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  notifIcon: { fontSize: 20, color: '#333' },
  
  profileAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2e64e5', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#eef3ff' },
  profileAvatarText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  // -------------------------------

  scrollContainer: { padding: 20, paddingBottom: 100, backgroundColor: '#f9f9f9', flexGrow: 1 },

  // Header Styles (Moved down slightly)
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 30 },
  headerTextContainer: { flex: 1 },
  greetingText: { fontSize: 16, color: '#666', marginBottom: 4 },
  nameText: { fontSize: 28, fontWeight: 'bold', color: '#333' },
  
  badgeContainer: { alignItems: 'flex-end' },
  strandBadge: { backgroundColor: '#eef3ff', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#d0ddff', marginBottom: 5 },
  strandBadgeText: { color: '#2e64e5', fontWeight: 'bold', fontSize: 12 },
  syncIcon: { fontSize: 10, color: '#28a745', fontWeight: '600' },

  // Section Styles
  sectionContainer: { marginBottom: 30 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 15 },

  // Card Styles
  card: { backgroundColor: '#ffffff', borderRadius: 16, padding: 20, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  moduleTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  moduleSubtitle: { fontSize: 14, color: '#888' },

  // Progress Bar Styles
  progressWrapper: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  progressBarBackground: { flex: 1, height: 8, backgroundColor: '#eee', borderRadius: 4, marginRight: 15, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#2e64e5', borderRadius: 4 },
  progressText: { fontSize: 14, fontWeight: 'bold', color: '#555' },

  // Button Styles
  resumeButton: { backgroundColor: '#2e64e5', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  resumeButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' }
});