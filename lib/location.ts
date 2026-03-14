import * as Location from 'expo-location'

/** Haversine formula — returns distance in kilometres between two lat/lng points */
export function getDistanceKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371 // Earth radius in km
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

/** Format distance for display: "500m" or "3 km" */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km)} km`
}

/** Get a bounding box for a radius around a point (for SQL BETWEEN queries) */
export function getBoundingBox(lat: number, lng: number, radiusKm: number) {
  const deltaLat = radiusKm / 111.32
  const deltaLng = radiusKm / (111.32 * Math.cos(toRad(lat)))
  return {
    minLat: lat - deltaLat,
    maxLat: lat + deltaLat,
    minLng: lng - deltaLng,
    maxLng: lng + deltaLng,
  }
}

/** Convert an address string to coordinates using on-device geocoding */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const results = await Location.geocodeAsync(address)
    if (results.length > 0) {
      return { lat: results[0].latitude, lng: results[0].longitude }
    }
    return null
  } catch {
    return null
  }
}

/** Request location permission and get current coords */
export async function getCurrentLocation(): Promise<{ lat: number; lng: number } | null> {
  const { status } = await Location.requestForegroundPermissionsAsync()
  if (status !== 'granted') return null

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  })

  return {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
  }
}
