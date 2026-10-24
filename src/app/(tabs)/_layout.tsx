import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NutritionIcon, ProgressIcon, SettingsIcon, TodayIcon, WorkoutsIcon } from '@/components/icons';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, layout } from '@/theme/tokens';
import { TourTarget } from '@/features/tour/TourTarget';

export default function TabLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.text2,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14 },
        tabBarStyle: {
          height: layout.tabBarHeight + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 6,
          backgroundColor: colors.bar,
          borderTopColor: colors.sep,
          borderTopWidth: 1,
          elevation: 0,
        },
        sceneStyle: { backgroundColor: colors.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Summary', tabBarIcon: ({ color }) => <TodayIcon color={color} /> }} />
      <Tabs.Screen
        name="nutrition"
        options={{ title: 'Nutrition', tabBarIcon: ({ color }) => <NutritionIcon color={color} /> }}
      />
      <Tabs.Screen name="workouts" options={{ title: 'Workouts', tabBarIcon: ({ color }) => <WorkoutsIcon color={color} /> }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: ({ color }) => <ProgressIcon color={color} /> }} />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <TourTarget id="settings-tab">
              <SettingsIcon color={color} />
            </TourTarget>
          ),
        }}
      />
    </Tabs>
  );
}
