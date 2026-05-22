"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Props = {
  mapId: string;
  mapName: string;
  isSharedWithCollaborators: boolean;
  trigger: ReactNode;
  onDeleted: () => void;
};

export function DeleteMapDialog({ mapId, mapName, isSharedWithCollaborators, trigger, onDeleted }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteMap() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/maps/${mapId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not delete this map.");
      setOpen(false);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this map.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <DialogTitle>Delete Map</DialogTitle>
          <DialogDescription>
            {isSharedWithCollaborators
              ? "This map is shared with collaborators. Deleting it will remove access for everyone and make the map unavailable to collaborators."
              : "Are you sure you want to delete this map?"}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <p className="font-medium">{mapName}</p>
          <p className="mt-1">This permanently deletes the map, its pins, memberships, and share link access.</p>
        </div>

        {error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={deleteMap} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete Map
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
