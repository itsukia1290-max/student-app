import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

export function useMyApproval() {
  const { session } = useAuth();
  const uid = session?.user?.id ?? null;

  // approved: true=承認済, false=未承認, null=判定中/未ログイン
  const [approved, setApproved] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;

    async function check() {
      // 未ログインなら「まだ判定できない」
      if (!uid) {
        if (alive) setApproved(null);
        return;
      }

      // 1) staff_flags に居れば（teacher/admin）→ 常時許可
      const { data: sf, error: se } = await supabase
        .from("staff_flags")
        .select("user_id")
        .eq("user_id", uid)
        .maybeSingle();

      if (!alive) return;
      if (!se && sf) {
        setApproved(true);
        return;
      }

      // 2) 一般ユーザーは profiles.is_approved を確認
      const { data: pr, error: pe } = await supabase
        .from("profiles")
        .select("is_approved")
        .eq("id", uid)
        .maybeSingle();

      if (!alive) return;

      // RLSで取れない or エラー → 未承認扱い（false）
      if (pe) {
        setApproved(false);
        return;
      }
      setApproved(!!pr?.is_approved);
    }

    check();
    return () => {
      alive = false;
    };
  }, [uid]);

  return { approved };
}
