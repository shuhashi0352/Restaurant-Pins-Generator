import Link from "next/link";
import { LogOut, MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export async function SiteHeader() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email ?? "Signed in";
  const avatarUrl = typeof data.user?.user_metadata.avatar_url === "string" ? data.user.user_metadata.avatar_url : null;

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-base font-semibold">
          <MapPinned className="h-5 w-5 text-primary" />
          Restaurant Map Generator
        </Link>
        <nav className="flex items-center gap-2">
          {data.user ? (
            <>
              <Button asChild variant="ghost">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <Button asChild>
                <Link href="/create">Create Map</Link>
              </Button>
              <div className="ml-1 flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {email.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="hidden max-w-44 truncate text-sm text-muted-foreground sm:inline">{email}</span>
                <form action="/logout" method="post">
                  <Button type="submit" variant="ghost" size="sm">
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <Button asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
