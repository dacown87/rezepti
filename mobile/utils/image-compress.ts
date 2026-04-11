import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

const MAX_BYTES = 256_000;

export async function compressIfNeeded(uri: string): Promise<string> {
  if (Platform.OS === 'web') return uri;
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  if ((info as any).size <= MAX_BYTES) return uri;
  let quality = 0.7;
  let result = uri;
  for (let attempt = 0; attempt < 4; attempt++) {
    const manip = await ImageManipulator.manipulateAsync(
      result, [], { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
    );
    const info2 = await FileSystem.getInfoAsync(manip.uri, { size: true });
    result = manip.uri;
    if ((info2 as any).size <= MAX_BYTES) break;
    quality -= 0.15;
    if (quality < 0.1) break;
  }
  return result;
}
