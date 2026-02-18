// src/components/report/ReportView.tsx
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "../../lib/supabase";

import CalendarBoard from "../CalendarBoard";
import type { CalendarPermissions } from "../CalendarBoard";
import RecentChapter from "./RecentChapter";
import TeacherReportView from "./TeacherReportView";

import StudentDashboardSummary from "../StudentDashboardSummary";
import { useNav } from "../../hooks/useNav";

const GOALS_TABLE = "student_goals";

type Mode = "student" | "teacher";

type Props = {
  ownerUserId: string;
  mode: Mode;
  viewerRole?: "student" | "staff";

  // 互換性のため残す（タブは廃止するので使わない）
  showTimeline?: boolean;

  showGrades?: boolean;
  showCalendar?: boolean;

  calendarPermissions: CalendarPermissions;
};

type Kind = "weekly" | "monthly";

type GoalRow = {
  id: string;
  user_id: string;
  kind: Kind;
  period_type: string | null;
  period_key: string | null;
  text: string | null;
  detail: string | null;
  created_at: string;
  updated_at: string;
};

// ISO 週番号（簡易）
function getISOWeek(date: Date): number {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return weekNo;
}
function currentWeekKey(now = new Date()): string {
  const year = now.getFullYear();
  const week = getISOWeek(now);
  return `${year}-W${String(week).padStart(2, "0")}`;
}
function currentMonthKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

type Tone = "blue" | "green" | "purple" | "amber" | "slate";

function SoftCard({
  title,
  right,
  children,
  tone = "slate",
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  tone?: Tone;
}) {
  const toneMap: Record<Tone, { accent: string }> = {
    blue: { accent: "#1d4ed8" },     // 濃い青
    green: { accent: "#15803d" },    // 濃い緑
    purple: { accent: "#6d28d9" },   // 濃い紫
    amber: { accent: "#b45309" },    // 濃い橙
    slate: { accent: "#334155" },    // 濃いグレー
  };

  const t = toneMap[tone];

  return (
    <section
      style={{
        borderRadius: "18px",
        background: "#ffffff",
        border: "1.5px solid rgba(15,23,42,0.12)",
        boxShadow: "0 8px 20px rgba(15,23,42,0.08)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* 左アクセントバー（濃い） */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: "6px",
          background: t.accent,
        }}
      />

      {/* ヘッダー（白のまま締める） */}
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "2px solid rgba(15,23,42,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            fontWeight: 900,
            color: t.accent,  // タイトルを濃色に
            fontSize: "16px",
            letterSpacing: "0.5px",
          }}
        >
          {title}
        </div>
        {right}
      </div>

      {/* 本文 */}
      <div style={{ padding: "16px 18px" }}>{children}</div>
    </section>
  );
}

export default function ReportView(props: Props) {
  // ★ 教師は完全に別画面
  if (props.mode === "teacher") {
    return (
      <div>
        <div
          style={{
            padding: 10,
            marginBottom: 10,
            borderRadius: 12,
            background: "#fee2e2",
            border: "1px solid #fecaca",
            color: "#7f1d1d",
            fontWeight: 900,
          }}
        >
          TEACHER MODE / ownerUserId = {props.ownerUserId}
        </div>

        <TeacherReportView ownerUserId={props.ownerUserId} />
      </div>
    );
  }

  // ---- ここから下は既存の生徒用 ----
  return <StudentReportView {...props} />;
}

