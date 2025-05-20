import { useState, useEffect, useCallback } from "react";

/**
 * Custom hook for working with localStorage
 * @param {string} key - The localStorage key
 * @param {any} initialValue - Default value if key doesn't exist in localStorage
 * @returns {Array} - [storedValue, setValue, clearValue]
 */
const useLocalStorage = <T>(key: string, initialValue: T) => {
    // Get stored value from localStorage or use initialValue
    const getStoredValue = useCallback(() => {
        if (typeof window === "undefined") {
            return initialValue;
        }

        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(`Error getting localStorage key "${key}":`, error);
            return initialValue;
        }
    }, [key, initialValue]);

    // State to store our value
    const [storedValue, setStoredValue] = useState(getStoredValue);

    // Return a wrapped version of useState's setter function that
    // persists the new value to localStorage
    const setValue = useCallback(
        (value: T | ((val: T) => T)) => {
            try {
                // Allow value to be a function so we have the same API as useState
                const valueToStore = value instanceof Function ? value(storedValue) : value;

                // Save state
                setStoredValue(valueToStore);

                // Save to localStorage
                if (typeof window !== "undefined") {
                    window.localStorage.setItem(key, JSON.stringify(valueToStore));
                }
            } catch (error) {
                console.error(`Error setting localStorage key "${key}":`, error);
            }
        },
        [key, storedValue],
    );

    // Clear value from localStorage
    const clearValue = useCallback(() => {
        try {
            // Remove from localStorage
            if (typeof window !== "undefined") {
                window.localStorage.removeItem(key);
            }

            // Reset state to initialValue
            setStoredValue(initialValue);
        } catch (error) {
            console.error(`Error clearing localStorage key "${key}":`, error);
        }
    }, [key, initialValue]);

    // Sync with localStorage if key changes in another tab/window
    useEffect(() => {
        const handleStorageChange = (event: StorageEvent) => {
            if (event.key === key) {
                setStoredValue(getStoredValue());
            }
        };

        // Add event listener
        window.addEventListener("storage", handleStorageChange);

        // Clean up
        return () => {
            window.removeEventListener("storage", handleStorageChange);
        };
    }, [key, getStoredValue]);

    return [storedValue, setValue, clearValue];
};

export default useLocalStorage;
