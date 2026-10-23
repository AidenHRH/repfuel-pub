import * as SystemUI from 'expo-system-ui';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { palettes, type Palette, type ThemeName } from './tokens';

type ThemeContextValue = {
  name: ThemeName;
  colors: Palette;
  setTheme: (name: ThemeName) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children, initial = 'dark' }: { children: ReactNode; initial?: ThemeName }) {
  const [name, setTheme] = useState<ThemeName>(initial);
  const value = useMemo(() => ({ name, colors: palettes[name], setTheme }), [name]);

  // The native root view shows through during transitions; keep it the same colour as the app.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(palettes[name].bg).catch(() => undefined);
  }, [name]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
