// src/components/StudentStudyLogs.tsx
// Responsibility: 勉強時間の記録（科目＋時間＋日付）
// - editable=true  : 生徒用（入力フォーム＋日別合計＋内訳）
// - editable=false : 先生用（閲覧のみ・日別合計＋内訳）

import { Fragment, useEffect, useMemo, useState } from "react";
import { useStudySubjects } from "../hooks/useStudySubjects";
import { supabase } from "../lib/supabase";

type Props = {
  userId: string;
  editable?: boolean;
};

type StudyLog = {
  id: string;
  subject: string;
  subject_id: string | null;
  minutes: number;
  studied_at: string; // YYYY-MM-DD
  memo: string | null;
  created_at: string;
};

type DayGroup = {
  date: string;
  totalMinutes: number;
  logs: StudyLog[];
};

export default function StudentStudyLogs({ userId, editable = true }: Props) {
  const [logs, setLogs] = useState<StudyLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 入力フォーム
  const { subjects: masterSubjects } = useStudySubjects("junior");
  const [subjectId, setSubjectId] = useState<string>("");
  const [hours, setHours] = useState<string>("1");
  const [studiedAt, setStudiedAt] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState("");

  const [openDates, setOpenDates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!subjectId && masterSubjects.length > 0) {
      const other = masterSubjects.find((s) => s.name === "その他");
      setSubjectId(other?.id ?? masterSubjects[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterSubjects]);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("study_logs")
        .select("id, subject, subject_id, minutes, studied_at, memo, created_at")
        .eq("user_id", userId)
        .order("studied_at", { ascending: false })
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error("❌ load study_logs:", error.message);
        setError("勉強記録の読み込みに失敗しました。");
      } else {
        setLogs((data ?? []) as StudyLog[]);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const groupedByDay: DayGroup[] = useMemo(() => {
    const map: Record<string, StudyLog[]> = {};
    for (const log of logs) {
      (map[log.studied_at] ??= []).push(log);
    }

    const groups: DayGroup[] = Object.entries(map).map(([date, items]) => {
      const totalMinutes = items.reduce((sum, l) => sum + l.minutes, 0);
      const sorted = [...items].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      return { date, totalMinutes, logs: sorted };
    });

    groups.sort((a, b) => (a.date < b.date ? 1 : -1));
    return groups;
  }, [logs]);

  const subjectNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of masterSubjects) map[s.id] = s.name;
    return map;
  }, [masterSubjects]);

  function toggleDate(date: string) {
    setOpenDates((prev) => ({ ...prev, [date]: !prev[date] }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editable) return;

    setError(null);

    if (!subjectId) {
      setError("科目を選択してください。");
      return;
    }

    const subjectName = subjectNameMap[subjectId] ?? "その他";

    const h = Number(hours);
    if (!Number.isFinite(h) || h <= 0) {
      setError("時間は 0 より大きい数値で入力してください。");
      return;
    }
    const minutes = Math.round(h * 60);

    if (!studiedAt) {
      setError("学習日を選択してください。");
      return;
    }

    setSaving(true);

    const { data, error } = await supabase
      .from("study_logs")
      .insert({
        user_id: userId,
        subject_id: subjectId,
        subject: subjectName,
        minutes,
        studied_at: studiedAt,
        memo: memo.trim() || null,
      })
      .select("id, subject, subject_id, minutes, studied_at, memo, created_at")
      .single();

    if (error) {
      console.error("❌ insert study_logs:", error.message);
      setError("勉強記録の保存に失敗しました。");
      setSaving(false);
      return;
    }

    if (data) {
      setLogs((prev) => [data as StudyLog, ...prev]);
      setHours("1");
      setMemo("");
      setOpenDates((prev) => ({ ...prev, [(data as StudyLog).studied_at]: true }));
    }

    setSaving(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* 入力 */}
      {editable && (
        <div style={innerCard()}>
          <div style={innerHead()}>
            <div style={innerTitle()}>今日の勉強を記録する</div>
            <div style={innerSub()}>科目・時間・日付</div>
          </div>

          <form onSubmit={handleSave} style={{ display: "grid", gap: 12 }}>
            <div style={grid3()}>
              <div style={{ minWidth: 0 }}>
                <div style={label()}>科目</div>
                <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={input()}>
                  {masterSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <div style={{ marginTop: 6, fontSize: 11, fontWeight: 800, color: "#64748b" }}>
                  ※今は中学主要教科＋その他（固定）
                </div>
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={label()}>時間（時間単位）</div>
                <input
                  type="number"
                  min={0.25}
                  step={0.25}
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  style={input()}
                />
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={label()}>日付</div>
                <input
                  type="date"
                  value={studiedAt}
                  onChange={(e) => setStudiedAt(e.target.value)}
                  style={input()}
                />
              </div>
            </div>

            <div>
              <div style={label()}>メモ（任意）</div>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="例: 過去問○年分、ワークP.50〜60 など"
                style={{ ...input(), minHeight: 90, resize: "vertical" }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button type="submit" disabled={saving} style={primaryBtn(saving)}>
                {saving ? "保存中..." : "記録する"}
              </button>
              {error && <div style={{ fontSize: 12, fontWeight: 900, color: "#dc2626" }}>{error}</div>}
            </div>
          </form>
        </div>
      )}

      {/* 履歴 */}
      <div style={innerCard()}>
        <div style={innerHead()}>
          <div style={innerTitle()}>{editable ? "過去の勉強記録" : "勉強記録（閲覧）"}</div>
          <div style={innerSub()}>日付をクリックで内訳</div>
        </div>

        {loading ? (
          <div style={muted()}>読み込み中...</div>
        ) : groupedByDay.length === 0 ? (
          <div style={muted()}>まだ勉強記録がありません。</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {groupedByDay.map((group) => {
              const isOpen = openDates[group.date] ?? false;
              return (
                <Fragment key={group.date}>
                  <button type="button" onClick={() => toggleDate(group.date)} style={dayRow(isOpen)}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                      <div style={{ fontWeight: 900, color: "#0f172a" }}>{group.date}</div>
                      <div style={{ fontWeight: 900, color: "#1d4ed8" }}>
                        {(group.totalMinutes / 60).toFixed(2)} h
                      </div>
                    </div>
                    <div style={{ marginTop: 4, ...muted() }}>
                      {isOpen ? "クリックして閉じる" : "クリックして内訳を表示"}
                    </div>
                  </button>

                  {isOpen && (
                    <div style={detailBox()}>
                      <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>
                        内訳
                      </div>
                      <div style={{ display: "grid", gap: 8 }}>
                        {group.logs.map((log) => (
                          <div key={log.id} style={logItem()}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                              <div style={{ fontWeight: 900, color: "#0f172a" }}>
                                {log.subject_id
                                  ? subjectNameMap[log.subject_id] ?? log.subject ?? "（不明）"
                                  : log.subject ?? "（不明）"}
                              </div>
                              <div style={{ fontWeight: 900, color: "#1d4ed8" }}>
                                {(log.minutes / 60).toFixed(2)} h
                              </div>
                            </div>
                            {log.memo && (
                              <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: "#64748b" }}>
                                {log.memo}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== styles ===== */

function innerCard(): React.CSSProperties {
  return {
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(255,255,255,0.92)",
    padding: 14,
  };
}

function innerHead(): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "baseline",
    marginBottom: 12,
  };
}

function innerTitle(): React.CSSProperties {
  return { fontSize: 14, fontWeight: 900, color: "#0f172a" };
}

function innerSub(): React.CSSProperties {
  return { fontSize: 12, fontWeight: 900, color: "#64748b" };
}

function grid3(): React.CSSProperties {
  return {
    display: "grid",
    gap: 10,
    gridTemplateColumns: "1fr",
  };
}

function label(): React.CSSProperties {
  return { fontSize: 12, fontWeight: 900, color: "#0f172a", marginBottom: 6 };
}

function input(): React.CSSProperties {
  return {
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
    border: "1px solid rgba(148,163,184,0.30)",
    borderRadius: 14,
    padding: "12px 14px",
    fontSize: 14,
    fontWeight: 800,
    outline: "none",
    background: "rgba(255,255,255,0.96)",
  };
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    border: "none",
    backgroundColor: "#60a5fa",
    color: "#ffffff",
    borderRadius: 9999,
    padding: "10px 16px",
    fontWeight: 900,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.6 : 1,
    boxShadow: "0 10px 20px rgba(37, 99, 235, 0.18)",
  };
}

function muted(): React.CSSProperties {
  return { fontSize: 12, fontWeight: 900, color: "#64748b" };
}

function dayRow(open: boolean): React.CSSProperties {
  return {
    width: "100%",
    textAlign: "left",
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.18)",
    background: open
      ? "linear-gradient(180deg, rgba(239,246,255,0.80), rgba(255,255,255,0.96))"
      : "rgba(255,255,255,0.96)",
    padding: 12,
    cursor: "pointer",
  };
}

function detailBox(): React.CSSProperties {
  return {
    marginTop: -4,
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(248,250,252,0.92)",
    padding: 12,
  };
}

function logItem(): React.CSSProperties {
  return {
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(255,255,255,0.96)",
    padding: 10,
  };
}
