import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPriceLevel(priceLevel: string | null) {
  if (!priceLevel || priceLevel === "any") return "Any";
  return "$".repeat(Number(priceLevel));
}

export function googleMapsPlaceUrl(placeId: string) {
  return `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${encodeURIComponent(placeId)}`;
}
