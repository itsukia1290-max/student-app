// src/components/StudentGoals.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  userId: string;
  editable: boolean;
};

type PeriodType = "week" | "month";

type Goal = {
  id: string;
  user_id: string;
  kind: string;                 // ★ 追加（DB実態）
  text: string | null;          // ★ title → text
  detail: string | null;
  period_type: PeriodType;
  period_key: string;
  period_start: string | null;  // DBにあるので持っておく（任意）
  period_end: string | null;    // DBにあるので持っておく（任意）
  created_at: string;
  updated_at: string;
};

// ISO週番号（簡易）
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

export default function StudentGoals({ userId, editable }: Props) {
  const [periodType, setPeriodType] = useState<PeriodType>("week");

  const currentKey = useMemo(
    () => (periodType === "week" ? getCurrentWeekKey(new Date()) : getCurrentMonthKey(new Date())),
    [periodType]
  );

  const [currentGoal, setCurrentGoal] = useState<Goal | null>(null);
  const [history, setHistory] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [text, setText] = useState("");     // ★ title → text
  const [detail, setDetail] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setMsg(null);

      const { data: cur, error: errCur } = await supabase
        .from("student_goals")
        .select("id,user_id,kind,text,detail,period_type,period_key,period_start,period_end,created_at,updated_at")
        .eq("user_id", userId)
        .eq("period_type", periodType)
        .eq("period_key", currentKey)
        .maybeSingle();

      if (!cancelled) {
        if (errCur) {
          console.error("❌ load current goal:", errCur.message);
          setMsg("目標の読み込みに失敗しました: " + errCur.message);
        }

        if (cur) {
          const g = cur as Goal;
          setCurrentGoal(g);
          setText(g.text ?? "");
          setDetail(g.detail ?? "");
        } else {
          setCurrentGoal(null);
          setText("");
          setDetail("");
        }
      }

      const { data: hist, error: errHist } = await supabase
        .from("student_goals")
        .select("id,user_id,kind,text,detail,period_type,period_key,period_start,period_end,created_at,updated_at")
        .eq("user_id", userId)
        .eq("period_type", periodType)
        .neq("period_key", currentKey)
        .order("period_key", { ascending: false })
        .limit(10);

      if (!cancelled) {
        if (errHist) console.error("❌ load history goals:", errHist.message);
        setHistory((hist ?? []) as Goal[]);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId, periodType, currentKey]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editable) return;

    setSaving(true);
    setMsg(null);

    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from("student_goals")
      .upsert(
        {
          id: currentGoal?.id,
          user_id: userId,
          kind: "goal",                 // ★ これが必須：CHECK制約を通す
          period_type: periodType,
          period_key: currentKey,
          text: text.trim() || null,    // ★ title → text
          detail: detail.trim() || null,
          created_at: currentGoal?.created_at ?? nowIso,
          updated_at: nowIso,
        },
        { onConflict: "user_id,period_type,period_key" }
      )
      .select()
      .maybeSingle();

    if (error) {
      console.error("❌ save goal:", error.message);
      setMsg("保存に失敗しました: " + error.message);
    } else {
      setCurrentGoal((data as Goal) ?? null);
      setMsg("保存しました。");
    }

    setSaving(false);
  }

  const label = labelOfPeriod(periodType, currentKey);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Pill active={periodType === "week"} onClick={() => setPeriodType("week")}>週目標</Pill>
        <Pill active={periodType === "month"} onClick={() => setPeriodType("month")}>月目標</Pill>
      </div>

      <div style={panel()}>
        <div style={panelHead()}>
          <div style={panelTitle()}>現在の目標</div>
          <div style={panelSub()}>現在の期間: {label}</div>
        </div>

        {loading ? (
          <div style={muted()}>読み込み中...</div>
        ) : (
          <form onSubmit={onSave} style={{ display: "grid", gap: 10 }}>
            {editable && !currentGoal && (
              <div style={warn()}>
                まだこの期間の目標が未設定です。入力して「保存」すると作成されます。
              </div>
            )}

            <div>
              <div style={fieldLabel()}>一言目標</div>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={!editable}
                placeholder="例：英単語を毎日100語"
                style={input()}
              />
            </div>

            <div>
              <div style={fieldLabel()}>詳細・振り返りメモ</div>
              <textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                disabled={!editable}
                placeholder="例：今週は○○ができた / 来週は△△を改善"
                style={textarea()}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, alignItems: "center" }}>
              {msg && <div style={{ ...muted(), marginRight: "auto" }}>{msg}</div>}
              {editable && (
                <button type="submit" disabled={saving} style={primaryBtn()}>
                  {saving ? "保存中..." : "保存"}
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      <div style={panel()}>
        <div style={panelHead()}>
          <div style={panelTitle()}>過去の目標（直近10件）</div>
          <div style={panelSub()}>期間タイプ: {periodType === "week" ? "週" : "月"}</div>
        </div>

        {loading ? (
          <div style={muted()}>読み込み中...</div>
        ) : history.length === 0 ? (
          <div style={muted()}>過去の目標はまだありません。</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {history.map((g) => (
              <div key={g.id} style={item()}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontWeight: 900, color: "#0f172a" }}>
                    {labelOfPeriod(g.period_type, g.period_key)}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 900, color: "#94a3b8" }}>
                    更新: {new Date(g.updated_at).toLocaleString()}
                  </div>
                </div>

                {g.text && (
                  <div style={{ marginTop: 6, fontWeight: 800, color: "#0f172a" }}>
                    <span style={{ color: "#1d4ed8" }}>目標：</span>
                    {g.text}
                  </div>
                )}

                {g.detail && (
                  <div style={{ marginTop: 6, fontSize: 13, fontWeight: 800, color: "#334155", whiteSpace: "pre-wrap" }}>
                    <span style={{ color: "#1d4ed8" }}>メモ：</span>
                    {g.detail}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- styles (元のまま) ---
function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: "1px solid rgba(148,163,184,0.22)",
        background: active ? "rgba(59,130,246,0.14)" : "rgba(255,255,255,0.85)",
        color: active ? "#1d4ed8" : "#0f172a",
        borderRadius: 9999,
        padding: "10px 14px",
        fontWeight: 900,
        fontSize: 13,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
function panel(): React.CSSProperties {
  return { borderRadius: 18, border: "1px solid rgba(148, 163, 184, 0.18)", background: "rgba(255,255,255,0.88)", padding: 14 };
}
function panelHead(): React.CSSProperties {
  return { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", marginBottom: 10 };
}
function panelTitle(): React.CSSProperties {
  return { fontSize: 14, fontWeight: 900, color: "#0f172a" };
}
function panelSub(): React.CSSProperties {
  return { fontSize: 12, fontWeight: 900, color: "#64748b" };
}
function muted(): React.CSSProperties {
  return { fontSize: 13, fontWeight: 800, color: "#64748b" };
}
function warn(): React.CSSProperties {
  return { border: "1px solid rgba(245,158,11,0.35)", background: "rgba(255,251,235,0.85)", color: "#92400e", borderRadius: 14, padding: 10, fontWeight: 900, fontSize: 12 };
}
function fieldLabel(): React.CSSProperties {
  return { fontSize: 12, fontWeight: 900, color: "#0f172a", marginBottom: 6 };
}
function input(): React.CSSProperties {
  return { width: "100%", border: "1px solid rgba(148,163,184,0.30)", borderRadius: 14, padding: "12px 14px", fontSize: 14, fontWeight: 800, outline: "none", background: "rgba(255,255,255,0.95)" };
}
function textarea(): React.CSSProperties {
  return { ...input(), minHeight: 110, resize: "vertical" };
}
function primaryBtn(): React.CSSProperties {
  return { border: "none", backgroundColor: "#60a5fa", color: "#ffffff", borderRadius: 9999, padding: "10px 16px", fontWeight: 900, cursor: "pointer", boxShadow: "0 10px 20px rgba(37, 99, 235, 0.18)" };
}
function item(): React.CSSProperties {
  return { borderRadius: 16, border: "1px solid rgba(148,163,184,0.18)", background: "linear-gradient(180deg, rgba(239,246,255,0.6), rgba(255,255,255,0.95))", padding: 12 };
}
