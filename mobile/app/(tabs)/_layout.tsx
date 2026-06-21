import { useEffect, useState } from 'react';
import { Tabs, router, usePathname } from 'expo-router';
import { View, Text, Image, Pressable, Platform } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import { BookOpen, Plus, Calendar, Settings, ShoppingCart, UserRound } from 'lucide-react-native';

import { BugReportHeaderAction } from '@/components/BugReportHeaderAction';
import Colors from '@/constants/Colors';
import { openBugReportModal } from '@/utils/bug-reporting';
import { getAuthSession, getSupabaseClient } from '@/utils/auth';
import { LOGIN_FIRST_ACCOUNT_GATE_ENABLED } from '@/utils/login-first-routing';

export default function TabLayout() {
  const { colorScheme } = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const pathname = usePathname();
  const [authState, setAuthState] = useState<'unknown' | 'signed_out' | 'signed_in'>('unknown');

  useEffect(() => {
    let active = true;

    void getAuthSession().then((session) => {
      if (!active) return;
      setAuthState(session?.user ? 'signed_in' : 'signed_out');
    }).catch(() => {
      if (!active) return;
      setAuthState('signed_out');
    });

    const client = getSupabaseClient();
    if (!client) {
      setAuthState('signed_out');
      return () => {
        active = false;
      };
    }

    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setAuthState(session?.user ? 'signed_in' : 'signed_out');
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const showLoginFirstShell = LOGIN_FIRST_ACCOUNT_GATE_ENABLED;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tabIconSelected,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerShadowVisible: false,
        headerLeft: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16 }}>
            <Image
              source={require('../../public/Logo.png')}
              style={{ width: 28, height: 28, borderRadius: 6 }}
            />
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
              Recipe<Text style={{ color: '#C84B31' }}>Deck</Text>
            </Text>
          </View>
        ),
        headerRight: showLoginFirstShell
          ? authState === 'signed_in'
            ? () => (
              <BugReportHeaderAction
                onPress={() => {
                  openBugReportModal({
                    reportType: 'general',
                    sourceArea: 'global_button',
                    route: pathname,
                  });
                }}
              />
            )
            : undefined
          : () => (
            <Pressable
              onPress={() => router.push('/account')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                marginRight: 16,
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.background,
              }}
            >
              <UserRound size={16} color={String(colors.text)} />
              <Text
                style={{
                  color: colors.text,
                  fontSize: 13,
                  fontWeight: '600',
                  display: Platform.OS === 'web' ? 'flex' : 'none',
                }}
              >
                Account
              </Text>
            </Pressable>
          ),
        headerTitle: '',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Rezepte',
          tabBarIcon: ({ color }) => <BookOpen size={24} color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="extract"
        options={{
          title: 'Hinzufügen',
          tabBarIcon: ({ color }) => <Plus size={24} color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          title: 'Planer',
          tabBarIcon: ({ color }) => <Calendar size={24} color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="shopping"
        options={{
          title: 'Einkauf',
          tabBarIcon: ({ color }) => <ShoppingCart size={24} color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="scanner"
        options={{ href: null }} // nicht in Tab-Bar anzeigen, aber Route bleibt
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Einstellungen',
          tabBarIcon: ({ color }) => <Settings size={24} color={String(color)} />,
        }}
      />
    </Tabs>
  );
}
