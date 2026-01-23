/*
 * src/hooks/useIsStaff.ts
 * - profiles.role を単一の真実として staff 判定する
 */

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

type Role = "student" | "teacher" | "admin" | string;

export function useIsStaff() {
  const { user } = useAuth();
  const [isStaff, setIsStaff] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!user) {
        if (alive) setIsStaff(false);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!alive) return;

      if (error) {
        // エラー時は安全側（スタッフ扱いしない）
        setIsStaff(false);
        setLoading(false);
        return;
      }

      const role = (data?.role ?? "student") as Role;
      setIsStaff(role === "teacher" || role === "admin");
      setLoading(false);
    }

    run();
    return () => {
      alive = false;
    };
  }, [user]);

  return { isStaff, loading };
}
