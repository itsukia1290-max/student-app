// src/hooks/useEnsureDm.ts
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { TEACHER_ID } from "../config/app";

/** 学生ログイン時、先生とのDMを作成(無ければ)して group_id を返す */
export function useEnsureDm(): { ensured: boolean; groupId: string | null } {
  const { session } = useAuth();
  const uid: string | null = session?.user?.id ?? null;
  const once = useRef(false);
  const [ensured, setEnsured] = useState(false);
  const [groupId, setGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (!uid || once.current) return;
    once.current = true;

    (async () => {
      try {
        const { data, error } = await supabase.rpc("ensure_dm_with_teacher", {
          p_student_id: uid,
          p_teacher_id: TEACHER_ID,
        });
        if (error) {
          console.error("❌ ensure_dm_with_teacher:", error.message);
          return;
        }
        // data は uuid（group_id）想定
        if (typeof data === "string") {
          setGroupId(data);
        }
        setEnsured(true);
        console.log("✅ DM ensured for student:", uid, "group:", data);
      } catch (err) {
        console.error("❌ ensure_dm_with_teacher exception:", err);
      }
    })();
  }, [uid]);

  return { ensured, groupId };
}
