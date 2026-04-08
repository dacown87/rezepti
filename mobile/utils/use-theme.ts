import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'nativewind';

const THEME_KEY = 'app_color_scheme';

/** Call once in the root layout to restore the saved theme on startup. */
export function useThemeInit() {
  const { setColorScheme } = useColorScheme();

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (saved === 'dark' || saved === 'light') {
        setColorScheme(saved);
      } else {
        setColorScheme('light'); // default: always start in light mode
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Use in any screen that needs to read or change the theme. */
export function useTheme() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const setTheme = async (scheme: 'light' | 'dark') => {
    setColorScheme(scheme);
    await AsyncStorage.setItem(THEME_KEY, scheme);
  };

  return { isDark, setTheme };
}
