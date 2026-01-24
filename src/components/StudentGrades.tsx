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
  const [rangeText, setRangeText] = useState<Record<string, { start: string; end: string }>>({});

  // notes per grade
  const [notesByGrade, setNotesByGrade] = useState<Record<string, NoteRow[]>>({});
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

  // ---------- 章作成/解除 ----------
  async function createChapterFromRange(row: GradeRow) {
    if (!editable) return;

    const range = getCurrentRange(row);
    if (!range) {
      alert("始点/終点が不正です。");
      return;
    }
    const { startIdx, endIdx } = range;
    const [lo, hi] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];

    const existing = (notesByGrade[row.id] ?? []);

    // 重複禁止（章の整合性）
    const hit = existing.find((n) => overlaps(lo, hi, n.start_idx, n.end_idx));
    if (hit) {
      alert(`既存の章（${labelOf(row, hit.start_idx)}〜${labelOf(row, hit.end_idx)}）と範囲が重なっています。解除してから作成してください。`);
      return;
    }

    const chapterTitle = window.prompt(
      `章名を入力（${labelOf(row, lo)}〜${labelOf(row, hi)}）`,
      `第${(notesByGrade[row.id]?.length ?? 0) + 1}章`
    );
    if (chapterTitle == null) return;

    // ✅ 「本文」ではなく「備考」
    const remark = window.prompt("備考（空でもOK）", "") ?? "";

    // 1行目=章名、2行目以降=備考
    const text = `${chapterTitle}\n${remark}`;

    const payload = { grade_id: row.id, start_idx: lo, end_idx: hi, note: text };

    const { data, error } = await supabase
      .from("student_grade_notes")
      .insert([payload])
      .select("id,grade_id,start_idx,end_idx,note,created_at,updated_at")
      .single();

    if (error) {
      alert("章の作成に失敗: " + error.message);
      return;
    }

    const newRow = data as NoteRow;

    setNotesByGrade((p) => {
      const list = [...(p[row.id] ?? []), newRow].sort((a, b) => a.start_idx - b.start_idx || a.end_idx - b.end_idx);
      return { ...p, [row.id]: list };
    });
    setNoteDraft((p) => ({ ...p, [newRow.id]: newRow.note ?? "" }));
  }

  async function removeChapterFromRange(row: GradeRow) {
    if (!editable) return;

    const range = getCurrentRange(row);
    if (!range) {
      alert("始点/終点が不正です。");
      return;
    }
    const { startIdx, endIdx } = range;
    const [lo, hi] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];

    const existing = (notesByGrade[row.id] ?? []);

    // まずは完全一致を優先
    let target = existing.find((n) => n.start_idx === lo && n.end_idx === hi);

    // 無ければ「範囲が含まれる章」を1つだけ許可（重複禁止前提）
    if (!target) {
      target = existing.find((n) => lo >= n.start_idx && hi <= n.end_idx);
    }

    if (!target) {
      alert("この範囲に対応する章が見つかりません。");
      return;
    }

    if (!confirm(`章（${labelOf(row, target.start_idx)}〜${labelOf(row, target.end_idx)}）を解除します。よろしいですか？`)) return;

    const { error } = await supabase.from("student_grade_notes").delete().eq("id", target.id);
    if (error) {
      alert("章の解除に失敗: " + error.message);
      return;
    }

    setNotesByGrade((p) => {
      const list = (p[row.id] ?? []).filter((n) => n.id !== target!.id);
      return { ...p, [row.id]: list };
    });
    setNoteDraft((p) => {
      const next = { ...p };
      delete next[target!.id];
      return next;
    });
  }

  function applyMarkToRange(row: GradeRow, mark: Mark) {
    const range = getCurrentRange(row);
    if (!range) {
      alert("始点/終点が不正です（例: 12 / 1(2) など）。");
      return;
    }

    const { startIdx, endIdx } = range;
    const [lo, hi] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];

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
  function scheduleAutoSaveNote(noteId: string, gradeId: string) {
    if (!editable) return;

    if (noteSaveTimers.current[noteId]) window.clearTimeout(noteSaveTimers.current[noteId]);

    noteSaveTimers.current[noteId] = window.setTimeout(async () => {
      const draft = noteDraftRef.current[noteId] ?? "";

      const { error } = await supabase
        .from("student_grade_notes")
        .update({ note: draft, updated_at: new Date().toISOString() })
        .eq("id", noteId);

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

  /** 章ノートを「章名」と「本文」に分離 */
  function splitChapterNote(text: string | null | undefined): { title: string; body: string; raw: string } {
    const raw = text ?? "";
    if (!raw.trim()) return { title: "", body: "", raw };
    const lines = raw.split("\n");
    const title = lines[0] ?? "";
    const body = lines.slice(1).join("\n");
    return { title, body, raw };
  }

  // ---------- 章ブロック生成 ----------
  type Segment = {
    kind: "chapter" | "free";
    start: number; // inclusive
    end: number;   // inclusive
    note?: NoteRow; // kind=chapter のときだけ
  };

  function buildSegments(problemCount: number, notes: NoteRow[]): Segment[] {
    const sorted = [...notes].sort((a, b) => a.start_idx - b.start_idx || a.end_idx - b.end_idx);

    const segs: Segment[] = [];
    let cur = 0;

    for (const n of sorted) {
      const s = Math.max(0, n.start_idx);
      const e = Math.min(problemCount - 1, n.end_idx);
      if (e < 0 || s > problemCount - 1) continue;

      // free before chapter
      if (cur <= s - 1) {
        segs.push({ kind: "free", start: cur, end: s - 1 });
      }

      // chapter segment
      segs.push({ kind: "chapter", start: s, end: e, note: n });

      cur = e + 1;
    }

    // trailing free
    if (cur <= problemCount - 1) {
      segs.push({ kind: "free", start: cur, end: problemCount - 1 });
    }

    return segs;
  }

  function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
    const [a0, a1] = aStart <= aEnd ? [aStart, aEnd] : [aEnd, aStart];
    const [b0, b1] = bStart <= bEnd ? [bStart, bEnd] : [bEnd, bStart];
    return !(a1 < b0 || b1 < a0);
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

                          <button style={ghostBtn()} onClick={() => createChapterFromRange(row)}>章を作成</button>
                          <button style={dangerBtn()} onClick={() => removeChapterFromRange(row)}>章を解除</button>
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

                {/* blocks (chapters) */}
                {(() => {
                  const segs = buildSegments(row.problem_count, notes);

                  return (
                    <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                      {segs.map((seg, si) => {
                        const isChapter = seg.kind === "chapter";
                        const parsed = isChapter && seg.note ? splitChapterNote(seg.note.note) : { title: "", body: "", raw: "" };
                        const title = isChapter
                          ? `${parsed.title || "章"}：${labelOf(row, seg.start)}〜${labelOf(row, seg.end)}`
                          : `未分類：${labelOf(row, seg.start)}〜${labelOf(row, seg.end)}`;

                        return (
                          <div key={si} style={isChapter ? chapterPanel() : freePanel()}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                              <div style={{ fontWeight: 950, fontSize: 12, color: "#0f172a" }}>{title}</div>
                              {isChapter && <span style={mutedChip()}>この章の直下に備考</span>}
                            </div>

                            <div
                              style={{
                                marginTop: 10,
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, 46px)",
                                gap: 8,
                                justifyContent: "start",
                              }}
                            >
                              {Array.from({ length: seg.end - seg.start + 1 }, (_, k) => seg.start + k).map((i) => {
                                const m = row.marks[i];
                                const clickable = editable;

                                return (
                                  <button
                                    key={i}
                                    type="button"
                                    disabled={!editable}
                                    onClick={() => clickable && onTileClick(row, i)}
                                    style={markTile(m, clickable, false)}
                                    title={`${labelOf(row, i)} ${m ? MARK_LABEL[m] : "未"}`}
                                  >
                                    <div style={{ lineHeight: 1, fontSize: 16, fontWeight: 950 }}>
                                      {m ? MARK_LABEL[m] : ""}
                                    </div>
                                    <div style={tileLabel()}>{labelOf(row, i)}</div>
                                  </button>
                                );
                              })}
                            </div>

                            {/* chapter note inline */}
                            {isChapter && seg.note && (() => {
                              const parsed = splitChapterNote(noteDraft[seg.note.id] ?? seg.note.note ?? "");
                              const titleValue = parsed.title === "（章名未設定）" ? "" : parsed.title;
                              const remarkValue = parsed.body ?? "";

                              return (
                                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                                  <input
                                    value={titleValue}
                                    onChange={(e) => {
                                      const nextRaw = `${e.target.value}\n${remarkValue}`;
                                      setNoteDraft((p) => ({ ...p, [seg.note!.id]: nextRaw }));
                                      scheduleAutoSaveNote(seg.note!.id, seg.note!.grade_id);
                                    }}
                                    readOnly={!editable}
                                    placeholder="章名（例：第1章 二次関数）"
                                    style={chapterTitleInput(!editable)}
                                  />

                                  <textarea
                                    value={remarkValue}
                                    onChange={(e) => {
                                      const nextRaw = `${parsed.title}\n${e.target.value}`;
                                      setNoteDraft((p) => ({ ...p, [seg.note!.id]: nextRaw }));
                                      scheduleAutoSaveNote(seg.note!.id, seg.note!.grade_id);
                                    }}
                                    readOnly={!editable}
                                    style={noteArea(!editable)}
                                    placeholder="この章の備考"
                                  />
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
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

function chapterTitleInput(readonly: boolean): React.CSSProperties {
  return {
    width: "100%",
    height: 36,
    borderRadius: 12,
    border: "1px solid rgba(59,130,246,0.25)",
    background: readonly ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.95)",
    padding: "0 12px",
    fontSize: 13,
    fontWeight: 950,
    color: "#0f172a",
    outline: "none",
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

function chapterPanel(): React.CSSProperties {
  return {
    borderRadius: 16,
    border: "1px solid rgba(59,130,246,0.22)",
    background: "rgba(239,246,255,0.85)",
    padding: 12,
  };
}

function freePanel(): React.CSSProperties {
  return {
    borderRadius: 16,
    border: "1px dashed rgba(148,163,184,0.30)",
    background: "rgba(255,255,255,0.75)",
    padding: 12,
  };
}
