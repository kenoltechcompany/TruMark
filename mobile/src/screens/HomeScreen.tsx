/**
 * TruMark Mobile - Student Hub Screen
 *
 * Provides a segmented 3-tab experience:
 * 1. Check-In: Camera selfie + GPS geofenced verification with optional session QR scanner
 * 2. My Attendance: Student portal to query attendance history and percentage by Index Number
 * 3. Register Face: In-app face biometric enrollment for students
 */
import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import axios from 'axios';
import { clearSchool, getSavedBackendUrl } from '../services/discovery';

interface Props {
  onChangeSchool: () => void;
}

type TabType = 'checkin' | 'attendance' | 'register';

interface AttendanceRecordItem {
  id: string;
  timestamp: string;
  session: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    classroom?: { name: string } | null;
  };
}

interface StudentAttendanceResponse {
  student: {
    id: string;
    fullName: string;
    indexNumber: string;
    class: { id: string; name: string };
  };
  totalSessions: number;
  attendedCount: number;
  attendanceRate: string;
  records: AttendanceRecordItem[];
}

export default function HomeScreen({ onChangeSchool }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('checkin');

  // ──────────────────────────────────────────
  // Check-In State
  // ──────────────────────────────────────────
  const [sessionId, setSessionId] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('front');
  const [isScanningQr, setIsScanningQr] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const [state, setState] = useState<
    'idle' | 'capturing' | 'submitting' | 'success' | 'error'
  >('idle');
  const [resultMessage, setResultMessage] = useState('');
  const [resultStudent, setResultStudent] = useState<{
    fullName: string;
    indexNumber: string;
  } | null>(null);

  // ──────────────────────────────────────────
  // Attendance History State
  // ──────────────────────────────────────────
  const [searchIndexNumber, setSearchIndexNumber] = useState('');
  const [isQueryingAttendance, setIsQueryingAttendance] = useState(false);
  const [attendanceData, setAttendanceData] =
    useState<StudentAttendanceResponse | null>(null);
  const [attendanceError, setAttendanceError] = useState('');

  // ──────────────────────────────────────────
  // Face Registration State
  // ──────────────────────────────────────────
  const [regClassId, setRegClassId] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regIndexNumber, setRegIndexNumber] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [regCapturedUri, setRegCapturedUri] = useState<string | null>(null);
  const [regStatusMessage, setRegStatusMessage] = useState('');

  // ── Handle Scanned QR Code ──
  const handleBarcodeScanned = useCallback(
    (scanningResult: { data: string; type?: string }) => {
      if (!isScanningQr) return;
      const raw = scanningResult.data?.trim();
      if (!raw) return;

      let extractedId = raw;
      let extractedName = '';

      try {
        const parsed = JSON.parse(raw);
        if (parsed.sessionId) {
          extractedId = parsed.sessionId;
          extractedName = parsed.sessionName || '';
        }
      } catch {
        const parts = raw.split('/');
        const lastPart = parts[parts.length - 1];
        if (lastPart && lastPart.length > 10) {
          extractedId = lastPart;
        }
      }

      setSessionId(extractedId);
      if (extractedName) setSessionName(extractedName);
      setIsScanningQr(false);
      setCameraFacing('front');
      Alert.alert(
        'QR Code Detected',
        `Session linked: ${extractedName || extractedId}\nNow tap "Verify & Check-In" to take your attendance selfie.`,
      );
    },
    [isScanningQr],
  );

  // ── Execute Check-In ──
  const handleCheckIn = useCallback(async () => {
    if (!sessionId.trim()) {
      Alert.alert('Session Required', 'Please scan a session QR code or enter a Session ID first.');
      return;
    }

    setState('capturing');

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission is required to verify classroom attendance.');
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      if (cameraFacing !== 'front') {
        setCameraFacing('front');
      }

      if (!cameraRef.current) {
        throw new Error('Camera preview is not ready.');
      }

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: false,
      });
      if (!photo) throw new Error('Failed to capture selfie.');

      setState('submitting');

      const backendUrl = await getSavedBackendUrl();
      if (!backendUrl) throw new Error('No backend URL configured for this institution.');

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
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 15000,
        },
      );

      const data = response.data;
      setResultStudent(data.student);
      setResultMessage(data.message || 'Check-in verified successfully!');
      setState('success');
    } catch (err: any) {
      const msg =
        err.response?.data?.message || err.message || 'Attendance verification failed.';
      setResultMessage(msg);
      setResultStudent(null);
      setState('error');
    }
  }, [sessionId, cameraFacing]);

  // ── Query Attendance History ──
  const handleQueryAttendance = async () => {
    if (!searchIndexNumber.trim()) {
      Alert.alert('Index Number Required', 'Please enter your student index number.');
      return;
    }

    setIsQueryingAttendance(true);
    setAttendanceError('');
    setAttendanceData(null);

    try {
      const backendUrl = await getSavedBackendUrl();
      if (!backendUrl) throw new Error('No backend URL configured.');

      const res = await axios.get(
        `${backendUrl}/api/public/students/${encodeURIComponent(searchIndexNumber.trim())}/attendance`,
        { timeout: 10000 },
      );
      setAttendanceData(res.data);
    } catch (err: any) {
      setAttendanceError(
        err.response?.data?.message || 'Could not find attendance records for this index number.',
      );
    } finally {
      setIsQueryingAttendance(false);
    }
  };

  // ── Self-Register Face ──
  const handleCaptureRegistrationPhoto = async () => {
    if (!cameraRef.current) {
      Alert.alert('Camera Error', 'Camera is not active.');
      return;
    }
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });
      if (photo?.uri) {
        setRegCapturedUri(photo.uri);
      }
    } catch (err: any) {
      Alert.alert('Capture Failed', err.message || 'Could not take photo.');
    }
  };

  const handleSubmitRegistration = async () => {
    if (!regClassId.trim() || !regFullName.trim() || !regIndexNumber.trim()) {
      Alert.alert('Missing Fields', 'Class ID, Full Name, and Index Number are required.');
      return;
    }
    if (!regCapturedUri) {
      Alert.alert('Photo Required', 'Please capture your face photo first.');
      return;
    }

    setIsRegistering(true);
    setRegStatusMessage('');

    try {
      const backendUrl = await getSavedBackendUrl();
      if (!backendUrl) throw new Error('No backend URL configured.');

      const formData = new FormData();
      formData.append('fullName', regFullName.trim());
      formData.append('indexNumber', regIndexNumber.trim());
      formData.append('images', {
        uri: regCapturedUri,
        type: 'image/jpeg',
        name: 'face_1.jpg',
      } as any);

      await axios.post(
        `${backendUrl}/api/public/classes/${regClassId.trim()}/register-student`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 20000,
        },
      );

      Alert.alert('Registration Successful', 'Your profile and face biometrics have been enrolled!');
      setRegFullName('');
      setRegIndexNumber('');
      setRegCapturedUri(null);
      setActiveTab('checkin');
    } catch (err: any) {
      Alert.alert(
        'Registration Failed',
        err.response?.data?.message || 'Could not complete registration. Check if registration is open.',
      );
    } finally {
      setIsRegistering(false);
    }
  };

  const handleChangeSchool = async () => {
    await clearSchool();
    onChangeSchool();
  };

  const toggleQrMode = () => {
    if (!isScanningQr) {
      setIsScanningQr(true);
      setCameraFacing('back');
    } else {
      setIsScanningQr(false);
      setCameraFacing('front');
    }
  };

  // ── Success flash ──
  if (state === 'success') {
    return (
      <View style={[styles.container, { backgroundColor: '#1F883D' }]}>
        <Text style={styles.flashTitle}>✓ Verified</Text>
        <Text style={styles.flashSubtitle}>Attendance Recorded</Text>
        {resultStudent && (
          <View style={styles.flashCard}>
            <Text style={styles.flashName}>{resultStudent.fullName}</Text>
            <Text style={styles.flashIndex}>{resultStudent.indexNumber}</Text>
          </View>
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
      <View style={[styles.container, { backgroundColor: '#CF222E' }]}>
        <Text style={styles.flashTitle}>✗ Check-In Failed</Text>
        <View style={styles.flashCard}>
          <Text style={styles.flashErrorText}>{resultMessage}</Text>
        </View>
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

  // ── Permission check ──
  if (!cameraPermission?.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>
          Camera permission is required for facial recognition and QR code scanning.
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => requestCameraPermission()}
        >
          <Text style={styles.primaryButtonText}>Grant Camera Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={onChangeSchool}>
          <Text style={styles.secondaryButtonText}>Change School</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Top Segmented Navigation Tabs ── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'checkin' && styles.tabItemActive]}
          onPress={() => setActiveTab('checkin')}
        >
          <Text
            style={[styles.tabItemText, activeTab === 'checkin' && styles.tabItemTextActive]}
          >
            Check-In
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'attendance' && styles.tabItemActive]}
          onPress={() => setActiveTab('attendance')}
        >
          <Text
            style={[styles.tabItemText, activeTab === 'attendance' && styles.tabItemTextActive]}
          >
            My Status
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'register' && styles.tabItemActive]}
          onPress={() => setActiveTab('register')}
        >
          <Text
            style={[styles.tabItemText, activeTab === 'register' && styles.tabItemTextActive]}
          >
            Register
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── TAB 1: CHECK-IN ── */}
      {activeTab === 'checkin' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Camera preview */}
          <View style={styles.cameraWrapper}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing={cameraFacing}
              barcodeScannerSettings={isScanningQr ? { barcodeTypes: ['qr'] } : undefined}
              onBarcodeScanned={isScanningQr ? handleBarcodeScanned : undefined}
            />
            {isScanningQr && (
              <View style={styles.qrOverlay}>
                <View style={styles.qrTargetBox} />
                <Text style={styles.qrOverlayText}>Align Session QR Code</Text>
              </View>
            )}
          </View>

          {/* QR Scanner or Front Camera Toggle */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                isScanningQr && { backgroundColor: '#0969DA', borderColor: '#0969DA' },
              ]}
              onPress={toggleQrMode}
            >
              <Text
                style={[
                  styles.modeButtonText,
                  isScanningQr && { color: '#FFFFFF' },
                ]}
              >
                {isScanningQr ? '✕ Cancel QR Scan' : '📷 Scan QR Code'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Session ID input */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Session ID or Scan QR above"
              placeholderTextColor="#656D76"
              value={sessionId}
              onChangeText={(val) => {
                setSessionId(val);
                setSessionName('');
              }}
              autoCapitalize="none"
            />
            {sessionName ? (
              <Text style={styles.sessionNameLabel}>Session: {sessionName}</Text>
            ) : null}
          </View>

          {/* Check-In button */}
          <TouchableOpacity
            style={[
              styles.primaryButton,
              (state === 'capturing' || state === 'submitting') && { opacity: 0.5 },
            ]}
            onPress={handleCheckIn}
            disabled={state === 'capturing' || state === 'submitting'}
          >
            {state === 'capturing' || state === 'submitting' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Verify &amp; Check-In</Text>
            )}
          </TouchableOpacity>

          {/* Change School */}
          <TouchableOpacity style={styles.secondaryButton} onPress={handleChangeSchool}>
            <Text style={styles.secondaryButtonText}>Change School</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── TAB 2: MY ATTENDANCE ── */}
      {activeTab === 'attendance' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionTitle}>Attendance Record Lookup</Text>
          <Text style={styles.sectionSubtitle}>
            Enter your student index number to review your real-time attendance standing.
          </Text>

          <View style={styles.searchRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Enter Index Number (e.g. 10293847)"
              placeholderTextColor="#656D76"
              value={searchIndexNumber}
              onChangeText={setSearchIndexNumber}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.searchButton, isQueryingAttendance && { opacity: 0.6 }]}
              onPress={handleQueryAttendance}
              disabled={isQueryingAttendance}
            >
              {isQueryingAttendance ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.searchButtonText}>Search</Text>
              )}
            </TouchableOpacity>
          </View>

          {attendanceError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{attendanceError}</Text>
            </View>
          ) : null}

          {attendanceData && (
            <View style={styles.attendanceCard}>
              <View style={styles.profileHeader}>
                <View>
                  <Text style={styles.profileName}>{attendanceData.student.fullName}</Text>
                  <Text style={styles.profileIndex}>
                    {attendanceData.student.indexNumber} • {attendanceData.student.class.name}
                  </Text>
                </View>
                <View style={styles.rateBadge}>
                  <Text style={styles.rateText}>{attendanceData.attendanceRate}</Text>
                  <Text style={styles.rateSubtext}>Attendance</Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{attendanceData.attendedCount}</Text>
                  <Text style={styles.statLabel}>Present</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>
                    {Math.max(0, attendanceData.totalSessions - attendanceData.attendedCount)}
                  </Text>
                  <Text style={styles.statLabel}>Missed</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{attendanceData.totalSessions}</Text>
                  <Text style={styles.statLabel}>Total Held</Text>
                </View>
              </View>

              <Text style={styles.historyHeading}>Session Timeline</Text>
              {attendanceData.records.length === 0 ? (
                <Text style={styles.emptyTimelineText}>No attendance records logged yet.</Text>
              ) : (
                attendanceData.records.map((r) => (
                  <View key={r.id} style={styles.timelineItem}>
                    <View style={styles.timelineDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sessionTitle}>{r.session.name}</Text>
                      <Text style={styles.sessionMeta}>
                        {new Date(r.timestamp).toLocaleDateString()} at{' '}
                        {new Date(r.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        {r.session.classroom?.name ? `• ${r.session.classroom.name}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.verifiedTag}>Verified</Text>
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* ── TAB 3: REGISTER FACE ── */}
      {activeTab === 'register' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionTitle}>Student Face Enrollment</Text>
          <Text style={styles.sectionSubtitle}>
            Self-register your face biometrics for automated classroom attendance.
          </Text>

          {/* Registration Camera Preview */}
          <View style={[styles.cameraWrapper, { height: 240, aspectRatio: undefined }]}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="front"
            />
          </View>

          <TouchableOpacity
            style={[styles.modeButton, { marginBottom: 16 }]}
            onPress={handleCaptureRegistrationPhoto}
          >
            <Text style={styles.modeButtonText}>
              {regCapturedUri ? '✓ Photo Ready (Tap to Retake)' : '📸 Take Enrollment Photo'}
            </Text>
          </TouchableOpacity>

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Class ID or Token</Text>
            <TextInput
              style={styles.input}
              placeholder="Paste Class ID from course rep"
              placeholderTextColor="#656D76"
              value={regClassId}
              onChangeText={setRegClassId}
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>Full Legal Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Kwame Mensah"
              placeholderTextColor="#656D76"
              value={regFullName}
              onChangeText={setRegFullName}
            />

            <Text style={styles.fieldLabel}>Student Index Number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 10293847"
              placeholderTextColor="#656D76"
              value={regIndexNumber}
              onChangeText={setRegIndexNumber}
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, isRegistering && { opacity: 0.6 }]}
            onPress={handleSubmitRegistration}
            disabled={isRegistering}
          >
            {isRegistering ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Submit Biometric Profile</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F8FA',
    paddingTop: 44,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#EAEEF2',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 8,
    padding: 3,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabItemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
  },
  tabItemText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#656D76',
  },
  tabItemTextActive: {
    color: '#1F2328',
    fontWeight: '600',
  },
  // Camera & Check-in styles
  cameraWrapper: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative',
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  qrOverlay: {
    ...(StyleSheet.absoluteFill as object),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  qrTargetBox: {
    width: 220,
    height: 220,
    borderWidth: 2,
    borderColor: '#54AEFF',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  qrOverlayText: {
    color: '#FFFFFF',
    marginTop: 14,
    fontSize: 13,
    fontWeight: '600',
  },
  actionRow: {
    width: '100%',
    marginBottom: 10,
  },
  modeButton: {
    width: '100%',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D0D7DE',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  modeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2328',
  },
  inputRow: {
    width: '100%',
    marginBottom: 14,
  },
  input: {
    width: '100%',
    height: 44,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D0D7DE',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1F2328',
  },
  sessionNameLabel: {
    fontSize: 12,
    color: '#0969DA',
    fontWeight: '600',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  primaryButton: {
    width: '100%',
    height: 44,
    backgroundColor: '#0969DA',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    width: '100%',
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D0D7DE',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    color: '#656D76',
    fontSize: 13,
    fontWeight: '500',
  },
  permissionText: {
    fontSize: 15,
    color: '#1F2328',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  // Flash Screens
  flashTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  flashSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 30,
  },
  flashCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  flashName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2328',
    marginBottom: 4,
  },
  flashIndex: {
    fontSize: 14,
    color: '#656D76',
  },
  flashErrorText: {
    fontSize: 14,
    color: '#CF222E',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Attendance Tab
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2328',
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#656D76',
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  searchRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  searchButton: {
    backgroundColor: '#0969DA',
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  errorBox: {
    width: '100%',
    backgroundColor: '#FFEBE9',
    borderColor: '#FF8182',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#CF222E',
    fontSize: 12,
  },
  attendanceCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D0D7DE',
    padding: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E4E8',
    paddingBottom: 12,
    marginBottom: 12,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2328',
  },
  profileIndex: {
    fontSize: 12,
    color: '#656D76',
    marginTop: 2,
  },
  rateBadge: {
    backgroundColor: '#DDF4FF',
    borderColor: '#54AEFF',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
  },
  rateText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0969DA',
  },
  rateSubtext: {
    fontSize: 9,
    fontWeight: '600',
    color: '#0969DA',
    textTransform: 'uppercase',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F6F8FA',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
    marginHorizontal: 3,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2328',
  },
  statLabel: {
    fontSize: 11,
    color: '#656D76',
    marginTop: 2,
  },
  historyHeading: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2328',
    marginBottom: 8,
  },
  emptyTimelineText: {
    fontSize: 12,
    color: '#656D76',
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1F883D',
    marginRight: 10,
  },
  sessionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2328',
  },
  sessionMeta: {
    fontSize: 11,
    color: '#656D76',
    marginTop: 2,
  },
  verifiedTag: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1F883D',
    backgroundColor: '#E6FFED',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  // Register Tab
  inputGroup: {
    width: '100%',
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#656D76',
    marginBottom: 4,
    marginTop: 8,
  },
});
