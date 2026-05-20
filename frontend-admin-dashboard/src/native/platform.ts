import { Capacitor } from '@capacitor/core';

export type NativePlatform = 'ios' | 'android' | 'web';

export const getPlatform = (): NativePlatform => Capacitor.getPlatform() as NativePlatform;

export const isNative = (): boolean => Capacitor.isNativePlatform();
export const isIOS = (): boolean => getPlatform() === 'ios';
export const isAndroid = (): boolean => getPlatform() === 'android';
