import React from 'react';
import { Link, Tabs } from 'expo-router';
import { Pressable, View } from 'react-native';
import { SymbolView } from '@/components/AppIcon';
import { Ionicons } from '@expo/vector-icons';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useStore } from '@/store/useStore';

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const settings = useStore(state => state.settings);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        headerShown: true,
        headerStyle: {
          backgroundColor: Colors[colorScheme].background,
          shadowColor: 'transparent',
          elevation: 0,
        },
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        tabBarStyle: {
          backgroundColor: Colors[colorScheme].background,
          borderTopColor: Colors[colorScheme].cardBackground,
        }
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Listas',
          tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'list.bullet', android: 'list', web: 'list' }} size={24} tintColor={color} />,
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Link href="/globalSettingsModal" asChild>
                <Pressable>
                  {({ pressed }) => (
                    <Ionicons name="settings-outline" size={24} color={Colors[colorScheme].text} style={{ marginRight: 15, opacity: pressed ? 0.5 : 1 }} />
                  )}
                </Pressable>
              </Link>
              <Link href="/modal" asChild>
                <Pressable>
                  {({ pressed }) => (
                    <Ionicons name="add" size={28} color={Colors[colorScheme].text} style={{ marginRight: 15, opacity: pressed ? 0.5 : 1 }} />
                  )}
                </Pressable>
              </Link>
              <Link href="/searchModal" asChild>
                <Pressable>
                  {({ pressed }) => (
                    <Ionicons name="search" size={24} color={Colors[colorScheme].text} style={{ marginRight: 15, opacity: pressed ? 0.5 : 1 }} />
                  )}
                </Pressable>
              </Link>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="enjoying"
        options={{
          title: 'Disfrutando',
          href: settings?.showEnjoying !== false ? '/enjoying' : null,
          tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'play.tv', android: 'live-tv', web: 'live-tv' }} size={24} tintColor={color} />,
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          title: 'Planificador',
          href: settings?.showPlanner !== false ? '/planner' : null,
          tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'sun.max', android: 'light-mode', web: 'light-mode' }} size={24} tintColor={color} />,
        }}
      />
      <Tabs.Screen
        name="logbook"
        options={{
          title: 'Bitácora',
          href: settings?.showLogbook !== false ? '/logbook' : null,
          tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'text.book.closed', android: 'book', web: 'book' }} size={24} tintColor={color} />,
        }}
      />
    </Tabs>
  );
}

