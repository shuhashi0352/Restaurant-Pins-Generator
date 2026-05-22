"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { DeleteMapDialog } from "@/components/delete-map-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@/i18n/navigation";
import type { Collaborator } from "@/lib/collaborators";
import type { MapMemberRow } from "@/lib/database.types";

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

type Props = {
  initialMaps: DashboardMap[];
  collaboratorsByMapId: Record<string, Collaborator[]>;
  currentUserId: string;
};

export function DashboardMapGrid({ initialMaps, collaboratorsByMapId, currentUserId }: Props) {
  const t = useTranslations("Dashboard");
  const [maps, setMaps] = useState(initialMaps);

  return (
    <Tabs defaultValue="all">
      <TabsList className="mb-4">
        <TabsTrigger value="all">{t("tabs.all")}</TabsTrigger>
        <TabsTrigger value="owned">{t("tabs.owned")}</TabsTrigger>
        <TabsTrigger value="shared">{t("tabs.shared")}</TabsTrigger>
      </TabsList>
      <TabsContent value="all">
        <MapCards maps={maps} collaboratorsByMapId={collaboratorsByMapId} currentUserId={currentUserId} onDeleted={(mapId) => setMaps((current) => current.filter((map) => map.id !== mapId))} />
      </TabsContent>
      <TabsContent value="owned">
        <MapCards maps={maps.filter((map) => map.ownership === "owned")} collaboratorsByMapId={collaboratorsByMapId} currentUserId={currentUserId} onDeleted={(mapId) => setMaps((current) => current.filter((map) => map.id !== mapId))} />
      </TabsContent>
      <TabsContent value="shared">
        <MapCards maps={maps.filter((map) => map.ownership === "shared")} collaboratorsByMapId={collaboratorsByMapId} currentUserId={currentUserId} onDeleted={(mapId) => setMaps((current) => current.filter((map) => map.id !== mapId))} />
      </TabsContent>
    </Tabs>
  );
}

function MapCards({
  maps,
  collaboratorsByMapId,
  currentUserId,
  onDeleted,
}: {
  maps: DashboardMap[];
  collaboratorsByMapId: Record<string, Collaborator[]>;
  currentUserId: string;
  onDeleted: (mapId: string) => void;
}) {
  const t = useTranslations("Dashboard");
  if (!maps.length) {
    return <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">{t("emptyView")}</div>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {maps.map((map) => {
        const collaborators = collaboratorsByMapId[map.id] ?? [];
        const isSharedWithCollaborators = map.share_enabled && collaborators.some((collaborator) => collaborator.role !== "owner");

        return (
          <Card key={map.id} className="h-full transition hover:border-primary">
            <Link href={`/maps/${map.id}`} className="block">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle>{map.name}</CardTitle>
                  <Badge className="shrink-0 bg-white">{map.ownership === "owned" ? t("badges.owned") : t("badges.shared")}</Badge>
                </div>
                <CardDescription>{map.center_label}</CardDescription>
              </CardHeader>
            </Link>
            <CardContent className="grid gap-3 text-sm text-muted-foreground">
              <p>
                {t("radius", { radius: map.radius_meters })} · {map.role === "editor" ? t("permissions.canEdit") : map.role === "viewer" ? t("permissions.canView") : map.share_enabled ? t("permissions.sharingEnabled") : t("permissions.private")}
              </p>
              {collaborators.length ? <CollaboratorAvatars collaborators={collaborators} currentUserId={currentUserId} /> : null}
              {map.ownership === "owned" ? (
                <div className="border-t pt-3">
                  <DeleteMapDialog
                    mapId={map.id}
                    mapName={map.name}
                    isSharedWithCollaborators={isSharedWithCollaborators}
                    onDeleted={() => onDeleted(map.id)}
                    trigger={
                      <Button type="button" variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                        {t("deleteMap")}
                      </Button>
                    }
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function CollaboratorAvatars({ collaborators, currentUserId }: { collaborators: Collaborator[]; currentUserId: string }) {
  const t = useTranslations("Collaborators");
  const visibleCollaborators = collaborators.slice(0, 5);
  const overflowCount = Math.max(0, collaborators.length - visibleCollaborators.length);

  return (
    <div className="flex items-center gap-2" aria-label={t("title")}>
      <div className="flex -space-x-2">
        {visibleCollaborators.map((collaborator) => (
          <span key={collaborator.userId} title={collaboratorLabel(collaborator, currentUserId, t)} className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-muted text-[11px] font-medium text-muted-foreground">
            {collaborator.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={collaborator.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
            ) : (
              collaboratorInitials(collaborator)
            )}
          </span>
        ))}
      </div>
      <span className="text-xs">{t("peopleCount", { count: collaborators.length })}</span>
      {overflowCount ? <span className="text-xs">+{overflowCount}</span> : null}
    </div>
  );
}

function collaboratorLabel(collaborator: Collaborator, currentUserId: string, t: ReturnType<typeof useTranslations<"Collaborators">>) {
  const name = collaborator.displayName ?? collaborator.email ?? t("unknown");
  const role = collaborator.role === "owner" ? t("roles.owner") : collaborator.role === "editor" ? t("roles.editor") : t("roles.viewer");
  return `${name}${collaborator.userId === currentUserId ? ` (${t("you")})` : ""} - ${role}`;
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
