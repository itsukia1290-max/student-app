// src/components/StudentGrades.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Mark = "O" | "X" | "D" | "";
type Mode = "view" | "select";

type GradeRow = {
  id: string;
  user_id: string;
  title: string;
  problem_count: number;
  marks: Mark[];
  created_at: string;
  updated_at: string;
};

type NoteRow = {
  id: string;
  grade_id: string;
  start_idx: number;
  end_idx: number;
  note: string;
  created_at: string;
  updated_at: string;
};

type Props = {
  userId: string;
  editable?: boolean; // 生徒: false / 教師: true
};

const MARK_LABEL: Record<Mark, string> = { "": "", O: "○", X: "×", D: "△" };

export default function StudentGrades({ userId, editable = false }: Props) {
  const [rows, setRows] = useState<GradeRow[]>([]);
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});

  // selection per grade
  const [mode, setMode] = useState<Record<string, Mode>>({});
  const [selected, setSelected] = useState<Record<string, Set<number>>>({});
  const [lastIdx, setLastIdx] = useState<Record<string, number | null>>({});

  // notes per grade
  const [notesByGrade, setNotesByGrade] = useState<Record<string, NoteRow[]>>({});
  const [noteSaving, setNoteSaving] = useState<Record<string, boolean>>({}); // note_id => saving
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({}); // note_id => draft text

  async function loadGrades() {
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

    // selection/notes state init（gradeが消えた時の掃除）
    setMode((prev) => {
      const next: Record<string, Mode> = {};
      for (const g of mapped) next[g.id] = prev[g.id] ?? "view";
      return next;
    });
    setSelected((prev) => {
      const next: Record<string, Set<number>> = {};
      for (const g of mapped) next[g.id] = prev[g.id] ?? new Set();
      return next;
    });
    setLastIdx((prev) => {
      const next: Record<string, number | null> = {};
      for (const g of mapped) next[g.id] = prev[g.id] ?? null;
      return next;
    });

    // notesも一括で読み込み
    await loadNotesForGrades(mapped.map((g) => g.id));
  }

  async function loadNotesForGrades(gradeIds: string[]) {
    if (gradeIds.length === 0) return;
    const { data, error } = await supabase
      .from("student_grade_notes")
      .select("id,grade_id,start_idx,end_idx,note,created_at,updated_at")
      .in("grade_id", gradeIds)
      .order("start_idx", { ascending: true })
      .order("end_idx", { ascending: true });

    if (error) {
      // notes未導入の段階だとここが失敗するので、consoleに留める
      console.warn("⚠️ load notes:", error.message);
      return;
    }

    const by: Record<string, NoteRow[]> = {};
    for (const g of gradeIds) by[g] = [];
    for (const r of (data ?? []) as NoteRow[]) {
      (by[r.grade_id] ??= []).push(r);
    }
    setNotesByGrade(by);

    // draft初期化
    setNoteDraft((prev) => {
      const next = { ...prev };
      for (const r of (data ?? []) as NoteRow[]) {
        if (next[r.id] == null) next[r.id] = r.note ?? "";
      }
      return next;
    });
  }

  useEffect(() => {
    loadGrades();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ---------- grade CRUD ----------
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
    row.marks = (Array.isArray(row.marks) ? (row.marks as unknown[]) : []).map((m) => (m === "O" || m === "X" || m === "D" ? (m as Mark) : ""));
    setRows((prev) => [...prev, row]);

    // notes state init
    setNotesByGrade((p) => ({ ...p, [row.id]: [] }));
    setMode((p) => ({ ...p, [row.id]: "view" }));
    setSelected((p) => ({ ...p, [row.id]: new Set() }));
    setLastIdx((p) => ({ ...p, [row.id]: null }));
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

    setNotesByGrade((p) => {
      const next = { ...p };
      delete next[row.id];
      return next;
    });
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

  // ---------- selection ----------
  function clearSelection(rowId: string) {
    setSelected((p) => ({ ...p, [rowId]: new Set() }));
    setLastIdx((p) => ({ ...p, [rowId]: null }));
  }

  function selectedRange(rowId: string): { start: number; end: number } | null {
    const s = selected[rowId];
    if (!s || s.size === 0) return null;
    const arr = Array.from(s.values()).sort((a, b) => a - b);
    return { start: arr[0], end: arr[arr.length - 1] };
  }

  function onTileClick(e: React.MouseEvent, row: GradeRow, idx: number) {
    if (!editable) return;

    const isSelectMode = (mode[row.id] ?? "view") === "select";
    if (!isSelectMode) {
      setMarkLocal(row.id, idx, cycleMark(row.marks[idx]));
      return;
    }

    const isShift = e.shiftKey;
    const isCtrl = e.ctrlKey || e.metaKey;
    const last = lastIdx[row.id];

    setSelected((prev) => {
      const next = { ...prev };
      const set = new Set(next[row.id] ?? []);

      if (isShift && last != null) {
        const [lo, hi] = last < idx ? [last, idx] : [idx, last];
        for (let i = lo; i <= hi; i++) set.add(i);
      } else if (isCtrl) {
        if (set.has(idx)) set.delete(idx);
        else set.add(idx);
      } else {
        set.clear();
        set.add(idx);
      }

      next[row.id] = set;
      return next;
    });

    setLastIdx((prev) => ({ ...prev, [row.id]: idx }));
  }

  function applyMark(rowId: string, mark: Mark) {
    const sel = selected[rowId];
    if (!sel || sel.size === 0) return;

    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const nextMarks = r.marks.map((m, i) => (sel.has(i) ? mark : m));
        return { ...r, marks: nextMarks };
      })
    );
  }

  // ---------- notes CRUD ----------
  async function addNoteFromSelection(row: GradeRow) {
    if (!editable) return;

    const range = selectedRange(row.id);
    if (!range) {
      alert("範囲を選択してから「備考追加」を押してください。");
      return;
    }

    const text = window.prompt(`備考を入力（#${range.start + 1}〜#${range.end + 1}）`);
    if (text == null) return;

    const payload = {
      grade_id: row.id,
      start_idx: range.start,
      end_idx: range.end,
      note: text,
    };

    const { data, error } = await supabase
      .from("student_grade_notes")
      .insert([payload])
      .select("id,grade_id,start_idx,end_idx,note,created_at,updated_at")
      .single();

    if (error) {
      alert("備考追加失敗: " + error.message);
      return;
    }

    const newRow = data as NoteRow;
    setNotesByGrade((p) => {
      const list = [...(p[row.id] ?? []), newRow].sort((a, b) => a.start_idx - b.start_idx || a.end_idx - b.end_idx);
      return { ...p, [row.id]: list };
    });
    setNoteDraft((p) => ({ ...p, [newRow.id]: newRow.note ?? "" }));

    // 追加したら選択は解除（誤操作防止）
    clearSelection(row.id);
    setMode((p) => ({ ...p, [row.id]: "view" }));
  }

  async function saveNote(note: NoteRow) {
    if (!editable) return;
    const draft = noteDraft[note.id] ?? "";
    setNoteSaving((p) => ({ ...p, [note.id]: true }));

    const { error } = await supabase
      .from("student_grade_notes")
      .update({ note: draft, updated_at: new Date().toISOString() })
      .eq("id", note.id);

    setNoteSaving((p) => {
      const next = { ...p };
      delete next[note.id];
      return next;
    });

    if (error) {
      alert("備考保存失敗: " + error.message);
      return;
    }

    setNotesByGrade((p) => {
      const list = (p[note.grade_id] ?? []).map((n) => (n.id === note.id ? { ...n, note: draft } : n));
      return { ...p, [note.grade_id]: list };
    });
  }

  async function deleteNote(note: NoteRow) {
    if (!editable) return;
    if (!confirm(`備考（#${note.start_idx + 1}〜#${note.end_idx + 1}）を削除します。よろしいですか？`)) return;

    const { error } = await supabase.from("student_grade_notes").delete().eq("id", note.id);
    if (error) {
      alert("備考削除失敗: " + error.message);
      return;
    }

    setNotesByGrade((p) => {
      const list = (p[note.grade_id] ?? []).filter((n) => n.id !== note.id);
      return { ...p, [note.grade_id]: list };
    });
    setNoteDraft((p) => {
      const next = { ...p };
      delete next[note.id];
      return next;
    });
  }

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
            const isSelectMode = (mode[row.id] ?? "view") === "select";
            const selCount = selected[row.id]?.size ?? 0;
            const range = selectedRange(row.id);
            const notes = notesByGrade[row.id] ?? [];

            return (
              <div key={row.id} style={panel()}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 14 }}>{row.title}</div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginTop: 4 }}>
                      {row.problem_count}問 / ○:{s.o} ×:{s.x} △:{s.d} 未:{s.blank}
                    </div>
                  </div>

                  {editable && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <button
                        onClick={() => {
                          setMode((p) => ({ ...p, [row.id]: isSelectMode ? "view" : "select" }));
                          if (!isSelectMode) clearSelection(row.id);
                        }}
                        style={ghostBtn(isSelectMode)}
                      >
                        {isSelectMode ? "選択中" : "選択"}
                      </button>

                      {isSelectMode && (
                        <>
                          <span style={chip()}>
                            {selCount === 0
                              ? "範囲選択"
                              : range
                              ? `選択: #${range.start + 1}〜#${range.end + 1}（${selCount}）`
                              : `選択: ${selCount}`}
                          </span>

                          <button style={ghostBtn()} onClick={() => applyMark(row.id, "O")}>
                            ○
                          </button>
                          <button style={ghostBtn()} onClick={() => applyMark(row.id, "X")}>
                            ×
                          </button>
                          <button style={ghostBtn()} onClick={() => applyMark(row.id, "D")}>
                            △
                          </button>
                          <button style={ghostBtn()} onClick={() => applyMark(row.id, "")}>
                            未
                          </button>

                          <button style={ghostBtn()} onClick={() => clearSelection(row.id)}>
                            解除
                          </button>

                          <button style={ghostBtn()} onClick={() => addNoteFromSelection(row)}>
                            備考追加
                          </button>
                        </>
                      )}

                      <button onClick={() => saveRow(row)} disabled={saving} style={ghostBtn()}>
                        {saving ? "保存中..." : "保存"}
                      </button>
                      <button onClick={() => deleteRow(row)} style={dangerBtn()}>
                        削除
                      </button>
                    </div>
                  )}
                </div>

                {/* marks grid */}
                <div
                  style={{
                    marginTop: 12,
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, 44px)",
                    gap: 8,
                    justifyContent: "start",
                  }}
                >
                  {row.marks.map((m, i) => {
                    const clickable = editable;
                    const isSelected = (selected[row.id]?.has(i) ?? false) && isSelectMode;

                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={!editable}
                        onClick={(e) => clickable && onTileClick(e, row, i)}
                        style={markTile(m, clickable, isSelected)}
                        title={`#${i + 1} ${m ? MARK_LABEL[m] : "未"}`}
                      >
                        {m ? MARK_LABEL[m] : `${i + 1}`}
                      </button>
                    );
                  })}
                </div>

                {/* notes */}
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 13 }}>備考（区切りメモ）</div>
                    <span style={mutedChip()}>範囲1つにつきメモ1つ</span>
                    {!editable && <span style={mutedChip()}>閲覧のみ</span>}
                  </div>

                  {notes.length === 0 ? (
                    <div style={muted()}>備考はありません。</div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {notes.map((n) => {
                        const savingN = !!noteSaving[n.id];
                        return (
                          <div key={n.id} style={notePanel()}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                              <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 12 }}>
                                #{n.start_idx + 1}〜#{n.end_idx + 1}
                              </div>

                              {editable && (
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  <button style={ghostBtn()} disabled={savingN} onClick={() => saveNote(n)}>
                                    {savingN ? "保存中..." : "保存"}
                                  </button>
                                  <button style={dangerBtn()} onClick={() => deleteNote(n)}>
                                    削除
                                  </button>
                                </div>
                              )}
                            </div>

                            <textarea
                              value={noteDraft[n.id] ?? n.note ?? ""}
                              onChange={(e) => setNoteDraft((p) => ({ ...p, [n.id]: e.target.value }))}
                              readOnly={!editable}
                              style={noteArea(!editable)}
                              placeholder="備考を入力"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
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

function chip(): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 900,
    color: "#0f172a",
    background: "rgba(255,255,255,0.85)",
    border: "1px solid rgba(148,163,184,0.22)",
    borderRadius: 9999,
    padding: "8px 10px",
    whiteSpace: "nowrap",
  };
}

function mutedChip(): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 900,
    color: "#64748b",
    background: "rgba(255,255,255,0.75)",
    border: "1px solid rgba(148,163,184,0.18)",
    borderRadius: 9999,
    padding: "6px 10px",
    whiteSpace: "nowrap",
  };
}

