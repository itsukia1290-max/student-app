import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

export type Role = "student" | "teacher" | "admin";

export function useMyRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    async function run() {
      if (!user) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (alive) {
        if (!error && data) setRole(data.role as Role);
        setLoading(false);
      }
    }
    run();
    return () => { alive = false; };
  }, [user?.id]);

  return { role, loading };
}
