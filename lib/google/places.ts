import { googleMapsPlaceUrl } from "@/lib/utils";
import type { GenerateMapInput } from "@/lib/validation";
import type { GeocodedLocation, PlaceCandidate, RankedRestaurant } from "./types";

type PlacesResponse = {
  results?: PlaceCandidate[];
  next_page_token?: string;
  status: string;
  error_message?: string;
};

type GeocodeResponse = {
  results?: Array<{
    formatted_address: string;
    geometry: { location: { lat: number; lng: number } };
  }>;
  status: string;
  error_message?: string;
};

const PLACES_BASE_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json";
const GEOCODE_BASE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const earthRadius = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadius * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function assertOk(status: string, message: string | undefined, context: string) {
  if (["OK", "ZERO_RESULTS"].includes(status)) return;
  throw new Error(`${context} failed: ${message ?? status}`);
}

async function fetchPlacesPage(url: URL) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("Google Places request failed.");
  const payload = (await response.json()) as PlacesResponse;
  assertOk(payload.status, payload.error_message, "Google Places");
  return payload;
}

function isRestaurant(place: PlaceCandidate) {
  return place.types?.includes("restaurant") === true;
}

function passesFilters(place: PlaceCandidate, input: GenerateMapInput) {
  if (!isRestaurant(place)) return false;
  if (input.minRating !== "any" && (place.rating ?? 0) < input.minRating) return false;
  if (input.minReviewCount !== "any" && (place.user_ratings_total ?? 0) < input.minReviewCount) return false;
  if (input.priceLevel !== "any" && String(place.price_level ?? "") !== input.priceLevel) return false;
  if (input.openNow === "open" && place.opening_hours?.open_now !== true) return false;
  return distanceMeters(input.center, place.geometry.location) <= input.radiusMeters;
}

export async function geocodeLocation(query: string): Promise<GeocodedLocation> {
  const url = new URL(GEOCODE_BASE_URL);
  url.searchParams.set("address", query);
  url.searchParams.set("key", requiredEnv("GOOGLE_GEOCODING_API_KEY"));

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("Google Geocoding request failed.");

  const payload = (await response.json()) as GeocodeResponse;
  assertOk(payload.status, payload.error_message, "Google Geocoding");

  const first = payload.results?.[0];
  if (!first) throw new Error("No matching location found.");

  return {
    lat: first.geometry.location.lat,
    lng: first.geometry.location.lng,
    label: first.formatted_address,
  };
}

export async function searchRankedRestaurants(input: GenerateMapInput): Promise<RankedRestaurant[]> {
  const key = requiredEnv("GOOGLE_PLACES_API_KEY");
  const allResults: PlaceCandidate[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 3; page += 1) {
    const url = new URL(PLACES_BASE_URL);
    url.searchParams.set("key", key);

    if (pageToken) {
      url.searchParams.set("pagetoken", pageToken);
      await new Promise((resolve) => setTimeout(resolve, 1800));
    } else {
      url.searchParams.set("location", `${input.center.lat},${input.center.lng}`);
      url.searchParams.set("radius", String(input.radiusMeters));
      url.searchParams.set("type", "restaurant");
      if (input.openNow === "open") url.searchParams.set("opennow", "true");
    }

    const payload = await fetchPlacesPage(url);
    allResults.push(...(payload.results ?? []));
    pageToken = payload.next_page_token;
    if (!pageToken || allResults.length >= input.maxPins * 3) break;
  }

  const deduped = new Map<string, PlaceCandidate>();
  allResults.forEach((place) => deduped.set(place.place_id, place));

  return [...deduped.values()]
    .filter((place) => passesFilters(place, input))
    .sort((a, b) => {
      const ratingDiff = (b.rating ?? 0) - (a.rating ?? 0);
      if (ratingDiff !== 0) return ratingDiff;
      return (b.user_ratings_total ?? 0) - (a.user_ratings_total ?? 0);
    })
    .slice(0, input.maxPins)
    .map((place) => ({
      googlePlaceId: place.place_id,
      name: place.name,
      address: place.vicinity ?? place.formatted_address ?? null,
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
      rating: place.rating ?? null,
      reviewCount: place.user_ratings_total ?? null,
      priceLevel: place.price_level == null ? null : String(place.price_level),
      googleMapsUrl: googleMapsPlaceUrl(place.place_id),
    }));
}
