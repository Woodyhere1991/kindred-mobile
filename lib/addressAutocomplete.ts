const ADDY_KEY = process.env.EXPO_PUBLIC_ADDY_API_KEY || ''
const BASE = 'https://api.addy.co.nz'

export interface AddySuggestion {
  id: string
  a: string // full address string
}

/** Search for NZ addresses matching the query */
export async function searchAddresses(query: string): Promise<AddySuggestion[]> {
  if (!ADDY_KEY || query.length < 3) return []
  try {
    const res = await fetch(`${BASE}/search?s=${encodeURIComponent(query)}&key=${ADDY_KEY}&max=5`)
    if (!res.ok) return []
    const data = await res.json()
    return (data.addresses || []) as AddySuggestion[]
  } catch {
    return []
  }
}

/** Get coordinates and suburb for a specific address by Addy ID */
export async function getAddressCoords(id: string): Promise<{ lat: number; lng: number; suburb?: string; city?: string } | null> {
  if (!ADDY_KEY || !id) return null
  try {
    const res = await fetch(`${BASE}/address/${encodeURIComponent(id)}?key=${ADDY_KEY}`)
    if (!res.ok) return null
    const data = await res.json()
    if (data.y && data.x) {
      return { lat: data.y, lng: data.x, suburb: data.suburb || undefined, city: data.city || data.mailtown || undefined }
    }
    return null
  } catch {
    return null
  }
}
