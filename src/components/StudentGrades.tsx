// src/components/StudentGrades.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * Mark:
 *  ""  = 未
 *  "O" = ○
 *  "X" = ×
 *  "T" = △ (Triangle)
 */
type Mark = "O" | "X" | "T" | "";
type Mode = "view" | "select";

type GradeRow = {
  id: string;
  user_id: string;
  title: string;
  problem_count: number;
  marks: Mark[];
  labels?: string[]; // 任意ラベル（例: "1", "1(1)", "1(2)" ...）
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

const MARK_LABEL: Record<Mark, string> = { "": "", O: "○", X: "×", T: "△" };

export default function StudentGrades({ userId, editable = false }: Props) {
  const [rows, setRows] = useState<GradeRow[]>([]);
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [autoMsg, setAutoMsg] = useState<Record<string, string>>({}); // rowId => status

  // selection per grade
  const [mode, setMode] = useState<Record<string, Mode>>({});
  const [selected, setSelected] = useState<Record<string, Set<number>>>({}); // ※備考用に残す（範囲の確定後にここへ入れる）
  const [rangeText, setRangeText] = useState<Record<string, { start: string; end: string }>>({});

  // notes per grade
  const [notesByGrade, setNotesByGrade] = useState<Record<string, NoteRow[]>>({});
  const [noteSaving, setNoteSaving] = useState<Record<string, boolean>>({}); // note_id => saving
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({}); // note_id => draft text

  // debounce timers
  const rowSaveTimers = useRef<Record<string, number>>({});
  const noteSaveTimers = useRef<Record<string, number>>({});

  // ---------- load ----------
  async function loadGrades() {
    if (!userId) return;

    const { data, error } = await supabase
      .from("student_grades")
      .select("id,user_id,title,problem_count,marks,labels,created_at,updated_at")
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
      labels?: unknown;
      created_at: string;
      updated_at: string;
    }>).map((r) => {
      const rawMarks = Array.isArray(r.marks) ? (r.marks as unknown[]) : [];
      const marks: Mark[] = rawMarks.map((m) => (m === "O" || m === "X" || m === "T" ? (m as Mark) : ""));
      const rawLabels = Array.isArray(r.labels) ? (r.labels as unknown[]) : [];
      const labels: string[] | undefined =
        rawLabels.length > 0 ? rawLabels.map((x) => (typeof x === "string" ? x : "")).filter(Boolean) : undefined;

      return {
        id: r.id,
        user_id: r.user_id,
        title: r.title,
        problem_count: r.problem_count,
        marks,
        labels,
        created_at: r.created_at,
        updated_at: r.updated_at,
      };
    });

    setRows(mapped);

    // state init / cleanup
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
    setRangeText((prev) => {
      const next: Record<string, { start: string; end: string }> = { ...prev };
      for (const g of mapped) next[g.id] = next[g.id] ?? { start: "", end: "" };
      return next;
    });

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
      console.warn("⚠️ load notes:", error.message);
      return;
    }

    const by: Record<string, NoteRow[]> = {};
    for (const g of gradeIds) by[g] = [];
    for (const r of (data ?? []) as NoteRow[]) (by[r.grade_id] ??= []).push(r);

    setNotesByGrade(by);

    setNoteDraft((prev) => {
      const next = { ...prev };
      for (const r of (data ?? []) as NoteRow[]) if (next[r.id] == null) next[r.id] = r.note ?? "";
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

    const title = window.prompt("問題集の名前は？（例：数学基礎問題精講）");
    if (!title) return;

    const numStr = window.prompt("問題数は？（1〜2000）");
    if (!numStr) return;

    const n = Number(numStr);
    if (!Number.isInteger(n) || n <= 0 || n > 2000) {
      alert("1〜2000の整数で指定してください。");
      return;
    }

    const marks: Mark[] = Array(n).fill("");
    const labels = Array.from({ length: n }, (_, i) => String(i + 1)); // デフォルトラベル

    const { data, error } = await supabase
      .from("student_grades")
      .insert([{ user_id: userId, title, problem_count: n, marks, labels }])
      .select("id,user_id,title,problem_count,marks,labels,created_at,updated_at")
      .single();

    if (error) {
      alert("追加失敗: " + error.message);
      return;
    }

    const row = data as unknown as GradeRow;
    const rawData = data as Record<string, unknown>;
    row.marks = (Array.isArray(rawData.marks) ? (rawData.marks as unknown[]) : []).map((m) =>
      m === "O" || m === "X" || m === "T" ? (m as Mark) : ""
    );
    row.labels = (Array.isArray(rawData.labels) ? (rawData.labels as unknown[]) : [])
      .map((x) => (typeof x === "string" ? x : ""))
      .filter(Boolean);

    setRows((prev) => [...prev, row]);

    setNotesByGrade((p) => ({ ...p, [row.id]: [] }));
    setMode((p) => ({ ...p, [row.id]: "view" }));
    setSelected((p) => ({ ...p, [row.id]: new Set() }));
    setRangeText((p) => ({ ...p, [row.id]: { start: "", end: "" } }));
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

  // ---------- marks local update ----------
  function cycleMark(cur: Mark): Mark {
    if (cur === "") return "O";
    if (cur === "O") return "X";
    if (cur === "X") return "T";
    return "";
  }

  function setMarkLocal(rowId: string, idx: number, next: Mark) {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, marks: r.marks.map((m, i) => (i === idx ? next : m)) } : r)));
    scheduleAutoSaveRow(rowId);
  }

  // ---------- autosave row ----------
  function scheduleAutoSaveRow(rowId: string) {
    if (!editable) return;

    // 既存タイマーをリセット
    if (rowSaveTimers.current[rowId]) window.clearTimeout(rowSaveTimers.current[rowId]);

    setAutoMsg((p) => ({ ...p, [rowId]: "自動保存待ち…" }));

    rowSaveTimers.current[rowId] = window.setTimeout(async () => {
      const row = rowsRef.current.find((r) => r.id === rowId);
      if (!row) return;

      setSavingIds((s) => ({ ...s, [rowId]: true }));

      const { error } = await supabase
        .from("student_grades")
        .update({
          marks: row.marks,
          updated_at: new Date().toISOString(),
        })
        .eq("id", rowId);

      setSavingIds((s) => {
        const next = { ...s };
        delete next[rowId];
        return next;
      });

      if (error) {
        setAutoMsg((p) => ({ ...p, [rowId]: "自動保存失敗（手動保存してください）" }));
        return;
      }
      setAutoMsg((p) => ({ ...p, [rowId]: "自動保存済み" }));
    }, 700);
  }

  // rowsRef: debounce内で最新rows参照
  const rowsRef = useRef<GradeRow[]>([]);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  async function manualSaveRow(row: GradeRow) {
    if (!editable) return;
    setSavingIds((s) => ({ ...s, [row.id]: true }));

    const { error } = await supabase
      .from("student_grades")
      .update({ marks: row.marks, updated_at: new Date().toISOString() })
      .eq("id", row.id);

    setSavingIds((s) => {
      const next = { ...s };
      delete next[row.id];
      return next;
    });

    if (error) alert("保存失敗: " + error.message);
    else setAutoMsg((p) => ({ ...p, [row.id]: "保存済み" }));
  }

  // ---------- selection helpers ----------
  function clearSelection(rowId: string) {
    setSelected((p) => ({ ...p, [rowId]: new Set() }));
  }

  function setSelectedRangeSet(rowId: string, startIdx: number, endIdx: number) {
    const [lo, hi] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
    const next = new Set<number>();
    for (let i = lo; i <= hi; i++) next.add(i);
    setSelected((p) => ({ ...p, [rowId]: next }));
  }

  function resolveIndex(row: GradeRow, text: string): number | null {
    const t = text.trim();
    if (!t) return null;

    // 1) 数字入力ならそのまま（1-based → 0-based）
    if (/^\d+$/.test(t)) {
      const n = Number(t);
      if (!Number.isInteger(n)) return null;
      const idx = n - 1;
      if (idx < 0 || idx >= row.problem_count) return null;
      return idx;
    }

    // 2) labels から一致検索
    const labels = row.labels ?? [];
    const idx = labels.findIndex((x) => x === t);
    if (idx >= 0) return idx;

    return null;
  }

  function getCurrentRange(row: GradeRow): { startIdx: number; endIdx: number } | null {
    const rt = rangeText[row.id] ?? { start: "", end: "" };
    const s = resolveIndex(row, rt.start);
    const e = resolveIndex(row, rt.end);
    if (s == null || e == null) return null;
    return { startIdx: s, endIdx: e };
  }

  function applyMarkToRange(row: GradeRow, mark: Mark) {
    const range = getCurrentRange(row);
    if (!range) {
      alert("始点/終点が不正です（例: 12 / 1(2) など）。");
      return;
    }

    const { startIdx, endIdx } = range;
    const [lo, hi] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];

    // UI上の選択状態も作る（備考追加で使える）
    setSelectedRangeSet(row.id, lo, hi);

    // marks更新
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== row.id) return r;
        const nextMarks = r.marks.map((m, i) => (i >= lo && i <= hi ? mark : m));
        return { ...r, marks: nextMarks };
      })
    );

    scheduleAutoSaveRow(row.id);
  }

  // タイルクリック（viewモード: 循環 / selectモード: 何もしない）
  function onTileClick(row: GradeRow, idx: number) {
    if (!editable) return;

    const isSelectMode = (mode[row.id] ?? "view") === "select";

    // view: クリックで循環（←これが必須）
    if (!isSelectMode) {
      const cur = row.marks[idx] ?? "";
      setMarkLocal(row.id, idx, cycleMark(cur));
      return;
    }

    // select: タイルクリックでは変更しない（誤爆防止）
    // 必要なら「クリックで始点/終点を自動入力」などにできるが、今は無効化
  }

  // ---------- notes ----------
  async function addNoteFromSelection(row: GradeRow) {
    if (!editable) return;

    const range = getCurrentRange(row);
    if (!range) {
      alert("始点/終点を入力してから「備考追加」を押してください。");
      return;
    }

    const { startIdx, endIdx } = range;
    const [lo, hi] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];

    const text = window.prompt(`備考を入力（${labelOf(row, lo)}〜${labelOf(row, hi)}）`);
    if (text == null) return;

    const payload = {
      grade_id: row.id,
      start_idx: lo,
      end_idx: hi,
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

    // 追加後は誤操作防止で解除
    clearSelection(row.id);
    setMode((p) => ({ ...p, [row.id]: "view" }));
  }

  function scheduleAutoSaveNote(noteId: string, gradeId: string) {
    if (!editable) return;

    if (noteSaveTimers.current[noteId]) window.clearTimeout(noteSaveTimers.current[noteId]);

    noteSaveTimers.current[noteId] = window.setTimeout(async () => {
      const draft = noteDraftRef.current[noteId] ?? "";

      setNoteSaving((p) => ({ ...p, [noteId]: true }));
      const { error } = await supabase
        .from("student_grade_notes")
        .update({ note: draft, updated_at: new Date().toISOString() })
        .eq("id", noteId);

      setNoteSaving((p) => {
        const next = { ...p };
        delete next[noteId];
        return next;
      });

      if (error) {
        alert("備考の自動保存に失敗しました: " + error.message);
        return;
      }

      setNotesByGrade((p) => {
        const list = (p[gradeId] ?? []).map((n) => (n.id === noteId ? { ...n, note: draft } : n));
        return { ...p, [gradeId]: list };
      });
    }, 700);
  }

  const noteDraftRef = useRef<Record<string, string>>({});
  useEffect(() => {
    noteDraftRef.current = noteDraft;
  }, [noteDraft]);

  async function deleteNote(note: NoteRow) {
    if (!editable) return;

    if (!confirm(`備考（${note.start_idx + 1}〜${note.end_idx + 1}）を削除します。よろしいですか？`)) return;

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

  // ---------- summary ----------
  function summarize(marks: Mark[]) {
    let o = 0,
      x = 0,
      t = 0,
      blank = 0;
    for (const m of marks) {
      if (m === "O") o++;
      else if (m === "X") x++;
      else if (m === "T") t++;
      else blank++;
    }
    return { o, x, t, blank };
  }

  const empty = useMemo(() => rows.length === 0, [rows]);

  function labelOf(row: GradeRow, idx: number) {
    const labels = row.labels ?? [];
    const s = labels[idx];
    return s && s.trim() ? s : String(idx + 1);
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
            const notes = notesByGrade[row.id] ?? [];

            return (
              <div key={row.id} style={panel()}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 14 }}>{row.title}</div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginTop: 4 }}>
                      {row.problem_count}問 / ○:{s.o} ×:{s.x} △:{s.t} 未:{s.blank}
                      {autoMsg[row.id] && <span style={{ marginLeft: 10, color: "#94a3b8" }}>{autoMsg[row.id]}</span>}
                    </div>
                  </div>

                  {editable && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
                      <button
                        onClick={() => {
                          setMode((p) => ({ ...p, [row.id]: isSelectMode ? "view" : "select" }));
                          clearSelection(row.id);
                        }}
                        style={ghostBtn(isSelectMode)}
                      >
                        {isSelectMode ? "範囲選択中" : "範囲選択"}
                      </button>

                      {isSelectMode && (
                        <>
                          <span style={chip()}>始点/終点を入力して範囲を確定</span>

                          <input
                            value={rangeText[row.id]?.start ?? ""}
                            onChange={(e) => setRangeText((p) => ({ ...p, [row.id]: { ...(p[row.id] ?? { start: "", end: "" }), start: e.target.value } }))}
                            placeholder="始点（例: 12 / 1(2)）"
                            style={rangeInput()}
                          />
                          <input
                            value={rangeText[row.id]?.end ?? ""}
                            onChange={(e) => setRangeText((p) => ({ ...p, [row.id]: { ...(p[row.id] ?? { start: "", end: "" }), end: e.target.value } }))}
                            placeholder="終点（例: 25 / 1(8)）"
                            style={rangeInput()}
                          />

                          <button style={markBtn("O")} onClick={() => applyMarkToRange(row, "O")}>○</button>
                          <button style={markBtn("X")} onClick={() => applyMarkToRange(row, "X")}>×</button>
                          <button style={markBtn("T")} onClick={() => applyMarkToRange(row, "T")}>△</button>
                          <button style={markBtn("")} onClick={() => applyMarkToRange(row, "")}>未</button>

                          <button style={ghostBtn()} onClick={() => clearSelection(row.id)}>解除</button>
                          <button style={ghostBtn()} onClick={() => addNoteFromSelection(row)}>備考追加</button>
                        </>
                      )}

                      <button onClick={() => manualSaveRow(row)} disabled={saving} style={ghostBtn()}>
                        {saving ? "保存中..." : "手動保存"}
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
                    gridTemplateColumns: "repeat(auto-fill, 46px)",
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
                        onClick={() => clickable && onTileClick(row, i)}
                        style={markTile(m, clickable, isSelected)}
                        title={`${labelOf(row, i)} ${m ? MARK_LABEL[m] : "未"}`}
                      >
                        {/* 中央：記号（無ければ空） */}
                        <div style={{ lineHeight: 1, fontSize: 16, fontWeight: 950 }}>
                          {m ? MARK_LABEL[m] : ""}
                        </div>

                        {/* 右下：番号/ラベル（常に表示） */}
                        <div style={tileLabel()}>
                          {labelOf(row, i)}
                        </div>
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
                        const start = labelOf(row, n.start_idx);
                        const end = labelOf(row, n.end_idx);

                        return (
                          <div key={n.id} style={notePanel()}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                              <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 12 }}>
                                {start}〜{end}
                              </div>

                              {editable && (
                                <div style={{ fontSize: 12, fontWeight: 900, color: savingN ? "#2563eb" : "#94a3b8" }}>
                                  {savingN ? "自動保存中…" : " "}
                                </div>
                              )}

                              {editable && (
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  <button style={dangerBtn()} onClick={() => deleteNote(n)}>
                                    削除
                                  </button>
                                </div>
                              )}
                            </div>

                            <textarea
                              value={noteDraft[n.id] ?? n.note ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                setNoteDraft((p) => ({ ...p, [n.id]: v }));
                                scheduleAutoSaveNote(n.id, n.grade_id);
                              }}
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

