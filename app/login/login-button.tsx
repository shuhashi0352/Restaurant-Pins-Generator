"use client";

import { Chrome } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/browser";

export function LoginButton() {
  async function signIn() {
    const supabase = createClient();
    const origin = window.location.origin;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=/dashboard`,
      },
    });
  }

  return (
    <Button onClick={signIn} className="w-full">
      <Chrome className="h-4 w-4" />
      Continue with Google
    </Button>
  );
}
