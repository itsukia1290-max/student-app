// src/components/report/ReportView.tsx
//
// Responsibility:
// - Report画面の「共通レイアウト」(カード/セクション/余白/見出し) を統一
// - 学習推移/目標(週・月)/成績/カレンダー/学習ログ入力 を組み合わせて表示
//
// Data sources:
// - study_logs: 学習ログ（minutes, studied_at, subject, memo）
//   -> 学習推移（今日/今週/今月/総学習時間）もここから集計する
// - student_goals: 目標（週・月など）を保存
//
// IMPORTANT:
// - あなたのDBでは study_logs の日付列は studied_at(date) です（studied_at_date ではない）

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

import CalendarBoard from "../components/CalendarBoard";
import type { CalendarPermissions } from "../components/CalendarBoard";
import StudentGrades from "../components/StudentGrades";
import Button from "../components/ui/Button";
import Input, { Textarea } from "../components/ui/Input";

const GOALS_TABLE = "student_goals";
const STUDY_LOGS_TABLE = "study_logs";

type Mode = "student" | "teacher";

type Props = {
  ownerUserId: string; // 生徒本人 or 先生が閲覧している対象生徒
  mode: Mode;

  showTimeline?: boolean;
  showGrades?: boolean;
  showCalendar?: boolean;

  calendarPermissions: CalendarPermissions;
  canEditGoals?: boolean;
};

type StudyLogRow = {
  id: string;
  user_id: string;
  subject: string;
  minutes: number;
  studied_at: string; // ★ date: "YYYY-MM-DD"
  memo: string | null;
  created_at: string;
};

type GoalRow = {
  id: string;
  user_id: string;
  kind: string; // "goal" など
  text: string | null;
  period_type: string | null; // "week" | "month"
  period_key: string | null; // 例: "2026-01" / 週キー
  period_start: string | null; // date
  period_end: string | null; // date
  detail: string | null; // JSON文字列でもOK
  created_at: string;
  updated_at: string;
};

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function minutesLabel(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// 月曜始まり
function startOfWeekISO(dateISO: string) {
  const d = new Date(`${dateISO}T00:00:00`);
  const day = d.getDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toISODate(d);
}
function endOfWeekISO(dateISO: string) {
  const s = new Date(`${startOfWeekISO(dateISO)}T00:00:00`);
  s.setDate(s.getDate() + 6);
  return toISODate(s);
}

function startOfMonthISO(dateISO: string) {
  const d = new Date(`${dateISO}T00:00:00`);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function endOfMonthISO(dateISO: string) {
  const d = new Date(`${startOfMonthISO(dateISO)}T00:00:00`);
  d.setMonth(d.getMonth() + 1);
  d.setDate(d.getDate() - 1);
  return toISODate(d);
}

function weekKey(dateISO: string) {
  return startOfWeekISO(dateISO); // 週キー = 週開始日
}
function monthKey(dateISO: string) {
  return dateISO.slice(0, 7); // "YYYY-MM"
}

function SoftCard({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        borderRadius: "22px",
        padding: "16px",
        background:
          "linear-gradient(180deg, rgba(239,246,255,0.92), rgba(255,255,255,0.92))",
        border: "1px solid rgba(59,130,246,0.14)",
        boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          marginBottom: "12px",
        }}
      >
        <div style={{ fontWeight: 900, color: "#0f172a", fontSize: "16px" }}>
          {title}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        borderRadius: "18px",
        padding: "14px 14px",
        backgroundColor: "rgba(255,255,255,0.78)",
        border: "1px solid rgba(148,163,184,0.22)",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
        minHeight: "66px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: "6px",
      }}
    >
      <div style={{ color: "#64748b", fontSize: "12px", fontWeight: 900 }}>
        {label}
      </div>
      <div style={{ color: "#0f172a", fontSize: "20px", fontWeight: 900 }}>
        {value}
      </div>
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  const p = clamp(percent, 0, 100);
  return (
    <div
      style={{
        width: "100%",
        height: "10px",
        borderRadius: "999px",
        background: "rgba(59,130,246,0.14)",
        overflow: "hidden",
        border: "1px solid rgba(59,130,246,0.18)",
      }}
    >
      <div
        style={{
          width: `${p}%`,
          height: "100%",
          borderRadius: "999px",
          background: "linear-gradient(90deg, #60a5fa, #3b82f6)",
          transition: "width 200ms ease",
        }}
      />
    </div>
  );
}

