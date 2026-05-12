import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createPlain } from "@supabase/supabase-js";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Server client bound to the incoming request's cookies — used for
 * authenticated pages and actions. Inherits the user's auth state.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet: CookieToSet[]) {
        try {
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — Next forbids mutating cookies there.
          // The middleware handles cookie refresh, so we can silently ignore.
        }
      },
    },
  });
}

/**
 * Service-role client — bypasses RLS. Use ONLY in server contexts that
 * intentionally need full access (e.g. the public /s/[id] schema route).
 */
export function createSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = process.env.SUPABASE_SECRET_KEY!;
  return createPlain(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { apikey: secret } },
  });
}
