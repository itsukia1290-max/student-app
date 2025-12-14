import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  userId: string;
  dateISO: string; // "YYYY-MM-DD"
};

export default function StudySummaryForDate({ userId, dateISO }: Props) {
  const [minutes, setMinutes] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const label = useMemo(() => {
    const m = minutes;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    if (h <= 0) return `${mm}分`;
    if (mm === 0) return `${h}時間`;
    return `${h}時間${mm}分`;
  }, [minutes]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId || !dateISO) return;
      setLoading(true);

      const { data, error } = await supabase
        .from("study_logs")
        .select("minutes")
        .eq("user_id", userId)
        .eq("studied_at", dateISO);

      if (!cancelled) {
        if (error) {
          console.warn("⚠️ load study_logs failed:", error.message);
          setMinutes(0);
        } else {
          const total = (data ?? []).reduce((sum, r: any) => sum + (r.minutes ?? 0), 0);
          setMinutes(total);
        }
      }

      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, dateISO]);

  return (
    <div className="text-xs text-gray-600">
      {loading ? "学習時間: 読み込み中..." : `学習時間: ${label}`}
    </div>
  );
}
