/*
 * src/components/StudentDashboardSummary.tsx
 */

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNav } from "../hooks/useNav";
import { useStudySubjects } from "../hooks/useStudySubjects";
import MiniDonut, { type BreakdownItem } from "./study/MiniDonut";

type Props = {
  userId: string;
  canEdit?: boolean; // ✅ 追加：先生閲覧時 false
};

type StudyLogRow = {
  minutes: number;
  studied_at: string; // YYYY-MM-DD
  subject_id: string | null;
};

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);

    onChange();
    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange);

    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, [query]);

  return matches;
}

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

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function startOfWeekISO(d = new Date()) {
  const x = new Date(d);
  const day = x.getDay();
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

function colorOf(label: string) {
  const map: Record<string, string> = {
    国語: "#f97316",
    数学: "#3b82f6",
    英語: "#22c55e",
    理科: "#a855f7",
    社会: "#ef4444",
    その他: "#64748b",
  };
  return map[label] ?? "#94a3b8";
}

export default function StudentDashboardSummary({ userId, canEdit = true }: Props) {
  const nav = useNav();
  const { subjects } = useStudySubjects();
  const isMobile = useMediaQuery("(max-width: 520px)"); // ✅

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
        setErr("サマリーの読み込みに失敗しました: " + error.message);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as StudyLogRow[];
      const todayRows = rows.filter((r) => r.studied_at === today);
      const weekRows = rows.filter((r) => r.studied_at >= weekStart);
      const monthRows = rows.filter((r) => r.studied_at >= monthStart);

      const sumMin = (xs: StudyLogRow[]) => xs.reduce((s, r) => s + (Number(r.minutes) || 0), 0);

      const subjectIdToLabel = (id: string | null) => {
        if (!id) return "その他";
        const found = subjects.find((s) => s.id === id);
        return found?.name ?? "その他";
      };

      setTodayMin(sumMin(todayRows));
      setWeekMin(sumMin(weekRows));
      setMonthMin(sumMin(monthRows));
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

  // ✅ 濃いめ・締まった版
  const actionBtnStyle: React.CSSProperties = {
    border: "1.5px solid rgba(29,78,216,0.55)",
    background: "#ffffff",
    color: "#1d4ed8",
    borderRadius: 9999,
    padding: "9px 12px",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
    boxShadow: "0 6px 16px rgba(15, 23, 42, 0.08)",
    whiteSpace: "nowrap",
  };

  return (
    <div
      style={{
        borderRadius: 18,
        background: "#ffffff",
        border: "1.5px solid rgba(15,23,42,0.12)",
        boxShadow: "0 8px 20px rgba(15,23,42,0.08)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* 左アクセントバー（濃い青） */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: 6,
          background: "#1d4ed8",
        }}
      />

      {/* ヘッダー（白で締める） */}
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "2px solid rgba(15,23,42,0.06)",
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          justifyContent: "space-between",
          gap: isMobile ? 8 : 10,
          alignItems: isMobile ? "stretch" : "center",
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 900, color: "#1d4ed8", whiteSpace: "nowrap" }}>
          学習サマリー
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: isMobile ? "flex-start" : "flex-end",
          }}
        >
          {canEdit && (
            <button type="button" style={actionBtnStyle} onClick={() => nav.openMyRecords()}>
              学習記録を追加
            </button>
          )}

          <div
            style={{
              fontSize: 12,
              fontWeight: 900,
              color: "#475569",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: isMobile ? "100%" : 520,
            }}
            title={`今日: ${today} / 週: ${weekStart}〜 / 月: ${monthStart}〜`}
          >
            今日: {today} / 週: {weekStart}〜 / 月: {monthStart}〜
          </div>
        </div>
      </div>

      {/* 本文 */}
      <div style={{ padding: isMobile ? 12 : 16 }}>
        {loading ? (
          <div style={{ fontSize: 13, fontWeight: 800, color: "#64748b" }}>読み込み中...</div>
        ) : err ? (
          <div style={{ fontSize: 13, fontWeight: 900, color: "#dc2626", whiteSpace: "pre-wrap" }}>{err}</div>
        ) : (
          <>
            {/* ✅ 凡例（色 ↔ 教科） */}
            <Legend breakdowns={[todayBreakdown, weekBreakdown, monthBreakdown]} compact={isMobile} />

            {/* ✅ 3つは常に横並び（高さ扱いをコンパクト化） */}
            <div
              style={{
                marginTop: 10,
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))", // ✅ 常に3列（スクロールなし）
                gap: isMobile ? 6 : 10, // ✅ モバイルは狭める
              }}
            >
              <SummaryTile compact={isMobile} label="今日" value={hoursText(todayMin)} breakdown={todayBreakdown} chart="donut" />
              <SummaryTile compact={isMobile} label="今週" value={hoursText(weekMin)} breakdown={weekBreakdown} chart="donut" />
              <SummaryTile compact={isMobile} label="今月" value={hoursText(monthMin)} breakdown={monthBreakdown} chart="donut" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Legend({
  breakdowns,
  compact,
}: {
  breakdowns: BreakdownItem[][];
  compact: boolean;
}) {
  const map = new Map<string, number>();
  for (const bd of breakdowns) {
    for (const b of bd) {
      map.set(b.label, (map.get(b.label) ?? 0) + b.minutes);
    }
  }

  const items = [...map.entries()]
    .filter(([label, minutes]) => minutes > 0 && label)
    .sort((a, b) => b[1] - a[1])
    .map(([label, minutes]) => ({ label, minutes }));

  if (items.length === 0) return null;

  const max = compact ? 4 : 6;
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;

  return (
    <div
      style={{
        marginTop: 10,
        display: "flex",
        flexWrap: "wrap",
        gap: compact ? 6 : 8,
        alignItems: "center",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", marginRight: 2 }}>
        色の対応：
      </div>

      {shown.map((it) => (
        <div
          key={it.label}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: compact ? "5px 8px" : "6px 10px",
            borderRadius: 999,
            border: "1px solid rgba(148,163,184,0.22)",
            background: "rgba(248,250,252,0.9)",
            fontSize: 11,
            fontWeight: 900,
            color: "#334155",
            maxWidth: compact ? 120 : 160,
          }}
          title={`${it.label}: ${(it.minutes / 60).toFixed(2)}h`}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: colorOf(it.label),
              flexShrink: 0,
            }}
          />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
        </div>
      ))}

      {rest > 0 && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 900,
            color: "#64748b",
            padding: compact ? "5px 8px" : "6px 10px",
            borderRadius: 999,
            border: "1px dashed rgba(148,163,184,0.28)",
            background: "rgba(255,255,255,0.7)",
          }}
          title={items
            .slice(max)
            .map((it) => `${it.label}: ${(it.minutes / 60).toFixed(2)}h`)
            .join(" / ")}
        >
          +{rest}
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  breakdown,
  chart = "donut",
  compact = false,
}: {
  label: string;
  value: string;
  breakdown?: BreakdownItem[];
  chart?: "bar" | "donut";
  compact?: boolean;
}) {
  const total = (breakdown ?? []).reduce((s, b) => s + b.minutes, 0);

  return (
    <div
      style={{
        borderRadius: 16,
        border: "1.5px solid rgba(15,23,42,0.10)",
        background: "#ffffff",
        boxShadow: "0 6px 14px rgba(15,23,42,0.06)",
        padding: compact ? 10 : 12, // ✅ 余白削減
        minWidth: 0,                // ✅ 横並びで潰れやすい時の保険
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
        <div
          style={{
            fontSize: compact ? 12 : 13,
            fontWeight: 900,
            color: "#1d4ed8",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
      </div>

      <div
        style={{
          marginTop: compact ? 4 : 6,
          fontSize: compact ? 18 : 22, // ✅ 数値を少し小さく
          fontWeight: 900,
          color: "#0f172a",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>

      {/* ✅ ドーナツをモバイル時だけ縮小（MiniDonutをいじらずに） */}
      <div style={{ transform: compact ? "scale(0.88)" : "none", transformOrigin: "left top" }}>
        {chart === "donut" ? (
          <MiniDonut breakdown={breakdown ?? []} total={total} />
        ) : (
          <MiniStackedBar breakdown={breakdown ?? []} total={total} />
        )}
      </div>
    </div>
  );
}

function MiniStackedBar({ breakdown, total }: { breakdown: BreakdownItem[]; total: number }) {
  if (!breakdown.length || total <= 0) {
    return <div style={{ marginTop: 10, fontSize: 11, fontWeight: 800, color: "#94a3b8" }}>内訳なし</div>;
  }

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
