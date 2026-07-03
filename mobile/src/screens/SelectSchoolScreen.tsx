/**
 * "Select Your School" onboarding screen.
 *
 * Fetches the school list on mount and lets the user pick their institution.
 * The selected backend URL is saved to SecureStore and the navigator moves
 * to the Home screen.
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
} from 'react-native';
import { fetchSchools, saveSchool, School } from '../services/discovery';

interface Props {
  onSchoolSelected: () => void;
}

export default function SelectSchoolScreen({ onSchoolSelected }: Props) {
  const [schools, setSchools] = useState<School[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

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
      <TextInput
        style={styles.searchInput}
        placeholder="Search schools…"
        placeholderTextColor="#656D76"
        value={search}
        onChangeText={setSearch}
      />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.schoolItem} onPress={() => handleSelect(item)}>
            <Text style={styles.schoolName}>{item.name}</Text>
            <Text style={styles.schoolUrl}>{item.backendUrl}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No schools found. Check your connection.</Text>
        }
      />
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
    fontWeight: '600',
    color: '#1F2328',
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D0D7DE',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1F2328',
    marginBottom: 16,
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
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2328',
  },
  schoolUrl: {
    fontSize: 12,
    color: '#656D76',
    marginTop: 2,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#656D76',
  },
  emptyText: {
    marginTop: 20,
    textAlign: 'center',
    color: '#656D76',
    fontSize: 14,
  },
});
