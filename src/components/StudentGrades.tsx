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

/*
 * src/components/StudentGrades.tsx
 * Responsibility: 生徒の問題集・成績表示コンポーネント
 * - `userId` の問題集スコアや成績を一覧表示・編集する
 */

export default function StudentGrades({ userId, editable = false }: Props) {
  const [rows, setRows] = useState<GradeRow[]>([]);
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});

  // ---- 読み込み ----
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

    const rows: GradeRow[] = ((data ?? []) as unknown as Array<{
      id: string;
      user_id: string;
      title: string;
      problem_count: number;
      marks: unknown;
      created_at: string;
      updated_at: string;
    }>).map((r) => {
      const raw = Array.isArray(r.marks) ? (r.marks as unknown[]) : [];
      const marks: Mark[] = raw.map((m) =>
        m === "O" || m === "X" || m === "D" ? (m as Mark) : ""
      );
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

    setRows(rows);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ---- 追加（教師のみ）----
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
    // 念のためマークの整形
    row.marks = (Array.isArray(row.marks) ? row.marks : []).map((m) =>
      m === "O" || m === "X" || m === "D" ? (m as Mark) : ""
    );
    setRows((prev) => [...prev, row]);
  }

  // ---- ローカル更新 & 保存 ----
  function setMarkLocal(rowId: string, idx: number, next: Mark) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? { ...r, marks: r.marks.map((m, i) => (i === idx ? next : m)) }
          : r
      )
    );
  }

  async function saveRow(row: GradeRow) {
    if (!editable) return;
    setSavingIds((s) => ({ ...s, [row.id]: true }));
    const { error } = await supabase
      .from("student_grades")
      .update({ marks: row.marks })
      .eq("id", row.id);
    setSavingIds((s) => {
      const rest = Object.fromEntries(
        Object.entries(s).filter(([key]) => key !== row.id)
      );
      return rest;
    });
    if (error) alert("保存失敗: " + error.message);
  }

  async function deleteRow(row: GradeRow) {
    if (!editable) return;
    if (!confirm(`「${row.title}」を削除します。よろしいですか？`)) return;
    const { error } = await supabase
      .from("student_grades")
      .delete()
      .eq("id", row.id);
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">問題集の成績</h3>
        {editable && (
          <button onClick={addWorkbook} className="text-sm border rounded px-2 py-1">
            ＋ 追加（教師）
          </button>
        )}
      </div>

      {empty ? (
        <p className="text-sm text-gray-500">登録された問題集はありません。</p>
      ) : (
        <div className="space-y-6">
          {rows.map((row) => {
            const s = summarize(row.marks);
            const saving = !!savingIds[row.id];
            return (
              <div key={row.id} className="border rounded-xl bg-white p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{row.title}</div>
                    <div className="text-xs text-gray-500">
                      {row.problem_count}問 / O:{s.o} X:{s.x} △:{s.d} 未:{s.blank}
                    </div>
                  </div>
                  {editable && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveRow(row)}
                        disabled={saving}
                        className="text-sm border rounded px-2 py-1"
                      >
                        {saving ? "保存中..." : "保存"}
                      </button>
                      <button
                        onClick={() => deleteRow(row)}
                        className="text-sm border rounded px-2 py-1 text-red-600"
                      >
                        削除
                      </button>
                    </div>
                  )}
                </div>

                {/* マトリクス */}
                <div className="mt-3 grid grid-cols-8 gap-2">
                  {row.marks.map((m, i) => (
                    <button
                      key={i}
                      type="button"
                      disabled={!editable}
                      onClick={() =>
                        editable && setMarkLocal(row.id, i, cycleMark(m))
                      }
                      className={`h-9 rounded border flex items-center justify-center ${
                        m === "O"
                          ? "bg-green-600 text-white"
                          : m === "X"
                          ? "bg-red-600 text-white"
                          : m === "D"
                          ? "bg-yellow-500 text-white"
                          : "bg-white"
                      } ${editable ? "cursor-pointer" : "cursor-default"}`}
                      title={`#${i + 1}`}
                    >
                      {m || `${i + 1}`}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
