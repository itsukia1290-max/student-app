import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type GoalRow = {
  id: string;
  user_id: string;
  title: string;
  done: boolean;
  created_at: string;
};

type Props = {
  userId: string;
  // 既存の「目標達成バー」があるならここに差し込める
  progressBarSlot?: React.ReactNode;
};

export default function ReportGoalsCard({ userId, progressBarSlot }: Props) {
  const [rows, setRows] = useState<GoalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingText, setAddingText] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!userId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("study_goals")
      .select("id,user_id,title,done,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ load study_goals:", error.message);
      setRows([]);
    } else {
      setRows((data ?? []) as GoalRow[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const progress = useMemo(() => {
    const total = rows.length;
    const done = rows.filter((r) => r.done).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    return { total, done, pct };
  }, [rows]);

  async function addGoal() {
    const t = addingText.trim();
    if (!t) return;

    setSaving(true);
    const { error } = await supabase.from("study_goals").insert({
      user_id: userId,
      title: t,
      done: false,
    });

    if (error) {
      alert("追加失敗: " + error.message);
      setSaving(false);
      return;
    }

    setAddingText("");
    await load();
    setSaving(false);
  }

  async function toggleDone(row: GoalRow) {
    const { error } = await supabase
      .from("study_goals")
      .update({ done: !row.done })
      .eq("id", row.id);

    if (error) {
      alert("更新失敗: " + error.message);
      return;
    }
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, done: !r.done } : r))
    );
  }

  async function remove(row: GoalRow) {
    if (!confirm(`目標「${row.title}」を削除しますか？`)) return;
    const { error } = await supabase.from("study_goals").delete().eq("id", row.id);
    if (error) return alert("削除失敗: " + error.message);
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  }

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 18,
        padding: 14,
      }}
    >
      {/* タイトル行 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontWeight: 900, color: "#0f172a" }}>目標</div>

        <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>
          {progress.done}/{progress.total} 達成（{progress.pct}%）
        </div>
      </div>

      {/* 既存の目標達成バーがあるならここに差し込める */}
      <div style={{ marginTop: 10 }}>
        {progressBarSlot ? (
          progressBarSlot
        ) : (
          <div
            style={{
              height: 10,
              borderRadius: 999,
              background: "#eef2ff",
              overflow: "hidden",
              border: "1px solid #e5e7eb",
            }}
          >
            <div
              style={{
                width: `${progress.pct}%`,
                height: "100%",
                background: "rgba(59,130,246,0.9)",
              }}
            />
          </div>
        )}
      </div>

      {/* ✅ 進捗バーの近くに "目標追加" */}
      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <input
          value={addingText}
          onChange={(e) => setAddingText(e.target.value)}
          placeholder="要約しきれていない問題を目標に追加（例：関係代名詞の使い分けを固める）"
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            outline: "none",
            fontSize: 14,
          }}
        />
        <button
          onClick={addGoal}
          disabled={saving || !addingText.trim()}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: saving ? "#f1f5f9" : "#0f172a",
            color: saving ? "#64748b" : "#fff",
            fontWeight: 900,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          ＋追加
        </button>
      </div>

      {/* リスト */}
      <div style={{ marginTop: 12 }}>
        {loading ? (
          <div style={{ color: "#64748b", fontSize: 13 }}>読み込み中...</div>
        ) : rows.length === 0 ? (
          <div style={{ color: "#64748b", fontSize: 13 }}>
            まだ目標がありません。上の入力欄から追加できます。
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map((r) => (
              <div
                key={r.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 14,
                  padding: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <button
                  onClick={() => toggleDone(r)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      background: r.done ? "rgba(34,197,94,0.18)" : "#fff",
                      display: "grid",
                      placeItems: "center",
                      color: r.done ? "#16a34a" : "#94a3b8",
                      fontWeight: 900,
                      flexShrink: 0,
                    }}
                  >
                    {r.done ? "✓" : ""}
                  </span>

                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 900,
                      color: "#0f172a",
                      textDecoration: r.done ? "line-through" : "none",
                      opacity: r.done ? 0.6 : 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={r.title}
                  >
                    {r.title}
                  </span>
                </button>

                <button
                  onClick={() => remove(r)}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    padding: "6px 10px",
                    background: "#fff",
                    color: "#ef4444",
                    fontWeight: 900,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
