/*
 * src/contexts/AuthContext.tsx
 * Responsibility: 認証情報（session / user）を提供する React Context の定義。
 * - `AuthCtx` を提供し、`useAuth` フックでアクセスする。
 * - 実際の値供給は `AuthProvider` にて行われる。
 */

import { createContext, useContext } from "react";
import type { Session, User } from "@supabase/supabase-js";

export type AuthCtxType = {
  session: Session | null;
  user: User | null;
};

export const AuthCtx = createContext<AuthCtxType>({
  session: null,
  user: null,
});

// コンポーネント以外の export はこのファイルに集約
export const useAuth = () => useContext(AuthCtx);
