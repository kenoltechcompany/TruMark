/**
 * Home Screen for the TruMark mobile app.
 *
 * Displays placeholder buttons for "Scan to Check-In" (future phase)
 * and "Change School" (which clears the saved URL and returns to onboarding).
 */
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { clearSchool } from '../services/discovery';

interface Props {
  onChangeSchool: () => void;
}

export default function HomeScreen({ onChangeSchool }: Props) {
  const handleCheckIn = () => {
    Alert.alert('Coming Soon', 'QR check-in scanning will be available in a future update.');
  };

  const handleChangeSchool = async () => {
    await clearSchool();
    onChangeSchool();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TruMark</Text>
      <Text style={styles.subtitle}>Student Check-In</Text>

      {/* Scan to Check-In button */}
      <TouchableOpacity style={styles.primaryButton} onPress={handleCheckIn}>
        <Text style={styles.primaryButtonText}>Scan to Check-In</Text>
      </TouchableOpacity>

      {/* Change School button */}
      <TouchableOpacity style={styles.secondaryButton} onPress={handleChangeSchool}>
        <Text style={styles.secondaryButtonText}>Change School</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F8FA',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2328',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: '#656D76',
    marginBottom: 40,
  },
  primaryButton: {
    backgroundColor: '#0969DA',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 6,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#F6F8FA',
    borderWidth: 1,
    borderColor: '#D0D7DE',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 6,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#1F2328',
    fontSize: 16,
    fontWeight: '500',
  },
});
