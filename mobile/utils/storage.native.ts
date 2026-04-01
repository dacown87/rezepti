import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Storage } from './storage';

const nativeStorage: Storage = {
  async getItem(key: string) {
    return AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    await AsyncStorage.setItem(key, value);
  },
  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
  },
};

export default nativeStorage;
