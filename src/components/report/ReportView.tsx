// src/components/report/ReportView.tsx
//
// Responsibility:
// - Report画面の「共通レイアウト」(カード/セクション/余白/見出し) を統一
// - 学習推移/目標(週・月)/成績/カレンダー/学習ログ入力 を組み合わせて表示
//
// NOTE:
// - 目標は MyPage の StudentGoals と同じ "student_goals" スキーマを使う
//   (user_id, period_type, period_key, title, detail)

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

import CalendarBoard from "../CalendarBoard";
import type { CalendarPermissions } from "../CalendarBoard";
import StudentGrades from "../StudentGrades";
import Button from "../ui/Button";
import Input, { Textarea } from "../ui/Input";

// ★ 学習サマリ（MyPageから移植）
import StudentDashboardSummary from "../StudentDashboardSummary";

const GOALS_TABLE = "student_goals";
const STUDY_LOGS_TABLE = "study_logs";

type Mode = "student" | "teacher";
type PeriodType = "week" | "month";

type Props = {
  ownerUserId: string; // 生徒本人 or 先生が閲覧している対象生徒
  mode: Mode;

  showTimeline?: boolean;
  showGrades?: boolean;
  showCalendar?: boolean;

  calendarPermissions: CalendarPermissions;
  canEditGoals?: boolean; // 生徒本人のみ true 推奨
};

type StudyLogRow = {
  id: string;
  user_id: string;
  subject: string;
  minutes: number;
  studied_at: string; // date: "YYYY-MM-DD"
  memo: string | null;
  created_at: string;
};

type GoalRow = {
  id: string;
  user_id: string;
  period_type: PeriodType;
  period_key: string; // "2026-W03" or "2026-01"
  title: string | null;
  detail: string | null;
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

// ISO 週番号（StudentGoals.tsx と同じ）
function getISOWeek(date: Date): number {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return weekNo;
}
function getCurrentWeekKey(now = new Date()): string {
  const year = now.getFullYear();
  const week = getISOWeek(now);
  return `${year}-W${String(week).padStart(2, "0")}`;
}
function getCurrentMonthKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}
function labelOfPeriod(type: PeriodType, key: string): string {
  if (type === "week") {
    const [y, w] = key.split("-W");
    return `${y}年第${parseInt(w ?? "0", 10)}週`;
  } else {
    const [y, m] = key.split("-");
    return `${y}年${parseInt(m ?? "0", 10)}月`;
  }
}

