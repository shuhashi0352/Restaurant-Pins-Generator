import Link from "next/link";
import { Plus } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireUser } from "@/lib/auth";
import { type Collaborator, getCollaboratorsForMaps } from "@/lib/collaborators";
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
          <Tabs defaultValue="all">
            <TabsList className="mb-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="owned">Owned by you</TabsTrigger>
              <TabsTrigger value="shared">Shared with you</TabsTrigger>
            </TabsList>
            <TabsContent value="all">
              <MapGrid maps={maps} collaboratorsByMapId={collaboratorsByMapId} currentUserId={user.id} />
            </TabsContent>
            <TabsContent value="owned">
              <MapGrid maps={maps.filter((map) => map.ownership === "owned")} collaboratorsByMapId={collaboratorsByMapId} currentUserId={user.id} />
            </TabsContent>
            <TabsContent value="shared">
              <MapGrid maps={maps.filter((map) => map.ownership === "shared")} collaboratorsByMapId={collaboratorsByMapId} currentUserId={user.id} />
            </TabsContent>
          </Tabs>
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

function MapGrid({
  maps,
  collaboratorsByMapId,
  currentUserId,
}: {
  maps: DashboardMap[];
  collaboratorsByMapId: Map<string, Collaborator[]>;
  currentUserId: string;
}) {
  if (!maps.length) {
    return <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No maps in this view.</div>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {maps.map((map) => {
        const collaborators = collaboratorsByMapId.get(map.id) ?? [];

        return (
          <Link key={map.id} href={`/maps/${map.id}`}>
            <Card className="h-full transition hover:border-primary">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle>{map.name}</CardTitle>
                  <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
                    {map.ownership === "owned" ? "Owned by you" : "Shared with you"}
                  </span>
                </div>
                <CardDescription>{map.center_label}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm text-muted-foreground">
                <p>
                  {map.radius_meters}m radius · {map.role === "editor" ? "Can edit" : map.role === "viewer" ? "Can view" : map.share_enabled ? "Sharing enabled" : "Private"}
                </p>
                {collaborators.length ? <CollaboratorAvatars collaborators={collaborators} currentUserId={currentUserId} /> : null}
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

function CollaboratorAvatars({ collaborators, currentUserId }: { collaborators: Collaborator[]; currentUserId: string }) {
  const visibleCollaborators = collaborators.slice(0, 5);
  const overflowCount = Math.max(0, collaborators.length - visibleCollaborators.length);

  return (
    <div className="flex items-center gap-2" aria-label="Collaborators">
      <div className="flex -space-x-2">
        {visibleCollaborators.map((collaborator) => (
          <span key={collaborator.userId} title={collaboratorLabel(collaborator, currentUserId)} className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-muted text-[11px] font-medium text-muted-foreground">
            {collaborator.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={collaborator.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
            ) : (
              collaboratorInitials(collaborator)
            )}
          </span>
        ))}
      </div>
      <span className="text-xs">{collaborators.length} {collaborators.length === 1 ? "person" : "people"}</span>
      {overflowCount ? <span className="text-xs">+{overflowCount}</span> : null}
    </div>
  );
}

function collaboratorLabel(collaborator: Collaborator, currentUserId: string) {
  const name = collaborator.displayName ?? collaborator.email ?? "Unknown collaborator";
  const role = collaborator.role === "owner" ? "Owner" : collaborator.role === "editor" ? "Editor" : "Viewer";
  return `${name}${collaborator.userId === currentUserId ? " (You)" : ""} - ${role}`;
}

function collaboratorInitials(collaborator: Collaborator) {
  const label = collaborator.displayName ?? collaborator.email ?? "?";
  return label
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
}
