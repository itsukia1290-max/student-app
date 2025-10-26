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
