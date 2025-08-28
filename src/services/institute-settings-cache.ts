import { Preferences } from '@capacitor/preferences';
import { getInstituteDetails } from './signup-api';

/**
 * Service to proactively fetch and cache institute settings
 * This ensures role assignment works correctly during signup
 */
export class InstituteSettingsCache {
  private static instance: InstituteSettingsCache;
  private cachePromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): InstituteSettingsCache {
    if (!InstituteSettingsCache.instance) {
      InstituteSettingsCache.instance = new InstituteSettingsCache();
    }
    return InstituteSettingsCache.instance;
  }

  /**
   * Fetch and cache institute settings if they're missing
   * This is called proactively to ensure settings are available during signup
   */
  public async ensureSettingsCached(instituteId: string): Promise<void> {
    // If already fetching, wait for that to complete
    if (this.cachePromise) {
      return this.cachePromise;
    }

    this.cachePromise = this._fetchAndCacheSettings(instituteId);
    try {
      await this.cachePromise;
    } finally {
      this.cachePromise = null;
    }
  }

  private async _fetchAndCacheSettings(instituteId: string): Promise<void> {
    try {
      // Check if we already have cached settings
      const stored = await Preferences.get({ key: "InstituteDetails" });
      if (stored?.value) {
        const parsed = JSON.parse(stored.value);
        if (parsed?.institute_settings_json) {
          return;
        }
      }

      // Fetch full institute details
      const fullInstituteDetails = await getInstituteDetails(instituteId);
      
      if (fullInstituteDetails?.setting) {
        // Store the full institute details
        await Preferences.set({
          key: "InstituteDetails",
          value: JSON.stringify({
            id: instituteId,
            name: fullInstituteDetails.institute_name || 'Unknown Institute',
            logo_file_id: fullInstituteDetails.institute_logo_file_id,
            institute_theme_code: fullInstituteDetails.institute_theme_code,
            institute_settings_json: fullInstituteDetails.setting
          })
        });
      }
    } catch (error) {
      // Don't throw - this is a background operation
    }
  }

  /**
   * Get cached institute settings
   */
  public async getCachedSettings(): Promise<any> {
    try {
      const stored = await Preferences.get({ key: "InstituteDetails" });
      if (stored?.value) {
        const parsed = JSON.parse(stored.value);
        if (parsed?.institute_settings_json) {
          return JSON.parse(parsed.institute_settings_json);
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Clear cached settings (useful for testing or when switching institutes)
   */
  public async clearCache(): Promise<void> {
    try {
      await Preferences.remove({ key: "InstituteDetails" });
    } catch (error) {
      // Silently handle errors
    }
  }
}

// Export singleton instance
export const instituteSettingsCache = InstituteSettingsCache.getInstance();
