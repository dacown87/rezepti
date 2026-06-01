import { Tabs } from 'expo-router';
import { View, Text, Image } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import { BookOpen, Plus, Calendar, Settings, ShoppingCart } from 'lucide-react-native';

import Colors from '@/constants/Colors';

export default function TabLayout() {
  const { colorScheme } = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

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
