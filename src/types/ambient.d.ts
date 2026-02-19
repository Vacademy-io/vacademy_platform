// Cashfree.js - loader for Cashfree payment SDK
declare module '@cashfreepayments/cashfree-js' {
  export function load(params?: { mode?: 'sandbox' | 'production' }): Promise<{
    create: (name: string, options?: object) => { mount: (selector: string) => void; destroy?: () => void };
    checkout: (opts: { paymentSessionId: string; returnUrl: string }) => Promise<{ error?: { message?: string }; redirect?: unknown }>;
    pay: (opts: { paymentMethod: unknown; paymentSessionId: string; returnUrl: string }) => Promise<{ error?: { message?: string }; redirect?: unknown }>;
  } | null>;
}

// Optional Capacitor Firebase Messaging plugin ambient typing to avoid TS errors
declare module '@capacitor-firebase/messaging' {
  export const Messaging: {
    getToken: () => Promise<{ token?: string }>
  };
}


