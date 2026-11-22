import {
  GeocodingAdapterPort,
  WeatherConditionCode,
  WeatherLocation,
  WeatherProviderAdapterPort,
  WeatherReading,
} from '../weather.models';
import { mapConditionToRepresentativeWmoCode } from './open-meteo.adapter';

export interface PresetLocationEntry extends WeatherLocation {
  aliases: string[];
  defaultCondition: WeatherConditionCode;
  baseTempC: number;
}

export const PRESET_WEATHER_LOCATIONS: PresetLocationEntry[] = [
  {
    id: 'preset-moscow',
    name: 'Москва',
    region: 'Московская область',
    country: 'Россия',
    latitude: 55.7558,
    longitude: 37.6173,
    timezone: 'Europe/Moscow',
    aliases: ['moscow', 'москва', 'мск'],
    defaultCondition: 'partly_cloudy',
    baseTempC: 16,
  },
  {
    id: 'preset-spb',
    name: 'Санкт-Петербург',
    region: 'Ленинградская область',
    country: 'Россия',
    latitude: 59.9343,
    longitude: 30.3351,
    timezone: 'Europe/Moscow',
    aliases: ['saint petersburg', 'санкт-петербург', 'питер', 'спб', 'петербург'],
    defaultCondition: 'rain',
    baseTempC: 13,
  },
  {
    id: 'preset-kazan',
    name: 'Казань',
    region: 'Республика Татарстан',
    country: 'Россия',
    latitude: 55.7961,
    longitude: 49.1064,
    timezone: 'Europe/Moscow',
    aliases: ['kazan', 'казань'],
    defaultCondition: 'clear',
    baseTempC: 18,
  },
  {
    id: 'preset-ekb',
    name: 'Екатеринбург',
    region: 'Свердловская область',
    country: 'Россия',
    latitude: 56.8389,
    longitude: 60.6057,
    timezone: 'Asia/Yekaterinburg',
    aliases: ['yekaterinburg', 'екатеринбург', 'екб'],
    defaultCondition: 'cloudy',
    baseTempC: 12,
  },
  {
    id: 'preset-novosibirsk',
    name: 'Новосибирск',
    region: 'Новосибирская область',
    country: 'Россия',
    latitude: 55.0084,
    longitude: 82.9357,
    timezone: 'Asia/Novosibirsk',
    aliases: ['novosibirsk', 'новосибирск', 'нск'],
    defaultCondition: 'snow',
    baseTempC: -3,
  },
  {
    id: 'preset-sochi',
    name: 'Сочи',
    region: 'Краснодарский край',
    country: 'Россия',
    latitude: 43.5855,
    longitude: 39.7231,
    timezone: 'Europe/Moscow',
    aliases: ['sochi', 'сочи', 'красная поляна'],
    defaultCondition: 'clear',
    baseTempC: 23,
  },
  {
    id: 'preset-kaliningrad',
    name: 'Калининград',
    region: 'Калининградская область',
    country: 'Россия',
    latitude: 54.7104,
    longitude: 20.4522,
    timezone: 'Europe/Kaliningrad',
    aliases: ['kaliningrad', 'калининград'],
    defaultCondition: 'fog',
    baseTempC: 14,
  },
  {
    id: 'preset-vladivostok',
    name: 'Владивосток',
    region: 'Приморский край',
    country: 'Россия',
    latitude: 43.1155,
    longitude: 131.8855,
    timezone: 'Asia/Vladivostok',
    aliases: ['vladivostok', 'владивосток'],
    defaultCondition: 'drizzle',
    baseTempC: 15,
  },
  {
    id: 'preset-minsk',
    name: 'Минск',
    region: 'Минская область',
    country: 'Беларусь',
    latitude: 53.9006,
    longitude: 27.559,
    timezone: 'Europe/Minsk',
    aliases: ['minsk', 'минск'],
    defaultCondition: 'partly_cloudy',
    baseTempC: 16,
  },
  {
    id: 'preset-almaty',
    name: 'Алматы',
    region: 'Алматинская область',
    country: 'Казахстан',
    latitude: 43.2389,
    longitude: 76.8897,
    timezone: 'Asia/Almaty',
    aliases: ['almaty', 'алматы', 'алма-ата'],
    defaultCondition: 'clear',
    baseTempC: 21,
  },
  {
    id: 'preset-tokyo',
    name: 'Токио',
    region: 'Канто',
    country: 'Япония',
    latitude: 35.6762,
    longitude: 139.6503,
    timezone: 'Asia/Tokyo',
    aliases: ['tokyo', 'токио'],
    defaultCondition: 'thunderstorm',
    baseTempC: 20,
  },
  {
    id: 'preset-london',
    name: 'Лондон',
    region: 'Англия',
    country: 'Великобритания',
    latitude: 51.5072,
    longitude: -0.1276,
    timezone: 'Europe/London',
    aliases: ['london', 'лондон'],
    defaultCondition: 'fog',
    baseTempC: 14,
  },
];

