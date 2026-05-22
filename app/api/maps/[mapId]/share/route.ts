import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ enabled: z.boolean() });

export async function POST(request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { enabled } = schema.parse(await request.json());
  const shareToken = enabled ? randomBytes(32).toString("hex") : null;

  const { data: map, error } = await supabase
    .from("maps")
    .update({
      share_enabled: enabled,
      share_token: shareToken,
      visibility: enabled ? "unlisted" : "private",
    })
    .eq("id", mapId)
    .eq("owner_id", userData.user.id)
    .select("share_token")
    .single();

  if (error || !map) return NextResponse.json({ error: "Map not found." }, { status: 404 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  return NextResponse.json({
    shareUrl: enabled && map.share_token ? `${appUrl}/share/${map.share_token}` : null,
  });
}
