import { NextResponse } from "next/server";
import { z } from "zod";
import type { Database } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  icon: z.enum(["restaurant", "star", "heart", "flag", "pin"]).optional(),
  shareToken: z.string().min(1).optional(),
});

type MapUpdate = Pick<Database["public"]["Tables"]["maps"]["Update"], "name" | "icon">;

export async function PATCH(request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Sign in before editing this map." }, { status: 401 });

  const input = schema.parse(await request.json());
  const updatePayload: MapUpdate = {};
  if (input.name !== undefined) updatePayload.name = input.name;
  if (input.icon !== undefined) updatePayload.icon = input.icon;
  if (!Object.keys(updatePayload).length) return NextResponse.json({ error: "No supported changes provided." }, { status: 400 });

  const admin = createAdminClient();
  const { data: map } = await admin
    .from("maps")
    .select("id,owner_id,share_enabled,share_token,share_permission")
    .eq("id", mapId)
    .single();

  if (!map) return NextResponse.json({ error: "Map not found." }, { status: 404 });

  const isOwner = map.owner_id === userData.user.id;
  const canSharedEdit =
    map.share_enabled &&
    map.share_permission === "edit" &&
    map.share_token !== null &&
    input.shareToken === map.share_token;

  if (!isOwner && !canSharedEdit) {
    return NextResponse.json({ error: "You do not have permission to edit this map." }, { status: 403 });
  }

  const { data: updatedMap, error } = await admin
    .from("maps")
    .update(updatePayload)
    .eq("id", mapId)
    .select("*")
    .single();

  if (error || !updatedMap) {
    return NextResponse.json({ error: error?.message ?? "Could not update the map." }, { status: 400 });
  }

  return NextResponse.json({ map: updatedMap });
}
