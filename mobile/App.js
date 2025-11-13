import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Button,
  Linking,
  TextInput,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Animated,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

const DEFAULT_API = 'http://localhost:8000';

const WelcomeScreen = ({ showMessage }) => {
  const logoPosition = useRef(new Animated.Value(0)).current;
  const messageOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showMessage) {
      // Animate logo moving up
      Animated.timing(logoPosition, {
        toValue: -60,
        duration: 800,
        useNativeDriver: true,
      }).start();

      // Animate message fading in
      Animated.timing(messageOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();
    }
  }, [showMessage]);

  return (
    <SafeAreaView style={styles.welcomeScreenContainer}>
      <View style={styles.welcomeContent}>
        <Animated.Image
          source={require('./assets/logo.png')}
          style={[
            styles.welcomeLogo,
            {
              transform: [{ translateY: logoPosition }],
            },
          ]}
          resizeMode="contain"
        />
        
        <Animated.View
          style={[
            styles.messageContainer,
            {
              opacity: messageOpacity,
            },
          ]}
        >
          <Text style={styles.welcomeTitle}>Research KG</Text>
          <Text style={styles.welcomeSubtitle}>Knowledge Graph Explorer</Text>
          <Text style={styles.welcomeMessage}>
            Discover connections between research papers and scientific concepts
          </Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

const LoadingScreen = () => (
  <View style={styles.loadingScreenContainer}>
    <View style={styles.loadingContent}>
      <Text style={styles.loadingLogo}>🧠</Text>
      <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 24 }} />
      <Text style={styles.loadingMessage}>Searching Knowledge Graph...</Text>
      <Text style={styles.loadingSubtext}>Please wait while we find relevant papers</Text>
    </View>
  </View>
);

