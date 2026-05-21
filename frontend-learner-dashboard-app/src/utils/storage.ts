import { safeJsonParse } from "./safe-json-parse";
import { preferencesGet } from "./preferences-storage";

export const getDataFromPreferences: <T>(
  key: string
) => Promise<T | null> = async (key: string) => {
  const data = await preferencesGet(key);
  return safeJsonParse(data.value);
};
