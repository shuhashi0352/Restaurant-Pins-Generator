import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateMapSchema } from "@/lib/validation";
import { searchRankedRestaurants } from "@/lib/google/places";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Sign in before generating a saved map." }, { status: 401 });
  }

  try {
    const input = generateMapSchema.parse(await request.json());
    const restaurants = await searchRankedRestaurants(input);

    const { data: map, error: mapError } = await supabase
      .from("maps")
      .insert({
        owner_id: userData.user.id,
        name: input.name,
        center_lat: input.center.lat,
        center_lng: input.center.lng,
        center_label: input.center.label,
        radius_meters: input.radiusMeters,
        min_rating: input.minRating === "any" ? null : input.minRating,
        min_review_count: input.minReviewCount === "any" ? null : input.minReviewCount,
        max_pins: input.maxPins,
        icon: input.icon,
        price_level: input.priceLevel,
        open_now: input.openNow === "open",
      })
      .select("id")
      .single();

    if (mapError || !map) throw new Error(mapError?.message ?? "Could not save the map.");

    await supabase.from("map_members").upsert(
      {
        map_id: map.id,
        user_id: userData.user.id,
        role: "owner",
      },
      { onConflict: "map_id,user_id" },
    );

    if (restaurants.length) {
      const { error: pinError } = await supabase.from("pins").insert(
        restaurants.map((restaurant) => ({
          map_id: map.id,
          google_place_id: restaurant.googlePlaceId,
          name: restaurant.name,
          address: restaurant.address,
          lat: restaurant.lat,
          lng: restaurant.lng,
          rating: restaurant.rating,
          review_count: restaurant.reviewCount,
          price_level: restaurant.priceLevel,
          google_maps_url: restaurant.googleMapsUrl,
        })),
      );
      if (pinError) throw new Error(pinError.message);
    }

    return NextResponse.json({ mapId: map.id, count: restaurants.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not generate the map." },
      { status: 400 },
    );
  }
}
