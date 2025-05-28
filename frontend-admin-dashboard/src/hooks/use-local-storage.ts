import { useState, useCallback } from "react";

const useLocalStorage = <T>(key: string, initialValue: T) => {
    // Use state to store the value in the hook
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(error);
            return initialValue;
        }
    });

    // Setter function to update the value in localStorage and state
    const setValue = useCallback(
        (value: T | ((val: T) => T)) => {
            try {
                // Allow value to be a function so we have the same API as useState
                const valueToStore = value instanceof Function ? value(storedValue) : value;
                // Save state
                setStoredValue(valueToStore);
                // Save to local storage
                window.localStorage.setItem(key, JSON.stringify(valueToStore));
            } catch (error) {
                console.error(error);
            }
        },
        [key, storedValue],
    );

    // Getter function to retrieve the value from localStorage or state
    const getValue = useCallback(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(error);
            return initialValue;
        }
    }, [initialValue, key]);

    // Function to clear the value from localStorage and reset the state
    const clearValue = useCallback(() => {
        try {
            // Remove from local storage
            window.localStorage.removeItem(key);
            // Reset state to initial value
            setStoredValue(initialValue);
        } catch (error) {
            console.error(error);
        }
    }, [initialValue, key]);

    return { setValue, getValue, clearValue };
};

export default useLocalStorage;
