import { NextResponse } from "next/server";
import type { Database, PinRow } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type MapInsert = Database["public"]["Tables"]["maps"]["Insert"];
type PinInsert = Database["public"]["Tables"]["pins"]["Insert"];

export async function POST(request: Request, { params }: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Sign in before saving this map.", loginUrl: `/login?next=/share/${shareToken}` }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: sourceMap } = await admin
    .from("maps")
    .select("*")
    .eq("share_token", shareToken)
    .eq("share_enabled", true)
    .single();

  if (!sourceMap) return NextResponse.json({ error: "Shared map not found." }, { status: 404 });

  const { data: sourcePins, error: pinsError } = await admin
    .from("pins")
    .select("*")
    .eq("map_id", sourceMap.id)
    .order("rating", { ascending: false, nullsFirst: false })
    .order("review_count", { ascending: false, nullsFirst: false });

  if (pinsError) return NextResponse.json({ error: pinsError.message }, { status: 400 });

  const newMapPayload: MapInsert = {
    owner_id: userData.user.id,
    name: `Copy of ${sourceMap.name}`,
    center_lat: sourceMap.center_lat,
    center_lng: sourceMap.center_lng,
    center_label: sourceMap.center_label,
    radius_meters: sourceMap.radius_meters,
    min_rating: sourceMap.min_rating,
    min_review_count: sourceMap.min_review_count,
    max_pins: sourceMap.max_pins,
    icon: sourceMap.icon,
    price_level: sourceMap.price_level,
    open_now: sourceMap.open_now,
    visibility: "private",
    share_enabled: false,
    share_token: null,
    share_permission: "view",
  };

  const { data: newMap, error: mapError } = await admin.from("maps").insert(newMapPayload).select("id").single();
  if (mapError || !newMap) {
    return NextResponse.json({ error: mapError?.message ?? "Could not save this map." }, { status: 400 });
  }

  const pins = (sourcePins ?? []) as PinRow[];
  if (pins.length) {
    const pinPayload: PinInsert[] = pins.map((pin) => ({
      map_id: newMap.id,
      google_place_id: pin.google_place_id,
      name: pin.name,
      address: pin.address,
      lat: pin.lat,
      lng: pin.lng,
      rating: pin.rating,
      review_count: pin.review_count,
      price_level: pin.price_level,
      google_maps_url: pin.google_maps_url,
    }));
    const { error: insertPinsError } = await admin.from("pins").insert(pinPayload);
    if (insertPinsError) return NextResponse.json({ error: insertPinsError.message }, { status: 400 });
  }

  return NextResponse.json({ mapId: newMap.id, redirectTo: `/maps/${newMap.id}` });
}
