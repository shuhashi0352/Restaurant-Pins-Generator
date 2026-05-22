import { SiteHeader } from "@/components/site-header";
import { CreateMapForm } from "@/components/create-map-form";
import { requireUser } from "@/lib/auth";

export default async function CreatePage() {
  await requireUser();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <CreateMapForm />
      </main>
    </>
  );
}