export const DEFAULT_WEATHER_LOCATION: WeatherLocation = PRESET_WEATHER_LOCATIONS[0];

export class PresetFallbackGeocodingAdapter implements GeocodingAdapterPort {
  async searchLocations(query: string, limit = 6): Promise<WeatherLocation[]> {
    const q = query.trim().toLowerCase();
    if (!q) {
      return PRESET_WEATHER_LOCATIONS.slice(0, limit);
    }

    const matches = PRESET_WEATHER_LOCATIONS.filter(
      (loc) =>
        loc.name.toLowerCase().includes(q) ||
        (loc.region || '').toLowerCase().includes(q) ||
        (loc.country || '').toLowerCase().includes(q) ||
        loc.aliases.some((a) => a.includes(q)),
    );

    if (matches.length > 0) {
      return matches.slice(0, limit);
    }

    // Allow custom user-typed settlement name even when offline
    const cleanName = query.trim();
    return [
      {
        id: `custom-${cleanName.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-')}`,
        name: cleanName,
        region: 'Пользовательская локация',
        country: '',
        latitude: 55.75,
        longitude: 37.61,
      },
    ];
  }
}

export class PresetFallbackWeatherAdapter implements WeatherProviderAdapterPort {
  async fetchCurrentWeather(location: WeatherLocation): Promise<WeatherReading> {
    const preset = PRESET_WEATHER_LOCATIONS.find(
      (p) => p.id === location.id || p.name.toLowerCase() === location.name.toLowerCase(),
    );

    const now = new Date();
    const hour = now.getHours();
    const isDay = hour >= 7 && hour < 21;

    // Diurnal temperature curve: cooler at dawn/night, warmer at 14:00–16:00
    const diurnalDelta = isDay ? Math.round(Math.sin(((hour - 7) / 14) * Math.PI) * 3) : -2;
    const baseTemp = preset?.baseTempC ?? Math.round(28 - Math.abs(location.latitude) * 0.3);
    const condition = preset?.defaultCondition ?? 'partly_cloudy';
    const temperatureC = baseTemp + diurnalDelta;
    const windSpeedKmh =
      condition === 'thunderstorm' || condition === 'heavy_rain'
        ? 24
        : condition === 'rain' || condition === 'snow'
          ? 16
          : 11;
    const humidityPercent =
      condition === 'fog' || condition === 'rain' || condition === 'heavy_rain' || condition === 'drizzle'
        ? 86
        : condition === 'snow'
          ? 78
          : 58;

    return {
      condition,
      wmoCode: mapConditionToRepresentativeWmoCode(condition),
      temperatureC,
      feelsLikeC: temperatureC - (windSpeedKmh > 18 ? 2 : 1),
      humidityPercent,
      windSpeedKmh,
      cloudCoverPercent:
        condition === 'clear'
          ? 10
          : condition === 'partly_cloudy'
            ? 45
            : condition === 'cloudy'
              ? 75
              : 92,
      isDay,
      observedAt: now.toISOString(),
      provider: 'preset-fallback',
    };
  }
}
