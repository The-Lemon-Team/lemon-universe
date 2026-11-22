/**
 * Standalone Weather & Geolocation Domain Module Contracts.
 *
 * Designed with zero framework or UI dependencies so this module can be
 * extracted into an independent microservice or shared package (@lemon/weather).
 */

export type WeatherConditionCode =
  | 'clear'
  | 'partly_cloudy'
  | 'cloudy'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'heavy_rain'
  | 'snow'
  | 'thunderstorm';

export type WeatherProviderSource = 'open-meteo' | 'preset-fallback' | 'manual-override';

export interface WeatherLocation {
  id: string;
  name: string;
  region?: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
}

export interface WeatherReading {
  condition: WeatherConditionCode;
  wmoCode: number;
  temperatureC: number;
  feelsLikeC: number;
  humidityPercent?: number;
  windSpeedKmh?: number;
  precipitationMm?: number;
  cloudCoverPercent?: number;
  isDay: boolean;
  observedAt: string;
  provider: WeatherProviderSource;
}

/**
 * Immutable weather snapshot stored directly inside a Note at capture time.
 *
 * Storing an immutable snapshot once (rather than only recording a timestamp
 * and querying a historical geo-API on every read) guarantees:
 * 1. Zero external API calls or rate limits when rendering timelines with many notes.
 * 2. Historical fidelity to what the user actually observed at that moment.
 * 3. Full offline durability while retaining coordinates & timestamp for future analytics.
 */
export interface NoteWeatherSnapshot {
  condition: WeatherConditionCode;
  wmoCode?: number;
  temperatureC: number;
  feelsLikeC?: number;
  humidityPercent?: number;
  windSpeedKmh?: number;
  locationName: string;
  region?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  label: string;
  icon: string;
  capturedAt: string;
}

export interface GeocodingAdapterPort {
  searchLocations(query: string, limit?: number): Promise<WeatherLocation[]>;
}

export interface WeatherProviderAdapterPort {
  fetchCurrentWeather(location: WeatherLocation): Promise<WeatherReading>;
}
