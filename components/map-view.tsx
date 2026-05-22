"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { MapRow, PinRow } from "@/lib/database.types";
import { formatPriceLevel } from "@/lib/utils";

type GoogleMap = google.maps.Map;
type GoogleMarker = google.maps.Marker;

type Props = {
  map: MapRow;
  pins: PinRow[];
  canShare?: boolean;
  readOnly?: boolean;
};

const iconColors: Record<string, string> = {
  restaurant: "#2563eb",
  star: "#d97706",
  heart: "#dc2626",
  flag: "#16a34a",
  pin: "#7c3aed",
};

export function MapView({ map, pins, canShare = false, readOnly = false }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<GoogleMap | null>(null);
  const markersRef = useRef<GoogleMarker[]>([]);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [activePinId, setActivePinId] = useState(pins[0]?.id ?? null);
  const [shareUrl, setShareUrl] = useState<string | null>(map.share_enabled && map.share_token ? `/share/${map.share_token}` : null);
  const [shareLoading, setShareLoading] = useState(false);
  const markScriptLoaded = useCallback(() => setScriptLoaded(true), []);

  const activePin = useMemo(() => pins.find((pin) => pin.id === activePinId) ?? pins[0] ?? null, [activePinId, pins]);

  useEffect(() => {
    function load() {
      if (!mapRef.current || !window.google?.maps) return;

      const googleMap = new window.google.maps.Map(mapRef.current, {
        center: { lat: map.center_lat, lng: map.center_lng },
        zoom: 14,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      googleMapRef.current = googleMap;

      markersRef.current = pins.map((pin) => {
        const marker = new window.google.maps.Marker({
          map: googleMap,
          position: { lat: pin.lat, lng: pin.lng },
          title: pin.name,
          icon: markerIcon(map.icon, false),
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
  }, [map.center_lat, map.center_lng, map.icon, pins, scriptLoaded]);

  useEffect(() => {
    markersRef.current.forEach((marker, index) => {
      marker.setIcon(markerIcon(map.icon, pins[index]?.id === activePinId));
    });
  }, [activePinId, map.icon, pins]);

  function focusPin(pin: PinRow) {
    setActivePinId(pin.id);
    googleMapRef.current?.panTo({ lat: pin.lat, lng: pin.lng });
    googleMapRef.current?.setZoom(16);
  }

  async function toggleShare() {
    setShareLoading(true);
    try {
      const response = await fetch(`/api/maps/${map.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !shareUrl }),
      });
      const payload = (await response.json()) as { shareUrl?: string | null; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not update sharing.");
      setShareUrl(payload.shareUrl ?? null);
    } finally {
      setShareLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-muted/30 lg:flex-row">
      <aside className="order-2 w-full border-r bg-white lg:order-1 lg:w-[26rem]">
        <div className="border-b p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">{map.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{map.center_label}</p>
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
                    <DialogDescription>Enable an unlisted read-only URL for anyone with the link.</DialogDescription>
                  </DialogHeader>
                  {shareUrl ? (
                    <div className="rounded-md border bg-muted p-2 text-sm break-all">{shareUrl}</div>
                  ) : null}
                  <Button onClick={toggleShare} disabled={shareLoading} variant={shareUrl ? "destructive" : "default"}>
                    {shareUrl ? "Disable share link" : "Enable share link"}
                  </Button>
                </DialogContent>
              </Dialog>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge>{pins.length} restaurants</Badge>
            <Badge>{map.radius_meters}m</Badge>
            <Badge>{map.min_rating == null ? "Any rating" : `${map.min_rating}+ stars`}</Badge>
            <Badge>{formatPriceLevel(map.price_level)}</Badge>
            <Badge>{map.open_now ? "Open now" : "Any hours"}</Badge>
          </div>
        </div>

        <div className="max-h-[45vh] overflow-y-auto p-3 lg:max-h-[calc(100vh-13rem)]">
          {pins.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              No restaurants matched these filters. Try a wider radius, lower rating, or smaller review minimum.
            </div>
          ) : (
            <div className="grid gap-3">
              {pins.map((pin, index) => (
                <button
                  type="button"
                  key={pin.id}
                  onClick={() => focusPin(pin)}
                  className={`rounded-lg border bg-white p-3 text-left transition ${activePinId === pin.id ? "border-primary shadow-sm" : "hover:bg-muted/40"}`}
                >
                  <div className="flex justify-between gap-3">
                    <h2 className="font-medium">{index + 1}. {pin.name}</h2>
                    <span className="text-sm text-muted-foreground">{pin.rating ?? "N/A"}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{pin.address}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {pin.review_count ?? 0} reviews · {formatPriceLevel(pin.price_level)}
                  </p>
                </button>
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
