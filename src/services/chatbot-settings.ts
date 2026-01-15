import { getInstituteId } from "@/constants/helper";
import { BASE_URL } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { Preferences } from "@capacitor/preferences";

export const DEFAULT_CHATBOT_SETTINGS = {
  assistant_name: "Savir",
  institute_name: "Vacademy",
  avatarUrl:
    "https://res.cloudinary.com/dwtmtd0oz/image/upload/t_chatbot/chatbot-avatar_xsyf0n",
  enable: false,
};
export const CHATBOT_SETTINGS_KEY = "CHATBOT_SETTING";
const LS_KEY = `${CHATBOT_SETTINGS_KEY}_cache_v1`;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const avatarUrl = DEFAULT_CHATBOT_SETTINGS.avatarUrl;

export interface ChatbotSettingsData {
  enable: boolean;
  assistant_name: string;
  institute_name: string;
  avatarUrl: string;
}

// export async function getChatbotSettings(): Promise<ChatbotSettingsData> {
//   const storageKey = "chatbotSettings";
//   const stored = await Preferences.get({ key: storageKey });
//   if (stored.value) {
//     try {
//       const parsed: ChatbotSettingsData = JSON.parse(stored.value);
//       return parsed;
//     } catch (e) {
//       console.error("Failed to parse stored chatbot settings:", e);
//       return DEFAULT_CHATBOT_SETTINGS;
//     }
//   }
//   return DEFAULT_CHATBOT_SETTINGS;
// }

export async function setChatbotSettings(
  settings: ChatbotSettingsData
): Promise<void> {
  await Preferences.set({
    key: LS_KEY,
    value: JSON.stringify(settings),
  });
}

function readCacheForInstitute(
  instituteId: string | null | undefined
): ChatbotSettingsData | null {
  if (!instituteId) return null;
  try {
    const raw = localStorage.getItem(`${LS_KEY}:${instituteId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      ts: number;
      data: ChatbotSettingsData;
    };
    return parsed?.ts && Date.now() - parsed.ts <= ONE_DAY_MS
      ? parsed.data
      : null;
  } catch {
    return null;
  }
}

async function writeCacheForInstitute(
  instituteId: string | null | undefined,
  data: ChatbotSettingsData
): Promise<void> {
  if (!instituteId) return;
  try {
    localStorage.setItem(
      `${LS_KEY}:${instituteId}`,
      JSON.stringify({ ts: Date.now(), data })
    );
  } catch {
    // noop
  }
}

export async function getChatbotSettings(
  forceRefresh = false,
  instituteId?: string
): Promise<ChatbotSettingsData> {
  const id = await getInstituteId();
  if (!instituteId) instituteId = id ?? "";
  if (!forceRefresh) {
    const cached = readCacheForInstitute(instituteId);
    if (cached) return cached;
  }
  if (!instituteId) {
    const defaults = DEFAULT_CHATBOT_SETTINGS;
    await writeCacheForInstitute(null, defaults);
    return defaults;
  }

  try {
    const res = await authenticatedAxiosInstance.get<{
      data: ChatbotSettingsData | null;
    }>(`${BASE_URL}/admin-core-service/institute/setting/v1/get`, {
      params: { instituteId, settingKey: CHATBOT_SETTINGS_KEY },
    });

    console.log("Fetched chatbot settings from API:", res.data.data);
    await writeCacheForInstitute(
      instituteId,
      res.data.data || DEFAULT_CHATBOT_SETTINGS
    );
    return res.data.data || DEFAULT_CHATBOT_SETTINGS;
  } catch {
    const defaults = DEFAULT_CHATBOT_SETTINGS;
    await writeCacheForInstitute(instituteId, defaults);
    return defaults;
  }
}

export function clearChatbotSettingsCache(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`${LS_KEY}:`)) keysToRemove.push(key);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (error) {
    console.error("Error clearing chatbot settings cache:", error);
  }
}
