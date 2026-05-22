import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  shareToken: z.string().min(1).optional(),
});

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ mapId: string; pinId: string }> },
) {
  const { mapId, pinId } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Sign in before editing this map." }, { status: 401 });

  const input = schema.parse(await request.json().catch(() => ({})));
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
    return NextResponse.json({ error: "You do not have permission to delete pins from this map." }, { status: 403 });
  }

  const { error } = await admin.from("pins").delete().eq("id", pinId).eq("map_id", mapId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ deleted: true });
}
