import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

interface CaptureNative {
  hasAccess(): Promise<boolean>; openSettings(): Promise<void>;
  getApps(): Promise<{ name: string; packageName: string }[]>;
  configure(packages: string[]): Promise<void>; read(): Promise<string>;
  acknowledge(ids: string[]): Promise<void>; dropped(): Promise<number>; clear(): Promise<void>;
}
export function captureNative(): CaptureNative | null {
  if (Platform.OS !== 'android') return null;
  return requireOptionalNativeModule<CaptureNative>('HorizonteCapture');
}
