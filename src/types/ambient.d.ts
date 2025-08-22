// Optional Capacitor Firebase Messaging plugin ambient typing to avoid TS errors
declare module '@capacitor-firebase/messaging' {
  export const Messaging: {
    getToken: () => Promise<{ token?: string }>
  };
}


