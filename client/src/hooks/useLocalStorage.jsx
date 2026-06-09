import { useState, useEffect } from 'react';

function parseValue(value) {
  try {
    return value === 'undefined' ? undefined : JSON.parse(value);
  } catch {
    return value;
  }
}

function serializeValue(value) {
  return value === undefined ? 'undefined' : JSON.stringify(value);
}

export default function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item !== null ? parseValue(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, serializeValue(storedValue));
    } catch (error) {
      console.error(`[useLocalStorage] Failed to store ${key}:`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}
