import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // server: {
  //   url: "http://192.168.68.119:8100/",
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
  },
};

export default config;
