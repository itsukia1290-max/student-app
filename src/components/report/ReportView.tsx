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


function SoftCard({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section
      style={{
        borderRadius: "22px",
        padding: "16px",
        background: "#ffffff", // ✅ グラデ撤去
        border: "1px solid rgba(148,163,184,0.18)",
        boxShadow: "0 14px 34px rgba(15, 23, 42, 0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "12px" }}>
        <div style={{ fontWeight: 900, color: "#0f172a", fontSize: "16px" }}>{title}</div>
        {right}
      </div>
      {children}
    </section>
  );
}

export default function ReportView(props: Props) {
  // ★ 教師は完全に別画面
  if (props.mode === "teacher") {
    return <TeacherReportView ownerUserId={props.ownerUserId} />;
  }

  // ---- ここから下は既存の生徒用 ----
  return <StudentReportView {...props} />;
}

function StudentReportView({
  ownerUserId,
  mode,
  showTimeline = true,
  showGrades = true,
  showCalendar = true,
  calendarPermissions,
}: Props) {
  const nav = useNav();

  const weekKey = useMemo(() => currentWeekKey(new Date()), []);
  const monthKey = useMemo(() => currentMonthKey(new Date()), []);

  const [tab, setTab] = useState<"record" | "timeline">("record");

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
    return (
      goals.find((g) => g.kind === "weekly" && g.period_key === weekKey) ??
      goals.find((g) => g.kind === "weekly") ??
      null
    );
  }, [goals, weekKey]);

  const currentMonthlyGoal = useMemo(() => {
    return (
      goals.find((g) => g.kind === "monthly" && g.period_key === monthKey) ??
      goals.find((g) => g.kind === "monthly") ??
      null
    );
  }, [goals, monthKey]);

  // ---- styles ----
  const pageStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    padding: "8px",
    borderRadius: "24px",
    background: "#f8fafc",
  };

  const headerWrapStyle: React.CSSProperties = {
    backgroundColor: "#ffffff",
    borderRadius: "18px",
    boxShadow: "0 10px 28px rgba(15,23,42,0.08)",
    border: "1px solid rgba(148,163,184,0.16)",
    padding: "18px 20px 0px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  };

  const headerTitleStyle: React.CSSProperties = {
    fontSize: "22px",
    fontWeight: 900,
    color: "#0f172a",
    paddingBottom: "6px",
  };

  const tabHeaderRowStyle: React.CSSProperties = {
    display: "flex",
    gap: "0px",
    position: "relative",
    width: "100%",
  };

  const TopTab = ({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) => (
    <button
      onClick={onClick}
      style={{
        all: "unset",
        cursor: "pointer",
        textAlign: "center",
        fontWeight: 900,
        fontSize: "14px",
        color: active ? "#2563eb" : "#64748b",
        padding: "0px 16px 12px",
        borderBottom: `1px solid ${active ? "transparent" : "rgba(148,163,184,0.35)"}`,
        position: "relative",
        flex: 1,
      }}
    >
      {label}
      {active && (
        <div
          style={{
            position: "absolute",
            bottom: "-1px",
            left: "0",
            right: "0",
            height: "3px",
            background: "#2563eb",
            borderRadius: "99px 99px 0 0",
          }}
        />
      )}
    </button>
  );

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
    <div style={pageStyle}>
      {/* Header & Tabs */}
      <div style={headerWrapStyle}>
        <div style={headerTitleStyle}>レポート</div>

        <div style={tabHeaderRowStyle}>
          <TopTab active={tab === "record"} label="記録" onClick={() => setTab("record")} />
          {showTimeline && <TopTab active={tab === "timeline"} label="タイムライン" onClick={() => setTab("timeline")} />}
        </div>
      </div>

      {tab === "timeline" ? (
        <SoftCard title="タイムライン" right={<span style={subtleRightStyle}>後で拡張</span>}>
          <div style={{ color: "#64748b", fontSize: "14px", fontWeight: 800 }}>
            ここは後で「先生コメント」「要約」「提出履歴」などを流せます。
          </div>
        </SoftCard>
      ) : (
        <>
          {/* 学習サマリ（枠の二重は回避して直置き） */}
          <div style={{ marginTop: "2px" }}>
            {/* ✅ 先生閲覧時はボタン非表示にできるように */}
            <StudentDashboardSummary userId={ownerUserId} canEdit={mode === "student"} />
          </div>

          {/* 週間目標（文字目標） */}
          <SoftCard
            title="週間目標"
            right={
              mode === "student" ? (
                <button style={primarySmallBtn} onClick={() => nav.openMyGoals("week")}>
                  目標を追加
                </button>
              ) : (
                <span style={subtleRightStyle}>生徒の目標</span>
              )
            }
          >
            {/* ✅ 今週の学習実績 行は削除 */}
            <GoalBlock g={currentWeeklyGoal} />
          </SoftCard>

          {/* 月間目標（文字目標） */}
          <SoftCard
            title="月間目標"
            right={
              mode === "student" ? (
                <button style={primarySmallBtn} onClick={() => nav.openMyGoals("month")}>
                  目標を追加
                </button>
              ) : (
                <span style={subtleRightStyle}>生徒の目標</span>
              )
            }
          >
            {/* ✅ 今月の学習実績 行は削除 */}
            <GoalBlock g={currentMonthlyGoal} />
          </SoftCard>

          {/* 成績 */}
          {showGrades && (
            <SoftCard title="成績（小テスト/問題集）" right={<span style={subtleRightStyle}>既存機能</span>}>
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
            <SoftCard title="カレンダー" right={<span style={subtleRightStyle}>calendar_events</span>}>
              <CalendarBoard ownerUserId={ownerUserId} permissions={calendarPermissions} />
            </SoftCard>
          )}
        </>
      )}
    </div>
  );
}
