"use client";

import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Crosshair, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type FormState = {
  center: { lat: number; lng: number; label: string } | null;
  radiusMeters: string;
  minRating: string;
  minReviewCount: string;
  maxPins: string;
  name: string;
  priceLevel: string;
  openNow: string;
};

const initialState: FormState = {
  center: null,
  radiusMeters: "1500",
  minRating: "4.0",
  minReviewCount: "50",
  maxPins: "20",
  name: "My Restaurant Map",
  priceLevel: "any",
  openNow: "any",
};

export function CreateMapForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [manualLocation, setManualLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const router = useRouter();

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function useCurrentLocation() {
    setError(null);
    if (!navigator.geolocation) {
      setError("Browser location is not available. Enter a location manually.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        update("center", {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          label: "Current location",
        });
      },
      () => setError("Location permission was denied. Enter an address or place name manually."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function geocodeManualLocation() {
    setGeocoding(true);
    setError(null);
    try {
      const response = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: manualLocation }),
      });
      const payload = (await response.json()) as { location?: FormState["center"]; error?: string };
      if (!response.ok || !payload.location) throw new Error(payload.error ?? "Could not find that location.");
      update("center", payload.location);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not find that location.");
    } finally {
      setGeocoding(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!form.center) {
      setError("Choose current location or enter a location manually.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/maps/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          center: form.center,
          radiusMeters: Number(form.radiusMeters),
          minRating: form.minRating === "any" ? "any" : Number(form.minRating),
          minReviewCount: form.minReviewCount === "any" ? "any" : Number(form.minReviewCount),
          maxPins: Number(form.maxPins),
          name: form.name,
          priceLevel: form.priceLevel,
          openNow: form.openNow,
        }),
      });
      const payload = (await response.json()) as { mapId?: string; error?: string };
      if (!response.ok || !payload.mapId) throw new Error(payload.error ?? "Could not generate the map.");
      router.push(`/maps/${payload.mapId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the map.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[1fr_22rem]">
      <Card>
        <CardHeader>
          <CardTitle>Create Map</CardTitle>
          <CardDescription>Answer the guided form. Only Google Places restaurants are searched.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-3">
            <Label>1. Center location</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="secondary" onClick={useCurrentLocation}>
                <Crosshair className="h-4 w-4" />
                Use current location
              </Button>
              <div className="flex flex-1 gap-2">
                <Input value={manualLocation} onChange={(e) => setManualLocation(e.target.value)} placeholder="Address or place name" />
                <Button type="button" variant="outline" onClick={geocodeManualLocation} disabled={geocoding || manualLocation.length < 2}>
                  {geocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            {form.center ? <p className="text-sm text-muted-foreground">Selected: {form.center.label}</p> : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="2. Search radius in meters">
              <Input type="number" min="100" max="50000" value={form.radiusMeters} onChange={(e) => update("radiusMeters", e.target.value)} />
            </Field>
            <Field label="3. Minimum rating">
              <Select value={form.minRating} onValueChange={(value) => update("minRating", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="3.5">3.5+</SelectItem>
                  <SelectItem value="4.0">4.0+</SelectItem>
                  <SelectItem value="4.3">4.3+</SelectItem>
                  <SelectItem value="4.5">4.5+</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="4. Minimum review count">
              <Select value={form.minReviewCount} onValueChange={(value) => update("minReviewCount", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="25">25+</SelectItem>
                  <SelectItem value="50">50+</SelectItem>
                  <SelectItem value="100">100+</SelectItem>
                  <SelectItem value="250">250+</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="5. Maximum number of pins">
              <Input type="number" min="1" max="60" value={form.maxPins} onChange={(e) => update("maxPins", e.target.value)} />
            </Field>
            <Field label="6. Map/list name">
              <Input value={form.name} onChange={(e) => update("name", e.target.value)} />
            </Field>
            <Field label="7. Price level">
              <Select value={form.priceLevel} onValueChange={(value) => update("priceLevel", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="1">$</SelectItem>
                  <SelectItem value="2">$$</SelectItem>
                  <SelectItem value="3">$$$</SelectItem>
                  <SelectItem value="4">$$$$</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="8. Open now">
              <Select value={form.openNow} onValueChange={(value) => update("openNow", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="open">Open now only</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          {error ? <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Generate Map
          </Button>
        </CardContent>
      </Card>

      <aside className="rounded-lg border bg-muted/40 p-5">
        <h2 className="text-sm font-semibold">Generation rules</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Restaurants are filtered on the backend, ranked by highest rating, and review count breaks ties.
          Generated maps are private until sharing is enabled.
        </p>
      </aside>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
