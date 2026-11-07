/**
 * "Select Your School" onboarding screen.
 *
 * Fetches the school list on mount and lets the user pick their institution.
 * Also provides an option to enter a custom/self-hosted server URL for
 * local development or private campus intranets.
 */
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { fetchSchools, saveSchool, School } from '../services/discovery';

interface Props {
  onSchoolSelected: () => void;
}

export default function SelectSchoolScreen({ onSchoolSelected }: Props) {
  const [schools, setSchools] = useState<School[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');

  useEffect(() => {
    fetchSchools()
      .then(setSchools)
      .catch(() => setSchools([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = schools.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSelect = async (school: School) => {
    await saveSchool(school);
    onSchoolSelected();
  };

  const handleCustomConnect = async () => {
    const trimmedUrl = customUrl.trim();
    if (!trimmedUrl) {
      Alert.alert('Required', 'Please enter a valid backend server URL.');
      return;
    }
    const cleanUrl = trimmedUrl.replace(/\/+$/, '');
    const schoolObj: School = {
      id: 'custom-' + Date.now(),
      name: customName.trim() || 'Custom Campus Server',
      backendUrl: cleanUrl,
    };
    await saveSchool(schoolObj);
    onSchoolSelected();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0969DA" />
        <Text style={styles.loadingText}>Loading schools…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Your School</Text>
      <Text style={styles.subtitle}>
        Connect your app to your institution's TruMark server.
      </Text>

      {/* Toggle between list and custom URL */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, !showCustomInput && styles.toggleBtnActive]}
          onPress={() => setShowCustomInput(false)}
        >
          <Text
            style={[styles.toggleText, !showCustomInput && styles.toggleTextActive]}
          >
            Registered Schools
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, showCustomInput && styles.toggleBtnActive]}
          onPress={() => setShowCustomInput(true)}
        >
          <Text
            style={[styles.toggleText, showCustomInput && styles.toggleTextActive]}
          >
            Custom Server URL
          </Text>
        </TouchableOpacity>
      </View>

      {showCustomInput ? (
        <View style={styles.customForm}>
          <Text style={styles.label}>Institution Name</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="e.g. My Campus"
            placeholderTextColor="#656D76"
            value={customName}
            onChangeText={setCustomName}
          />
          <Text style={styles.label}>Server Base URL</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="e.g. https://attendance.myschool.edu"
            placeholderTextColor="#656D76"
            value={customUrl}
            onChangeText={setCustomUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.connectButton}
            onPress={handleCustomConnect}
          >
            <Text style={styles.connectButtonText}>Connect to Server</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <TextInput
            style={styles.searchInput}
            placeholder="Search registered schools…"
            placeholderTextColor="#656D76"
            value={search}
            onChangeText={setSearch}
          />
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.schoolItem}
                onPress={() => handleSelect(item)}
              >
                <Text style={styles.schoolName}>{item.name}</Text>
                <Text style={styles.schoolUrl}>{item.backendUrl}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                No schools found. Switch to Custom Server URL above.
              </Text>
            }
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F8FA',
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2328',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#656D76',
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#EAEFF5',
    borderRadius: 8,
    padding: 3,
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  toggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#656D76',
  },
  toggleTextActive: {
    color: '#1F2328',
    fontWeight: '600',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#656D76',
    marginBottom: 6,
  },
  customForm: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D0D7DE',
    borderRadius: 8,
    padding: 16,
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D0D7DE',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2328',
    marginBottom: 14,
  },
  connectButton: {
    backgroundColor: '#0969DA',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 4,
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  schoolItem: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D0D7DE',
    borderRadius: 6,
    padding: 14,
    marginBottom: 8,
  },
  schoolName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2328',
  },
  schoolUrl: {
    fontSize: 12,
    color: '#656D76',
    marginTop: 3,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#656D76',
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 20,
    textAlign: 'center',
    color: '#656D76',
    fontSize: 13,
  },
});
