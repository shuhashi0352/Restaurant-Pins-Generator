import { NextResponse } from "next/server";
import { canEditRole, getMapRole } from "@/lib/map-permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ mapId: string; pinId: string }> },
) {
  const { mapId, pinId } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Sign in before editing this map." }, { status: 401 });

  const admin = createAdminClient();

  const { data: map } = await admin
    .from("maps")
    .select("id,owner_id")
    .eq("id", mapId)
    .single();

  if (!map) return NextResponse.json({ error: "Map not found." }, { status: 404 });

  const role = await getMapRole(admin, map.id, userData.user.id, map.owner_id);
  if (!canEditRole(role)) {
    return NextResponse.json({ error: "You do not have permission to delete pins from this map." }, { status: 403 });
  }

  const { error } = await admin.from("pins").delete().eq("id", pinId).eq("map_id", mapId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ deleted: true });
}
