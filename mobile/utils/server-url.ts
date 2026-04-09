import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const PRODUCTION_URL = 'https://p01--rezepti-app--2s7hvlwm5zc5.code.run';
export const SERVER_URL_KEY = 'recipedeck_server_url';

export async function getServerUrl(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(SERVER_URL_KEY);
    if (stored?.trim()) return stored.trim();
  } catch {}
  return Platform.OS === 'web' ? '' : PRODUCTION_URL;
}
