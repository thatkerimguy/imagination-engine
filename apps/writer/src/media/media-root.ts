// Native: the document directory that `media_assets.relative_path` values resolve against.
import { Paths } from 'expo-file-system';

export const mediaRoot = (): string => Paths.document.uri;
