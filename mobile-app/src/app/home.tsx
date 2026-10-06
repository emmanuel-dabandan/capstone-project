import React, { useRef, useState } from 'react';
import { View, ScrollView, Dimensions, TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// 🟢 Import your screens from the new components folder
import DashboardScreen from '../components/dashboard';
import LearnScreen from '../components/learn';
import SettingsScreen from '../components/settings';
import StatsScreen from '../components/stats';


const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const scrollRef = useRef<any>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // 🟢 Animated value driven by the ScrollView's horizontal offset
  const scrollX = useRef(new Animated.Value(0)).current;

  // 🟢 Detects your swipe position and updates the nav active state seamlessly
  const handleScroll = (event: any) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / width);
    if (index !== activeIndex) {
      setActiveIndex(index);
    }
  };

  // 🟢 Smoothly slides to the exact screen when you tap a bottom nav icon
  const goToPage = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
    setActiveIndex(index);
  };

  const navItems = [
    { id: 0, label: 'Home', icon: 'home', outline: 'home-outline' },
    { id: 1, label: 'Learn', icon: 'book', outline: 'book-outline' },
    { id: 2, label: 'Stats', icon: 'bar-chart', outline: 'bar-chart-outline' },
    { id: 3, label: 'Profile', icon: 'person', outline: 'person-outline' },
  ];

  const TAB_WIDTH = width / navItems.length;
  const PILL_WIDTH = TAB_WIDTH; // 🟢 Removed the margin subtractions

  // 🟢 Interpolates scrollX into edge-to-edge horizontal movement
  const pillTranslateX = scrollX.interpolate({
    inputRange: [0, width * (navItems.length - 1)],
    outputRange: [0, TAB_WIDTH * (navItems.length - 1)], // Starts at exactly 0
    extrapolate: 'clamp',
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#fcfaf8' }}>
      
      {/* 🟠 The Master Swipe Container */}
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false, listener: handleScroll }
        )}
        scrollEventThrottle={16} // Keeps the active state check running smoothly while swiping
        bounces={false}
        style={{ flex: 1 }}
      >
        {/* Page 0: Dashboard */}
        <View style={{ width, flex: 1 }}>
          <DashboardScreen />
        </View>
        
        {/* Page 1: Learn */}
        <View style={{ width, flex: 1 }}>
          <LearnScreen />
        </View>

        {/* Page 2: Stats (Placeholder) */}
        <View style={{ width, flex: 1 }}>
          <StatsScreen />
        </View>

        {/* Page 3: Profile (Placeholder) */}
        <View style={{ width, flex: 1 }}>
          <SettingsScreen />
        </View>
      </Animated.ScrollView>

      {/* 🟠 Dynamic Bottom Nav */}
      <View style={styles.bottomNav}>
        
        {/* 🟢 The Animated Sliding Pill */}
        <Animated.View
          style={[
            styles.slidingPill,
            {
              width: PILL_WIDTH,
              transform: [{ translateX: pillTranslateX }],
            },
          ]}
        />

        {navItems.map((item) => {
          const isFocused = activeIndex === item.id;
          
          return (
            <TouchableOpacity 
              key={item.id} 
              onPress={() => goToPage(item.id)} 
              style={styles.navItem}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={isFocused ? item.icon : item.outline as any} 
                size={24} 
                color={isFocused ? '#ffffff' : '#888888'} 
                style={styles.iconMargin} 
              />
              <Text style={isFocused ? styles.navTextActive : styles.navText}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: { 
    height: 80, 
    backgroundColor: '#ffffff', 
    flexDirection: 'row', 
    borderTopWidth: 1, 
    borderTopColor: '#e0d8d0',
    position: 'relative' // 🟢 Required so the sliding pill can float inside it
  },
  slidingPill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: '#2e64e5',
    borderRadius: 0,
    zIndex: 0,
  },
  navItem: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingBottom: 15, 
    zIndex: 1 // 🟢 Keeps icons and text clickable and above the pill
  },
  navItemActive: { backgroundColor: '#2e64e5', borderRadius: 0, marginHorizontal: 0, marginTop: 0, marginBottom: 0, paddingVertical: 0 }, 
  iconMargin: { marginBottom: 4 }, 
  navText: { fontSize: 12, color: '#888', fontWeight: '500' },
  navTextActive: { fontSize: 12, color: '#ffffff', fontWeight: 'bold' }
});