// 月曜始まり（実績集計用：study_logs は date 文字列なので比較でOK）
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
  const weekKey = useMemo(() => getCurrentWeekKey(new Date()), []);
  const monthKey = useMemo(() => getCurrentMonthKey(new Date()), []);

  const [tab, setTab] = useState<"record" | "timeline">("record");

  // study_logs
  const [logs, setLogs] = useState<StudyLogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // goals (MyPage 방식)
  const [weekGoal, setWeekGoal] = useState<GoalRow | null>(null);
  const [monthGoal, setMonthGoal] = useState<GoalRow | null>(null);
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

    const [wRes, mRes] = await Promise.all([
      supabase
        .from(GOALS_TABLE)
        .select("*")
        .eq("user_id", ownerUserId)
        .eq("period_type", "week")
        .eq("period_key", weekKey)
        .maybeSingle(),
      supabase
        .from(GOALS_TABLE)
        .select("*")
        .eq("user_id", ownerUserId)
        .eq("period_type", "month")
        .eq("period_key", monthKey)
        .maybeSingle(),
    ]);

    if (wRes.error) console.error("❌ load week goal:", wRes.error.message);
    if (mRes.error) console.error("❌ load month goal:", mRes.error.message);

    setWeekGoal((wRes.data as GoalRow) ?? null);
    setMonthGoal((mRes.data as GoalRow) ?? null);

    setGoalsLoading(false);
  }

  useEffect(() => {
    loadLogs();
    loadGoals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerUserId]);

  // 実績（study_logs 集計）
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

  // （任意）進捗バーは「数値目標」が無いので、ここでは “実績だけ” にする。
  // ただし「目標文に 10時間 とか書いてある」場合もあるので、バーは出さない方が安全。

  async function upsertTextGoal(periodType: PeriodType) {
    if (!ownerUserId) return;
    if (!canEditGoals) return;

    const key = periodType === "week" ? weekKey : monthKey;
    const current = periodType === "week" ? weekGoal : monthGoal;

    const currentTitle = current?.title ?? "";
    const currentDetail = current?.detail ?? "";

    const title = window.prompt(
      `${periodType === "week" ? "週" : "月"}目標（ひとこと）を入力してください`,
      currentTitle
    );
    if (title == null) return;

    const detail = window.prompt(
      `詳細・振り返りメモ（任意）`,
      currentDetail
    );
    if (detail == null) return;

    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from(GOALS_TABLE)
      .upsert(
        {
          id: current?.id,
          user_id: ownerUserId,
          period_type: periodType,
          period_key: key,
          title: title.trim() || null,
          detail: detail.trim() || null,
          created_at: current?.created_at ?? nowIso,
          updated_at: nowIso,
        },
        { onConflict: "user_id,period_type,period_key" }
      )
      .select()
      .maybeSingle();

    if (error) {
      alert("目標の保存に失敗: " + error.message);
      return;
    }

    const saved = (data as GoalRow) ?? null;
    if (periodType === "week") setWeekGoal(saved);
    else setMonthGoal(saved);
  }

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

  // タイトル→タブを縦並び
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

  const TopTab = ({
    active,
    label,
    onClick,
  }: {
    active: boolean;
    label: string;
    onClick: () => void;
  }) => (
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
    backgroundColor: "rgba(255,255,255,0.75)",
    border: "1px solid rgba(148,163,184,0.20)",
    borderRadius: "999px",
    padding: "8px 10px",
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
    whiteSpace: "nowrap",
  };

  function GoalCard({
    periodType,
    goal,
    actualMinutes,
  }: {
    periodType: PeriodType;
    goal: GoalRow | null;
    actualMinutes: number;
  }) {
    const label = labelOfPeriod(periodType, periodType === "week" ? weekKey : monthKey);
    const title = goal?.title?.trim() || "";
    const detail = goal?.detail?.trim() || "";

    return (
      <SoftCard
        title={periodType === "week" ? "週間目標" : "月間目標"}
        right={
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <div style={subtleRightStyle}>{title ? `目標: ${title}` : "未設定"}</div>
            {canEditGoals && (
              <button
                onClick={() => upsertTextGoal(periodType)}
                style={{
                  border: "1px solid rgba(59,130,246,0.22)",
                  background:
                    "linear-gradient(180deg, rgba(96,165,250,0.90), rgba(59,130,246,0.90))",
                  color: "#ffffff",
                  borderRadius: "999px",
                  padding: "10px 14px",
                  fontWeight: 900,
                  cursor: "pointer",
                  boxShadow: "0 14px 28px rgba(59,130,246,0.18)",
                }}
              >
                編集
              </button>
            )}
          </div>
        }
      >
        <div style={{ color: "#64748b", fontSize: "12px", fontWeight: 900, marginBottom: 10 }}>
          対象期間: {label}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ color: "#0f172a", fontWeight: 900 }}>
            実績: <span style={{ color: "#1d4ed8" }}>{minutesLabel(actualMinutes)}</span>
          </div>
          {goalsLoading && (
            <div style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 900 }}>
              目標読み込み中...
            </div>
          )}
        </div>

        {title ? (
          <div style={{ marginTop: 10, fontWeight: 900, color: "#0f172a" }}>
            <span style={{ color: "#1d4ed8" }}>目標：</span>
            {title}
          </div>
        ) : (
          <div style={{ marginTop: 10, color: "#64748b", fontSize: "13px", fontWeight: 900 }}>
            目標が未設定です。
          </div>
        )}

        {detail && (
          <div style={{ marginTop: 8, color: "#334155", fontSize: "13px", whiteSpace: "pre-wrap", fontWeight: 800 }}>
            <span style={{ color: "#1d4ed8" }}>メモ：</span>
            {detail}
          </div>
        )}
      </SoftCard>
    );
  }

  return (
    <div style={pageStyle}>
      {/* Header & Tabs */}
      <div style={headerWrapStyle}>
        <div style={headerTitleStyle}>レポート</div>

        <div style={tabHeaderRowStyle}>
          <TopTab active={tab === "record"} label="記録" onClick={() => setTab("record")} />
          {showTimeline && (
            <TopTab
              active={tab === "timeline"}
              label="タイムライン"
              onClick={() => setTab("timeline")}
            />
          )}
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
          {/* 学習推移：外枠(SoftCard)を消して直置き（枠の二重を解消） */}
          <div style={{ marginTop: "2px" }}>
            <StudentDashboardSummary userId={ownerUserId} />
          </div>

          {/* 週間目標（MyPageの文字目標） */}
          <GoalCard periodType="week" goal={weekGoal} actualMinutes={weekMinutes} />

          {/* 月間目標（MyPageの文字目標） */}
          <GoalCard periodType="month" goal={monthGoal} actualMinutes={monthMinutes} />

          {/* 成績 */}
          {showGrades && (
            <SoftCard title="成績（小テスト/問題集）" right={<span style={subtleRightStyle}>既存機能</span>}>
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
