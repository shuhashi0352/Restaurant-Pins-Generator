"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, ExternalLink, Loader2, Save, Share2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MapRow, PinRow } from "@/lib/database.types";
import { formatPriceLevel } from "@/lib/utils";
import { createClient } from "@/lib/supabase/browser";

type GoogleMap = google.maps.Map;
type GoogleMarker = google.maps.Marker;

type Props = {
  map: MapRow;
  pins: PinRow[];
  canShare?: boolean;
  readOnly?: boolean;
  shareToken?: string;
  isLoggedIn?: boolean;
  canEdit?: boolean;
  sharedMode?: "view" | "edit";
};

const iconColors: Record<string, string> = {
  restaurant: "#2563eb",
  star: "#d97706",
  heart: "#dc2626",
  flag: "#16a34a",
  pin: "#7c3aed",
};

export function MapView({
  map,
  pins,
  canShare = false,
  readOnly = false,
  shareToken,
  isLoggedIn = false,
  canEdit = !readOnly,
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
  const [sharePermission, setSharePermission] = useState<"view" | "edit">(map.share_permission);
  const [shareLoading, setShareLoading] = useState(false);
  const [mapName, setMapName] = useState(map.name);
  const [renameLoading, setRenameLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [deletingPinId, setDeletingPinId] = useState<string | null>(null);
  const markScriptLoaded = useCallback(() => setScriptLoaded(true), []);

  const activePin = useMemo(
    () => currentPins.find((pin) => pin.id === activePinId) ?? currentPins[0] ?? null,
    [activePinId, currentPins],
  );

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

  async function toggleShare() {
    setShareLoading(true);
    try {
      const response = await fetch(`/api/maps/${map.id}/share`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !shareUrl, permission: sharePermission }),
      });
      const payload = (await response.json()) as { shareUrl?: string | null; sharePermission?: "view" | "edit"; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not update sharing.");
      setShareUrl(payload.shareUrl ?? null);
      setSharePermission(payload.sharePermission ?? "view");
    } finally {
      setShareLoading(false);
    }
  }

  async function updateSharePermission(permission: "view" | "edit") {
    setSharePermission(permission);
    if (!shareUrl) return;
    setShareLoading(true);
    try {
      const response = await fetch(`/api/maps/${map.id}/share`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true, permission }),
      });
      const payload = (await response.json()) as { shareUrl?: string | null; sharePermission?: "view" | "edit"; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not update sharing.");
      setShareUrl(payload.shareUrl ?? null);
      setSharePermission(payload.sharePermission ?? permission);
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
        body: JSON.stringify({ name: nextName, shareToken }),
      });
      const payload = (await response.json()) as { map?: MapRow; error?: string };
      if (!response.ok || !payload.map) throw new Error(payload.error ?? "Could not rename map.");
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
        body: JSON.stringify({ shareToken }),
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

  async function saveToMyMaps() {
    if (!shareToken) return;
    if (!isLoggedIn) {
      await signInToSharedMap();
      return;
    }
    setSaveLoading(true);
    try {
      const response = await fetch(`/api/share/${shareToken}/save`, { method: "POST" });
      const payload = (await response.json()) as { redirectTo?: string; loginUrl?: string; error?: string };
      if (response.status === 401 && payload.loginUrl) {
        window.location.href = payload.loginUrl;
        return;
      }
      if (!response.ok || !payload.redirectTo) throw new Error(payload.error ?? "Could not save this map.");
      window.location.href = payload.redirectTo;
    } finally {
      setSaveLoading(false);
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

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-muted/30 lg:flex-row">
      <aside className="order-2 w-full border-r bg-white lg:order-1 lg:w-[26rem]">
        <div className="border-b p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              {canEdit ? (
                <div className="flex gap-2">
                  <Input value={mapName} onChange={(event) => setMapName(event.target.value)} aria-label="Map name" />
                  <Button size="sm" onClick={renameMap} disabled={renameLoading || mapName.trim() === currentMap.name}>
                    {renameLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Rename"}
                  </Button>
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
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Share link</DialogTitle>
                    <DialogDescription>Choose what anyone with the link can do.</DialogDescription>
                  </DialogHeader>
                  <Select value={sharePermission} onValueChange={(value) => updateSharePermission(value as "view" | "edit")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view">Anyone with the link can view</SelectItem>
                      <SelectItem value="edit">Anyone with the link can edit</SelectItem>
                    </SelectContent>
                  </Select>
                  {shareUrl ? (
                    <div className="flex gap-2">
                      <div className="min-w-0 flex-1 rounded-md border bg-muted p-2 text-sm break-all">{shareUrl}</div>
                      <Button type="button" variant="outline" onClick={copyShareUrl} aria-label="Copy share URL">
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                  <Button onClick={toggleShare} disabled={shareLoading} variant={shareUrl ? "destructive" : "default"}>
                    {shareUrl ? "Disable share link" : "Enable share link"}
                  </Button>
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
          </div>
          {showSharedControls ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={saveToMyMaps} disabled={saveLoading}>
                {saveLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save to My Maps
              </Button>
              {showEditPrompt ? (
                <Button size="sm" variant="outline" onClick={signInToSharedMap}>
                  Sign in to edit
                </Button>
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
