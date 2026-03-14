import * as ImageManipulator from 'expo-image-manipulator'

/** Compress and resize an image to fit within maxWidth while keeping under ~4MB */
export async function compressImage(uri: string, maxWidth = 1200): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxWidth } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  )
  return result.uri
}
