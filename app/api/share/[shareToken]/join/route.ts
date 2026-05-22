import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(_request: Request, { params }: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Sign in before joining this shared map.", loginUrl: `/login?next=/share/${shareToken}` }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: map } = await admin
    .from("maps")
    .select("id,owner_id,share_enabled,share_permission")
    .eq("share_token", shareToken)
    .eq("share_enabled", true)
    .single();

  if (!map) return NextResponse.json({ error: "Shared map not found." }, { status: 404 });
  if (map.share_permission !== "edit") {
    return NextResponse.json({ error: "This share link is view-only." }, { status: 403 });
  }

  if (map.owner_id !== userData.user.id) {
    const { error } = await admin.from("map_members").upsert(
      {
        map_id: map.id,
        user_id: userData.user.id,
        role: "editor",
      },
      { onConflict: "map_id,user_id", ignoreDuplicates: true },
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ mapId: map.id, redirectTo: `/maps/${map.id}` });
}
