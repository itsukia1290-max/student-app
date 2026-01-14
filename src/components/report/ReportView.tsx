// src/components/report/ReportView.tsx
//
// Responsibility:
// - Report画面の「共通レイアウト」(カード/セクション/余白/見出し) を統一
// - 学習推移/目標(週・月)/成績/カレンダー/学習ログ入力 を組み合わせて表示
//
// Data sources:
// - study_logs: 学習ログ（minutes, studied_at_date, subject, memo）
//   -> 学習推移（今日/今月/総学習時間）もここから集計する
// - student_goals: 目標（週・月など）を保存（あなたのDBの列に合わせる）
//
// NOTE:
// - テーブル名が違う場合は GOALS_TABLE / STUDY_LOGS_TABLE を修正してください。

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

import CalendarBoard from "../CalendarBoard";
import type { CalendarPermissions } from "../CalendarBoard";
import StudentGrades from "../StudentGrades";
import Button from "../ui/Button";
import Input, { Textarea } from "../ui/Input";

const GOALS_TABLE = "student_goals"; // ★修正
const STUDY_LOGS_TABLE = "study_logs";

type Mode = "student" | "teacher";

type Props = {
  ownerUserId: string;
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
  studied_at_date: string; // YYYY-MM-DD
  memo: string | null;
  created_at: string;
};

