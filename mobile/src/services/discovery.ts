/**
 * Federated discovery service for TruMark.
 *
 * Fetches a remote JSON file of school endpoints, falling back to a local
 * array if the remote fetch fails. The selected school's backendUrl is
 * persisted so the app remembers it across sessions.
 */
import localSchools from './schools.json';

const REMOTE_SCHOOLS_URL =
  'https://raw.githubusercontent.com/trumark/schools/main/schools.json';

const STORAGE_KEY_SCHOOL = 'trumark_selected_school';
const STORAGE_KEY_URL = 'trumark_backend_url';

// Safe dynamic AsyncStorage loader
let storageEngine: {
  getItem: (k: string) => Promise<string | null>;
  setItem: (k: string, v: string) => Promise<void>;
  removeItem: (k: string) => Promise<void>;
} | null = null;

try {
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
    storageEngine = AsyncStorage;
  }
} catch {
  // AsyncStorage module not bundled, fall back to memory
}

// In-memory fallback
const memoryStore: Record<string, string> = {};

export interface School {
  id: string;
  name: string;
  backendUrl: string;
}

async function getItem(key: string): Promise<string | null> {
  if (storageEngine) {
    try {
      const val = await storageEngine.getItem(key);
      if (val !== null) return val;
    } catch {
      // fallback to memory
    }
  }
  return memoryStore[key] ?? null;
}

async function setItem(key: string, value: string): Promise<void> {
  memoryStore[key] = value;
  if (storageEngine) {
    try {
      await storageEngine.setItem(key, value);
    } catch {
      // fallback kept
    }
  }
}

async function removeItem(key: string): Promise<void> {
  delete memoryStore[key];
  if (storageEngine) {
    try {
      await storageEngine.removeItem(key);
    } catch {
      // fallback kept
    }
  }
}

/**
 * Fetches the list of available schools. Falls back to local copy on failure.
 */
export async function fetchSchools(): Promise<School[]> {
  try {
    const response = await fetch(REMOTE_SCHOOLS_URL);
    if (!response.ok) throw new Error('Failed to fetch remote schools');
    return (await response.json()) as School[];
  } catch {
    // Fallback to local schools.json bundled with the app
    return localSchools as School[];
  }
}

/**
 * Persists the selected school's backend URL for later use.
 */
export async function saveSchool(school: School): Promise<void> {
  await setItem(STORAGE_KEY_SCHOOL, JSON.stringify(school));
  await setItem(STORAGE_KEY_URL, school.backendUrl);
}

/**
 * Returns the saved backend URL, or null if no school has been selected yet.
 */
export async function getSavedBackendUrl(): Promise<string | null> {
  try {
    return await getItem(STORAGE_KEY_URL);
  } catch {
    return null;
  }
}

/**
 * Returns the saved school object, or null.
 */
export async function getSavedSchool(): Promise<School | null> {
  try {
    const raw = await getItem(STORAGE_KEY_SCHOOL);
    return raw ? (JSON.parse(raw) as School) : null;
  } catch {
    return null;
  }
}

/**
 * Clears the saved school data (used on "Change School").
 */
export async function clearSchool(): Promise<void> {
  await removeItem(STORAGE_KEY_SCHOOL);
  await removeItem(STORAGE_KEY_URL);
}
