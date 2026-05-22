import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { LoginButton } from "./login-button";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next: rawNext } = await searchParams;
  const next = safeNext(rawNext);
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect(next ?? "/dashboard");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Use Google to create private restaurant maps and manage share links.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginButton next={next} />
          </CardContent>
        </Card>
      </main>
    </>
  );
}

function safeNext(next: string | undefined) {
  if (!next?.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}