export default function ReportView({
  ownerUserId,
  mode,
  showTimeline = true,
  showGrades = true,
  showCalendar = true,
  calendarPermissions,
  canEditGoals = true,
}: Props) {
  const todayISO = toISODate(new Date());

  const [tab, setTab] = useState<"record" | "timeline">("record");

  // study_logs
  const [logs, setLogs] = useState<StudyLogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // student_goals
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(false);

  // add form
  const [formDate, setFormDate] = useState<string>(todayISO);
  const [formSubject, setFormSubject] = useState<string>("");
  const [formMinutes, setFormMinutes] = useState<string>("60");
  const [formMemo, setFormMemo] = useState<string>("");
  const [savingLog, setSavingLog] = useState(false);

  async function loadLogs() {
    if (!ownerUserId) return;
    setLogsLoading(true);

    // ★ studied_at に修正
    const { data, error } = await supabase
      .from(STUDY_LOGS_TABLE)
      .select("id,user_id,subject,minutes,studied_at,memo,created_at")
      .eq("user_id", ownerUserId)
      .order("studied_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      console.error("❌ load study_logs:", error.message);
      setLogs([]);
    } else {
      setLogs((data ?? []) as StudyLogRow[]);
    }

    setLogsLoading(false);
  }

  async function loadGoals() {
    if (!ownerUserId) return;
    setGoalsLoading(true);

    const { data, error } = await supabase
      .from(GOALS_TABLE)
      .select(
        "id,user_id,kind,text,period_type,period_key,period_start,period_end,detail,created_at,updated_at"
      )
      .eq("user_id", ownerUserId)
      .order("created_at", { ascending: false })
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
    loadLogs();
    loadGoals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerUserId]);

  // -------------------------
  // 学習推移（study_logsから集計）
  // -------------------------
  const todayMinutes = useMemo(() => {
    return logs
      .filter((l) => l.studied_at === todayISO)
      .reduce((sum, l) => sum + (l.minutes ?? 0), 0);
  }, [logs, todayISO]);

  const weekMinutes = useMemo(() => {
    const s = startOfWeekISO(todayISO);
    const e = endOfWeekISO(todayISO);
    return logs
      .filter((l) => l.studied_at >= s && l.studied_at <= e)
      .reduce((sum, l) => sum + (l.minutes ?? 0), 0);
  }, [logs, todayISO]);

  const monthMinutes = useMemo(() => {
    const s = startOfMonthISO(todayISO);
    const e = endOfMonthISO(todayISO);
    return logs
      .filter((l) => l.studied_at >= s && l.studied_at <= e)
      .reduce((sum, l) => sum + (l.minutes ?? 0), 0);
  }, [logs, todayISO]);

  const totalMinutes = useMemo(() => {
    return logs.reduce((sum, l) => sum + (l.minutes ?? 0), 0);
  }, [logs]);

  // ---- goals: detail JSON { target_minutes } 優先 ----
  function parseTargetMinutes(r: GoalRow | undefined): number | null {
    if (!r) return null;

    if (r.detail) {
      try {
        const obj = JSON.parse(r.detail);
        const v = obj?.target_minutes;
        if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
      } catch {
        // ignore
      }
    }
    if (r.text) {
      const n = Number(r.text);
      if (Number.isFinite(n) && n > 0) return Math.floor(n);
    }
    return null;
  }

  const currentWeekTarget = useMemo(() => {
    const key = weekKey(todayISO);
    const row =
      goals.find((r) => r.kind === "goal" && r.period_type === "week" && r.period_key === key) ||
      goals.find((r) => r.kind === "goal" && r.period_type === "week");
    return parseTargetMinutes(row);
  }, [goals, todayISO]);

  const currentMonthTarget = useMemo(() => {
    const key = monthKey(todayISO);
    const row =
      goals.find((r) => r.kind === "goal" && r.period_type === "month" && r.period_key === key) ||
      goals.find((r) => r.kind === "goal" && r.period_type === "month");
    return parseTargetMinutes(row);
  }, [goals, todayISO]);

  const weekPercent = useMemo(() => {
    if (!currentWeekTarget || currentWeekTarget <= 0) return 0;
    return (weekMinutes / currentWeekTarget) * 100;
  }, [weekMinutes, currentWeekTarget]);

  const monthPercent = useMemo(() => {
    if (!currentMonthTarget || currentMonthTarget <= 0) return 0;
    return (monthMinutes / currentMonthTarget) * 100;
  }, [monthMinutes, currentMonthTarget]);

  async function upsertGoal(periodType: "week" | "month") {
    if (!ownerUserId) return;
    if (!canEditGoals) return;

    const label = periodType === "week" ? "週" : "月";
    const current = periodType === "week" ? currentWeekTarget : currentMonthTarget;

    const input = window.prompt(
      `${label}間目標を「分」で入力してください。\n例：600（=10時間）`,
      current ? String(current) : ""
    );
    if (input == null) return;

    const n = Number(input);
    if (!Number.isFinite(n) || n <= 0) {
      alert("正の数（分）で入力してください。");
      return;
    }

    const key = periodType === "week" ? weekKey(todayISO) : monthKey(todayISO);
    const start = periodType === "week" ? startOfWeekISO(todayISO) : startOfMonthISO(todayISO);
    const end = periodType === "week" ? endOfWeekISO(todayISO) : endOfMonthISO(todayISO);

    const existing = goals.find(
      (r) => r.kind === "goal" && r.period_type === periodType && r.period_key === key
    );

    const payload = {
      user_id: ownerUserId,
      kind: "goal",
      period_type: periodType,
      period_key: key,
      period_start: start,
      period_end: end,
      text: null,
      detail: JSON.stringify({ target_minutes: Math.floor(n) }),
    };

    const res = existing
      ? await supabase.from(GOALS_TABLE).update(payload).eq("id", existing.id)
      : await supabase.from(GOALS_TABLE).insert(payload);

    if (res.error) {
      alert("目標の保存に失敗: " + res.error.message);
      return;
    }

    await loadGoals();
  }

  async function addLog() {
    if (!ownerUserId) return;

    const minutes = Number(formMinutes);
    if (!formSubject.trim()) return alert("科目を入力してください。");
    if (!Number.isFinite(minutes) || minutes <= 0) return alert("分数を正しく入力してください。");
    if (!formDate) return alert("日付を選択してください。");

    setSavingLog(true);

    // ★ studied_at に修正
    const { error } = await supabase.from(STUDY_LOGS_TABLE).insert({
      user_id: ownerUserId,
      subject: formSubject.trim(),
      minutes: Math.floor(minutes),
      studied_at: formDate,
      memo: formMemo.trim() || null,
    });

    if (error) {
      alert("学習ログの保存に失敗: " + error.message);
      setSavingLog(false);
      return;
    }

    setFormSubject("");
    setFormMinutes("60");
    setFormMemo("");
    setSavingLog(false);

    await loadLogs();
  }

  // ---- styles ----
  const pageStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    padding: "8px",
    borderRadius: "24px",
    background:
      "radial-gradient(1000px 400px at 20% -10%, rgba(96,165,250,0.30), rgba(255,255,255,0)), radial-gradient(900px 380px at 90% 0%, rgba(191,219,254,0.55), rgba(255,255,255,0)), #f8fafc",
  };

  const headerWrapStyle: React.CSSProperties = {
    backgroundColor: "#ffffff",
    borderRadius: "18px",
    boxShadow: "0 10px 28px rgba(15,23,42,0.08)",
    border: "1px solid rgba(148,163,184,0.16)",
    padding: "18px 20px 0px",
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "20px",
  };

  const headerTitleStyle: React.CSSProperties = {
    fontSize: "22px",
    fontWeight: 900,
    color: "#0f172a",
    paddingBottom: "12px",
  };

  const tabHeaderRowStyle: React.CSSProperties = {
    display: "flex",
    gap: "0px",
    position: "relative",
    flex: 1,
    maxWidth: "400px",
  };

  const subtleRightStyle: React.CSSProperties = {
    color: "#64748b",
    fontWeight: 900,
    fontSize: "12px",
    backgroundColor: "rgba(255,255,255,0.75)",
    border: "1px solid rgba(148,163,184,0.20)",
    borderRadius: "999px",
    padding: "8px 10px",
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
    whiteSpace: "nowrap",
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
          {/* 学習推移 */}
          <SoftCard
            title="学習推移"
            right={<span style={subtleRightStyle}>study_logs.minutes を集計</span>}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "12px",
              }}
            >
              <StatPill label="今日" value={minutesLabel(todayMinutes)} />
              <StatPill label="今週" value={minutesLabel(weekMinutes)} />
              <StatPill label="今月" value={minutesLabel(monthMinutes)} />
            </div>

            <div
              style={{
                marginTop: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ color: "#64748b", fontSize: "12px", fontWeight: 900 }}>
                総学習時間（全期間）: {minutesLabel(totalMinutes)}
              </div>

              <button
                onClick={() => loadLogs()}
                style={{
                  border: "1px solid rgba(148,163,184,0.24)",
                  background: "rgba(255,255,255,0.75)",
                  borderRadius: "999px",
                  padding: "10px 14px",
                  fontWeight: 900,
                  cursor: "pointer",
                  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
                }}
              >
                再読み込み
              </button>
            </div>

            {logsLoading && (
              <div style={{ marginTop: "8px", color: "#94a3b8", fontSize: "12px", fontWeight: 900 }}>
                読み込み中...
              </div>
            )}
          </SoftCard>

          {/* 週間目標 */}
          <SoftCard
            title="週間目標"
            right={
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <div style={subtleRightStyle}>
                  {currentWeekTarget ? `${minutesLabel(currentWeekTarget)} 目標` : "未設定"}
                </div>
                {canEditGoals && (
                  <button
                    onClick={() => upsertGoal("week")}
                    style={{
                      border: "1px solid rgba(59,130,246,0.22)",
                      background: "linear-gradient(180deg, rgba(96,165,250,0.90), rgba(59,130,246,0.90))",
                      color: "#ffffff",
                      borderRadius: "999px",
                      padding: "10px 14px",
                      fontWeight: 900,
                      cursor: "pointer",
                      boxShadow: "0 14px 28px rgba(59,130,246,0.18)",
                    }}
                  >
                    目標を設定
                  </button>
                )}
              </div>
            }
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <div style={{ color: "#0f172a", fontWeight: 900 }}>
                実績: <span style={{ color: "#1d4ed8" }}>{minutesLabel(weekMinutes)}</span>
              </div>
              <div style={{ color: "#0f172a", fontWeight: 900 }}>
                {currentWeekTarget ? `${Math.floor(weekPercent)}%` : "—"}
              </div>
            </div>

            {currentWeekTarget ? (
              <ProgressBar percent={weekPercent} />
            ) : (
              <div style={{ color: "#64748b", fontSize: "13px", fontWeight: 900 }}>
                目標が未設定です。「目標を設定」から追加できます。
              </div>
            )}

            {goalsLoading && (
              <div style={{ marginTop: "10px", color: "#94a3b8", fontSize: "12px", fontWeight: 900 }}>
                読み込み中...
              </div>
            )}
          </SoftCard>

          {/* 月間目標 */}
          <SoftCard
            title="月間目標"
            right={
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <div style={subtleRightStyle}>
                  {currentMonthTarget ? `${minutesLabel(currentMonthTarget)} 目標` : "未設定"}
                </div>
                {canEditGoals && (
                  <button
                    onClick={() => upsertGoal("month")}
                    style={{
                      border: "1px solid rgba(59,130,246,0.22)",
                      background: "linear-gradient(180deg, rgba(96,165,250,0.90), rgba(59,130,246,0.90))",
                      color: "#ffffff",
                      borderRadius: "999px",
                      padding: "10px 14px",
                      fontWeight: 900,
                      cursor: "pointer",
                      boxShadow: "0 14px 28px rgba(59,130,246,0.18)",
                    }}
                  >
                    目標を設定
                  </button>
                )}
              </div>
            }
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <div style={{ color: "#0f172a", fontWeight: 900 }}>
                実績: <span style={{ color: "#1d4ed8" }}>{minutesLabel(monthMinutes)}</span>
              </div>
              <div style={{ color: "#0f172a", fontWeight: 900 }}>
                {currentMonthTarget ? `${Math.floor(monthPercent)}%` : "—"}
              </div>
            </div>

            {currentMonthTarget ? (
              <ProgressBar percent={monthPercent} />
            ) : (
              <div style={{ color: "#64748b", fontSize: "13px", fontWeight: 900 }}>
                目標が未設定です。「目標を設定」から追加できます。
              </div>
            )}
          </SoftCard>

          {/* 成績 */}
          {showGrades && (
            <SoftCard
              title="成績（小テスト/問題集）"
              right={<span style={subtleRightStyle}>既存機能</span>}
            >
              <div style={{ color: "#64748b", fontSize: "13px", fontWeight: 900, marginBottom: "12px" }}>
                「確認する」で問題集の進捗を確認できます。
              </div>
              <div style={{ borderTop: "1px dashed rgba(148,163,184,0.35)", paddingTop: "12px" }}>
                <StudentGrades userId={ownerUserId} editable={mode !== "student"} />
              </div>
            </SoftCard>
          )}

          {/* 学習ログ入力 */}
          <SoftCard title="学習時間の記入" right={<span style={subtleRightStyle}>study_logs に保存</span>}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "160px 1fr 140px",
                gap: "10px",
              }}
            >
              <div>
                <label style={{ fontSize: "12px", fontWeight: 900, color: "#475569" }}>日付</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  style={{
                    width: "100%",
                    marginTop: "6px",
                    border: "1px solid rgba(148,163,184,0.30)",
                    borderRadius: "14px",
                    padding: "12px 12px",
                    fontWeight: 900,
                    backgroundColor: "rgba(255,255,255,0.85)",
                    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 900, color: "#475569" }}>科目</label>
                <Input
                  className="mt-1"
                  value={formSubject}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormSubject(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 900, color: "#475569" }}>分</label>
                <Input
                  className="mt-1"
                  value={formMinutes}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormMinutes(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginTop: "10px" }}>
              <label style={{ fontSize: "12px", fontWeight: 900, color: "#475569" }}>メモ（任意）</label>
              <Textarea
                className="mt-1 h-24"
                value={formMemo}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormMemo(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
              <Button onClick={addLog} disabled={savingLog}>
                {savingLog ? "保存中..." : "追加"}
              </Button>
            </div>

            <div style={{ marginTop: "14px", borderTop: "1px dashed rgba(148,163,184,0.35)", paddingTop: "14px" }}>
              <div style={{ fontWeight: 900, color: "#0f172a", marginBottom: "10px" }}>
                最近の学習ログ
              </div>

              {logsLoading ? (
                <div style={{ color: "#94a3b8", fontSize: "13px", fontWeight: 900 }}>読み込み中...</div>
              ) : logs.length === 0 ? (
                <div style={{ color: "#94a3b8", fontSize: "13px", fontWeight: 900 }}>まだ学習ログがありません。</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {logs.slice(0, 8).map((l) => (
                    <div
                      key={l.id}
                      style={{
                        border: "1px solid rgba(148,163,184,0.22)",
                        borderRadius: "16px",
                        padding: "12px 12px",
                        background: "rgba(255,255,255,0.78)",
                        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 900, color: "#0f172a" }}>
                          {l.subject}
                          <span style={{ marginLeft: "10px", color: "#64748b", fontWeight: 900, fontSize: "12px" }}>
                            {l.studied_at}
                          </span>
                        </div>
                        <div style={{ fontWeight: 900, color: "#1d4ed8" }}>
                          {minutesLabel(l.minutes)}
                        </div>
                      </div>

                      {l.memo && (
                        <div style={{ marginTop: "8px", color: "#475569", fontSize: "13px", whiteSpace: "pre-wrap", fontWeight: 800 }}>
                          {l.memo}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SoftCard>

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
