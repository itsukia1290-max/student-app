/*
 * src/components/StudentDashboardSummary.tsx
 * Responsibility:
 * - 生徒マイページ上部の「今日/今週/今月」学習サマリを表示する
 * - 後から消す可能性があるため、MyPageから独立している
 */

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  userId: string;
};

type StudyLogRow = {
  minutes: number;
  studied_at: string; // YYYY-MM-DD
};

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function startOfWeekISO(d = new Date()) {
  // 月曜始まり
  const x = new Date(d);
  const day = x.getDay(); // 0..6 (Sun..Sat)
  const diff = (day === 0 ? -6 : 1 - day);
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
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [todayMin, setTodayMin] = useState(0);
  const [weekMin, setWeekMin] = useState(0);
  const [monthMin, setMonthMin] = useState(0);

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
        .select("minutes,studied_at")
        .eq("user_id", userId)
        .gte("studied_at", fromISO);

      if (cancelled) return;

      if (error) {
        setErr("サマリの読み込みに失敗しました: " + error.message);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as StudyLogRow[];
      let t = 0,
        w = 0,
        m = 0;

      for (const r of rows) {
        const min = Number(r.minutes) || 0;
        if (r.studied_at === today) t += min;
        if (r.studied_at >= weekStart) w += min;
        if (r.studied_at >= monthStart) m += min;
      }

      setTodayMin(t);
      setWeekMin(w);
      setMonthMin(m);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId, today, weekStart, monthStart]);

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
        <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b" }}>
          今日: {today} / 週: {weekStart}〜 / 月: {monthStart}〜
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
          <SummaryTile label="今日" value={hoursText(todayMin)} hint="今日の合計" />
          <SummaryTile label="今週" value={hoursText(weekMin)} hint="月曜はじまり" />
          <SummaryTile label="今月" value={hoursText(monthMin)} hint="月初から" />
        </div>
      )}
    </div>
  );
}

function SummaryTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid rgba(148,163,184,0.18)",
        background: "linear-gradient(180deg, rgba(239,246,255,0.85), rgba(255,255,255,0.92))",
        padding: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: "#1d4ed8" }}>{label}</div>
        <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b" }}>{hint}</div>
      </div>
      <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900, color: "#0f172a" }}>{value}</div>
    </div>
  );
}
