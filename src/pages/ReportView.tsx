// src/pages/ReportView.tsx
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
  // 表示対象（先生が見ている生徒など）
  ownerUserId: string;

  // ★学習推移は「自分」を出したい → viewerUserId を別で渡す
  viewerUserId?: string;

  mode: Mode;

  showTimeline?: boolean;
  showGrades?: boolean;
  showCalendar?: boolean;

  // ★必須：未設定だとカレンダーが空になる
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
  kind: string;
  text: string | null;
  period_type: string | null; // "week" | "month"
  period_key: string | null;
  period_start: string | null;
  period_end: string | null;
  detail: string | null; // JSON文字列: {"target_minutes": 600}
  created_at: string;
  updated_at: string;
};

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function startOfWeekISO(dateISO: string) {
  const d = new Date(`${dateISO}T00:00:00`);
  const day = d.getDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday start
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
  return startOfWeekISO(dateISO);
}
function monthKey(dateISO: string) {
  return dateISO.slice(0, 7); // YYYY-MM
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

function ProgressBar({ percent }: { percent: number }) {
  const p = clamp(percent, 0, 100);
  return (
    <div
      style={{
        width: "100%",
        height: "10px",
        borderRadius: "999px",
        background: "#e8f0ff",
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
  viewerUserId,
  mode,
  showTimeline = true,
  showGrades = true,
  showCalendar = true,
  calendarPermissions,
  canEditGoals = true,
}: Props) {
  const todayISO = toISODate(new Date());

  // 学習推移は "自分" を出す
  const effectiveViewerId = viewerUserId ?? ownerUserId;

  const [tab, setTab] = useState<"record" | "timeline">("record");

  // 学習推移用（viewer）
  const [viewerLogs, setViewerLogs] = useState<StudyLogRow[]>([]);
  const [viewerLogsLoading, setViewerLogsLoading] = useState(false);

  // 目標・成績・カレンダーなどは owner を表示
  const [goals, setGoals] = useState<GoalRow[]>([]);

  // 学習ログ入力（生徒が入力できるように）
  const [formDate, setFormDate] = useState<string>(todayISO);
  const [formSubject, setFormSubject] = useState<string>("");
  const [formMinutes, setFormMinutes] = useState<string>("60");
  const [formMemo, setFormMemo] = useState<string>("");
  const [savingLog, setSavingLog] = useState(false);

  // ---- load viewer study_logs ----
  async function loadViewerLogs() {
    if (!effectiveViewerId) return;
    setViewerLogsLoading(true);

    const { data, error } = await supabase
      .from(STUDY_LOGS_TABLE)
      .select("id,user_id,subject,minutes,studied_at_date,memo,created_at")
      .eq("user_id", effectiveViewerId)
      .order("studied_at_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      console.error("❌ load study_logs(viewer):", error.message);
      setViewerLogs([]);
    } else {
      setViewerLogs((data ?? []) as StudyLogRow[]);
    }

    setViewerLogsLoading(false);
  }

  // ---- load owner goals ----
  async function loadGoals() {
    if (!ownerUserId) return;

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
  }

  useEffect(() => {
    loadViewerLogs();
    loadGoals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerUserId, effectiveViewerId]);

  // -------- 学習推移（viewerLogsから集計） --------
  const todayMinutes = useMemo(() => {
    return viewerLogs
      .filter((l) => l.studied_at_date === todayISO)
      .reduce((sum, l) => sum + (l.minutes ?? 0), 0);
  }, [viewerLogs, todayISO]);

  const weekMinutes = useMemo(() => {
    const s = startOfWeekISO(todayISO);
    const e = endOfWeekISO(todayISO);
    return viewerLogs
      .filter((l) => l.studied_at_date >= s && l.studied_at_date <= e)
      .reduce((sum, l) => sum + (l.minutes ?? 0), 0);
  }, [viewerLogs, todayISO]);

  const monthMinutes = useMemo(() => {
    const s = startOfMonthISO(todayISO);
    const e = endOfMonthISO(todayISO);
    return viewerLogs
      .filter((l) => l.studied_at_date >= s && l.studied_at_date <= e)
      .reduce((sum, l) => sum + (l.minutes ?? 0), 0);
  }, [viewerLogs, todayISO]);

  const totalMinutes = useMemo(() => {
    return viewerLogs.reduce((sum, l) => sum + (l.minutes ?? 0), 0);
  }, [viewerLogs]);

  // -------- goals: detail JSON { target_minutes } --------
  function parseTargetMinutes(r: GoalRow | undefined): number | null {
    if (!r) return null;
    if (r.detail) {
      try {
        const obj = JSON.parse(r.detail);
        const v = obj?.target_minutes;
        if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
      } catch {
        // JSON parse error - ignore
      }
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

  // 生徒が学習ログを入力（ownerUserId に保存する）
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

    // owner と viewer が同じなら推移も更新
    await loadViewerLogs();
  }

  // ---- styles (旧寄せ) ----
  const pageStyle: React.CSSProperties = {
    background: "#f3f7ff",
    borderRadius: "16px",
    padding: "14px",
  };

  const sectionStyle: React.CSSProperties = {
    background: "#ffffff",
    border: "1px solid #e6eefc",
    borderRadius: "18px",
    padding: "16px",
    marginBottom: "14px",
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontWeight: 900,
    color: "#0f172a",
    marginBottom: "10px",
  };

  const tabRowStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "center",
    gap: "30%",
    borderBottom: "2px solid #e6eefc",
    marginBottom: "14px",
  };

  function Tab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
    return (
      <button
        onClick={onClick}
        style={{
          padding: "12px 14px",
          fontWeight: 900,
          color: active ? "#0f172a" : "#94a3b8",
          borderBottom: active ? "3px solid #3b82f6" : "3px solid transparent",
          background: "transparent",
          cursor: "pointer",
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <div style={pageStyle}>
      {/* tabs */}
      <div style={tabRowStyle}>
        <Tab active={tab === "record"} label="記録" onClick={() => setTab("record")} />
        {showTimeline && <Tab active={tab === "timeline"} label="タイムライン" onClick={() => setTab("timeline")} />}
      </div>

      {tab === "timeline" ? (
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>タイムライン</div>
          <div style={{ color: "#64748b", fontWeight: 700, fontSize: "13px" }}>
            （ここは後で実装）
          </div>
        </div>
      ) : (
        <>
          {/* 学習推移（viewer） */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>学習推移</div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "10px",
              }}
            >
              {[
                { label: "今日", value: minutesLabel(todayMinutes) },
                { label: "今月", value: minutesLabel(monthMinutes) },
                { label: "総学習時間", value: minutesLabel(totalMinutes) },
              ].map((x) => (
                <div
                  key={x.label}
                  style={{
                    border: "1px solid #e6eefc",
                    borderRadius: "14px",
                    padding: "14px",
                    background: "#ffffff",
                  }}
                >
                  <div style={{ color: "#64748b", fontWeight: 800, fontSize: "12px" }}>{x.label}</div>
                  <div style={{ fontWeight: 900, fontSize: "18px", color: "#0f172a", marginTop: "4px" }}>
                    {x.value}
                  </div>
                </div>
              ))}
            </div>

            {viewerLogsLoading && (
              <div style={{ marginTop: "10px", color: "#64748b", fontWeight: 700, fontSize: "13px" }}>
                読み込み中...
              </div>
            )}
          </div>

          {/* 週間目標 */}
          <div style={sectionStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={sectionTitleStyle}>週間目標</div>
              <div style={{ fontWeight: 900, color: "#0f172a" }}>
                {currentWeekTarget ? `${minutesLabel(currentWeekTarget)} 目標` : "未設定"}
              </div>
            </div>

            <div style={{ marginBottom: "8px", display: "flex", justifyContent: "space-between" }}>
              <div style={{ color: "#64748b", fontWeight: 800 }}>実績: {minutesLabel(weekMinutes)}</div>
              <div style={{ fontWeight: 900, color: "#0f172a" }}>
                {currentWeekTarget ? `${Math.floor(weekPercent)}%` : "—"}
              </div>
            </div>

            {currentWeekTarget ? (
              <ProgressBar percent={weekPercent} />
            ) : (
              <div style={{ color: "#64748b", fontWeight: 700, fontSize: "13px" }}>
                （目標はあとで拡張）
              </div>
            )}

            {canEditGoals && (
              <div style={{ marginTop: "10px", display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => upsertGoal("week")}
                  style={{
                    border: "1px solid #e6eefc",
                    borderRadius: "999px",
                    padding: "10px 14px",
                    background: "#ffffff",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  目標を設定
                </button>
              </div>
            )}
          </div>

          {/* 月間目標 */}
          <div style={sectionStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={sectionTitleStyle}>月間目標</div>
              <div style={{ fontWeight: 900, color: "#0f172a" }}>
                {currentMonthTarget ? `${minutesLabel(currentMonthTarget)} 目標` : "未設定"}
              </div>
            </div>

            <div style={{ marginBottom: "8px", display: "flex", justifyContent: "space-between" }}>
              <div style={{ color: "#64748b", fontWeight: 800 }}>実績: {minutesLabel(monthMinutes)}</div>
              <div style={{ fontWeight: 900, color: "#0f172a" }}>
                {currentMonthTarget ? `${Math.floor(monthPercent)}%` : "—"}
              </div>
            </div>

            {currentMonthTarget ? (
              <ProgressBar percent={monthPercent} />
            ) : (
              <div style={{ color: "#64748b", fontWeight: 700, fontSize: "13px" }}>
                （目標はあとで拡張）
              </div>
            )}

            {canEditGoals && (
              <div style={{ marginTop: "10px", display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => upsertGoal("month")}
                  style={{
                    border: "1px solid #e6eefc",
                    borderRadius: "999px",
                    padding: "10px 14px",
                    background: "#ffffff",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  目標を設定
                </button>
              </div>
            )}
          </div>

          {/* 成績 */}
          {showGrades && (
            <div style={sectionStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={sectionTitleStyle}>成績（小テスト/問題集）</div>
                <div style={{ color: "#64748b", fontWeight: 800, fontSize: "12px" }}>
                  「確認する」で既存機能へ
                </div>
              </div>
              <StudentGrades userId={ownerUserId} editable={mode !== "student"} />
            </div>
          )}

          {/* 学習ログ記入（生徒用） */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>学習時間の記入</div>

            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 120px", gap: "10px" }}>
              <div>
                <div style={{ fontSize: "12px", fontWeight: 900, color: "#64748b" }}>日付</div>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  style={{
                    width: "100%",
                    marginTop: "6px",
                    border: "1px solid #e6eefc",
                    borderRadius: "12px",
                    padding: "10px",
                    fontWeight: 900,
                  }}
                />
              </div>

              <div>
                <div style={{ fontSize: "12px", fontWeight: 900, color: "#64748b" }}>科目</div>
                <Input
                  className="mt-1"
                  value={formSubject}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormSubject(e.target.value)}
                />
              </div>

              <div>
                <div style={{ fontSize: "12px", fontWeight: 900, color: "#64748b" }}>分</div>
                <Input
                  className="mt-1"
                  value={formMinutes}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormMinutes(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginTop: "10px" }}>
              <div style={{ fontSize: "12px", fontWeight: 900, color: "#64748b" }}>メモ（任意）</div>
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
          </div>

          {/* カレンダー */}
          {showCalendar && (
            <div style={sectionStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={sectionTitleStyle}>カレンダー</div>
                <div style={{ color: "#64748b", fontWeight: 800, fontSize: "12px" }}>
                  個人閲覧 / 塾・編集（先生）
                </div>
              </div>

              <CalendarBoard ownerUserId={ownerUserId} permissions={calendarPermissions} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
