import type { Database, MapMemberRow } from "@/lib/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type MapRole = MapMemberRow["role"];

export function canEditRole(role: MapRole | null) {
  return role === "owner" || role === "editor";
}

export async function getMapRole(
  supabase: SupabaseClient<Database>,
  mapId: string,
  userId: string,
  ownerId: string,
): Promise<MapRole | null> {
  if (ownerId === userId) return "owner";

  const { data } = await supabase
    .from("map_members")
    .select("role")
    .eq("map_id", mapId)
    .eq("user_id", userId)
    .maybeSingle();

  return data?.role ?? null;
}
