import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';

import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/fonts';

const iconSize = 24;

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedText,
        sceneStyle: { backgroundColor: colors.background },
        tabBarLabelStyle: { fontFamily: fonts.sansMedium, fontSize: 10, letterSpacing: 0.2 },
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
          height: 72,
          paddingBottom: 9,
          paddingTop: 7,
          shadowOpacity: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'house.fill', android: 'home', web: 'home' }} size={iconSize} tintColor={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menu',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'menucard.fill', android: 'restaurant_menu', web: 'restaurant_menu' }} size={iconSize} tintColor={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'bag.fill', android: 'shopping_bag', web: 'shopping_bag' }} size={iconSize} tintColor={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          title: 'Rewards',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'star.fill', android: 'star', web: 'star' }} size={iconSize} tintColor={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'person.fill', android: 'person', web: 'person' }} size={iconSize} tintColor={color} />
          ),
        }}
      />
    </Tabs>
  );
}
