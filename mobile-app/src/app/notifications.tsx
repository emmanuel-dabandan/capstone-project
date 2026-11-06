import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAppTheme } from '../lib/ThemeContext';

export default function NotificationsScreen() {
  const { theme } = useAppTheme();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setNotifications(data);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (id: string, isRead: boolean) => {
    if (isRead) return;
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  };

  const getTimeAgo = (dateString: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
    if (seconds < 3600) return 'Just now';
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    const days = Math.floor(seconds / 86400);
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days} days ago`;
    return 'A month ago';
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.headerBg} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Notifications</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.cardContainer, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          {notifications.length === 0 ? (
            <View style={{ padding: 30, alignItems: 'center' }}>
              <Text style={{ color: theme.textSecondary }}>No recent notifications.</Text>
            </View>
          ) : (
            notifications.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.notificationItem,
                  { borderBottomColor: theme.divider },
                  index === notifications.length - 1 && styles.lastItem
                ]}
                activeOpacity={0.6}
                onPress={() => markAsRead(item.id, item.is_read)}
              >
                <View style={styles.itemContent}>
                  <Text style={[styles.messageText, { color: theme.textPrimary }, !item.is_read && styles.messageTextUnread]}>
                    {item.message}
                  </Text>

                  <View style={styles.timeRow}>
                    {!item.is_read && <View style={styles.unreadDot} />}
                    <Text style={[styles.timeText, { color: theme.textSecondary }]}>{getTimeAgo(item.created_at)}</Text>
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
  backButton: { padding: 5, marginLeft: -5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  cardContainer: { borderRadius: 20, borderWidth: 1, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, overflow: 'hidden' },
  notificationItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 20, paddingHorizontal: 20, borderBottomWidth: 1 },
  lastItem: { borderBottomWidth: 0 },
  itemContent: { flex: 1, paddingRight: 20 },
  messageText: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  messageTextUnread: { fontWeight: 'bold' },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00e676', marginRight: 6 },
  timeText: { fontSize: 13, fontWeight: '500' },
});