function panel(): React.CSSProperties {
  return {
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(255,255,255,0.90)",
    padding: 14,
  };
}

function notePanel(): React.CSSProperties {
  return {
    borderRadius: 14,
    border: "1px dashed rgba(148,163,184,0.35)",
    background: "rgba(248,250,252,0.8)",
    padding: 10,
  };
}

function noteArea(readonly: boolean): React.CSSProperties {
  return {
    width: "100%",
    minHeight: 64,
    resize: "vertical",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.22)",
    background: readonly ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.95)",
    padding: 10,
    fontSize: 13,
    fontWeight: 800,
    color: "#0f172a",
    outline: "none",
  };
}

function ghostBtn(active?: boolean): React.CSSProperties {
  return {
    border: active ? "1px solid rgba(37,99,235,0.35)" : "1px solid rgba(148,163,184,0.22)",
    background: active ? "rgba(219,234,254,0.80)" : "rgba(255,255,255,0.9)",
    borderRadius: 9999,
    padding: "8px 12px",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
    color: active ? "#1d4ed8" : "#0f172a",
  };
}

function dangerBtn(): React.CSSProperties {
  return {
    ...ghostBtn(false),
    color: "#dc2626",
    borderColor: "rgba(220,38,38,0.30)",
    background: "rgba(254,242,242,0.90)",
  };
}

function markTile(m: Mark, clickable: boolean, selected: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    height: 40,
    width: 44,
    borderRadius: 14,
    border: selected ? "2px solid rgba(37,99,235,0.55)" : "1px solid rgba(148,163,184,0.22)",
    background: "rgba(255,255,255,0.95)",
    fontWeight: 900,
    cursor: clickable ? "pointer" : "default",
    userSelect: "none",
    outline: "none",
  };

  if (m === "O")
    return { ...base, background: "rgba(34,197,94,0.18)", color: "#166534", borderColor: selected ? "rgba(37,99,235,0.55)" : "rgba(34,197,94,0.28)" };
  if (m === "X")
    return { ...base, background: "rgba(239,68,68,0.14)", color: "#991b1b", borderColor: selected ? "rgba(37,99,235,0.55)" : "rgba(239,68,68,0.24)" };
  if (m === "D")
    return { ...base, background: "rgba(245,158,11,0.16)", color: "#92400e", borderColor: selected ? "rgba(37,99,235,0.55)" : "rgba(245,158,11,0.28)" };

  return { ...base, color: "#64748b" };
}
