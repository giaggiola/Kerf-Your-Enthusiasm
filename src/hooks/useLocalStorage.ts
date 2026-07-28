'use client';

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';

const LOCAL_STORAGE_EVENT = 'kerf-local-storage';

function parseStoredValue<T>(serialized: string, fallback: T): T {
  try {
    return JSON.parse(serialized) as T;
  } catch {
    return fallback;
  }
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [initialState] = useState(() => ({
    value: initialValue,
    serialized: JSON.stringify(initialValue),
  }));

  const getSnapshot = useCallback(() => {
    try {
      return window.localStorage.getItem(key) ?? initialState.serialized;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialState.serialized;
    }
  }, [initialState.serialized, key]);

  const subscribe = useCallback((onStoreChange: () => void) => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) onStoreChange();
    };
    const handleLocalStorage = (event: Event) => {
      if ((event as CustomEvent<{ key: string }>).detail.key === key) onStoreChange();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(LOCAL_STORAGE_EVENT, handleLocalStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(LOCAL_STORAGE_EVENT, handleLocalStorage);
    };
  }, [key]);

  const serialized = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => initialState.serialized
  );
  const storedValue = useMemo(
    () => parseStoredValue(serialized, initialState.value),
    [initialState.value, serialized]
  );

  // Return a wrapped version of useState's setter function that
  // persists the new value to localStorage
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        // Allow value to be a function so we have same API as useState
        const currentValue = parseStoredValue(getSnapshot(), initialState.value);
        const valueToStore =
          value instanceof Function ? value(currentValue) : value;

        window.localStorage.setItem(key, JSON.stringify(valueToStore));
        window.dispatchEvent(new CustomEvent(LOCAL_STORAGE_EVENT, {
          detail: { key },
        }));
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    },
    [getSnapshot, initialState.value, key]
  );

  return [storedValue, setValue];
}
