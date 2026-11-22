import {
  GeocodingAdapterPort,
  WeatherConditionCode,
  WeatherLocation,
  WeatherProviderAdapterPort,
  WeatherReading,
} from '../weather.models';

/**
 * Maps standard WMO weather interpretation codes (WW 00–99) to canonical WeatherConditionCode.
 */
export function mapWmoCodeToCondition(wmoCode: number, cloudCoverPercent?: number): WeatherConditionCode {
  if (wmoCode === 0) {
    return 'clear';
  }
  if (wmoCode === 1) {
    return 'partly_cloudy';
  }
  if (wmoCode === 2) {
    return (cloudCoverPercent ?? 60) >= 75 ? 'cloudy' : 'partly_cloudy';
  }
  if (wmoCode === 3) {
    return (cloudCoverPercent ?? 90) >= 85 ? 'overcast' : 'cloudy';
  }
  if (wmoCode === 45 || wmoCode === 48) {
    return 'fog';
  }
  if (wmoCode >= 51 && wmoCode <= 57) {
    return 'drizzle';
  }
  if (wmoCode === 61 || wmoCode === 63 || wmoCode === 66 || wmoCode === 80 || wmoCode === 81) {
    return 'rain';
  }
  if (wmoCode === 65 || wmoCode === 67 || wmoCode === 82) {
    return 'heavy_rain';
  }
  if ((wmoCode >= 71 && wmoCode <= 77) || wmoCode === 85 || wmoCode === 86) {
    return 'snow';
  }
  if (wmoCode >= 95 && wmoCode <= 99) {
    return 'thunderstorm';
  }
  return 'partly_cloudy';
}

/**
 * Maps a canonical WeatherConditionCode back to a representative WMO code.
 */
export function mapConditionToRepresentativeWmoCode(condition: WeatherConditionCode): number {
  switch (condition) {
    case 'clear':
      return 0;
    case 'partly_cloudy':
      return 1;
    case 'cloudy':
      return 2;
    case 'overcast':
      return 3;
    case 'fog':
      return 45;
    case 'drizzle':
      return 53;
    case 'rain':
      return 61;
    case 'heavy_rain':
      return 65;
    case 'snow':
      return 73;
    case 'thunderstorm':
      return 95;
  }
}

export class OpenMeteoGeocodingAdapter implements GeocodingAdapterPort {
  constructor(
    private readonly baseUrl = 'https://geocoding-api.open-meteo.com/v1/search',
    private readonly fetchFn: typeof fetch = (...args) => globalThis.fetch(...args),
  ) {}

  async searchLocations(query: string, limit = 6): Promise<WeatherLocation[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    const url = new URL(this.baseUrl);
    url.searchParams.set('name', trimmed);
    url.searchParams.set('count', String(limit));
    url.searchParams.set('language', 'ru');
    url.searchParams.set('format', 'json');

    const response = await this.fetchFn(url.toString(), {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Open-Meteo geocoding error: ${response.status}`);
    }

    const data = (await response.json()) as {
      results?: Array<{
        id?: number;
        name: string;
        admin1?: string;
        country?: string;
        latitude: number;
        longitude: number;
        timezone?: string;
      }>;
    };

    if (!Array.isArray(data.results)) return [];

    return data.results.map((item) => ({
      id: `openmeteo-${item.id ?? `${item.latitude.toFixed(3)}-${item.longitude.toFixed(3)}`}`,
      name: item.name,
      region: item.admin1,
      country: item.country,
      latitude: item.latitude,
      longitude: item.longitude,
      timezone: item.timezone,
    }));
  }
}

export class OpenMeteoWeatherAdapter implements WeatherProviderAdapterPort {
  constructor(
    private readonly baseUrl = 'https://api.open-meteo.com/v1/forecast',
    private readonly fetchFn: typeof fetch = (...args) => globalThis.fetch(...args),
  ) {}

  async fetchCurrentWeather(location: WeatherLocation): Promise<WeatherReading> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('latitude', String(location.latitude));
    url.searchParams.set('longitude', String(location.longitude));
    url.searchParams.set(
      'current',
      [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'is_day',
        'precipitation',
        'weather_code',
        'cloud_cover',
        'wind_speed_10m',
      ].join(','),
    );
    url.searchParams.set('timezone', location.timezone || 'auto');

    const response = await this.fetchFn(url.toString(), {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Open-Meteo forecast error: ${response.status}`);
    }

    const data = (await response.json()) as {
      current?: {
        time?: string;
        temperature_2m?: number;
        relative_humidity_2m?: number;
        apparent_temperature?: number;
        is_day?: number;
        precipitation?: number;
        weather_code?: number;
        cloud_cover?: number;
        wind_speed_10m?: number;
      };
    };

    const current = data.current;
    if (!current) {
      throw new Error('Open-Meteo response missing current weather block');
    }

    const wmoCode = Number(current.weather_code ?? 0);
    const cloudCover = current.cloud_cover !== undefined ? Math.round(current.cloud_cover) : undefined;
    const condition = mapWmoCodeToCondition(wmoCode, cloudCover);
    const tempC = Math.round(Number(current.temperature_2m ?? 15));
    const feelsLikeC = Math.round(Number(current.apparent_temperature ?? tempC));

    return {
      condition,
      wmoCode,
      temperatureC: tempC,
      feelsLikeC,
      humidityPercent:
        current.relative_humidity_2m !== undefined ? Math.round(current.relative_humidity_2m) : undefined,
      windSpeedKmh:
        current.wind_speed_10m !== undefined ? Math.round(current.wind_speed_10m) : undefined,
      precipitationMm:
        current.precipitation !== undefined ? Number(current.precipitation) : undefined,
      cloudCoverPercent: cloudCover,
      isDay: current.is_day !== 0,
      observedAt: current.time || new Date().toISOString(),
      provider: 'open-meteo',
    };
  }
}
