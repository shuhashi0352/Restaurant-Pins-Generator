import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { MapView } from "@/components/map-view";
import { getCollaboratorsForMap } from "@/lib/collaborators";
import { canEditRole, getMapRole } from "@/lib/map-permissions";
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
  const sharedMode = map.share_permission === "edit" ? "edit" : "view";
  const role = userData.user ? await getMapRole(supabase, map.id, userData.user.id, map.owner_id) : null;

  const { data: pins } = await supabase
    .from("pins")
    .select("*")
    .eq("map_id", map.id)
    .order("rating", { ascending: false, nullsFirst: false })
    .order("review_count", { ascending: false, nullsFirst: false });
  const collaborators = role ? await getCollaboratorsForMap(map) : [];

  return (
    <>
      <SiteHeader />
      <MapView
        map={map}
        pins={pins ?? []}
        readOnly
        shareToken={shareToken}
        isLoggedIn={Boolean(userData.user)}
        canEdit={sharedMode === "edit" && canEditRole(role)}
        canJoinSharedMap={sharedMode === "edit" && role === null}
        membershipRole={role}
        sharedMode={sharedMode}
        collaborators={collaborators}
        currentUserId={userData.user?.id}
      />
    </>
  );
}
