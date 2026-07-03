/**
 * TruMark Mobile - Check-in Screen
 *
 * Full-screen camera interface with:
 * 1. Text input for session ID
 * 2. Large "Scan & Check-In" button
 * 3. Captures GPS + photo, POSTs to backend
 * 4. Full-screen green success or red error
 */
import { useState, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import axios from 'axios';
import { clearSchool, getSavedBackendUrl } from '../services/discovery';

interface Props {
  onChangeSchool: () => void;
}

export default function HomeScreen({ onChangeSchool }: Props) {
  const [sessionId, setSessionId] = useState('');
  const [cameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [state, setState] = useState<'idle' | 'capturing' | 'submitting' | 'success' | 'error'>('idle');
  const [resultMessage, setResultMessage] = useState('');
  const [resultStudent, setResultStudent] = useState<{ fullName: string; indexNumber: string } | null>(null);

  const handleCheckIn = useCallback(async () => {
    if (!sessionId.trim()) {
      Alert.alert('Enter Session ID', 'Please enter a session ID before checking in.');
      return;
    }

    setState('capturing');

    try {
      // 1. Capture GPS
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });

      // 2. Capture photo
      if (!cameraRef.current) {
        throw new Error('Camera not ready');
      }
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        base64: false,
      });
      if (!photo) throw new Error('Failed to capture photo');

      setState('submitting');

      // 3. POST to backend
      const backendUrl = await getSavedBackendUrl();
      if (!backendUrl) throw new Error('No backend URL configured');

      const formData = new FormData();
      formData.append('latitude', String(loc.coords.latitude));
      formData.append('longitude', String(loc.coords.longitude));
      formData.append('image', {
        uri: photo.uri,
        type: 'image/jpeg',
        name: 'checkin.jpg',
      } as any);

      const response = await axios.post(
        `${backendUrl}/api/public/sessions/${sessionId.trim()}/check-in`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );

      const data = response.data;
      setResultStudent(data.student);
      setResultMessage(data.message || 'Check-in successful!');
      setState('success');
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Check-in failed';
      setResultMessage(msg);
      setResultStudent(null);
      setState('error');
    }
  }, [sessionId]);

  const handleChangeSchool = async () => {
    await clearSchool();
    onChangeSchool();
  };

  // ── Success flash ──
  if (state === 'success') {
    return (
      <View style={[styles.container, { backgroundColor: '#1F883D' }]}>
        <Text style={styles.flashTitle}>✓ Checked In</Text>
        {resultStudent && (
          <>
            <Text style={styles.flashName}>{resultStudent.fullName}</Text>
            <Text style={styles.flashIndex}>{resultStudent.indexNumber}</Text>
          </>
        )}
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: '#FFFFFF', marginTop: 40 }]}
          onPress={() => {
            setState('idle');
            setResultMessage('');
            setResultStudent(null);
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Error flash ──
  if (state === 'error') {
    return (
      <View style={[styles.container, { backgroundColor: '#D73A49' }]}>
        <Text style={styles.flashTitle}>✗ Check-In Failed</Text>
        <Text style={styles.flashName}>{resultMessage}</Text>
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: '#FFFFFF', marginTop: 40 }]}
          onPress={() => {
            setState('idle');
            setResultMessage('');
            setResultStudent(null);
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Camera / idle view ──
  if (!cameraPermission?.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ color: '#656D76', fontSize: 14, textAlign: 'center', marginBottom: 16 }}>
          Camera permission is required for check-in.
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={onChangeSchool}>
          <Text style={styles.primaryButtonText}>Change School</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera preview */}
      <CameraView ref={cameraRef} style={styles.camera} facing="front" />

      {/* Session ID input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Session ID"
          placeholderTextColor="#656D76"
          value={sessionId}
          onChangeText={setSessionId}
          autoCapitalize="none"
        />
      </View>

      {/* Check-In button */}
      <TouchableOpacity
        style={[styles.primaryButton, (state === 'capturing' || state === 'submitting') && { opacity: 0.5 }]}
        onPress={handleCheckIn}
        disabled={state === 'capturing' || state === 'submitting'}
      >
        {state === 'capturing' || state === 'submitting' ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryButtonText}>Scan &amp; Check-In</Text>
        )}
      </TouchableOpacity>

      {/* Change School */}
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
  camera: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
  },
  inputRow: {
    width: '100%',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D0D7DE',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1F2328',
    textAlign: 'center',
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
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#D0D7DE',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 6,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#656D76',
    fontSize: 16,
    fontWeight: '500',
  },
  // Flash states
  flashTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  flashName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  flashIndex: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
  },
});
