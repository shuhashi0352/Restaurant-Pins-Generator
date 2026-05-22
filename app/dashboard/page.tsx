import Link from "next/link";
import { Plus } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: maps } = await supabase
    .from("maps")
    .select("id,name,center_label,radius_meters,share_enabled,created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Your private saved restaurant maps.</p>
          </div>
          <Button asChild>
            <Link href="/create"><Plus className="h-4 w-4" />Create Map</Link>
          </Button>
        </div>

        {maps?.length ? (
          <Tabs defaultValue="all">
            <TabsList className="mb-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="shared">Shared</TabsTrigger>
              <TabsTrigger value="private">Private</TabsTrigger>
            </TabsList>
            <TabsContent value="all">
              <MapGrid maps={maps} />
            </TabsContent>
            <TabsContent value="shared">
              <MapGrid maps={maps.filter((map) => map.share_enabled)} />
            </TabsContent>
            <TabsContent value="private">
              <MapGrid maps={maps.filter((map) => !map.share_enabled)} />
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
}: {
  maps: Array<{
    id: string;
    name: string;
    center_label: string;
    radius_meters: number;
    share_enabled: boolean;
  }>;
}) {
  if (!maps.length) {
    return <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No maps in this view.</div>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {maps.map((map) => (
        <Link key={map.id} href={`/maps/${map.id}`}>
          <Card className="h-full transition hover:border-primary">
            <CardHeader>
              <CardTitle>{map.name}</CardTitle>
              <CardDescription>{map.center_label}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {map.radius_meters}m radius · {map.share_enabled ? "Sharing enabled" : "Private"}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
