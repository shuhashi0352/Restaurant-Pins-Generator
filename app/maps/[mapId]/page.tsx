import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { MapView } from "@/components/map-view";
import { requireUser } from "@/lib/auth";
import { getCollaboratorsForMap } from "@/lib/collaborators";
import { canEditRole, getMapRole } from "@/lib/map-permissions";
import { createClient } from "@/lib/supabase/server";

export default async function PrivateMapPage({ params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: map } = await supabase.from("maps").select("*").eq("id", mapId).single();
  if (!map) notFound();

  const role = await getMapRole(supabase, map.id, user.id, map.owner_id);
  if (!role) notFound();

  const { data: pins } = await supabase
    .from("pins")
    .select("*")
    .eq("map_id", map.id)
    .order("rating", { ascending: false, nullsFirst: false })
    .order("review_count", { ascending: false, nullsFirst: false });
  const collaborators = await getCollaboratorsForMap(map);

  return (
    <>
      <SiteHeader />
      <MapView
        map={map}
        pins={pins ?? []}
        canShare={role === "owner"}
        canEdit={canEditRole(role)}
        membershipRole={role}
        collaborators={collaborators}
        currentUserId={user.id}
      />
    </>
  );
}
