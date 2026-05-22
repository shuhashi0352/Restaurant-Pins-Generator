import { LogOut, MapPinned } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export async function SiteHeader() {
  const t = await getTranslations("Navigation");
  const locale = await getLocale();
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email ?? t("signedIn");
  const avatarUrl = typeof data.user?.user_metadata.avatar_url === "string" ? data.user.user_metadata.avatar_url : null;

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-base font-semibold">
          <MapPinned className="h-5 w-5 text-primary" />
          {t("brand")}
        </Link>
        <nav className="flex items-center gap-2">
          <LanguageSwitcher />
          {data.user ? (
            <>
              <Button asChild variant="ghost">
                <Link href="/dashboard">{t("dashboard")}</Link>
              </Button>
              <Button asChild>
                <Link href="/create">{t("createMap")}</Link>
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
                <form action={`/logout?locale=${locale}`} method="post">
                  <Button type="submit" variant="ghost" size="sm">
                    <LogOut className="h-4 w-4" />
                    {t("signOut")}
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <Button asChild>
              <Link href="/login">{t("signIn")}</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
