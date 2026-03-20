import { Preferences } from "@capacitor/preferences";
import { safeJsonParse } from "./safe-json-parse";

export const getDataFromPreferences: <T>(
  key: string
) => Promise<T | null> = async (key: string) => {
  const data = await Preferences.get({ key });
  return safeJsonParse(data.value);
};