export default function App() {
  const [apiBase, setApiBase] = useState(DEFAULT_API);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [appReady, setAppReady] = useState(false);
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    // Show message after 2 seconds
    const messageTimer = setTimeout(() => {
      setShowMessage(true);
    }, 2000);

    // Transition to app after 5 seconds total
    const appTimer = setTimeout(() => {
      setAppReady(true);
    }, 5000);

    return () => {
      clearTimeout(messageTimer);
      clearTimeout(appTimer);
    };
  }, []);

  async function runSearch() {
    if (!query) {
      Alert.alert('Enter a search term');
      return;
    }
    setLoading(true);
    try {
      const url = `${apiBase.replace(/\/$/, '')}/search?query=${encodeURIComponent(query)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      // Expecting array of papers or nodes from backend
      setResults(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      Alert.alert('Search error', String(err));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    // simple pull-to-refresh: re-run last query if present
    if (!query) return;
    setRefreshing(true);
    try {
      await runSearch();
    } finally {
      setRefreshing(false);
    }
  }

  function openUpload() {
    // Redirect to web frontend upload page for file uploads (avoids adding file-picker deps)
    const url = 'http://localhost:3000';
    Linking.openURL(url).catch(() => Alert.alert('Cannot open URL', url));
  }

  return (
    <SafeAreaProvider>
      {!appReady ? (
        <WelcomeScreen showMessage={showMessage} />
      ) : (
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Research KG</Text>
          <Text style={styles.subtitle}>Knowledge Graph Explorer</Text>
        </View>

        {/* API Configuration Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuration</Text>
          <View style={styles.card}>
            <Text style={styles.label}>API Endpoint</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputPrefix}>🔗</Text>
              <TextInput
                style={styles.input}
                value={apiBase}
                onChangeText={setApiBase}
                placeholder={DEFAULT_API}
                autoCapitalize="none"
                placeholderTextColor="#bbb"
              />
            </View>
            {apiBase.includes('localhost') && (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>⚠️ Localhost won't work on physical devices. Use your machine's LAN IP (e.g., 192.168.x.x:8000) or Expo Tunnel.</Text>
              </View>
            )}
          </View>
        </View>

        {/* Search Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Search</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Search Papers & Concepts</Text>
            <View style={styles.row}>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputPrefix}>🔍</Text>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={query}
                  onChangeText={setQuery}
                  onSubmitEditing={runSearch}
                  placeholder="e.g., transformer, citation network"
                  placeholderTextColor="#bbb"
                  returnKeyType="search"
                />
              </View>
              <TouchableOpacity 
                style={[styles.searchButtonTouchable, loading && styles.searchButtonDisabled]}
                onPress={runSearch}
                disabled={loading}
              >
                <Text style={styles.searchButtonText}>{loading ? '⏳' : '🔎'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.uploadButton]}
            onPress={openUpload}
          >
            <Text style={styles.actionButtonText}>📤 Upload Papers</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, styles.webButton]}
            onPress={openUpload}
          >
            <Text style={styles.actionButtonText}>🌐 Full Web UI</Text>
          </TouchableOpacity>
        </View>

        {/* Results Section */}
        {loading ? (
          <LoadingScreen />
        ) : (
          <View style={styles.resultsContainer}>
            <Text style={styles.sectionTitle}>
              Results {results.length > 0 && <Text style={styles.resultCount}>({results.length})</Text>}
            </Text>
            <FlatList
              style={styles.list}
              data={results}
              refreshing={refreshing}
              onRefresh={onRefresh}
              keyExtractor={(item, i) => (item && (item.id || item._id)) ? String(item.id || item._id) : String(i)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.item}
                  onPress={() => setSelected(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemContent}>
                    <Text style={styles.itemTitle} numberOfLines={2}>{item.title || item.name || 'Untitled'}</Text>
                    <Text style={styles.itemMeta} numberOfLines={1} ellipsizeMode="tail">
                      {Array.isArray(item.authors) ? item.authors.join(', ') : (item.author || 'Unknown authors')}
                    </Text>
                    {(item.year || item.date) && (
                      <Text style={styles.itemYear}>📅 {item.year || item.date}</Text>
                    )}
                  </View>
                  <Text style={styles.itemArrow}>→</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={() => (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>📚</Text>
                  <Text style={styles.empty}>No results yet</Text>
                  <Text style={styles.emptySubtext}>Try searching for papers or concepts</Text>
                </View>
              )}
            />
          </View>
        )}

        {/* Detail Modal */}
        <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
          <SafeAreaView style={styles.modalSafeArea}>
            <ScrollView contentContainerStyle={styles.modalContainer}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={() => setSelected(null)}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Modal Content */}
              <Text style={styles.modalTitle}>{selected?.title || selected?.name}</Text>
              
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Authors</Text>
                <Text style={styles.detailValue}>
                  {Array.isArray(selected?.authors) ? (selected.authors || []).join(', ') : (selected?.author || '—')}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Publication Year</Text>
                <Text style={styles.detailValue}>{selected?.year || selected?.date || '—'}</Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Abstract</Text>
                <Text style={styles.detailValue}>
                  {selected?.abstract || selected?.summary || 'No abstract available'}
                </Text>
              </View>

              <TouchableOpacity 
                style={styles.closeDetailButton}
                onPress={() => setSelected(null)}
              >
                <Text style={styles.closeDetailButtonText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  welcomeScreenContainer: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  welcomeContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeLogo: {
    width: 140,
    height: 140,
    marginBottom: 30,
  },
  messageContainer: {
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1a2d4d',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  welcomeSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7a8fa3',
    marginBottom: 20,
  },
  welcomeMessage: {
    fontSize: 14,
    color: '#5a6d84',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  spinnerContainer: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  spinner: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: 'transparent',
    borderTopColor: '#007AFF',
    borderRightColor: '#007AFF',
  },
  spinner1: {
    borderTopColor: '#007AFF',
    borderRightColor: '#007AFF',
    opacity: 1,
  },
  spinner2: {
    borderTopColor: '#5ac8fa',
    borderRightColor: '#5ac8fa',
    opacity: 0.6,
  },
  spinner3: {
    borderTopColor: '#a4c8fa',
    borderRightColor: '#a4c8fa',
    opacity: 0.3,
  },
  progressBarContainer: {
    width: '100%',
    height: 6,
    backgroundColor: '#e8eef7',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
    maxWidth: 200,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 3,
    minWidth: 10,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 12,
  },
  welcomeLoadingDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 40,
    marginBottom: 20,
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
  },
  dot1: {
    opacity: 0.3,
  },
  dot2: {
    opacity: 0.6,
  },
  dot3: {
    opacity: 1,
  },
  welcomeHint: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
    marginTop: 8,
  },
  loadingScreenContainer: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogo: {
    fontSize: 80,
    marginBottom: 24,
  },
  loadingMessage: {
    marginTop: 20,
    fontSize: 16,
    fontWeight: '600',
    color: '#1a2d4d',
    textAlign: 'center',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 13,
    color: '#7a8fa3',
    textAlign: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8eef7',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a2d4d',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#7a8fa3',
    fontWeight: '500',
    marginTop: 4,
  },
  section: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2c4563',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  label: {
    fontSize: 12,
    color: '#5a6d84',
    marginBottom: 8,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e3e8f0',
    paddingLeft: 12,
  },
  inputPrefix: {
    fontSize: 16,
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 12,
    fontSize: 14,
    color: '#1a2d4d',
    backgroundColor: 'transparent',
  },
  row: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10,
    marginTop: 8,
  },
  searchButtonTouchable: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  searchButtonDisabled: {
    opacity: 0.6,
  },
  searchButtonText: {
    fontSize: 20,
  },
  warningBox: {
    backgroundColor: '#fef3cd',
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  warningText: {
    fontSize: 12,
    color: '#664d03',
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  uploadButton: {
    backgroundColor: '#34c759',
  },
  webButton: {
    backgroundColor: '#5856d6',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 50,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#7a8fa3',
    fontWeight: '500',
  },
  list: { 
    flex: 1,
  },
  item: { 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e8eef7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: { 
    fontSize: 15, 
    fontWeight: '700',
    color: '#1a2d4d',
    marginBottom: 6,
  },
  itemMeta: { 
    fontSize: 12, 
    color: '#7a8fa3',
    fontWeight: '500',
  },
  itemYear: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  itemArrow: {
    fontSize: 16,
    color: '#ccc',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  empty: { 
    textAlign: 'center', 
    color: '#2c4563', 
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    textAlign: 'center',
    color: '#7a8fa3',
    fontSize: 13,
    marginTop: 6,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  modalContainer: { 
    paddingBottom: 40,
    backgroundColor: '#f5f7fa',
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e8eef7',
    marginBottom: 20,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8eef7',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#7a8fa3',
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a2d4d',
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  detailSection: {
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2c4563',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 14,
    color: '#1a2d4d',
    lineHeight: 20,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e8eef7',
  },
  closeDetailButton: {
    marginHorizontal: 16,
    marginTop: 20,
    paddingVertical: 14,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  closeDetailButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