type GoalRow = {
  id: string;
  user_id: string;
  kind: string; // "goal" など
  text: string | null;
  period_type: string | null; // "week" | "month"
  period_key: string | null;  // 例: "2026-01" / 週キー
  period_start: string | null; // date
  period_end: string | null;   // date
  detail: string | null;       // JSON文字列でもOK
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

// 月曜始まり（日本の塾用途ならこれが自然）
function startOfWeekISO(dateISO: string) {
  const d = new Date(`${dateISO}T00:00:00`);
  const day = d.getDay(); // 0 Sun
  const diff = (day === 0 ? -6 : 1 - day);
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
  // 週のキーは「週の開始日(YYYY-MM-DD)」で統一
  return startOfWeekISO(dateISO);
}
function monthKey(dateISO: string) {
  return dateISO.slice(0, 7); // "YYYY-MM"
}

function Card({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "16px",
        padding: "16px",
        boxShadow: "0 1px 0 rgba(0,0,0,0.02)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "10px",
        }}
      >
        <div style={{ fontWeight: 800, color: "#0f172a" }}>{title}</div>
        {right}
      </div>
      {children}
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
        background: "#eef2ff",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${p}%`,
          height: "100%",
          borderRadius: "999px",
          background: "#3b82f6",
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

  // study_logs add form
  const [formDate, setFormDate] = useState<string>(todayISO);
  const [formSubject, setFormSubject] = useState<string>("");
  const [formMinutes, setFormMinutes] = useState<string>("60");
  const [formMemo, setFormMemo] = useState<string>("");
  const [savingLog, setSavingLog] = useState(false);

  // ---- load study_logs ----
  async function loadLogs() {
    if (!ownerUserId) return;
    setLogsLoading(true);

    const { data, error } = await supabase
      .from(STUDY_LOGS_TABLE)
      .select("id,user_id,subject,minutes,studied_at_date,memo,created_at")
      .eq("user_id", ownerUserId)
      .order("studied_at_date", { ascending: false })
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

  // ---- load student_goals ----
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
      .filter((l) => l.studied_at_date === todayISO)
      .reduce((sum, l) => sum + (l.minutes ?? 0), 0);
  }, [logs, todayISO]);

  const weekMinutes = useMemo(() => {
    const s = startOfWeekISO(todayISO);
    const e = endOfWeekISO(todayISO);
    return logs
      .filter((l) => l.studied_at_date >= s && l.studied_at_date <= e)
      .reduce((sum, l) => sum + (l.minutes ?? 0), 0);
  }, [logs, todayISO]);

  const monthMinutes = useMemo(() => {
    const s = startOfMonthISO(todayISO);
    const e = endOfMonthISO(todayISO);
    return logs
      .filter((l) => l.studied_at_date >= s && l.studied_at_date <= e)
      .reduce((sum, l) => sum + (l.minutes ?? 0), 0);
  }, [logs, todayISO]);

  const totalMinutes = useMemo(() => {
    return logs.reduce((sum, l) => sum + (l.minutes ?? 0), 0);
  }, [logs]);

  // ---- goals: detail JSON { target_minutes: number } を優先 ----
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

  // ---- upsert goal (student_goals) ----
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

  // ---- add study log ----
  async function addLog() {
    if (!ownerUserId) return;

    const minutes = Number(formMinutes);
    if (!formSubject.trim()) return alert("科目を入力してください。");
    if (!Number.isFinite(minutes) || minutes <= 0) return alert("分数を正しく入力してください。");
    if (!formDate) return alert("日付を選択してください。");

    setSavingLog(true);
    const { error } = await supabase.from(STUDY_LOGS_TABLE).insert({
      user_id: ownerUserId,
      subject: formSubject.trim(),
      minutes: Math.floor(minutes),
      studied_at_date: formDate,
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
  const rootStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  };

  const tabRowStyle: React.CSSProperties = {
    display: "flex",
    gap: "10px",
    borderBottom: "1px solid #e5e7eb",
    paddingBottom: "10px",
  };

  function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
    return (
      <button
        onClick={onClick}
        style={{
          padding: "10px 14px",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          background: active ? "#eff6ff" : "#ffffff",
          color: active ? "#1d4ed8" : "#475569",
          fontWeight: 900,
          cursor: "pointer",
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <div style={rootStyle}>
      {/* Tabs */}
      <div style={tabRowStyle}>
        <TabButton active={tab === "record"} label="記録" onClick={() => setTab("record")} />
        {showTimeline && (
          <TabButton active={tab === "timeline"} label="タイムライン" onClick={() => setTab("timeline")} />
        )}
      </div>

      {tab === "timeline" ? (
        <Card title="タイムライン">
          <div style={{ color: "#64748b", fontSize: "14px" }}>
            ここは後で「レポート要約」「先生コメント」「提出履歴」などを流せます。
          </div>
        </Card>
      ) : (
        <>
          {/* 学習推移 */}
          <Card
            title="学習推移"
            right={
              <div style={{ color: "#64748b", fontWeight: 800, fontSize: "12px" }}>
                データ元: {STUDY_LOGS_TABLE}.minutes（集計）
              </div>
            }
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "12px",
              }}
            >
              <div style={{ padding: "12px", borderRadius: "14px", background: "#f8fafc", border: "1px solid #e5e7eb" }}>
                <div style={{ color: "#64748b", fontSize: "12px", fontWeight: 800 }}>今日</div>
                <div style={{ fontSize: "18px", fontWeight: 900, color: "#0f172a" }}>{minutesLabel(todayMinutes)}</div>
              </div>

              <div style={{ padding: "12px", borderRadius: "14px", background: "#f8fafc", border: "1px solid #e5e7eb" }}>
                <div style={{ color: "#64748b", fontSize: "12px", fontWeight: 800 }}>今週</div>
                <div style={{ fontSize: "18px", fontWeight: 900, color: "#0f172a" }}>{minutesLabel(weekMinutes)}</div>
              </div>

              <div style={{ padding: "12px", borderRadius: "14px", background: "#f8fafc", border: "1px solid #e5e7eb" }}>
                <div style={{ color: "#64748b", fontSize: "12px", fontWeight: 800 }}>今月</div>
                <div style={{ fontSize: "18px", fontWeight: 900, color: "#0f172a" }}>{minutesLabel(monthMinutes)}</div>
              </div>
            </div>

            <div style={{ marginTop: "10px", display: "flex", justifyContent: "space-between" }}>
              <div style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 700 }}>
                総学習時間（全期間）: {minutesLabel(totalMinutes)}
              </div>
              <button
                onClick={() => loadLogs()}
                style={{
                  border: "1px solid #e5e7eb",
                  background: "#ffffff",
                  borderRadius: "12px",
                  padding: "8px 10px",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                再読み込み
              </button>
            </div>

            {logsLoading && (
              <div style={{ marginTop: "8px", color: "#94a3b8", fontSize: "12px" }}>読み込み中...</div>
            )}
          </Card>

          {/* 週間目標 */}
          <Card
            title="週間目標"
            right={
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ fontWeight: 900, color: "#0f172a" }}>
                  {currentWeekTarget ? `${minutesLabel(currentWeekTarget)} 目標` : "未設定"}
                </div>
                {canEditGoals && (
                  <button
                    onClick={() => upsertGoal("week")}
                    style={{
                      border: "1px solid #e5e7eb",
                      background: "#ffffff",
                      borderRadius: "12px",
                      padding: "8px 10px",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    目標を設定
                  </button>
                )}
              </div>
            }
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <div style={{ color: "#475569", fontWeight: 800 }}>
                実績: {minutesLabel(weekMinutes)}
              </div>
              <div style={{ color: "#0f172a", fontWeight: 900 }}>
                {currentWeekTarget ? `${Math.floor(weekPercent)}%` : "—"}
              </div>
            </div>

            {currentWeekTarget ? (
              <ProgressBar percent={weekPercent} />
            ) : (
              <div style={{ color: "#64748b", fontSize: "13px", fontWeight: 700 }}>
                目標が未設定です。右上の「目標を設定」から追加できます。
              </div>
            )}

            {goalsLoading && (
              <div style={{ marginTop: "8px", color: "#94a3b8", fontSize: "12px" }}>読み込み中...</div>
            )}
          </Card>

          {/* 月間目標 */}
          <Card
            title="月間目標"
            right={
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ fontWeight: 900, color: "#0f172a" }}>
                  {currentMonthTarget ? `${minutesLabel(currentMonthTarget)} 目標` : "未設定"}
                </div>
                {canEditGoals && (
                  <button
                    onClick={() => upsertGoal("month")}
                    style={{
                      border: "1px solid #e5e7eb",
                      background: "#ffffff",
                      borderRadius: "12px",
                      padding: "8px 10px",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    目標を設定
                  </button>
                )}
              </div>
            }
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <div style={{ color: "#475569", fontWeight: 800 }}>
                実績: {minutesLabel(monthMinutes)}
              </div>
              <div style={{ color: "#0f172a", fontWeight: 900 }}>
                {currentMonthTarget ? `${Math.floor(monthPercent)}%` : "—"}
              </div>
            </div>

            {currentMonthTarget ? (
              <ProgressBar percent={monthPercent} />
            ) : (
              <div style={{ color: "#64748b", fontSize: "13px", fontWeight: 700 }}>
                目標が未設定です。右上の「目標を設定」から追加できます。
              </div>
            )}
          </Card>

          {/* 成績 */}
          {showGrades && (
            <Card title="成績（小テスト/問題集）">
              <div style={{ color: "#64748b", fontSize: "13px", fontWeight: 700, marginBottom: "10px" }}>
                既存の「小テスト確認」機能を利用します。
              </div>
              <div style={{ borderTop: "1px dashed #e5e7eb", paddingTop: "12px" }}>
                <StudentGrades userId={ownerUserId} editable={mode !== "student"} />
              </div>
            </Card>
          )}

          {/* 学習ログ入力 */}
          <Card title="学習時間の記入">
            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 140px", gap: "10px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 900, color: "#475569" }}>日付</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  style={{
                    width: "100%",
                    marginTop: "6px",
                    border: "1px solid #e5e7eb",
                    borderRadius: "12px",
                    padding: "10px",
                    fontWeight: 800,
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 900, color: "#475569" }}>科目</label>
                <Input
                  className="mt-1"
                  value={formSubject}
                  onChange={(e) => setFormSubject((e.target as HTMLInputElement).value)}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 900, color: "#475569" }}>分</label>
                <Input
                  className="mt-1"
                  value={formMinutes}
                  onChange={(e) => setFormMinutes((e.target as HTMLInputElement).value)}
                />
              </div>
            </div>

            <div style={{ marginTop: "10px" }}>
              <label style={{ fontSize: "12px", fontWeight: 900, color: "#475569" }}>メモ（任意）</label>
              <Textarea
                className="mt-1 h-24"
                value={formMemo}
                onChange={(e) => setFormMemo((e.target as HTMLTextAreaElement).value)}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
              <Button onClick={addLog} disabled={savingLog}>
                {savingLog ? "保存中..." : "追加"}
              </Button>
            </div>

            <div style={{ marginTop: "12px", borderTop: "1px dashed #e5e7eb", paddingTop: "12px" }}>
              <div style={{ fontWeight: 900, color: "#0f172a", marginBottom: "8px" }}>
                最近の学習ログ
              </div>

              {logsLoading ? (
                <div style={{ color: "#94a3b8", fontSize: "13px" }}>読み込み中...</div>
              ) : logs.length === 0 ? (
                <div style={{ color: "#94a3b8", fontSize: "13px" }}>まだ学習ログがありません。</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {logs.slice(0, 8).map((l) => (
                    <div
                      key={l.id}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: "14px",
                        padding: "10px 12px",
                        background: "#ffffff",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
                        <div style={{ fontWeight: 900, color: "#0f172a" }}>
                          {l.subject}
                          <span style={{ marginLeft: "10px", color: "#64748b", fontWeight: 800, fontSize: "12px" }}>
                            {l.studied_at_date}
                          </span>
                        </div>
                        <div style={{ fontWeight: 900, color: "#1d4ed8" }}>
                          {minutesLabel(l.minutes)}
                        </div>
                      </div>
                      {l.memo && (
                        <div style={{ marginTop: "6px", color: "#475569", fontSize: "13px", whiteSpace: "pre-wrap", fontWeight: 700 }}>
                          {l.memo}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* カレンダー */}
          {showCalendar && (
            <Card
              title="カレンダー"
              right={
                <div style={{ color: "#64748b", fontWeight: 800, fontSize: "12px" }}>
                  データはCalendarBoard側のcalendar_eventsから
                </div>
              }
            >
              <CalendarBoard ownerUserId={ownerUserId} permissions={calendarPermissions} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
