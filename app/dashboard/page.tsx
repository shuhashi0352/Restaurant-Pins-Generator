import Link from "next/link";
import { Plus } from "lucide-react";
import { DashboardMapGrid } from "@/components/dashboard-map-grid";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { getCollaboratorsForMaps } from "@/lib/collaborators";
import type { MapMemberRow } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

type DashboardMap = {
  id: string;
  owner_id: string;
  name: string;
  center_label: string;
  radius_meters: number;
  share_enabled: boolean;
  created_at: string;
  ownership: "owned" | "shared";
  role: MapMemberRow["role"];
};

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: ownedMaps } = await supabase
    .from("maps")
    .select("id,owner_id,name,center_label,radius_meters,share_enabled,created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  const { data: memberships } = await supabase
    .from("map_members")
    .select("map_id,role")
    .eq("user_id", user.id)
    .neq("role", "owner");

  const sharedMapIds = memberships?.map((membership) => membership.map_id) ?? [];
  const { data: sharedMaps } = sharedMapIds.length
    ? await supabase
        .from("maps")
        .select("id,owner_id,name,center_label,radius_meters,share_enabled,created_at")
        .in("id", sharedMapIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const roleByMapId = new Map((memberships ?? []).map((membership) => [membership.map_id, membership.role]));
  const maps: DashboardMap[] = [
    ...(ownedMaps ?? []).map((map) => ({ ...map, ownership: "owned" as const, role: "owner" as const })),
    ...(sharedMaps ?? []).map((map) => ({
      ...map,
      ownership: "shared" as const,
      role: roleByMapId.get(map.id) ?? "viewer",
    })),
  ].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const collaboratorsByMapId = await getCollaboratorsForMaps(maps);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Owned maps and collaborative maps shared with you.</p>
          </div>
          <Button asChild>
            <Link href="/create"><Plus className="h-4 w-4" />Create Map</Link>
          </Button>
        </div>

        {maps.length ? (
          <DashboardMapGrid initialMaps={maps} collaboratorsByMapId={Object.fromEntries(collaboratorsByMapId)} currentUserId={user.id} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No maps yet</CardTitle>
              <CardDescription>Create your first ranked restaurant map.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild><Link href="/create">Create Map</Link></Button>
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
