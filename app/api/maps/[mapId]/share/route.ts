import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  enabled: z.boolean(),
  permission: z.enum(["private", "view", "edit"]).default("private"),
});
type MapUpdate = Database["public"]["Tables"]["maps"]["Update"];

export async function PATCH(request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { enabled: requestedEnabled, permission } = schema.parse(await request.json());
  const enabled = requestedEnabled && permission !== "private";
  const { data: existingMap } = await supabase
    .from("maps")
    .select("share_token")
    .eq("id", mapId)
    .eq("owner_id", userData.user.id)
    .single();

  if (!existingMap) return NextResponse.json({ error: "Map not found." }, { status: 404 });

  const shareToken = enabled ? existingMap.share_token ?? randomBytes(32).toString("hex") : null;
  const updatePayload: MapUpdate = {
    share_enabled: enabled,
    share_token: shareToken,
    share_permission: enabled ? permission : "private",
    visibility: enabled ? "unlisted" : "private",
  };

  const { data: map, error } = await supabase
    .from("maps")
    .update(updatePayload)
    .eq("id", mapId)
    .eq("owner_id", userData.user.id)
    .select("share_token,share_permission")
    .single();

  if (error || !map) return NextResponse.json({ error: "Map not found." }, { status: 404 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  return NextResponse.json({
    shareUrl: enabled && map.share_token ? `${appUrl}/share/${map.share_token}` : null,
    sharePermission: map.share_permission,
  });
}

export async function POST(request: Request, context: { params: Promise<{ mapId: string }> }) {
  return PATCH(request, context);
}
