interface FlavorConfig {
  appName: string;
  domain: string;
  subdomain: string;
}

interface FlavorConfigs {
  [key: string]: FlavorConfig;
}

export const flavorConfig: FlavorConfigs = {
  "io.vacademy.student.app": {
    appName: "SSDC Horizon",
    domain: "vacademy.io",
    subdomain: "ssdc",
  },
  "com.sevencs.app": {
    appName: "The 7Cs",
    domain: "vacademy.io",
    subdomain: "7cs",
  },
};
