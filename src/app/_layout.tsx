import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';

import { DatabaseProvider, useDb } from '@/database/DatabaseProvider';
import { ReminderSync } from '@/features/reminders/ReminderSync';
import { getSetting } from '@/database/repositories/settingsRepository';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import type { ThemeName } from '@/theme/tokens';
import { CloudSync } from '@/features/cloud/CloudSync';
import { SetupGate } from '@/features/setup/SetupGate';
import { TourProvider } from '@/features/tour/TourProvider';

void SplashScreen.preventAutoHideAsync();

function NavigationTheme({ children }: { children: ReactNode }) {
  const { name, colors } = useTheme();
  const base = name === 'dark' ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      background: colors.bg,
      card: colors.bg,
      text: colors.text,
      border: colors.sep,
      primary: colors.accent,
    },
  };
  return (
    <NavigationThemeProvider value={theme}>
      <StatusBar style={name === 'dark' ? 'light' : 'dark'} />
      {children}
    </NavigationThemeProvider>
  );
}

/** Applies the saved appearance before the first screen draws, so there is no flash of the wrong theme. */
function AppearanceGate({ children }: { children: ReactNode }) {
  const db = useDb();
  const { setTheme } = useTheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSetting<ThemeName>(db, 'appearance', 'dark')
      .then((name) => {
        if (!cancelled) setTheme(name === 'light' ? 'light' : 'dark');
      })
      .catch(() => undefined)
      .finally(() => {
        if (cancelled) return;
        setReady(true);
        void SplashScreen.hideAsync();
      });
    return () => {
      cancelled = true;
    };
  }, [db, setTheme]);

  return ready ? children : null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    // Swipe actions (e.g. on Today's food rows) need gestures handled from the root.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <DatabaseProvider>
          <AppearanceGate>
            <ReminderSync />
            <CloudSync />
            <NavigationTheme>
              <SetupGate>
                <TourProvider>
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      animation: 'fade',
                      animationDuration: 150,
                    }}>
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen
                      name="entry/[id]"
                      options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                      }}
                    />
                    <Stack.Screen
                      name="log-food"
                      options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                      }}
                    />
                    <Stack.Screen
                      name="lift-progress/[id]"
                      options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                      }}
                    />
                    <Stack.Screen
                      name="muscle/[group]"
                      options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                      }}
                    />
                    <Stack.Screen
                      name="recipe-book/index"
                      options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                      }}
                    />
                    <Stack.Screen
                      name="recipe-book/[id]"
                      options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                      }}
                    />
                    <Stack.Screen
                      name="recipe-book/online/[id]"
                      options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                      }}
                    />
                    <Stack.Screen
                      name="recipe-book/cook"
                      options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                      }}
                    />
                    <Stack.Screen
                      name="exercise/[id]"
                      options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                      }}
                    />
                    <Stack.Screen
                      name="search-food"
                      options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                      }}
                    />
                    <Stack.Screen
                      name="saved-meals"
                      options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                      }}
                    />
                    <Stack.Screen
                      name="food/new"
                      options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                      }}
                    />
                    <Stack.Screen
                      name="food/[id]"
                      options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                      }}
                    />
                    <Stack.Screen
                      name="recipe/new"
                      options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                      }}
                    />
                    <Stack.Screen
                      name="recipe/[id]"
                      options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                      }}
                    />
                    <Stack.Screen
                      name="scan"
                      options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                      }}
                    />
                    <Stack.Screen
                      name="food/log"
                      options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                      }}
                    />
                    <Stack.Screen
                      name="lift/new"
                      options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                      }}
                    />
                    <Stack.Screen
                      name="prep"
                      options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                      }}
                    />
                    <Stack.Screen
                      name="shopping"
                      options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                      }}
                    />
                    <Stack.Screen
                      name="class/[id]"
                      options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                      }}
                    />
                    <Stack.Screen
                      name="lift/[id]"
                      options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                      }}
                    />
                  </Stack>
                </TourProvider>
              </SetupGate>
            </NavigationTheme>
          </AppearanceGate>
        </DatabaseProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
