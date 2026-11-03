import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Cliente com service role: ignora RLS. Usar só em Server Actions já protegidas por exigirDono(). */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
