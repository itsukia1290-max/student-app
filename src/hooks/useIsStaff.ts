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
  }, [user?.id]);

  return { isStaff, loading };
}
