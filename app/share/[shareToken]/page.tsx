import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { MapView } from "@/components/map-view";
import { createClient } from "@/lib/supabase/server";

export default async function SharedMapPage({ params }: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  const { data: map } = await supabase
    .from("maps")
    .select("*")
    .eq("share_token", shareToken)
    .eq("share_enabled", true)
    .single();
  if (!map) notFound();

  const { data: pins } = await supabase
    .from("pins")
    .select("*")
    .eq("map_id", map.id)
    .order("rating", { ascending: false, nullsFirst: false })
    .order("review_count", { ascending: false, nullsFirst: false });

  return (
    <>
      <SiteHeader />
      <MapView
        map={map}
        pins={pins ?? []}
        readOnly
        shareToken={shareToken}
        isLoggedIn={Boolean(userData.user)}
        canEdit={map.share_permission === "edit" && Boolean(userData.user)}
        sharedMode={map.share_permission}
      />
    </>
  );
}
