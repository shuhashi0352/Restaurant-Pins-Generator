"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { routing } from "@/i18n/routing";

const labels: Record<Locale, string> = {
  en: "EN",
  ja: "日本語",
};

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("LanguageSwitcher");
  const [isPending, startTransition] = useTransition();

  function switchLocale(nextLocale: Locale) {
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
  }

  return (
    <div className="flex items-center gap-1 rounded-md border bg-white px-2 py-1 text-sm">
      <Languages className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <label className="sr-only" htmlFor="language-switcher">
        {t("label")}
      </label>
      <select
        id="language-switcher"
        value={locale}
        onChange={(event) => switchLocale(event.target.value as Locale)}
        disabled={isPending}
        className="bg-transparent text-sm outline-none"
      >
        {routing.locales.map((option) => (
          <option key={option} value={option}>
            {labels[option]}
          </option>
        ))}
      </select>
    </div>
  );
}
