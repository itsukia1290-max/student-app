import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type StudySubject = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

export function useStudySubjects(scope: "junior" = "junior") {
  const [subjects, setSubjects] = useState<StudySubject[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("study_subjects")
        .select("id,name,sort_order,is_active")
        .eq("scope", scope)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (cancelled) return;

      if (error) {
        console.error("load study_subjects:", error.message);
        setSubjects([]);
      } else {
        setSubjects((data ?? []) as StudySubject[]);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [scope]);

  return { subjects, loading };
}
