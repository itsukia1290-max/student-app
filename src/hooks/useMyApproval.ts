import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

export function useMyApproval() {
  const { session } = useAuth();
  const uid = session?.user?.id ?? null;
  const [approved, setApproved] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    async function check() {
      if (!uid) { if (alive) setApproved(null); return; }

      // ★ staff_flags の直読みは廃止
      // profiles だけで判定（admin/teacher は常時許可）
      const { data: pr, error } = await supabase
        .from("profiles")
        .select("role, is_approved, status")
        .eq("id", uid)
        .maybeSingle();

      if (!alive) return;

      if (error) { setApproved(false); return; }

      if (pr?.role === "admin" || pr?.role === "teacher") {
        setApproved(true);
      } else {
        setApproved(!!pr?.is_approved && (pr?.status ?? "active") === "active");
      }
    }
    check();
    return () => { alive = false; };
  }, [uid]);

  return { approved };
}
