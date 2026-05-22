import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPriceLevel(priceLevel: string | null) {
  if (!priceLevel || priceLevel === "any") return "Any";
  if (priceLevel.includes("-")) {
    const [min, max] = priceLevel.split("-");
    if (min === max) return "$".repeat(Number(min));
    return `${"$".repeat(Number(min))}-${"$".repeat(Number(max))}`;
  }
  return "$".repeat(Number(priceLevel));
}

export function googleMapsPlaceUrl(placeId: string) {
  return `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${encodeURIComponent(placeId)}`;
}
