export const INSTITUTE_KEY = "institute_id";

const getFromLocalStorage = <T = string>(
  key: string,
  defaultValue: T | null = null
): T | null => {
  try {
    if (typeof window === "undefined") {
      return defaultValue;
    }

    const item = localStorage.getItem(key);
    if (item === null) {
      return defaultValue;
    }

    try {
      return JSON.parse(item) as T;
    } catch {
      return item as unknown as T;
    }
  } catch (error) {
    console.error(
      `Error getting item from localStorage with key "${key}":`,
      error
    );
    return defaultValue;
  }
};

const setToLocalStorage = <T>(key: string, value: T): boolean => {
  try {
    if (typeof window === "undefined") {
      return false;
    }

    const serializedValue =
      typeof value === "string" ? value : JSON.stringify(value);
    localStorage.setItem(key, serializedValue);
    return true;
  } catch (error) {
    console.error(
      `Error setting item in localStorage with key "${key}":`,
      error
    );
    return false;
  }
};

const removeFromLocalStorage = (key: string): boolean => {
  try {
    if (typeof window === "undefined") {
      return false;
    }

    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(
      `Error removing item from localStorage with key "${key}":`,
      error
    );
    return false;
  }
};

const hasInLocalStorage = (key: string): boolean => {
  try {
    if (typeof window === "undefined") {
      return false;
    }

    return localStorage.getItem(key) !== null;
  } catch (error) {
    console.error(`Error checking localStorage for key "${key}":`, error);
    return false;
  }
};

const clearLocalStorage = (): boolean => {
  try {
    if (typeof window === "undefined") {
      return false;
    }

    localStorage.clear();
    return true;
  } catch (error) {
    console.error("Error clearing localStorage:", error);
    return false;
  }
};

export const LocalStorageUtils = {
  get: getFromLocalStorage,
  set: setToLocalStorage,
  remove: removeFromLocalStorage,
  has: hasInLocalStorage,
  clear: clearLocalStorage,
} as const;

export default LocalStorageUtils;
