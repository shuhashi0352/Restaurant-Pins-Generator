"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertCircle, Check, Copy, ExternalLink, Globe2, Loader2, Lock, Pencil, Share2, Trash2, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DeleteMapDialog } from "@/components/delete-map-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Collaborator } from "@/lib/collaborators";
import type { MapMemberRow, MapRow, PinRow } from "@/lib/database.types";
import { useRouter } from "@/i18n/navigation";
import { cn, formatPriceLevel } from "@/lib/utils";
import { createClient } from "@/lib/supabase/browser";

type GoogleMap = google.maps.Map;
type GoogleMarker = google.maps.Marker;
type SharePermission = "private" | "view" | "edit";
type SortMode = "distance" | "rating" | "reviews";

type Props = {
  map: MapRow;
  pins: PinRow[];
  canShare?: boolean;
  readOnly?: boolean;
  shareToken?: string;
  isLoggedIn?: boolean;
  canEdit?: boolean;
  canJoinSharedMap?: boolean;
  membershipRole?: MapMemberRow["role"] | null;
  sharedMode?: "view" | "edit";
  collaborators?: Collaborator[];
  currentUserId?: string;
};

const markerColor = "#2563eb";

export function MapView({
  map,
  pins,
  canShare = false,
  readOnly = false,
  shareToken,
  isLoggedIn = false,
  canEdit = !readOnly,
  canJoinSharedMap = false,
  membershipRole = null,
  sharedMode,
  collaborators = [],
  currentUserId,
}: Props) {
  const locale = useLocale();
  const t = useTranslations("MapView");
  const tc = useTranslations("Collaborators");
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<GoogleMap | null>(null);
  const markersRef = useRef<GoogleMarker[]>([]);
  const [currentMap, setCurrentMap] = useState(map);
  const [currentPins, setCurrentPins] = useState(pins);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [activePinId, setActivePinId] = useState(pins[0]?.id ?? null);
  const [shareUrl, setShareUrl] = useState<string | null>(map.share_enabled && map.share_token ? `/${locale}/share/${map.share_token}` : null);
  const [sharePermission, setSharePermission] = useState<SharePermission>(map.share_enabled ? map.share_permission : "private");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [mapName, setMapName] = useState(map.name);
  const [renameLoading, setRenameLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [deletingPinId, setDeletingPinId] = useState<string | null>(null);
  const [browserOrigin, setBrowserOrigin] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("distance");
  const markScriptLoaded = useCallback(() => setScriptLoaded(true), []);

  const sortedPins = useMemo(
    () => sortPins(currentPins, sortMode, { lat: currentMap.center_lat, lng: currentMap.center_lng }),
    [currentMap.center_lat, currentMap.center_lng, currentPins, sortMode],
  );

  const activePin = useMemo(
    () => sortedPins.find((pin) => pin.id === activePinId) ?? sortedPins[0] ?? null,
    [activePinId, sortedPins],
  );

  useEffect(() => {
    setBrowserOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    function load() {
      if (!mapRef.current || !window.google?.maps) return;

      const googleMap = new window.google.maps.Map(mapRef.current, {
        center: { lat: currentMap.center_lat, lng: currentMap.center_lng },
        zoom: 14,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      googleMapRef.current = googleMap;

      markersRef.current = sortedPins.map((pin, index) => {
        const marker = new window.google.maps.Marker({
          map: googleMap,
          position: { lat: pin.lat, lng: pin.lng },
          title: pin.name,
          icon: markerIcon(false),
          zIndex: sortedPins.length - index,
        });
        marker.addListener("click", () => {
          setActivePinId(pin.id);
          googleMap.panTo({ lat: pin.lat, lng: pin.lng });
        });
        return marker;
      });
    }

    if (scriptLoaded) load();
    return () => {
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
    };
  }, [currentMap.center_lat, currentMap.center_lng, scriptLoaded, sortedPins]);

  useEffect(() => {
    markersRef.current.forEach((marker, index) => {
      marker.setIcon(markerIcon(sortedPins[index]?.id === activePinId));
      marker.setZIndex((sortedPins[index]?.id === activePinId ? sortedPins.length : sortedPins.length - index) + 1);
    });
  }, [activePinId, sortedPins]);

  function focusPin(pin: PinRow) {
    setActivePinId(pin.id);
    googleMapRef.current?.panTo({ lat: pin.lat, lng: pin.lng });
    googleMapRef.current?.setZoom(16);
  }

  async function updateShareAccess(permission: SharePermission) {
    setShareLoading(true);
    setShareError(null);
    setSharePermission(permission);
    try {
      const enabled = permission !== "private";
      const response = await fetch(`/api/maps/${map.id}/share`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, permission: enabled ? permission : "private" }),
      });
      const payload = (await response.json()) as { shareUrl?: string | null; sharePermission?: SharePermission; error?: string };
      if (!response.ok) throw new Error(payload.error ?? t("errors.updateSharing"));
      setShareUrl(localizeShareUrl(payload.shareUrl, locale));
      setSharePermission(payload.sharePermission ?? permission);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("errors.updateSharing");
      setShareError(message);
    } finally {
      setShareLoading(false);
    }
  }

  async function renameMap() {
    const nextName = mapName.trim();
    if (!nextName || nextName === currentMap.name) return;
    setRenameLoading(true);
    try {
      const response = await fetch(`/api/maps/${currentMap.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      });
      const payload = (await response.json()) as { map?: MapRow; error?: string };
      if (!response.ok || !payload.map) throw new Error(payload.error ?? t("errors.renameMap"));
      setCurrentMap(payload.map);
      setMapName(payload.map.name);
    } finally {
      setRenameLoading(false);
    }
  }

  async function deletePin(pinId: string) {
    setDeletingPinId(pinId);
    try {
      const response = await fetch(`/api/maps/${currentMap.id}/pins/${pinId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? t("errors.deletePin"));
      const nextPins = currentPins.filter((pin) => pin.id !== pinId);
      setCurrentPins(nextPins);
      if (activePinId === pinId) setActivePinId(nextPins[0]?.id ?? null);
    } finally {
      setDeletingPinId(null);
    }
  }

  async function joinSharedMap() {
    if (!shareToken) return;
    setJoinError(null);
    if (!isLoggedIn) {
      await signInToSharedMap();
      return;
    }
    setJoinLoading(true);
    try {
      const response = await fetch(`/api/share/${shareToken}/join`, { method: "POST" });
      const payload = (await response.json()) as { redirectTo?: string; loginUrl?: string; error?: string };
      if (response.status === 401 && payload.loginUrl) {
        window.location.href = payload.loginUrl;
        return;
      }
      if (!response.ok || !payload.redirectTo) throw new Error(payload.error ?? t("errors.joinMap"));
      window.location.href = localizeRedirect(payload.redirectTo, locale);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("errors.joinMap");
      setJoinError(message);
    } finally {
      setJoinLoading(false);
    }
  }

  async function signInToSharedMap() {
    const supabase = createClient();
    const next = `${window.location.pathname}${window.location.search}`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    const absoluteUrl = new URL(shareUrl, window.location.origin).toString();
    await navigator.clipboard.writeText(absoluteUrl);
  }

  const showSharedControls = Boolean(shareToken);
  const showEditPrompt = sharedMode === "edit" && !isLoggedIn;
  const showJoinPrompt = sharedMode === "edit" && canJoinSharedMap;
  const absoluteShareUrl = shareUrl && browserOrigin ? new URL(shareUrl, browserOrigin).toString() : shareUrl;
  const canDelete = canShare && !readOnly;
  const isSharedWithCollaborators = currentMap.share_enabled && collaborators.some((collaborator) => collaborator.role !== "owner");

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-muted/30 lg:flex-row">
      <aside className="order-2 w-full border-r bg-white lg:order-1 lg:w-[26rem]">
        <div className="border-b p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {canEdit ? (
                <div className="grid gap-2">
                  <div className="flex gap-2">
                    <Input value={mapName} onChange={(event) => setMapName(event.target.value)} aria-label={t("mapName")} />
                    <Button size="sm" onClick={renameMap} disabled={renameLoading || mapName.trim() === currentMap.name}>
                      {renameLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("rename")}
                    </Button>
                  </div>
                </div>
              ) : (
                <h1 className="text-xl font-semibold">{currentMap.name}</h1>
              )}
              <p className="mt-1 text-sm text-muted-foreground">{currentMap.center_label}</p>
            </div>
            {canShare && !readOnly ? (
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Share2 className="h-4 w-4" />
                    {t("share")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[calc(100vh-2rem)] max-w-3xl overflow-y-auto p-0">
                  <DialogHeader>
                    <div className="border-b px-6 py-5">
                      <DialogTitle className="text-xl">{t("shareDialog.title")}</DialogTitle>
                      <DialogDescription className="mt-1">{t("shareDialog.description")}</DialogDescription>
                    </div>
                  </DialogHeader>
                  <div className="grid gap-7 px-6 pb-6">
                    <section className="grid gap-3">
                      <h2 className="text-sm font-semibold">{t("shareDialog.accessLevel")}</h2>
                      <div className="grid gap-3" role="radiogroup" aria-label={t("shareDialog.accessLevel")}>
                        <ShareAccessOption
                          active={sharePermission === "private"}
                          disabled={shareLoading}
                          icon={<Lock className="h-5 w-5" />}
                          title={t("shareDialog.privateTitle")}
                          description={t("shareDialog.privateDescription")}
                          onClick={() => void updateShareAccess("private")}
                        />
                        <ShareAccessOption
                          active={sharePermission === "view"}
                          disabled={shareLoading}
                          icon={<Globe2 className="h-5 w-5" />}
                          title={t("shareDialog.viewTitle")}
                          description={t("shareDialog.viewDescription")}
                          onClick={() => void updateShareAccess("view")}
                        />
                        <ShareAccessOption
                          active={sharePermission === "edit"}
                          disabled={shareLoading}
                          icon={<Pencil className="h-5 w-5" />}
                          title={t("shareDialog.editTitle")}
                          description={t("shareDialog.editDescription")}
                          onClick={() => void updateShareAccess("edit")}
                        />
                      </div>
                    </section>

                    {sharePermission !== "private" && shareUrl ? (
                      <section className="grid gap-3">
                        <h2 className="text-sm font-semibold">{t("shareDialog.shareLink")}</h2>
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <div className="min-w-0 flex-1 rounded-md border bg-muted/60 px-3 py-2.5 text-sm break-all text-muted-foreground">
                            {absoluteShareUrl}
                          </div>
                          <Button type="button" variant="outline" onClick={copyShareUrl} className="sm:w-36">
                            <Copy className="h-4 w-4" />
                            {t("copyLink")}
                          </Button>
                        </div>
                      </section>
                    ) : null}

                    <section className="grid gap-3">
                      <h2 className="text-sm font-semibold">{t("shareDialog.peopleWithAccess")}</h2>
                      <CollaboratorList collaborators={collaborators} currentUserId={currentUserId} compact />
                    </section>

                    {sharePermission === "edit" ? (
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                        <div className="flex gap-3">
                          <AlertCircle className="mt-0.5 h-5 w-5 flex-none" />
                          <div>
                            <p className="font-medium">{t("collaborativeNotice.title")}</p>
                            <p className="mt-1">{t("collaborativeNotice.text")}</p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {sharePermission === "view" ? (
                      <p className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
                        {t("viewOnlyNotice")}
                      </p>
                    ) : null}

                    {shareError ? (
                      <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{shareError}</p>
                    ) : null}

                    <div className="flex items-center justify-between gap-3 border-t pt-5">
                      <p className="text-sm text-muted-foreground">
                        {shareLoading ? t("loading.updatingAccess") : sharePermission === "private" ? t("shareDialog.noPublicLink") : t("shareDialog.linkActive")}
                      </p>
                      {shareLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge>{t("badges.restaurantCount", { count: currentPins.length })}</Badge>
            <Badge>{currentMap.radius_meters}m</Badge>
            <Badge>{currentMap.min_rating == null ? t("badges.anyRating") : t("badges.stars", { rating: currentMap.min_rating })}</Badge>
            <Badge>{t("badges.priceRange", { range: formatPriceLevelLabel(currentMap.price_level, t) })}</Badge>
            <Badge>{t("badges.sortedBy", { mode: t(`sortModes.${sortMode}`) })}</Badge>
            <Badge>{currentMap.open_now ? t("badges.openNow") : t("badges.anyHours")}</Badge>
            {sharedMode ? <Badge>{sharedMode === "edit" ? t("badges.editableShared") : t("badges.viewOnlyShared")}</Badge> : null}
            {membershipRole ? <Badge>{roleLabel(membershipRole, tc)}</Badge> : null}
          </div>
          <div className="mt-4 grid gap-2 rounded-md border bg-muted/30 p-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
            <Label htmlFor="sort-mode" className="text-sm font-medium">{t("sortBy")}</Label>
            <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
              <SelectTrigger id="sort-mode" className="bg-white sm:max-w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="distance">{t("sortModes.distance")}</SelectItem>
                <SelectItem value="rating">{t("sortModes.rating")}</SelectItem>
                <SelectItem value="reviews">{t("sortModes.reviews")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {showSharedControls ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {showJoinPrompt || showEditPrompt ? (
                <Button size="sm" onClick={joinSharedMap} disabled={joinLoading}>
                  {isLoggedIn ? (
                    <>
                      {joinLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                      {t("joinSharedMap")}
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      {t("signInToJoin")}
                    </>
                  )}
                </Button>
              ) : null}
              {canEdit && sharedMode === "edit" ? (
                <Badge className="bg-white">{t("collaborativeBadge")}</Badge>
              ) : null}
              {sharedMode === "view" ? (
                <Badge className="bg-white">{t("viewOnlyLink")}</Badge>
              ) : null}
              {joinError ? (
                <p className="basis-full rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">{joinError}</p>
              ) : null}
            </div>
          ) : null}
          {collaborators.length ? (
            <section className="mt-4 rounded-md border bg-white p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">{tc("title")}</h2>
                <Badge className="bg-white">{tc("peopleCount", { count: collaborators.length })}</Badge>
              </div>
              <CollaboratorList collaborators={collaborators} currentUserId={currentUserId} />
            </section>
          ) : null}
          {canDelete ? (
            <section className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <div className="mb-3 flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-none text-destructive" />
                <div>
                  <h2 className="text-sm font-semibold text-destructive">{t("dangerZone")}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{t("deleteDescription")}</p>
                </div>
              </div>
              <DeleteMapDialog
                mapId={currentMap.id}
                mapName={currentMap.name}
                isSharedWithCollaborators={isSharedWithCollaborators}
                onDeleted={() => {
                  router.replace("/dashboard");
                  router.refresh();
                }}
                trigger={
                  <Button type="button" variant="destructive" className="w-full">
                    <Trash2 className="h-4 w-4" />
                    {t("deleteMap")}
                  </Button>
                }
              />
            </section>
          ) : null}
        </div>

        <div className="max-h-[45vh] overflow-y-auto p-3 lg:max-h-[calc(100vh-13rem)]">
          {sortedPins.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              {t("emptyRestaurants")}
            </div>
          ) : (
            <div className="grid gap-3">
              {sortedPins.map((pin, index) => (
                <div
                  key={pin.id}
                  onClick={() => focusPin(pin)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") focusPin(pin);
                  }}
                  className={`rounded-lg border bg-white p-3 text-left transition ${activePinId === pin.id ? "border-primary shadow-sm" : "hover:bg-muted/40"}`}
                >
                  <div className="flex justify-between gap-3">
                    <h2 className="font-medium">{index + 1}. {pin.name}</h2>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{pin.rating ?? "N/A"}</span>
                      {canEdit ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation();
                            void deletePin(pin.id);
                          }}
                          disabled={deletingPinId === pin.id}
                          aria-label={t("deletePin", { name: pin.name })}
                        >
                          {deletingPinId === pin.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{pin.address}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("reviews", { count: pin.review_count ?? 0 })} · {formatPriceLevelLabel(pin.price_level, t)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      <section className="relative order-1 flex min-h-[55vh] flex-1 flex-col lg:order-2">
        <GoogleMapsScript onLoaded={markScriptLoaded} />
        <div ref={mapRef} className="min-h-[55vh] flex-1 lg:min-h-0" />
        {activePin ? (
          <Card className="m-3 lg:absolute lg:bottom-4 lg:right-4 lg:w-96">
            <CardContent className="p-4">
              <h2 className="font-semibold">{activePin.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{activePin.address}</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-sm">
                  {t("pinSummary", { rating: activePin.rating ?? "N/A", count: activePin.review_count ?? 0 })}
                </p>
                <Button asChild size="sm">
                  <a href={activePin.google_maps_url} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    {t("open")}
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </section>
    </div>
  );
}

function CollaboratorList({
  collaborators,
  currentUserId,
  compact = false,
}: {
  collaborators: Collaborator[];
  currentUserId?: string;
  compact?: boolean;
}) {
  const t = useTranslations("Collaborators");
  if (!collaborators.length) {
    return <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <div className={cn("grid", compact ? "gap-2" : "gap-3")}>
      {collaborators.map((collaborator) => (
        <div
          key={`${collaborator.userId}-${collaborator.role}`}
          className={cn(
            "flex items-center gap-3 rounded-md border bg-white p-3",
            collaborator.role === "owner" ? "border-primary/40 bg-primary/5" : null,
          )}
        >
          <CollaboratorAvatar collaborator={collaborator} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="truncate text-sm font-medium">
                {collaborator.displayName ?? collaborator.email ?? t("unknown")}
              </p>
              {collaborator.userId === currentUserId ? <span className="text-xs text-muted-foreground">{t("you")}</span> : null}
            </div>
            {collaborator.email && collaborator.email !== collaborator.displayName ? (
              <p className="truncate text-xs text-muted-foreground">{collaborator.email}</p>
            ) : null}
          </div>
          <Badge className={cn("shrink-0", collaborator.role === "owner" ? "border-primary bg-white text-primary" : "bg-white")}>
            {roleLabel(collaborator.role, t)}
          </Badge>
        </div>
      ))}
    </div>
  );
}

function CollaboratorAvatar({ collaborator }: { collaborator: Collaborator }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-sm font-medium text-muted-foreground">
      {collaborator.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={collaborator.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        collaboratorInitials(collaborator)
      )}
    </div>
  );
}

function roleLabel(role: Collaborator["role"], t: ReturnType<typeof useTranslations<"Collaborators">>) {
  if (role === "owner") return t("roles.owner");
  if (role === "editor") return t("roles.editor");
  return t("roles.viewer");
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

function ShareAccessOption({
  active,
  disabled,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-4 rounded-md border p-4 text-left transition hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-70",
        active ? "border-primary bg-primary/5" : "bg-white",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border",
          active ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40 bg-white",
        )}
        aria-hidden="true"
      >
        {active ? <Check className="h-3.5 w-3.5" /> : null}
      </span>
      <span className="flex flex-1 gap-3">
        <span className={cn("mt-0.5 text-muted-foreground", active ? "text-primary" : null)}>{icon}</span>
        <span>
          <span className="block text-sm font-medium">{title}</span>
          <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
        </span>
      </span>
    </button>
  );
}

function GoogleMapsScript({ onLoaded }: { onLoaded: () => void }) {
  useEffect(() => {
    if (window.google?.maps) {
      onLoaded();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>("#google-maps-js");
    if (existing) {
      existing.addEventListener("load", onLoaded, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = "google-maps-js";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
    script.async = true;
    script.addEventListener("load", onLoaded, { once: true });
    document.head.appendChild(script);
  }, [onLoaded]);
  return null;
}

function markerIcon(active: boolean): google.maps.Symbol {
  return {
    path: window.google.maps.SymbolPath.CIRCLE,
    fillColor: active ? "#ef4444" : markerColor,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: active ? 3 : 2,
    scale: active ? 11 : 8,
  };
}

function sortPins(pins: PinRow[], sortMode: SortMode, center: { lat: number; lng: number }) {
  return [...pins].sort((a, b) => {
    if (sortMode === "distance") {
      return distanceMeters(center, a) - distanceMeters(center, b);
    }
    if (sortMode === "rating") {
      return (b.rating ?? -1) - (a.rating ?? -1) || (b.review_count ?? -1) - (a.review_count ?? -1);
    }
    return (b.review_count ?? -1) - (a.review_count ?? -1) || (b.rating ?? -1) - (a.rating ?? -1);
  });
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const earthRadius = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadius * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function localizeShareUrl(shareUrl: string | null | undefined, locale: string) {
  if (!shareUrl) return null;
  if (shareUrl.startsWith(`/${locale}/`)) return shareUrl;
  if (shareUrl.startsWith("/share/")) return `/${locale}${shareUrl}`;
  return shareUrl;
}

function localizeRedirect(path: string, locale: string) {
  if (!path.startsWith("/") || path.startsWith(`/${locale}/`)) return path;
  return `/${locale}${path}`;
}

function formatPriceLevelLabel(priceLevel: string | null, t: ReturnType<typeof useTranslations<"MapView">>) {
  if (!priceLevel || priceLevel === "any") return t("badges.anyPrice");
  return formatPriceLevel(priceLevel);
}
