// src/components/StudentGrades.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Mark = "O" | "X" | "D" | "";

type GradeRow = {
  id: string;
  user_id: string;
  title: string;
  problem_count: number;
  marks: Mark[];
  created_at: string;
  updated_at: string;
};

type Props = {
  userId: string;
  editable?: boolean; // 生徒: false / 教師: true
};

export default function StudentGrades({ userId, editable = false }: Props) {
  const [rows, setRows] = useState<GradeRow[]>([]);
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});

  async function load() {
    if (!userId) return;
    const { data, error } = await supabase
      .from("student_grades")
      .select("id,user_id,title,problem_count,marks,created_at,updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("❌ load grades:", error.message);
      return;
    }

    const mapped: GradeRow[] = ((data ?? []) as unknown as Array<{
      id: string;
      user_id: string;
      title: string;
      problem_count: number;
      marks: unknown;
      created_at: string;
      updated_at: string;
    }>).map((r) => {
      const raw = Array.isArray(r.marks) ? (r.marks as unknown[]) : [];
      const marks: Mark[] = raw.map((m) => (m === "O" || m === "X" || m === "D" ? (m as Mark) : ""));
      return {
        id: r.id,
        user_id: r.user_id,
        title: r.title,
        problem_count: r.problem_count,
        marks,
        created_at: r.created_at,
        updated_at: r.updated_at,
      };
    });

    setRows(mapped);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function addWorkbook() {
    if (!editable) return;
    const title = window.prompt("問題集の名前は？（例：英文法Vintage）");
    if (!title) return;
    const numStr = window.prompt("問題数は？（1〜1000）");
    if (!numStr) return;

    const n = Number(numStr);
    if (!Number.isInteger(n) || n <= 0 || n > 1000) {
      alert("1〜1000の整数で指定してください。");
      return;
    }

    const marks: Mark[] = Array(n).fill("");

    const { data, error } = await supabase
      .from("student_grades")
      .insert([{ user_id: userId, title, problem_count: n, marks }])
      .select("id,user_id,title,problem_count,marks,created_at,updated_at")
      .single();

    if (error) {
      alert("追加失敗: " + error.message);
      return;
    }

    const row = data as unknown as GradeRow;
    row.marks = (Array.isArray(row.marks) ? row.marks : []).map((m) => (m === "O" || m === "X" || m === "D" ? (m as Mark) : ""));
    setRows((prev) => [...prev, row]);
  }

  function setMarkLocal(rowId: string, idx: number, next: Mark) {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, marks: r.marks.map((m, i) => (i === idx ? next : m)) } : r))
    );
  }

  async function saveRow(row: GradeRow) {
    if (!editable) return;
    setSavingIds((s) => ({ ...s, [row.id]: true }));

    const { error } = await supabase.from("student_grades").update({ marks: row.marks }).eq("id", row.id);

    setSavingIds((s) => {
      const rest = Object.fromEntries(Object.entries(s).filter(([key]) => key !== row.id));
      return rest;
    });

    if (error) alert("保存失敗: " + error.message);
  }

  async function deleteRow(row: GradeRow) {
    if (!editable) return;
    if (!confirm(`「${row.title}」を削除します。よろしいですか？`)) return;

    const { error } = await supabase.from("student_grades").delete().eq("id", row.id);
    if (error) {
      alert("削除失敗: " + error.message);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  }

  function cycleMark(cur: Mark): Mark {
    if (cur === "") return "O";
    if (cur === "O") return "X";
    if (cur === "X") return "D";
    return "";
  }

  function summarize(marks: Mark[]) {
    let o = 0,
      x = 0,
      d = 0,
      blank = 0;
    for (const m of marks) {
      if (m === "O") o++;
      else if (m === "X") x++;
      else if (m === "D") d++;
      else blank++;
    }
    return { o, x, d, blank };
  }

  const empty = useMemo(() => rows.length === 0, [rows]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>問題集の成績</div>
        {editable && (
          <button onClick={addWorkbook} style={ghostBtn()}>
            ＋ 追加（教師）
          </button>
        )}
      </div>

      {empty ? (
        <div style={muted()}>登録された問題集はありません。</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {rows.map((row) => {
            const s = summarize(row.marks);
            const saving = !!savingIds[row.id];

            return (
              <div key={row.id} style={panel()}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 14 }}>{row.title}</div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginTop: 4 }}>
                      {row.problem_count}問 / O:{s.o} X:{s.x} △:{s.d} 未:{s.blank}
                    </div>
                  </div>

                  {editable && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => saveRow(row)} disabled={saving} style={ghostBtn()}>
                        {saving ? "保存中..." : "保存"}
                      </button>
                      <button onClick={() => deleteRow(row)} style={dangerBtn()}>
                        削除
                      </button>
                    </div>
                  )}
                </div>

                <div
                  style={{
                    marginTop: 12,
                    display: "grid",
                    gridTemplateColumns: "repeat(8, minmax(0, 1fr))",
                    gap: 8,
                  }}
                >
                  {row.marks.map((m, i) => {
                    const clickable = editable;
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={!editable}
                        onClick={() => clickable && setMarkLocal(row.id, i, cycleMark(m))}
                        style={markTile(m, clickable)}
                        title={`#${i + 1}`}
                      >
                        {m || `${i + 1}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function muted(): React.CSSProperties {
  return { fontSize: 13, fontWeight: 800, color: "#64748b" };
}

function panel(): React.CSSProperties {
  return {
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(255,255,255,0.90)",
    padding: 14,
  };
}

function ghostBtn(): React.CSSProperties {
  return {
    border: "1px solid rgba(148,163,184,0.22)",
    background: "rgba(255,255,255,0.9)",
    borderRadius: 9999,
    padding: "8px 12px",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
    color: "#0f172a",
  };
}

function dangerBtn(): React.CSSProperties {
  return {
    ...ghostBtn(),
    color: "#dc2626",
    borderColor: "rgba(220,38,38,0.30)",
    background: "rgba(254,242,242,0.90)",
  };
}

function markTile(m: "O" | "X" | "D" | "", clickable: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    height: 40,
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.22)",
    background: "rgba(255,255,255,0.95)",
    fontWeight: 900,
    cursor: clickable ? "pointer" : "default",
    userSelect: "none",
  };

  if (m === "O") return { ...base, background: "rgba(34,197,94,0.18)", color: "#166534", borderColor: "rgba(34,197,94,0.28)" };
  if (m === "X") return { ...base, background: "rgba(239,68,68,0.14)", color: "#991b1b", borderColor: "rgba(239,68,68,0.24)" };
  if (m === "D") return { ...base, background: "rgba(245,158,11,0.16)", color: "#92400e", borderColor: "rgba(245,158,11,0.28)" };
  return base;
}
