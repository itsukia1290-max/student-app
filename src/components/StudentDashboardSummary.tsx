/*
 * src/components/StudentDashboardSummary.tsx
 * Responsibility:
 * - 生徒マイページ上部の「今日/今週/今月」学習サマリを表示する
 * - 後から消す可能性があるため、MyPageから独立している
 */

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNav } from "../hooks/useNav"; // ★追加
import { useStudySubjects } from "../hooks/useStudySubjects";

type Props = {
  userId: string;
};

type StudyLogRow = {
  minutes: number;
  studied_at: string; // YYYY-MM-DD
  subject_id: string | null;
};

type BreakdownItem = { key: string; label: string; minutes: number };

function makeBreakdown(
  rows: StudyLogRow[],
  subjectIdToLabel: (id: string | null) => string
): BreakdownItem[] {
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

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function startOfWeekISO(d = new Date()) {
  // 月曜始まり
  const x = new Date(d);
  const day = x.getDay(); // 0..6 (Sun..Sat)
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return isoDate(x);
}

function startOfMonthISO(d = new Date()) {
  const x = new Date(d);
  x.setDate(1);
  return isoDate(x);
}

function hoursText(min: number) {
  const h = min / 60;
  return `${h.toFixed(2)} h`;
}

export default function StudentDashboardSummary({ userId }: Props) {
  const nav = useNav(); // ★追加
  const { subjects } = useStudySubjects();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [todayMin, setTodayMin] = useState(0);
  const [weekMin, setWeekMin] = useState(0);
  const [monthMin, setMonthMin] = useState(0);
  const [todayBreakdown, setTodayBreakdown] = useState<BreakdownItem[]>([]);
  const [weekBreakdown, setWeekBreakdown] = useState<BreakdownItem[]>([]);
  const [monthBreakdown, setMonthBreakdown] = useState<BreakdownItem[]>([]);

  const today = useMemo(() => isoDate(new Date()), []);
  const weekStart = useMemo(() => startOfWeekISO(new Date()), []);
  const monthStart = useMemo(() => startOfMonthISO(new Date()), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!userId) return;
      setLoading(true);
      setErr(null);

      // 直近40日くらい引いて集計（安定＆速い）
      const from = new Date();
      from.setDate(from.getDate() - 40);
      const fromISO = isoDate(from);

      const { data, error } = await supabase
        .from("study_logs")
        .select("minutes,studied_at,subject_id")
        .eq("user_id", userId)
        .gte("studied_at", fromISO);

      if (cancelled) return;

      if (error) {
        setErr("サマリの読み込みに失敗しました: " + error.message);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as StudyLogRow[];

      const todayRows = rows.filter((r) => r.studied_at === today);
      const weekRows = rows.filter((r) => r.studied_at >= weekStart);
      const monthRows = rows.filter((r) => r.studied_at >= monthStart);

      const sumMin = (xs: StudyLogRow[]) => xs.reduce((s, r) => s + (Number(r.minutes) || 0), 0);

      const t = sumMin(todayRows);
      const w = sumMin(weekRows);
      const m = sumMin(monthRows);

      const subjectIdToLabel = (id: string | null) => {
        if (!id) return "その他";
        const found = subjects.find((s) => s.id === id);
        return found?.name ?? "その他";
      };

      setTodayMin(t);
      setWeekMin(w);
      setMonthMin(m);
      setTodayBreakdown(makeBreakdown(todayRows, subjectIdToLabel));
      setWeekBreakdown(makeBreakdown(weekRows, subjectIdToLabel));
      setMonthBreakdown(makeBreakdown(monthRows, subjectIdToLabel));
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId, today, weekStart, monthStart, subjects]);

  const actionBtnStyle: React.CSSProperties = {
    border: "1px solid rgba(59,130,246,0.22)",
    background: "linear-gradient(180deg, rgba(96,165,250,0.95), rgba(59,130,246,0.95))",
    color: "#ffffff",
    borderRadius: 9999,
    padding: "10px 12px",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
    boxShadow: "0 14px 28px rgba(59,130,246,0.18)",
    whiteSpace: "nowrap",
  };

  return (
    <div
      style={{
        borderRadius: 20,
        background: "rgba(255,255,255,0.86)",
        border: "1px solid rgba(148, 163, 184, 0.18)",
        boxShadow: "0 12px 34px rgba(15, 23, 42, 0.08)",
        padding: 16,
        backdropFilter: "blur(8px)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a" }}>学習サマリ</div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button type="button" style={actionBtnStyle} onClick={() => nav.openMyRecords()}>
            学習記録を追加
          </button>

          <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b" }}>
            今日: {today} / 週: {weekStart}〜 / 月: {monthStart}〜
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ marginTop: 10, fontSize: 13, fontWeight: 800, color: "#64748b" }}>読み込み中...</div>
      ) : err ? (
        <div style={{ marginTop: 10, fontSize: 13, fontWeight: 900, color: "#dc2626", whiteSpace: "pre-wrap" }}>
          {err}
        </div>
      ) : (
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          <SummaryTile label="今日" value={hoursText(todayMin)} hint="今日の合計" breakdown={todayBreakdown} />
          <SummaryTile label="今週" value={hoursText(weekMin)} hint="月曜はじまり" breakdown={weekBreakdown} />
          <SummaryTile label="今月" value={hoursText(monthMin)} hint="月初から" breakdown={monthBreakdown} />
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  breakdown,
}: {
  label: string;
  value: string;
  hint: string;
  breakdown?: BreakdownItem[];
}) {
  const total = (breakdown ?? []).reduce((s, b) => s + b.minutes, 0);

  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid rgba(148,163,184,0.18)",
        background: "#ffffff",
        padding: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: "#1d4ed8" }}>{label}</div>
        <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b" }}>{hint}</div>
      </div>
      <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900, color: "#0f172a" }}>{value}</div>
      <MiniStackedBar breakdown={breakdown ?? []} total={total} />
    </div>
  );
}

function MiniStackedBar({ breakdown, total }: { breakdown: BreakdownItem[]; total: number }) {
  if (!breakdown.length || total <= 0) {
    return <div style={{ marginTop: 10, fontSize: 11, fontWeight: 800, color: "#94a3b8" }}>内訳なし</div>;
  }

  const colorOf = (label: string) => {
    const map: Record<string, string> = {
      "国語": "#f97316",
      "数学": "#3b82f6",
      "英語": "#22c55e",
      "理科": "#a855f7",
      "社会": "#ef4444",
      "その他": "#64748b",
    };
    return map[label] ?? "#94a3b8";
  };

  return (
    <div style={{ marginTop: 10 }}>
      <div
        style={{
          height: 10,
          borderRadius: 999,
          overflow: "hidden",
          display: "flex",
          border: "1px solid rgba(148,163,184,0.22)",
          background: "rgba(248,250,252,0.9)",
        }}
        title={breakdown.map((b) => `${b.label}: ${(b.minutes / 60).toFixed(2)}h`).join(" / ")}
      >
        {breakdown.map((b) => (
          <div
            key={b.key}
            style={{
              width: `${(b.minutes / total) * 100}%`,
              background: colorOf(b.label),
            }}
          />
        ))}
      </div>

      <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 8 }}>
        {breakdown.slice(0, 3).map((b) => (
          <div
            key={b.key}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 900, color: "#64748b" }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: colorOf(b.label),
                display: "inline-block",
              }}
            />
            <span>{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
