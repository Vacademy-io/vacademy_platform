interface FlavorConfig {
  appName: string;
  domain: string;
  subdomain: string;
}

interface FlavorConfigs {
  [key: string]: FlavorConfig;
}

export const flavorConfig: FlavorConfigs = {
  // ============ iOS bundle identifiers ============
  // (must match Xcode PRODUCT_BUNDLE_IDENTIFIER)

  // the7cs iOS app
  "com.sevencs.learner": {
    appName: "the7cs",
    domain: "vacademy.io",
    subdomain: "7cs",
  },

  // SSDC HORIZON iOS app
  "io.ssdc.student.app": {
    appName: "SSDC HORIZON",
    domain: "vacademy.io",
    subdomain: "ssdc",
  },

  // iThinkers by Fivesep iOS app
  "io.fivesep.student.app": {
    appName: "iThinkers by Fivesep",
    domain: "ithinkersolympiad.com",
    subdomain: "practice",
  },

  // ============ Android app IDs ============
  // (must match applicationId in build.gradle)

  // the7cs Android app
  "com.sevencs.app": {
    appName: "The 7Cs",
    domain: "vacademy.io",
    subdomain: "7cs",
  },

  // iThinkers by Fivesep Android app
  "com.fivesep.app": {
    appName: "iThinkers by Fivesep",
    domain: "vacademy.io",
    subdomain: "fivesep",
  },

  // Shiksha Nation Android app
  "com.shikshanation.new.app": {
    appName: "Shiksha Nation",
    domain: "vacademy.io",
    subdomain: "shiksha-nation",
  },

  //SSDC Android App
   "io.vacademy.student.app": {
    appName: "SSDC Horizon",
    domain: "vacademy.io",
    subdomain: "ssdc",
  },

   // Enark Uplift Teacher Training Android app
  "com.enarkuplift.app": {
    appName: "Uplift Teacher Training",
    domain: "enarkuplift.in",
    subdomain: "training",
  }
};