/* ================= styles ================= */

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
    background: "rgba(255,255,255,0.92)",
    padding: 14,
  };
}

function notePanel(): React.CSSProperties {
  return {
    borderRadius: 14,
    border: "1px dashed rgba(148,163,184,0.35)",
    background: "rgba(248,250,252,0.85)",
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
    marginTop: 8,
  };
}

function ghostBtn(active?: boolean): React.CSSProperties {
  return {
    border: active ? "1px solid rgba(37,99,235,0.35)" : "1px solid rgba(148,163,184,0.22)",
    background: active ? "rgba(219,234,254,0.80)" : "rgba(255,255,255,0.92)",
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
    background: "rgba(254,242,242,0.92)",
  };
}

function markBtn(mark: Mark): React.CSSProperties {
  const base: React.CSSProperties = {
    borderRadius: 9999,
    padding: "8px 12px",
    fontWeight: 950,
    fontSize: 12,
    cursor: "pointer",
    border: "1px solid rgba(148,163,184,0.22)",
  };

  if (mark === "O") return { ...base, background: "rgba(34,197,94,0.18)", borderColor: "rgba(34,197,94,0.30)", color: "#166534" };
  if (mark === "X") return { ...base, background: "rgba(239,68,68,0.14)", borderColor: "rgba(239,68,68,0.28)", color: "#991b1b" };
  if (mark === "T") return { ...base, background: "rgba(245,158,11,0.16)", borderColor: "rgba(245,158,11,0.30)", color: "#92400e" };
  return { ...base, background: "rgba(148,163,184,0.12)", borderColor: "rgba(148,163,184,0.22)", color: "#334155" };
}

