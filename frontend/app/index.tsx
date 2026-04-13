import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width } = Dimensions.get('window');

// Types
interface Aircraft {
  icao24: string;
  callsign: string | null;
  latitude: number;
  longitude: number;
  altitude_ft: number;
  velocity_knots: number | null;
  heading: number | null;
  vertical_rate: number | null;
  on_ground: boolean;
  distance_km: number | null;
}

interface RunwayStatus {
  runway_name: string;
  direction: string;
  heading: number;
  aircraft_count: number;
  aircraft: Aircraft[];
}

interface AirportInfo {
  icao: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  elevation_ft: number;
}

interface RunwayAnalysisResponse {
  airport: AirportInfo;
  timestamp: string;
  active_runways: RunwayStatus[];
  total_landing_aircraft: number;
  all_aircraft_nearby: Aircraft[];
  message: string;
}

export default function Index() {
  const [airportCode, setAirportCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RunwayAnalysisResponse | null>(null);
  const [airports, setAirports] = useState<AirportInfo[]>([]);
  const [filteredAirports, setFilteredAirports] = useState<AirportInfo[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [viewMode, setViewMode] = useState<'text' | 'map'>('text');
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Fetch airports list on mount
  useEffect(() => {
    fetchAirports();
  }, []);

  // Auto-refresh logic
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh && data) {
      interval = setInterval(() => {
        fetchRunwayStatus(data.airport.icao, true);
      }, 30000); // Refresh every 30 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, data]);

  const fetchAirports = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/airports`);
      if (response.ok) {
        const list = await response.json();
        setAirports(list);
      }
    } catch (err) {
      console.log('Failed to fetch airports list');
    }
  };

  const fetchRunwayStatus = async (icao: string, isBackground = false) => {
    if (!icao.trim()) {
      setError('Please enter an ICAO code');
      return;
    }

    if (!isBackground) {
      setLoading(true);
      setError(null);
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/runway-status/${icao.toUpperCase()}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || 'Failed to fetch data');
      }

      setData(result);
      setShowSuggestions(false);
    } catch (err: any) {
      if (!isBackground) {
        setError(err.message || 'An error occurred');
        setData(null);
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  };

  const onRefresh = useCallback(() => {
    if (data) {
      setRefreshing(true);
      fetchRunwayStatus(data.airport.icao, false).finally(() => setRefreshing(false));
    }
  }, [data]);

  const handleInputChange = (text: string) => {
    setAirportCode(text.toUpperCase());
    if (text.length >= 2) {
      const filtered = airports.filter(
        (a) =>
          a.icao.includes(text.toUpperCase()) ||
          a.name.toUpperCase().includes(text.toUpperCase()) ||
          a.city.toUpperCase().includes(text.toUpperCase())
      );
      setFilteredAirports(filtered.slice(0, 5));
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const selectAirport = (airport: AirportInfo) => {
    setAirportCode(airport.icao);
    setShowSuggestions(false);
    fetchRunwayStatus(airport.icao);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getHeadingArrow = (heading: number | null) => {
    if (heading === null) return '';
    // Simple direction indicator
    const directions = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
    const index = Math.round(heading / 45) % 8;
    return directions[index];
  };

  const renderTextView = () => (
    <ScrollView
      style={styles.resultContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4CAF50" />}
    >
      {/* Airport Info Card */}
      <View style={styles.airportCard}>
        <View style={styles.airportHeader}>
          <View style={styles.icaoContainer}>
            <Text style={styles.icaoCode}>{data!.airport.icao}</Text>
          </View>
          <View style={styles.airportDetails}>
            <Text style={styles.airportName}>{data!.airport.name}</Text>
            <Text style={styles.airportLocation}>
              {data!.airport.city}, {data!.airport.country}
            </Text>
            <Text style={styles.airportElevation}>Elevation: {data!.airport.elevation_ft} ft</Text>
          </View>
        </View>
      </View>

      {/* Status Message */}
      <View style={styles.messageCard}>
        <Ionicons
          name={data!.active_runways.length > 0 ? 'airplane' : 'information-circle'}
          size={24}
          color={data!.active_runways.length > 0 ? '#4CAF50' : '#FFC107'}
        />
        <Text style={styles.messageText}>{data!.message}</Text>
      </View>

      {/* Active Runways */}
      {data!.active_runways.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Landing Runways (QFU)</Text>
          {data!.active_runways.map((runway, index) => (
            <View key={index} style={styles.runwayCard}>
              <View style={styles.runwayHeader}>
                <View style={styles.runwayBadge}>
                  <Text style={styles.runwayDirection}>{runway.direction}</Text>
                </View>
                <View style={styles.runwayInfo}>
                  <Text style={styles.runwayName}>Runway {runway.runway_name}</Text>
                  <Text style={styles.runwayHeading}>Heading: {runway.heading}°</Text>
                </View>
                <View style={styles.aircraftCountBadge}>
                  <Ionicons name="airplane" size={16} color="#fff" />
                  <Text style={styles.aircraftCountText}>{runway.aircraft_count}</Text>
                </View>
              </View>

              {/* Aircraft on this runway */}
              {runway.aircraft.length > 0 && (
                <View style={styles.aircraftList}>
                  {runway.aircraft.map((ac, acIndex) => (
                    <View key={acIndex} style={styles.aircraftItem}>
                      <Text style={styles.callsign}>{ac.callsign || ac.icao24}</Text>
                      <Text style={styles.aircraftDetail}>
                        {Math.round(ac.altitude_ft)} ft | {ac.distance_km?.toFixed(1)} km
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{data!.total_landing_aircraft}</Text>
          <Text style={styles.statLabel}>Landing Aircraft</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{data!.all_aircraft_nearby.length}</Text>
          <Text style={styles.statLabel}>Aircraft Nearby</Text>
        </View>
      </View>

      {/* Last Updated */}
      <View style={styles.timestampContainer}>
        <Ionicons name="time-outline" size={14} color="#888" />
        <Text style={styles.timestamp}>Updated: {formatTime(data!.timestamp)}</Text>
      </View>
    </ScrollView>
  );

  const renderMapView = () => {
    // Simple visual representation of aircraft positions
    const airportLat = data!.airport.lat;
    const airportLon = data!.airport.lon;
    const mapSize = width - 40;
    const scale = mapSize / 60; // ~30km radius = 60km span, scaled to pixels

    return (
      <ScrollView
        style={styles.resultContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4CAF50" />}
      >
        {/* Airport Info */}
        <View style={styles.airportCardSmall}>
          <Text style={styles.icaoCodeSmall}>{data!.airport.icao}</Text>
          <Text style={styles.airportNameSmall}>{data!.airport.name}</Text>
        </View>

        {/* Map Container */}
        <View style={[styles.mapContainer, { width: mapSize, height: mapSize }]}>
          {/* Grid lines */}
          <View style={styles.gridLine} />
          <View style={[styles.gridLine, styles.gridLineVertical]} />

          {/* Compass */}
          <Text style={styles.compassN}>N</Text>
          <Text style={styles.compassS}>S</Text>
          <Text style={styles.compassE}>E</Text>
          <Text style={styles.compassW}>W</Text>

          {/* Airport marker (center) */}
          <View style={[styles.airportMarker, { left: mapSize / 2 - 15, top: mapSize / 2 - 15 }]}>
            <Ionicons name="location" size={30} color="#FF5722" />
          </View>

          {/* Range circles */}
          <View
            style={[
              styles.rangeCircle,
              {
                width: scale * 20,
                height: scale * 20,
                left: mapSize / 2 - (scale * 20) / 2,
                top: mapSize / 2 - (scale * 20) / 2,
              },
            ]}
          />
          <View
            style={[
              styles.rangeCircle,
              {
                width: scale * 40,
                height: scale * 40,
                left: mapSize / 2 - (scale * 40) / 2,
                top: mapSize / 2 - (scale * 40) / 2,
              },
            ]}
          />

          {/* Aircraft markers */}
          {data!.all_aircraft_nearby.slice(0, 30).map((ac, index) => {
            const latDiff = (ac.latitude - airportLat) * 111; // km
            const lonDiff = (ac.longitude - airportLon) * 111 * Math.cos((airportLat * Math.PI) / 180); // km

            const x = mapSize / 2 + lonDiff * scale;
            const y = mapSize / 2 - latDiff * scale;

            // Check if within map bounds
            if (x < 0 || x > mapSize || y < 0 || y > mapSize) return null;

            const isLanding = ac.altitude_ft < 1000 + data!.airport.elevation_ft && (ac.vertical_rate ?? 0) < 0;

            return (
              <View
                key={ac.icao24}
                style={[
                  styles.aircraftMarker,
                  { left: x - 8, top: y - 8 },
                  isLanding && styles.aircraftMarkerLanding,
                ]}
              >
                <Text style={styles.aircraftArrow}>{getHeadingArrow(ac.heading)}</Text>
              </View>
            );
          })}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.legendText}>Landing Aircraft</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#2196F3' }]} />
            <Text style={styles.legendText}>Other Aircraft</Text>
          </View>
          <View style={styles.legendItem}>
            <Ionicons name="location" size={16} color="#FF5722" />
            <Text style={styles.legendText}>Airport</Text>
          </View>
        </View>

        {/* Active Runways Summary */}
        {data!.active_runways.length > 0 && (
          <View style={styles.runwaySummary}>
            <Text style={styles.runwaySummaryTitle}>Active Runways:</Text>
            <View style={styles.runwayBadges}>
              {data!.active_runways.map((rwy, i) => (
                <View key={i} style={styles.runwayBadgeSmall}>
                  <Text style={styles.runwayBadgeText}>{rwy.direction}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{data!.total_landing_aircraft}</Text>
            <Text style={styles.statLabel}>Landing</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{data!.all_aircraft_nearby.length}</Text>
            <Text style={styles.statLabel}>Nearby</Text>
          </View>
        </View>

        {/* Timestamp */}
        <View style={styles.timestampContainer}>
          <Ionicons name="time-outline" size={14} color="#888" />
          <Text style={styles.timestamp}>Updated: {formatTime(data!.timestamp)}</Text>
        </View>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="airplane" size={32} color="#4CAF50" />
          <Text style={styles.title}>Flight QFU Tracker</Text>
          <Text style={styles.subtitle}>Real-time runway landing directions</Text>
        </View>

        {/* Search Section */}
        <View style={styles.searchSection}>
          <View style={styles.inputContainer}>
            <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter ICAO code (e.g., LFPG)"
              placeholderTextColor="#666"
              value={airportCode}
              onChangeText={handleInputChange}
              autoCapitalize="characters"
              maxLength={4}
            />
            {airportCode.length > 0 && (
              <TouchableOpacity onPress={() => setAirportCode('')} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color="#888" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[styles.searchButton, loading && styles.searchButtonDisabled]}
            onPress={() => fetchRunwayStatus(airportCode)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="arrow-forward" size={24} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        {/* Suggestions Dropdown */}
        {showSuggestions && filteredAirports.length > 0 && (
          <View style={styles.suggestionsContainer}>
            {filteredAirports.map((airport) => (
              <TouchableOpacity key={airport.icao} style={styles.suggestionItem} onPress={() => selectAirport(airport)}>
                <Text style={styles.suggestionIcao}>{airport.icao}</Text>
                <Text style={styles.suggestionName} numberOfLines={1}>
                  {airport.name} - {airport.city}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={20} color="#f44336" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* View Toggle & Auto-refresh */}
        {data && (
          <View style={styles.controlsRow}>
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[styles.toggleButton, viewMode === 'text' && styles.toggleButtonActive]}
                onPress={() => setViewMode('text')}
              >
                <Ionicons name="list" size={18} color={viewMode === 'text' ? '#fff' : '#888'} />
                <Text style={[styles.toggleText, viewMode === 'text' && styles.toggleTextActive]}>Text</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, viewMode === 'map' && styles.toggleButtonActive]}
                onPress={() => setViewMode('map')}
              >
                <Ionicons name="map" size={18} color={viewMode === 'map' ? '#fff' : '#888'} />
                <Text style={[styles.toggleText, viewMode === 'map' && styles.toggleTextActive]}>Map</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.autoRefreshButton, autoRefresh && styles.autoRefreshActive]}
              onPress={() => setAutoRefresh(!autoRefresh)}
            >
              <Ionicons name="refresh" size={16} color={autoRefresh ? '#4CAF50' : '#888'} />
              <Text style={[styles.autoRefreshText, autoRefresh && styles.autoRefreshTextActive]}>Auto</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Results */}
        {data && (viewMode === 'text' ? renderTextView() : renderMapView())}

        {/* Empty State */}
        {!data && !loading && !error && (
          <View style={styles.emptyState}>
            <Ionicons name="airplane-outline" size={64} color="#333" />
            <Text style={styles.emptyStateText}>Enter an airport ICAO code to see</Text>
            <Text style={styles.emptyStateText}>current landing runway directions</Text>
            <Text style={styles.emptyStateHint}>Examples: LFPG, KJFK, EGLL, KLAX</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  flex: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  searchSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C2128',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 48,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  clearButton: {
    padding: 4,
  },
  searchButton: {
    width: 48,
    height: 48,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonDisabled: {
    backgroundColor: '#2E7D32',
  },
  suggestionsContainer: {
    marginHorizontal: 16,
    backgroundColor: '#1C2128',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#30363D',
    marginBottom: 8,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
  },
  suggestionIcao: {
    color: '#4CAF50',
    fontWeight: 'bold',
    fontSize: 14,
    width: 50,
  },
  suggestionName: {
    color: '#888',
    fontSize: 13,
    flex: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  errorText: {
    color: '#f44336',
    marginLeft: 8,
    flex: 1,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#1C2128',
    borderRadius: 8,
    padding: 4,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  toggleButtonActive: {
    backgroundColor: '#4CAF50',
  },
  toggleText: {
    color: '#888',
    marginLeft: 6,
    fontSize: 14,
  },
  toggleTextActive: {
    color: '#fff',
  },
  autoRefreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#1C2128',
    borderRadius: 8,
  },
  autoRefreshActive: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  autoRefreshText: {
    color: '#888',
    marginLeft: 4,
    fontSize: 12,
  },
  autoRefreshTextActive: {
    color: '#4CAF50',
  },
  resultContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  airportCard: {
    backgroundColor: '#1C2128',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  airportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icaoContainer: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 12,
    marginRight: 16,
  },
  icaoCode: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  airportDetails: {
    flex: 1,
  },
  airportName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  airportLocation: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  airportElevation: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  messageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C2128',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  messageText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  runwayCard: {
    backgroundColor: '#1C2128',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  runwayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  runwayBadge: {
    backgroundColor: '#FF5722',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 12,
  },
  runwayDirection: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  runwayInfo: {
    flex: 1,
  },
  runwayName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  runwayHeading: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  aircraftCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  aircraftCountText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  aircraftList: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#30363D',
    paddingTop: 12,
  },
  aircraftItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  callsign: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  aircraftDetail: {
    color: '#888',
    fontSize: 12,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#1C2128',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  statValue: {
    color: '#4CAF50',
    fontSize: 28,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  timestampContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  timestamp: {
    color: '#888',
    fontSize: 12,
    marginLeft: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyStateText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
  },
  emptyStateHint: {
    color: '#4CAF50',
    fontSize: 14,
    marginTop: 16,
  },
  // Map view styles
  airportCardSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C2128',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  icaoCodeSmall: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 12,
  },
  airportNameSmall: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  mapContainer: {
    backgroundColor: '#161B22',
    borderRadius: 12,
    alignSelf: 'center',
    marginBottom: 12,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#30363D',
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: '#30363D',
    width: '100%',
    height: 1,
    top: '50%',
  },
  gridLineVertical: {
    width: 1,
    height: '100%',
    left: '50%',
    top: 0,
  },
  compassN: {
    position: 'absolute',
    top: 8,
    left: '50%',
    marginLeft: -6,
    color: '#666',
    fontSize: 12,
  },
  compassS: {
    position: 'absolute',
    bottom: 8,
    left: '50%',
    marginLeft: -4,
    color: '#666',
    fontSize: 12,
  },
  compassE: {
    position: 'absolute',
    right: 8,
    top: '50%',
    marginTop: -8,
    color: '#666',
    fontSize: 12,
  },
  compassW: {
    position: 'absolute',
    left: 8,
    top: '50%',
    marginTop: -8,
    color: '#666',
    fontSize: 12,
  },
  airportMarker: {
    position: 'absolute',
    zIndex: 10,
  },
  rangeCircle: {
    position: 'absolute',
    borderRadius: 1000,
    borderWidth: 1,
    borderColor: '#30363D',
    borderStyle: 'dashed',
  },
  aircraftMarker: {
    position: 'absolute',
    width: 16,
    height: 16,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aircraftMarkerLanding: {
    backgroundColor: '#4CAF50',
  },
  aircraftArrow: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginVertical: 4,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    color: '#888',
    fontSize: 12,
  },
  runwaySummary: {
    backgroundColor: '#1C2128',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  runwaySummaryTitle: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
  },
  runwayBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  runwayBadgeSmall: {
    backgroundColor: '#FF5722',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  runwayBadgeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
