import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // server: {
  //   url: "http://192.168.31.249:8100/",
  //   cleartext: true,
  // },

  appId: "io.vacademy.student.app",
  appName: "Vacademy Learner",
  // appName: "SSDC Horizon",
  webDir: "dist",
  plugins: {
    PrivacyScreen: {
      enable: true,
      preventScreenshots: true,
    },
    // @capacitor/push-notifications — kept for backward compat (Android channel creation)
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    // @capacitor-firebase/messaging — primary FCM plugin used on Android & iOS
    FirebaseMessaging: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
