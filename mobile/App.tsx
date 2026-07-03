/**
 * TruMark Mobile - Root App Component
 *
 * Handles the navigation flow:
 * 1. On first launch (no saved backend URL) → SelectSchoolScreen
 * 2. After school selection → HomeScreen
 * 3. "Change School" button → clears saved data and returns to onboarding
 */
import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { getSavedBackendUrl } from './src/services/discovery';
import SelectSchoolScreen from './src/screens/SelectSchoolScreen';
import HomeScreen from './src/screens/HomeScreen';

export default function App() {
  const [hasSchool, setHasSchool] = useState<boolean | null>(null);

  useEffect(() => {
    getSavedBackendUrl().then((url) => {
      setHasSchool(!!url);
    });
  }, []);

  // Still checking SecureStore on startup
  if (hasSchool === null) {
    return null; // Or a splash screen
  }

  if (!hasSchool) {
    return (
      <>
        <StatusBar style="dark" />
        <SelectSchoolScreen onSchoolSelected={() => setHasSchool(true)} />
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <HomeScreen onChangeSchool={() => setHasSchool(false)} />
    </>
  );
}
