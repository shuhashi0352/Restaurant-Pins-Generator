"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, Copy, ExternalLink, Globe2, Loader2, Lock, Pencil, Share2, Trash2, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MapMemberRow, MapRow, PinRow } from "@/lib/database.types";
import { cn, formatPriceLevel } from "@/lib/utils";
import { createClient } from "@/lib/supabase/browser";

type GoogleMap = google.maps.Map;
type GoogleMarker = google.maps.Marker;
type SharePermission = "private" | "view" | "edit";
type MapIcon = "restaurant" | "star" | "heart" | "flag" | "pin";

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
};

const iconColors: Record<string, string> = {
  restaurant: "#2563eb",
  star: "#d97706",
  heart: "#dc2626",
  flag: "#16a34a",
  pin: "#7c3aed",
};

const iconLabels: Record<MapIcon, string> = {
  restaurant: "Restaurant",
  star: "Star",
  heart: "Heart",
  flag: "Flag",
  pin: "Pin",
};

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
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<GoogleMap | null>(null);
  const markersRef = useRef<GoogleMarker[]>([]);
  const [currentMap, setCurrentMap] = useState(map);
  const [currentPins, setCurrentPins] = useState(pins);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [activePinId, setActivePinId] = useState(pins[0]?.id ?? null);
  const [shareUrl, setShareUrl] = useState<string | null>(map.share_enabled && map.share_token ? `/share/${map.share_token}` : null);
  const [sharePermission, setSharePermission] = useState<SharePermission>(map.share_enabled ? map.share_permission : "private");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [mapName, setMapName] = useState(map.name);
  const [mapIcon, setMapIcon] = useState<MapIcon>(toMapIcon(map.icon));
  const [renameLoading, setRenameLoading] = useState(false);
  const [iconLoading, setIconLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [deletingPinId, setDeletingPinId] = useState<string | null>(null);
  const [browserOrigin, setBrowserOrigin] = useState<string | null>(null);
  const markScriptLoaded = useCallback(() => setScriptLoaded(true), []);

  const activePin = useMemo(
    () => currentPins.find((pin) => pin.id === activePinId) ?? currentPins[0] ?? null,
    [activePinId, currentPins],
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

      markersRef.current = currentPins.map((pin) => {
        const marker = new window.google.maps.Marker({
          map: googleMap,
          position: { lat: pin.lat, lng: pin.lng },
          title: pin.name,
          icon: markerIcon(currentMap.icon, false),
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
  }, [currentMap.center_lat, currentMap.center_lng, currentMap.icon, currentPins, scriptLoaded]);

  useEffect(() => {
    markersRef.current.forEach((marker, index) => {
      marker.setIcon(markerIcon(currentMap.icon, currentPins[index]?.id === activePinId));
    });
  }, [activePinId, currentMap.icon, currentPins]);

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
      if (!response.ok) throw new Error(payload.error ?? "Could not update sharing.");
      setShareUrl(payload.shareUrl ?? null);
      setSharePermission(payload.sharePermission ?? permission);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update sharing.";
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
      if (!response.ok || !payload.map) throw new Error(payload.error ?? "Could not rename map.");
      setCurrentMap(payload.map);
      setMapName(payload.map.name);
      setMapIcon(toMapIcon(payload.map.icon));
    } finally {
      setRenameLoading(false);
    }
  }

  async function updateMapIcon(icon: MapIcon) {
    if (icon === currentMap.icon) {
      setMapIcon(icon);
      return;
    }
    setMapIcon(icon);
    setIconLoading(true);
    try {
      const response = await fetch(`/api/maps/${currentMap.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icon }),
      });
      const payload = (await response.json()) as { map?: MapRow; error?: string };
      if (!response.ok || !payload.map) throw new Error(payload.error ?? "Could not update icon.");
      setCurrentMap(payload.map);
      setMapIcon(toMapIcon(payload.map.icon));
    } finally {
      setIconLoading(false);
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
      if (!response.ok) throw new Error(payload.error ?? "Could not delete pin.");
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
      if (!response.ok || !payload.redirectTo) throw new Error(payload.error ?? "Could not join this map.");
      window.location.href = payload.redirectTo;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not join this map.";
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

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-muted/30 lg:flex-row">
      <aside className="order-2 w-full border-r bg-white lg:order-1 lg:w-[26rem]">
        <div className="border-b p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {canEdit ? (
                <div className="grid gap-2">
                  <div className="flex gap-2">
                    <Input value={mapName} onChange={(event) => setMapName(event.target.value)} aria-label="Map name" />
                    <Button size="sm" onClick={renameMap} disabled={renameLoading || mapName.trim() === currentMap.name}>
                      {renameLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Rename"}
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={mapIcon} onValueChange={(value) => void updateMapIcon(value as MapIcon)} disabled={iconLoading}>
                      <SelectTrigger className="h-9">
                        <SelectValue aria-label="Map icon" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(iconLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {iconLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
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
                    Share
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[calc(100vh-2rem)] max-w-3xl overflow-y-auto p-0">
                  <DialogHeader>
                    <div className="border-b px-6 py-5">
                      <DialogTitle className="text-xl">Share this map</DialogTitle>
                      <DialogDescription className="mt-1">Control who can access the original restaurant map.</DialogDescription>
                    </div>
                  </DialogHeader>
                  <div className="grid gap-7 px-6 pb-6">
                    <section className="grid gap-3">
                      <h2 className="text-sm font-semibold">Access level</h2>
                      <div className="grid gap-3" role="radiogroup" aria-label="Access level">
                        <ShareAccessOption
                          active={sharePermission === "private"}
                          disabled={shareLoading}
                          icon={<Lock className="h-5 w-5" />}
                          title="Private"
                          description="Only you can access this map."
                          onClick={() => void updateShareAccess("private")}
                        />
                        <ShareAccessOption
                          active={sharePermission === "view"}
                          disabled={shareLoading}
                          icon={<Globe2 className="h-5 w-5" />}
                          title="Anyone with the link can view"
                          description="People can view this shared map."
                          onClick={() => void updateShareAccess("view")}
                        />
                        <ShareAccessOption
                          active={sharePermission === "edit"}
                          disabled={shareLoading}
                          icon={<Pencil className="h-5 w-5" />}
                          title="Anyone with the link can edit"
                          description="People can collaboratively edit this original map."
                          onClick={() => void updateShareAccess("edit")}
                        />
                      </div>
                    </section>

                    {sharePermission !== "private" && shareUrl ? (
                      <section className="grid gap-3">
                        <h2 className="text-sm font-semibold">Share link</h2>
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <div className="min-w-0 flex-1 rounded-md border bg-muted/60 px-3 py-2.5 text-sm break-all text-muted-foreground">
                            {absoluteShareUrl}
                          </div>
                          <Button type="button" variant="outline" onClick={copyShareUrl} className="sm:w-36">
                            <Copy className="h-4 w-4" />
                            Copy Link
                          </Button>
                        </div>
                      </section>
                    ) : null}

                    {sharePermission === "edit" ? (
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                        <div className="flex gap-3">
                          <AlertCircle className="mt-0.5 h-5 w-5 flex-none" />
                          <div>
                            <p className="font-medium">This map is collaborative.</p>
                            <p className="mt-1">Changes affect the same shared map for everyone.</p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {sharePermission === "view" ? (
                      <p className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
                        Viewers can inspect this map from the link. It will not appear in their dashboard unless they are added later.
                      </p>
                    ) : null}

                    {shareError ? (
                      <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{shareError}</p>
                    ) : null}

                    <div className="flex items-center justify-between gap-3 border-t pt-5">
                      <p className="text-sm text-muted-foreground">
                        {shareLoading ? "Updating access..." : sharePermission === "private" ? "No public link is active." : "Link access is active."}
                      </p>
                      {shareLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge>{currentPins.length} restaurants</Badge>
            <Badge>{currentMap.radius_meters}m</Badge>
            <Badge>{currentMap.min_rating == null ? "Any rating" : `${currentMap.min_rating}+ stars`}</Badge>
            <Badge>{formatPriceLevel(currentMap.price_level)}</Badge>
            <Badge>{currentMap.open_now ? "Open now" : "Any hours"}</Badge>
            {sharedMode ? <Badge>{sharedMode === "edit" ? "Editable shared map" : "View-only shared map"}</Badge> : null}
            {membershipRole ? <Badge>{membershipRole === "owner" ? "Owner" : membershipRole === "editor" ? "Editor" : "Viewer"}</Badge> : null}
          </div>
          {showSharedControls ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {showJoinPrompt || showEditPrompt ? (
                <Button size="sm" onClick={joinSharedMap} disabled={joinLoading}>
                  {isLoggedIn ? (
                    <>
                      {joinLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                      Join Shared Map
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Sign in to join
                    </>
                  )}
                </Button>
              ) : null}
              {canEdit && sharedMode === "edit" ? (
                <Badge className="bg-white">Collaborative edits affect the original map.</Badge>
              ) : null}
              {sharedMode === "view" ? (
                <Badge className="bg-white">View-only link</Badge>
              ) : null}
              {joinError ? (
                <p className="basis-full rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">{joinError}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="max-h-[45vh] overflow-y-auto p-3 lg:max-h-[calc(100vh-13rem)]">
          {currentPins.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              No restaurants matched these filters. Try a wider radius, lower rating, or smaller review minimum.
            </div>
          ) : (
            <div className="grid gap-3">
              {currentPins.map((pin, index) => (
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
                          aria-label={`Delete ${pin.name}`}
                        >
                          {deletingPinId === pin.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{pin.address}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {pin.review_count ?? 0} reviews · {formatPriceLevel(pin.price_level)}
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
                  {activePin.rating ?? "N/A"} stars · {activePin.review_count ?? 0} reviews
                </p>
                <Button asChild size="sm">
                  <a href={activePin.google_maps_url} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Open
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

function markerIcon(icon: string, active: boolean): google.maps.Symbol {
  return {
    path: window.google.maps.SymbolPath.CIRCLE,
    fillColor: active ? "#ef4444" : iconColors[icon] ?? iconColors.restaurant,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: active ? 3 : 2,
    scale: active ? 11 : 8,
  };
}

function toMapIcon(icon: string): MapIcon {
  if (icon === "star" || icon === "heart" || icon === "flag" || icon === "pin") return icon;
  return "restaurant";
}
