import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Lock, MapPinned, Share2, Star } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="border-b bg-[linear-gradient(180deg,#eef6ff_0%,#ffffff_100%)]">
          <div className="mx-auto grid min-h-[520px] max-w-7xl items-center gap-8 px-4 py-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-md border bg-white px-3 py-1 text-sm text-muted-foreground">
                <MapPinned className="h-4 w-4 text-primary" />
                Rule-based Google Places restaurant maps
              </div>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-normal sm:text-5xl">
                Restaurant Map Generator
              </h1>
              <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
                Sign in with Google, set structured filters, and generate a private ranked map of real restaurant places that open directly in Google Maps.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/create">
                    Create Map
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/dashboard">View Dashboard</Link>
                </Button>
              </div>
            </div>
            <div className="min-h-[360px] rounded-lg border bg-white p-4 shadow-sm">
              <div className="grid h-full grid-cols-[11rem_1fr] gap-3">
                <div className="space-y-3">
                  {["Sushi Ginza", "Cafe Verde", "Noodle House", "Trattoria Alto"].map((name, index) => (
                    <div key={name} className="rounded-md border p-3">
                      <p className="text-sm font-medium">{index + 1}. {name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">4.{8 - index} · {180 + index * 71} reviews</p>
                    </div>
                  ))}
                </div>
                <div className="relative overflow-hidden rounded-md bg-[#d9ead7]">
                  <div className="absolute inset-x-0 top-1/3 h-6 rotate-[-8deg] bg-white/80" />
                  <div className="absolute inset-y-0 left-1/2 w-8 rotate-[8deg] bg-white/80" />
                  {[["22%", "30%"], ["54%", "42%"], ["68%", "62%"], ["38%", "70%"]].map(([left, top]) => (
                    <div key={`${left}-${top}`} className="absolute h-5 w-5 rounded-full border-2 border-white bg-primary shadow" style={{ left, top }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="mx-auto grid max-w-7xl gap-4 px-4 py-10 md:grid-cols-3">
          <Feature icon={<Star className="h-5 w-5" />} title="Rating-first ranking" text="Results are sorted by highest rating, with review count used as the tie-breaker." />
          <Feature icon={<Lock className="h-5 w-5" />} title="Private by default" text="Saved maps belong to the creator unless sharing is explicitly enabled." />
          <Feature icon={<Share2 className="h-5 w-5" />} title="Collaborative sharing" text="Use view-only links for publishing or editable links so signed-in collaborators join the same map." />
        </section>
      </main>
    </>
  );
}

function Feature({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-lg border bg-white p-5">
      <div className="mb-3 text-primary">{icon}</div>
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
