export type PlaceCandidate = {
  place_id: string;
  name: string;
  vicinity?: string;
  formatted_address?: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  types?: string[];
  opening_hours?: {
    open_now?: boolean;
  };
};

export type RankedRestaurant = {
  googlePlaceId: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: string | null;
  googleMapsUrl: string;
};

export type GeocodedLocation = {
  lat: number;
  lng: number;
  label: string;
};
