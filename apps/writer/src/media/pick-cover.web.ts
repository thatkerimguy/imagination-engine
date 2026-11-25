// Web cover picker: the image comes back as a small JPEG data URI (blob: URLs die on reload).
// No files, no thumbnails: `BookCoverThumb` falls back to the data URI itself. `null` when cancelled.
import * as ImagePicker from 'expo-image-picker';

export async function pickCoverImage(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.6,
    base64: true,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  return asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
}
