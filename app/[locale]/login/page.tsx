import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { LoginButton } from "./login-button";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const t = await getTranslations("Login");
  const { locale } = await params;
  const { next: rawNext } = await searchParams;
  const next = safeNext(rawNext);
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect(localizePath(next ?? "/dashboard", locale));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginButton next={localizePath(next, locale)} />
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

function localizePath(path: string, locale: string) {
  if (path.startsWith(`/${locale}/`) || path === `/${locale}`) return path;
  if (path.startsWith("/en/") || path === "/en" || path.startsWith("/ja/") || path === "/ja") return path;
  return `/${locale}${path}`;
}
