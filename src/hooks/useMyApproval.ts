/*
 * src/hooks/useMyApproval.ts
 * Responsibility: 自分のプロファイルが承認済みかどうかを判定するフック
 * - 認証済みユーザーの `profiles` レコードを参照して `approved`, `status`, `role`, `loading` を返す
 * - App.tsx が status 別の画面ゲートに使えるように拡張
 */

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

export function useMyApproval() {
  const { session } = useAuth();
  const uid = session?.user?.id ?? null;
  
  const [approved, setApproved] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!uid) {
      setApproved(null);
      setStatus(null);
      setRole(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data: pr, error } = await supabase
      .from("profiles")
      .select("role, is_approved, status")
      .eq("id", uid)
      .maybeSingle();

    if (error) {
      setApproved(false);
      setStatus(null);
      setRole(null);
      setLoading(false);
      return;
    }

    const userRole = pr?.role ?? null;
    const userStatus = pr?.status ?? "active";

    setRole(userRole);
    setStatus(userStatus);

    if (userRole === "admin" || userRole === "teacher") {
      setApproved(true);
    } else {
      setApproved(!!pr?.is_approved && userStatus === "active");
    }
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const refetch = useCallback(() => {
    fetch();
  }, [fetch]);

  return { approved, status, role, loading, refetch };
}
