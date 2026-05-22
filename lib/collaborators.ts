import type { MapMemberRow, ProfileRow } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";

export type Collaborator = {
  userId: string;
  role: MapMemberRow["role"];
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
};

type MapOwner = {
  id: string;
  owner_id: string;
};

const roleRank: Record<MapMemberRow["role"], number> = {
  owner: 0,
  editor: 1,
  viewer: 2,
};

export async function getCollaboratorsForMaps(maps: MapOwner[]) {
  if (!maps.length) return new Map<string, Collaborator[]>();

  try {
    const admin = createAdminClient();
    const mapIds = maps.map((map) => map.id);
    const ownerByMapId = new Map(maps.map((map) => [map.id, map.owner_id]));

    const { data: members } = await admin
      .from("map_members")
      .select("map_id,user_id,role")
      .in("map_id", mapIds);

    const userIds = new Set<string>();
    for (const map of maps) userIds.add(map.owner_id);
    for (const member of members ?? []) userIds.add(member.user_id);

    const { data: profiles } = userIds.size
      ? await admin.from("profiles").select("id,email,display_name,avatar_url,created_at").in("id", [...userIds])
      : { data: [] as ProfileRow[] };

    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const collaboratorsByMapId = new Map<string, Collaborator[]>();

    for (const map of maps) {
      const mapMembers = (members ?? []).filter((member) => member.map_id === map.id);
      const hasOwnerMember = mapMembers.some((member) => member.user_id === map.owner_id);
      const normalizedMembers = hasOwnerMember
        ? mapMembers
        : [{ map_id: map.id, user_id: map.owner_id, role: "owner" as const }];

      const collaborators = normalizedMembers
        .map((member) => {
          const ownerId = ownerByMapId.get(member.map_id);
          const role = member.user_id === ownerId ? "owner" : member.role;
          const profile = profileById.get(member.user_id);

          return {
            userId: member.user_id,
            role,
            displayName: profile?.display_name ?? null,
            email: profile?.email ?? null,
            avatarUrl: profile?.avatar_url ?? null,
          };
        })
        .sort((a, b) => roleRank[a.role] - roleRank[b.role] || displayLabel(a).localeCompare(displayLabel(b)));

      collaboratorsByMapId.set(map.id, collaborators);
    }

    return collaboratorsByMapId;
  } catch {
    return fallbackOwnerCollaborators(maps);
  }
}

export async function getCollaboratorsForMap(map: MapOwner) {
  const collaboratorsByMapId = await getCollaboratorsForMaps([map]);
  return collaboratorsByMapId.get(map.id) ?? [];
}

function displayLabel(collaborator: Pick<Collaborator, "displayName" | "email">) {
  return collaborator.displayName ?? collaborator.email ?? "";
}

function fallbackOwnerCollaborators(maps: MapOwner[]) {
  return new Map(
    maps.map((map) => [
      map.id,
      [
        {
          userId: map.owner_id,
          role: "owner" as const,
          displayName: null,
          email: null,
          avatarUrl: null,
        },
      ],
    ]),
  );
}
