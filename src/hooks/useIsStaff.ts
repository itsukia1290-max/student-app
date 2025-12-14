/*
 * src/hooks/useIsStaff.ts
 * Responsibility: 現在のユーザーが教師/管理者かどうかを判定するフック
 * - `isStaff` を返す。UI 側で表示制御に使用する
 */

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

export function useIsStaff() {
  const { user } = useAuth();
  const [isStaff, setIsStaff] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    async function run() {
      if (!user) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("staff_flags")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!alive) return;
      setIsStaff(!!data && !error);
      setLoading(false);
    }
    run();
    return () => { alive = false; };
  }, [user]);

  return { isStaff, loading };
}
