/*
 * src/contexts/AuthProvider.tsx
 * Responsibility: 認証状態を監視して `AuthCtx` に値を供給する Provider。
 * - supabase.auth の状態変化を購読し、session を更新する。
 */

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { AuthCtx } from "./AuthContext";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <AuthCtx.Provider value={{ session, user: session?.user ?? null }}>
      {children}
    </AuthCtx.Provider>
  );
}
