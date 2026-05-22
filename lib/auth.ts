import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser(locale?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect(locale ? `/${locale}/login` : "/login");
  }

  return data.user;
}
