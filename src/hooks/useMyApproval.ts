import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

export function useMyApproval() {
  const { session } = useAuth();
  const uid = session?.user?.id;
  const [approved, setApproved] = useState<boolean | null>(null); // null=loading
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function run() {
      if (!uid) { setApproved(null); return; }
      const { data, error } = await supabase
        .from("profiles")
        .select("is_approved")
        .eq("id", uid)
        .maybeSingle();
      if (!alive) return;
      if (error) { setError(error.message); setApproved(false); return; }
      setApproved(!!data?.is_approved);
    }
    run();
    return () => { alive = false; };
  }, [uid]);

  return { approved, error };
}
