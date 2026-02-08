import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useStudySubjects } from "../hooks/useStudySubjects";
import MiniDonut, { type BreakdownItem } from "./study/MiniDonut";

type Props = {
  userId: string;
  dateISO: string; // YYYY-MM-DD
};

type StudyLogRow = {
  minutes: number;
  studied_at: string;
  subject_id: string | null;
};

function makeBreakdown(rows: StudyLogRow[], subjectIdToLabel: (id: string | null) => string): BreakdownItem[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const min = Number(r.minutes) || 0;
    const label = subjectIdToLabel(r.subject_id);
    map.set(label, (map.get(label) ?? 0) + min);
  }
  return [...map.entries()]
    .filter(([, m]) => m > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([label, minutes]) => ({ key: label, label, minutes }));
}

function minutesLabel(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}

export default function StudyBreakdownForDate({ userId, dateISO }: Props) {
  const { subjects } = useStudySubjects();
  const [rows, setRows] = useState<StudyLogRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId || !dateISO) return;
      setLoading(true);

      const { data, error } = await supabase
        .from("study_logs")
        .select("minutes,studied_at,subject_id")
        .eq("user_id", userId)
        .eq("studied_at", dateISO);

      if (cancelled) return;

      if (error) {
        console.warn("load study_logs failed:", error.message);
        setRows([]);
      } else {
        setRows((data ?? []) as StudyLogRow[]);
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, dateISO]);

  const { total, breakdown, top3 } = useMemo(() => {
    const subjectIdToLabel = (id: string | null) => {
      if (!id) return "その他";
      const found = subjects.find((s) => s.id === id);
      return found?.name ?? "その他";
    };

    const breakdown = makeBreakdown(rows, subjectIdToLabel);
    const total = breakdown.reduce((s, b) => s + b.minutes, 0);
    const top3 = breakdown.slice(0, 3);

    return { total, breakdown, top3 };
  }, [rows, subjects]);

  const isEmpty = total <= 0 || breakdown.length === 0;

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b" }}>
          {loading ? "学習時間: 読み込み中..." : `学習時間: ${minutesLabel(total)}`}
        </div>

        <div style={{ opacity: loading ? 0.6 : 1 }}>
          <MiniDonut breakdown={breakdown} total={total} emptyAsGray />
        </div>
      </div>

      {!isEmpty && (
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 10 }}>
          {top3.map((b) => (
            <div key={b.key} style={{ fontSize: 11, fontWeight: 900, color: "#64748b" }}>
              {b.label}: {(b.minutes / 60).toFixed(2)}h
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