function markTile(m: Mark, clickable: boolean, selected: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    height: 44,
    width: 46,
    borderRadius: 14,
    border: selected ? "2px solid rgba(37,99,235,0.60)" : "1px solid rgba(148,163,184,0.22)",
    background: "rgba(255,255,255,0.96)",
    cursor: clickable ? "pointer" : "default",
    userSelect: "none",
    outline: "none",
    position: "relative",
    display: "grid",
    placeItems: "center",
  };

  if (m === "O") return { ...base, background: "rgba(34,197,94,0.18)", color: "#166534", borderColor: selected ? "rgba(37,99,235,0.60)" : "rgba(34,197,94,0.28)" };
  if (m === "X") return { ...base, background: "rgba(239,68,68,0.14)", color: "#991b1b", borderColor: selected ? "rgba(37,99,235,0.60)" : "rgba(239,68,68,0.24)" };
  if (m === "T") return { ...base, background: "rgba(245,158,11,0.16)", color: "#92400e", borderColor: selected ? "rgba(37,99,235,0.60)" : "rgba(245,158,11,0.28)" };

  return { ...base, color: "#0f172a" };
}

function tileLabel(): React.CSSProperties {
  return {
    position: "absolute",
    right: 6,
    bottom: 5,
    fontSize: 10,
    fontWeight: 900,
    color: "rgba(15,23,42,0.70)",
    maxWidth: 40,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    pointerEvents: "none",
  };
}

function rangeInput(): React.CSSProperties {
  return {
    height: 32,
    borderRadius: 9999,
    border: "1px solid rgba(148,163,184,0.22)",
    padding: "0 12px",
    fontSize: 12,
    fontWeight: 900,
    outline: "none",
    background: "rgba(255,255,255,0.92)",
    color: "#0f172a",
    width: 170,
  };
}
