import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase'; // Assuming this handles your auth

export default function SettingsScreen() {
  // Experience Toggle States
  const [animation, setAnimation] = useState(true);
  const [sounds, setSounds] = useState(true);
  const [haptic, setHaptic] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.replace('/' as any); // Routes back to the index/login screen
    } catch (error) {
      console.error("Logout Error", error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.mainBackground}>
        
        {/* 🟠 TOP SECTION (Blue Background, Curved Bottom) */}
        <View style={styles.topSection}>
          <Text style={styles.screenTitle}>Settings</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* 🟠 1. Account Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitlePad}>Account</Text>
            <View style={styles.card}>
              <TouchableOpacity 
                style={styles.row} 
                activeOpacity={0.7} 
                onPress={() => router.push('/profile' as any)} // 🟢 Routes to your app/profile.tsx
              >
                <View style={styles.rowLeft}>
                  <View style={[styles.iconWrapper, { backgroundColor: '#e0e8f9' }]}>
                    <Ionicons name="person-outline" size={20} color="#2e64e5" />
                  </View>
                  <Text style={styles.rowText}>View my profile</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#bbbbbb" />
              </TouchableOpacity>
            </View>
          </View>

          {/* 🟠 2. Experience Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitlePad}>Experience</Text>
            <View style={styles.card}>
              
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <View style={[styles.iconWrapper, { backgroundColor: '#f3e8ff' }]}>
                    <Ionicons name="color-wand-outline" size={20} color="#9333ea" />
                  </View>
                  <Text style={styles.rowText}>Animation</Text>
                </View>
                <Switch value={animation} onValueChange={setAnimation} trackColor={{ true: '#2e64e5', false: '#e0d8d0' }} />
              </View>
              <View style={styles.divider} />
              
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <View style={[styles.iconWrapper, { backgroundColor: '#e0f2fe' }]}>
                    <Ionicons name="volume-high-outline" size={20} color="#0284c7" />
                  </View>
                  <Text style={styles.rowText}>Sounds</Text>
                </View>
                <Switch value={sounds} onValueChange={setSounds} trackColor={{ true: '#2e64e5', false: '#e0d8d0' }} />
              </View>
              <View style={styles.divider} />

              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <View style={[styles.iconWrapper, { backgroundColor: '#dcfce7' }]}>
                    <Ionicons name="phone-portrait-outline" size={20} color="#16a34a" />
                  </View>
                  <Text style={styles.rowText}>Haptic Feedback</Text>
                </View>
                <Switch value={haptic} onValueChange={setHaptic} trackColor={{ true: '#2e64e5', false: '#e0d8d0' }} />
              </View>
              <View style={styles.divider} />

              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <View style={[styles.iconWrapper, { backgroundColor: '#fef3c7' }]}>
                    <Ionicons name={darkMode ? "moon" : "sunny-outline"} size={20} color="#d97706" />
                  </View>
                  <Text style={styles.rowText}>Night Mode</Text>
                </View>
                <Switch value={darkMode} onValueChange={setDarkMode} trackColor={{ true: '#2e64e5', false: '#e0d8d0' }} />
              </View>

            </View>
          </View>

          {/* 🟠 3. Support Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitlePad}>Support</Text>
            <View style={styles.card}>
              <TouchableOpacity style={styles.row} activeOpacity={0.7}>
                <Text style={styles.rowText}>Get Support</Text>
                <Ionicons name="chevron-forward" size={20} color="#bbbbbb" />
              </TouchableOpacity>
              <View style={styles.divider} />
              
              <TouchableOpacity style={styles.row} activeOpacity={0.7}>
                <Text style={styles.rowText}>Send Feedback</Text>
                <Ionicons name="chevron-forward" size={20} color="#bbbbbb" />
              </TouchableOpacity>
              <View style={styles.divider} />

              <TouchableOpacity style={styles.row} activeOpacity={0.7}>
                <Text style={styles.rowText}>Terms of Use</Text>
                <Ionicons name="chevron-forward" size={20} color="#bbbbbb" />
              </TouchableOpacity>
              <View style={styles.divider} />

              <TouchableOpacity style={styles.row} activeOpacity={0.7}>
                <Text style={styles.rowText}>Privacy Policy</Text>
                <Ionicons name="chevron-forward" size={20} color="#bbbbbb" />
              </TouchableOpacity>
            </View>
          </View>

          {/* 🟠 4. Logout Button */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={22} color="#e65100" />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>

        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#2e64e5' }, 
  mainBackground: { flex: 1, backgroundColor: '#fcfaf8' },
  
  topSection: {
    backgroundColor: '#2e64e5', 
    paddingBottom: 20, 
    borderBottomLeftRadius: 35, 
    borderBottomRightRadius: 35,
    paddingHorizontal: 20,
    paddingTop: 10,
    zIndex: 1,
    alignItems: 'center',
  },
  
  screenTitle: { fontSize: 32, fontWeight: 'bold', color: '#ffffff' },
  scrollContent: { paddingBottom: 20, paddingTop: 10 },

  sectionContainer: { marginBottom: 30 },
  sectionTitlePad: { fontSize: 18, fontWeight: 'bold', color: '#333', paddingHorizontal: 20, marginBottom: 12 },
  
  card: { 
    marginHorizontal: 20,
    backgroundColor: '#ffffff', 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: '#e0d8d0',
    elevation: 1, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 2,
    overflow: 'hidden'
  },
  
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 20 },
  rowLeft: { flexDirection: 'row', alignItems: 'center' },
  iconWrapper: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  rowText: { fontSize: 16, fontWeight: '500', color: '#333' },
  
  divider: { height: 1, backgroundColor: '#f0f0f0', marginLeft: 20 },

  logoutButton: { 
    marginHorizontal: 20, 
    marginTop: 10,
    backgroundColor: '#fff3e0', 
    borderWidth: 1,
    borderColor: '#ffcc80',
    borderRadius: 16, 
    paddingVertical: 16, 
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center'
  },
  logoutText: { color: '#e65100', fontWeight: 'bold', fontSize: 16, marginLeft: 8 }
});