import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const AUTH_STORAGE_PREFIX = 'recipedeck-auth:';

type SecureStoreModule = typeof import('expo-secure-store');

let secureStorePromise: Promise<SecureStoreModule | null> | undefined;

async function getSecureStore(): Promise<SecureStoreModule | null> {
  if (Platform.OS === 'web') return null;

  secureStorePromise ??= import('expo-secure-store')
    .then(async (module) => ((await module.isAvailableAsync()) ? module : null))
    .catch(() => null);

  return secureStorePromise;
}

function authStorageKey(key: string): string {
  return `${AUTH_STORAGE_PREFIX}${key}`;
}

export const authStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const storageKey = authStorageKey(key);
    const secureStore = await getSecureStore();
    if (secureStore) {
      return secureStore.getItemAsync(storageKey);
    }
    return AsyncStorage.getItem(storageKey);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    const storageKey = authStorageKey(key);
    const secureStore = await getSecureStore();
    if (secureStore) {
      await secureStore.setItemAsync(storageKey, value);
      return;
    }
    await AsyncStorage.setItem(storageKey, value);
  },
  removeItem: async (key: string): Promise<void> => {
    const storageKey = authStorageKey(key);
    const secureStore = await getSecureStore();
    if (secureStore) {
      await secureStore.deleteItemAsync(storageKey);
      return;
    }
    await AsyncStorage.removeItem(storageKey);
  },
};
