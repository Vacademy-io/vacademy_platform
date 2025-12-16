interface InstituteSettings {
  isDrippingEnable: boolean;
}

// Utility function to parse institute settings
export const parseDripConditions = (
  settingsString: string
): InstituteSettings => {
  try {
    // Handle null, undefined, or empty string
    if (!settingsString || settingsString.trim() === "") {
      return {
        isDrippingEnable: false,
      };
    }

    const settings = JSON.parse(settingsString);
    // Handle case where parsed result is null or not an object
    if (!settings || typeof settings !== "object") {
      return {
        isDrippingEnable: false,
      };
    }
    // Extract permissions from the nested structure
    let isDrippingEnable = false;
    if (settings.setting && typeof settings.setting === "object") {
      if (
        settings.setting.COURSE_SETTING &&
        settings.setting.COURSE_SETTING.data &&
        settings.setting.COURSE_SETTING.data.dripConditions
      ) {
        isDrippingEnable =
          settings.setting.COURSE_SETTING.data.dripConditions.enabled ?? false;
      }
    }

    return {
      isDrippingEnable,
    };
  } catch (error) {
    console.error("Error parsing institute settings:", error);
    return {
      isDrippingEnable: false,
    };
  }
};
