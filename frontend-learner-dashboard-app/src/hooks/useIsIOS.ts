import { Capacitor } from '@capacitor/core';

/**
 * Hook to detect if the app is running on iOS via Capacitor.
 * Returns true only when running on iOS device/simulator.
 * Returns false for web, Android, and other platforms.
 */
export const useIsIOS = (): boolean => {
    return Capacitor.getPlatform() === 'ios';
};

/**
 * Direct function to check if running on iOS.
 * Use this in non-hook contexts.
 */
export const isIOSPlatform = (): boolean => {
    return Capacitor.getPlatform() === 'ios';
};