function StudentReportView({
  ownerUserId,
  viewerRole = "student",
  showGrades = true,
  showCalendar = true,
  calendarPermissions,
}: Props) {
  const nav = useNav();
  const canEdit = viewerRole === "student";

  const weekKey = useMemo(() => currentWeekKey(new Date()), []);
  const monthKey = useMemo(() => currentMonthKey(new Date()), []);

  // student_goals
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(false);

  async function loadGoals() {
    if (!ownerUserId) return;
    setGoalsLoading(true);

    const { data, error } = await supabase
      .from(GOALS_TABLE)
      .select("id,user_id,kind,period_type,period_key,text,detail,created_at,updated_at")
      .eq("user_id", ownerUserId)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("❌ load student_goals:", error.message);
      setGoals([]);
    } else {
      setGoals((data ?? []) as GoalRow[]);
    }

    setGoalsLoading(false);
  }

  useEffect(() => {
    loadGoals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerUserId]);

  const currentWeeklyGoal = useMemo(() => {
    return goals.find((g) => g.kind === "weekly" && g.period_key === weekKey) ?? goals.find((g) => g.kind === "weekly") ?? null;
  }, [goals, weekKey]);

  const currentMonthlyGoal = useMemo(() => {
    return goals.find((g) => g.kind === "monthly" && g.period_key === monthKey) ?? goals.find((g) => g.kind === "monthly") ?? null;
  }, [goals, monthKey]);

  // ---- styles ----
  const outerStyle: React.CSSProperties = {
    background: "#f1f5f9",
    padding: "12px",
    // ✅ 下部固定バーに隠れないように安全余白
    paddingBottom: "calc(96px + env(safe-area-inset-bottom))",
  };

  const innerStyle: React.CSSProperties = {
    maxWidth: 980,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  };

  // タブ廃止に合わせてヘッダーを“締まった”見た目に
  const headerWrapStyle: React.CSSProperties = {
    backgroundColor: "#ffffff",
    borderRadius: "18px",
    boxShadow: "0 10px 28px rgba(15,23,42,0.08)",
    border: "1px solid rgba(148,163,184,0.16)",
    padding: "16px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  };

  const headerLeftColStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    minWidth: 0,
  };

  const headerTitleStyle: React.CSSProperties = {
    fontSize: "22px",
    fontWeight: 900,
    color: "#0f172a",
    lineHeight: 1.2,
  };

  const headerSubStyle: React.CSSProperties = {
    color: "#64748b",
    fontWeight: 900,
    fontSize: "12px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  };

  const pillStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 10px",
    borderRadius: "999px",
    border: "1px solid rgba(148,163,184,0.20)",
    background: "#ffffff",
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
    whiteSpace: "nowrap",
  };

  const subtleRightStyle: React.CSSProperties = {
    color: "#64748b",
    fontWeight: 900,
    fontSize: "12px",
    backgroundColor: "#ffffff",
    border: "1px solid rgba(148,163,184,0.20)",
    borderRadius: "999px",
    padding: "8px 10px",
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
    whiteSpace: "nowrap",
  };

  // ✅ 薄い色のボタン（グラデ撤去）
  const primarySmallBtn: React.CSSProperties = {
    border: "1px solid rgba(59,130,246,0.28)",
    background: "rgba(219,234,254,0.9)",
    color: "#1d4ed8",
    borderRadius: "999px",
    padding: "10px 14px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 10px 22px rgba(15, 23, 42, 0.06)",
  };

  const dmBtn: React.CSSProperties = {
    border: "1px solid rgba(59,130,246,0.22)",
    background: "#ffffff",
    color: "#1d4ed8",
    borderRadius: "999px",
    padding: "10px 12px",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 10px 22px rgba(15, 23, 42, 0.06)",
    whiteSpace: "nowrap",
  };

  function GoalBlock({ g }: { g: GoalRow | null }) {
    if (goalsLoading) {
      return <div style={{ color: "#94a3b8", fontSize: "13px", fontWeight: 900 }}>読み込み中...</div>;
    }
    if (!g || (!g.text && !g.detail)) {
      return <div style={{ color: "#64748b", fontSize: "13px", fontWeight: 900 }}>未設定です。</div>;
    }
    return (
      <div style={{ display: "grid", gap: 10 }}>
        {g.text && (
          <div style={{ fontWeight: 900, color: "#0f172a" }}>
            <span style={{ color: "#1d4ed8" }}>一言目標：</span>
            {g.text}
          </div>
        )}
        {g.detail && (
          <div style={{ fontSize: "13px", fontWeight: 800, color: "#334155", whiteSpace: "pre-wrap" }}>
            <span style={{ color: "#1d4ed8" }}>詳細：</span>
            {g.detail}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={outerStyle}>
      <div style={innerStyle}>
        {/* Header（タブ廃止） */}
        <div style={headerWrapStyle}>
          <div style={headerLeftColStyle}>
            <div style={headerTitleStyle}>レポート</div>
            <div style={headerSubStyle}>
              <span style={pillStyle}>記録</span>
              <span style={{ whiteSpace: "nowrap" }}>学習のまとめ / 目標 / 成績 / カレンダー</span>
            </div>
          </div>

          {/* 右側：先生が生徒のレポートを見ている時だけ DMへ ボタン */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {viewerRole === "staff" && (
              <button
                type="button"
                style={dmBtn}
                onClick={() => nav.openDmWith(ownerUserId)}
              >
                DMへ
              </button>
            )}

            <span style={subtleRightStyle}>{canEdit ? "生徒画面" : "閲覧モード"}</span>
          </div>
        </div>

        {/* ===== ここから “記録” の中身（従来 tab===record 側）を直置き ===== */}

        {/* 学習サマリ（枠の二重は回避して直置き） */}
        <div style={{ marginTop: "2px", background: "rgba(37,99,235,0.04)", borderRadius: "20px", padding: "4px 0" }}>
          <StudentDashboardSummary userId={ownerUserId} canEdit={canEdit} />
        </div>

        {/* 週間目標（文字目標） */}
        <SoftCard
          title="週間目標"
          tone="green"
          right={
            canEdit ? (
              <button style={primarySmallBtn} onClick={() => nav.openMyGoals("week")}>
                目標を追加
              </button>
            ) : (
              <span style={subtleRightStyle}>生徒の目標</span>
            )
          }
        >
          <GoalBlock g={currentWeeklyGoal} />
        </SoftCard>

        {/* 月間目標（文字目標） */}
        <SoftCard
          title="月間目標"
          tone="green"
          right={
            canEdit ? (
              <button style={primarySmallBtn} onClick={() => nav.openMyGoals("month")}>
                目標を追加
              </button>
            ) : (
              <span style={subtleRightStyle}>生徒の目標</span>
            )
          }
        >
          <GoalBlock g={currentMonthlyGoal} />
        </SoftCard>

        {/* 成績 */}
        {showGrades && (
          <SoftCard title="成績（小テスト/問題集）" tone="purple" right={<span style={subtleRightStyle}>既存機能</span>}>
            <div style={{ color: "#64748b", fontSize: "13px", fontWeight: 900, marginBottom: "12px" }}>
              「確認する」で問題集の進捗を確認できます。
            </div>
            <div style={{ borderTop: "1px dashed rgba(148,163,184,0.35)", paddingTop: "12px" }}>
              <RecentChapter ownerUserId={ownerUserId} />
            </div>
          </SoftCard>
        )}

        {/* カレンダー */}
        {showCalendar && (
          <SoftCard title="カレンダー" tone="amber" right={<span style={subtleRightStyle}>calendar_events</span>}>
            <CalendarBoard ownerUserId={ownerUserId} permissions={calendarPermissions} />
          </SoftCard>
        )}
      </div>
    </div>
  );
}
