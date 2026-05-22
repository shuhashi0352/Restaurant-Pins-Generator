import { NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL(`/${getLocale(url.searchParams.get("locale"))}`, url.origin), 303);
}

function getLocale(locale: string | null) {
  if (locale && routing.locales.includes(locale as (typeof routing.locales)[number])) return locale;
  return routing.defaultLocale;
}
