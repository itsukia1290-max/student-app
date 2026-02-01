import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

/**
 * Mark:
 *  ""  = 未
 *  "O" = ○
 *  "X" = ×
 *  "T" = △
 */
type Mark = "O" | "X" | "T" | "";
const MARK_LABEL: Record<Mark, string> = { "": "", O: "○", X: "×", T: "△" };

type GradeRow = {
  id: string;
  user_id: string;
  title: string;
  problem_count: number;
  marks: Mark[];
  labels?: string[];
  created_at: string;
  updated_at: string;
};

type ChapterRow = {
  id: string;
  grade_id: string;
  start_idx: number;
  end_idx: number;

  // 新カラム
  chapter_title: string | null;
  chapter_note: string | null;
  teacher_memo: string | null;
  next_homework: string | null;

  // 互換用（昔の note）
  note?: string | null;

  created_at: string;
  updated_at: string;
};

type Props = {
  ownerUserId: string;
};

type FilterMode = "all" | "x" | "blank" | "x_blank";

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

function cycleMark(cur: Mark): Mark {
  if (cur === "") return "O";
  if (cur === "O") return "X";
  if (cur === "X") return "T";
  return "";
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export default function TeacherGradesPanel({ ownerUserId }: Props) {
  // workbooks
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [activeGradeId, setActiveGradeId] = useState<string | null>(null);
  const activeGrade = useMemo(() => grades.find((g) => g.id === activeGradeId) ?? null, [grades, activeGradeId]);

  // chapters
  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const activeChapter = useMemo(() => chapters.find((c) => c.id === activeChapterId) ?? null, [chapters, activeChapterId]);

  // filtering inside chapter
  const [filterMode, setFilterMode] = useState<FilterMode>("all");

  // status
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // autosave (marks)
  const gradeSaveTimers = useRef<Record<string, number>>({});
  const gradesRef = useRef<GradeRow[]>([]);
  useEffect(() => {
    gradesRef.current = grades;
  }, [grades]);

  // autosave (chapter fields)
  const chapterSaveTimers = useRef<Record<string, number>>({});
  const chapterDraftRef = useRef<Record<string, { chapter_note: string; teacher_memo: string; next_homework: string }>>({});
  const [chapterDraft, setChapterDraft] = useState<Record<string, { chapter_note: string; teacher_memo: string; next_homework: string }>>({});
  useEffect(() => {
    chapterDraftRef.current = chapterDraft;
  }, [chapterDraft]);

  // ---------- load ----------
  const loadGrades = useCallback(async () => {
    if (!ownerUserId) return;
    setLoading(true);
    setErr(null);

    const { data, error } = await supabase
      .from("student_grades")
      .select("id,user_id,title,problem_count,marks,labels,created_at,updated_at")
      .eq("user_id", ownerUserId)
      .order("created_at", { ascending: true });

    if (error) {
      setErr("student_grades 読み込み失敗: " + error.message);
      setGrades([]);
      setLoading(false);
      return;
    }

    const mapped: GradeRow[] = ((data ?? []) as Array<Record<string, unknown>>).map((r) => {
      const rawMarks = Array.isArray(r.marks) ? r.marks : [];
      const marks: Mark[] = rawMarks.map((m: unknown) => (m === "O" || m === "X" || m === "T" ? (m as Mark) : ""));
      const rawLabels = Array.isArray(r.labels) ? r.labels : [];
      const labels: string[] | undefined =
        rawLabels.length > 0 ? rawLabels.map((x: unknown) => (typeof x === "string" ? x : "")).filter(Boolean) : undefined;

      return {
        id: r.id as string,
        user_id: r.user_id as string,
        title: r.title as string,
        problem_count: r.problem_count as number,
        marks,
        labels,
        created_at: r.created_at as string,
        updated_at: r.updated_at as string,
      };
    });

    setGrades(mapped);

    // default select first
    const first = mapped[0]?.id ?? null;
    setActiveGradeId((prev) => prev ?? first);

    setLoading(false);
  }, [ownerUserId]);

  const loadChapters = useCallback(async (gradeId: string) => {
    if (!gradeId) return;

    const { data, error } = await supabase
      .from("student_grade_notes")
      .select(
        "id,grade_id,start_idx,end_idx,chapter_title,chapter_note,teacher_memo,next_homework,note,created_at,updated_at"
      )
      .eq("grade_id", gradeId)
      .order("start_idx", { ascending: true })
      .order("end_idx", { ascending: true });

    if (error) {
      setErr("student_grade_notes 読み込み失敗: " + error.message);
      setChapters([]);
      setActiveChapterId(null);
      return;
    }

    const list = (data ?? []) as ChapterRow[];
    setChapters(list);

    // draft init
    setChapterDraft((prev) => {
      const next = { ...prev };
      for (const c of list) {
        if (next[c.id] == null) {
          next[c.id] = {
            chapter_note: (c.chapter_note ?? c.note ?? "") as string,
            teacher_memo: (c.teacher_memo ?? "") as string,
            next_homework: (c.next_homework ?? "") as string,
          };
        }
      }
      return next;
    });

    // default select: last updated (最新編集)
    if (list.length > 0) {
      const sorted = [...list].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
      setActiveChapterId((prev) => prev ?? sorted[0].id);
    } else {
      setActiveChapterId(null);
    }
  }, []);

  useEffect(() => {
    loadGrades();
  }, [ownerUserId, loadGrades]);

  useEffect(() => {
    if (!activeGradeId) return;
    loadChapters(activeGradeId);
  }, [activeGradeId, loadChapters]);

  // ---------- helpers ----------
  function labelOf(row: GradeRow, idx: number) {
    const labels = row.labels ?? [];
    const s = labels[idx];
    return s && String(s).trim() ? String(s) : String(idx + 1);
  }

  function chapterLabel(c: ChapterRow) {
    const title = (c.chapter_title ?? "").trim();
    const range = `${c.start_idx + 1}〜${c.end_idx + 1}`;
    return title ? `${title}（${range}）` : `章（${range}）`;
  }

  function chapterRangeIndices(c: ChapterRow, grade: GradeRow) {
    const start = clamp(c.start_idx, 0, grade.problem_count - 1);
    const end = clamp(c.end_idx, 0, grade.problem_count - 1);
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);
    return { lo, hi };
  }

  function shouldShowByFilter(mark: Mark, mode: FilterMode) {
    if (mode === "all") return true;
    if (mode === "x") return mark === "X";
    if (mode === "blank") return mark === "";
    return mark === "X" || mark === "";
  }

  // ---------- grade ops ----------
  async function addWorkbook() {
    const title = window.prompt("問題集名を入力してください（例：数学基礎問題精講）");
    if (!title) return;

    const { data, error } = await supabase
      .from("student_grades")
      .insert([
        {
          user_id: ownerUserId,
          title,
          problem_count: 1,   // ★ CHECK 制約を満たす
          marks: [""],
          labels: ["1"],
        },
      ])
      .select()
      .single();

    if (error) {
      alert("問題集の追加に失敗しました: " + error.message);
      return;
    }

    setGrades((prev) => [...prev, data]);
    setActiveGradeId(data.id);
    setChapters([]);
    setActiveChapterId(null);
  }

  async function deleteWorkbook(g: GradeRow) {
    if (!confirm(`問題集「${g.title}」を削除します。よろしいですか？`)) return;
    const { error } = await supabase.from("student_grades").delete().eq("id", g.id);
    if (error) {
      alert("削除失敗: " + error.message);
      return;
    }
    setGrades((prev) => prev.filter((x) => x.id !== g.id));
    setActiveGradeId((prev) => {
      if (prev !== g.id) return prev;
      return null;
    });
    setChapters([]);
    setActiveChapterId(null);
  }

  async function expandWorkbookIfNeeded(grade: GradeRow, requiredTotal: number) {
    if (requiredTotal <= grade.problem_count) return { ok: true as const };

    const addN = requiredTotal - grade.problem_count;
    const nextMarks: Mark[] = [...grade.marks, ...Array(addN).fill("")];
    const nextLabels: string[] = [
      ...(grade.labels ?? Array.from({ length: grade.problem_count }, (_, i) => String(i + 1))),
      ...Array.from({ length: addN }, (_, i) => String(grade.problem_count + i + 1)),
    ];

    const { error } = await supabase
      .from("student_grades")
      .update({
        problem_count: requiredTotal,
        marks: nextMarks,
        labels: nextLabels,
        updated_at: new Date().toISOString(),
      })
      .eq("id", grade.id);

    if (error) {
      setErr("問題集の拡張に失敗: " + error.message);
      return { ok: false as const };
    }

    // UI反映
    setGrades((prev) =>
      prev.map((g) =>
        g.id === grade.id
          ? { ...g, problem_count: requiredTotal, marks: nextMarks, labels: nextLabels, updated_at: new Date().toISOString() }
          : g
      )
    );

    return { ok: true as const };
  }

  function scheduleSaveMarks(gradeId: string) {
    if (gradeSaveTimers.current[gradeId]) window.clearTimeout(gradeSaveTimers.current[gradeId]);

    gradeSaveTimers.current[gradeId] = window.setTimeout(async () => {
      const g = gradesRef.current.find((x) => x.id === gradeId);
      if (!g) return;

      const { error } = await supabase
        .from("student_grades")
        .update({ marks: g.marks, updated_at: new Date().toISOString() })
        .eq("id", gradeId);

      if (error) setErr("marks 保存失敗: " + error.message);
    }, 700);
  }

  function updateMarkLocal(gradeId: string, idx: number, next: Mark) {
    setGrades((prev) =>
      prev.map((g) => (g.id === gradeId ? { ...g, marks: g.marks.map((m, i) => (i === idx ? next : m)) } : g))
    );
    scheduleSaveMarks(gradeId);
  }

  async function bulkSetMarksInChapter(mark: Mark) {
    if (!activeGrade || !activeChapter) return;

    const { lo, hi } = chapterRangeIndices(activeChapter, activeGrade);

    setGrades((prev) =>
      prev.map((g) => {
        if (g.id !== activeGrade.id) return g;
        const nextMarks = g.marks.map((m, i) => (i >= lo && i <= hi ? mark : m));
        return { ...g, marks: nextMarks };
      })
    );

    // debounce save
    scheduleSaveMarks(activeGrade.id);
  }

  // ---------- chapter ops ----------
  async function createChapter() {
    if (!activeGrade) return;

    const title = window.prompt("章名（空でもOK）", "") ?? "";
    const titleNorm = title.trim() ? title.trim() : null;

    const countStr = window.prompt("この章の問題数を入力（1〜）");
    if (!countStr) return;

    const chapterCount = Number(countStr);
    if (!Number.isInteger(chapterCount) || chapterCount <= 0) {
      alert("章の問題数は 1 以上の整数で入力してください。");
      return;
    }

    // ★章は「末尾に追加」：開始は現在の問題数
    const startIdx = activeGrade.problem_count; // 0-based
    const endIdx = startIdx + (chapterCount - 1);
    const requiredTotal = endIdx + 1;

    // ★必要なら問題集を拡張（problem_count/marks/labels を伸ばす）
    const res = await expandWorkbookIfNeeded(activeGrade, requiredTotal);
    if (!res.ok) return;

    // 章のメモ類（今まで通り）
    const note = window.prompt("章の備考（生徒向け）", "") ?? "";
    const teacherMemo = window.prompt("先生メモ（先生のみ）", "") ?? "";
    const homework = window.prompt("次回宿題（先生のみ）", "") ?? "";

    const payload: Record<string, unknown> = {
      grade_id: activeGrade.id,
      start_idx: startIdx,
      end_idx: endIdx,
      chapter_title: titleNorm,
      chapter_note: note,
      teacher_memo: teacherMemo,
      next_homework: homework,
      note: note, // 互換用
    };

    const { data, error } = await supabase
      .from("student_grade_notes")
      .insert([payload])
      .select("id,grade_id,start_idx,end_idx,chapter_title,chapter_note,teacher_memo,next_homework,note,created_at,updated_at")
      .single();

    if (error) {
      alert("章作成失敗: " + error.message);
      return;
    }

    const c = data as ChapterRow;

    setChapters((prev) => {
      const next = [...prev, c].sort((a, b) => a.start_idx - b.start_idx || a.end_idx - b.end_idx);
      return next;
    });
    setActiveChapterId(c.id);

    setChapterDraft((prev) => ({
      ...prev,
      [c.id]: {
        chapter_note: (c.chapter_note ?? c.note ?? "") as string,
        teacher_memo: (c.teacher_memo ?? "") as string,
        next_homework: (c.next_homework ?? "") as string,
      },
    }));
  }

  async function deleteChapter(c: ChapterRow) {
    if (!confirm(`「${chapterLabel(c)}」を削除します。よろしいですか？`)) return;

    const { error } = await supabase.from("student_grade_notes").delete().eq("id", c.id);
    if (error) {
      alert("削除失敗: " + error.message);
      return;
    }

    setChapters((prev) => prev.filter((x) => x.id !== c.id));
    setActiveChapterId((prev) => (prev === c.id ? null : prev));

    setChapterDraft((prev) => {
      const next = { ...prev };
      delete next[c.id];
      return next;
    });
  }

  async function renameChapter(c: ChapterRow) {
    const nextName = window.prompt("章名を入力（空で章名なし）", c.chapter_title ?? "") ?? null;
    if (nextName == null) return;

    const normalized = nextName.trim() ? nextName.trim() : null;

    const { error } = await supabase
      .from("student_grade_notes")
      .update({ chapter_title: normalized, updated_at: new Date().toISOString() })
      .eq("id", c.id);

    if (error) {
      alert("章名更新失敗: " + error.message);
      return;
    }

    setChapters((prev) => prev.map((x) => (x.id === c.id ? { ...x, chapter_title: normalized, updated_at: new Date().toISOString() } : x)));
  }

  function scheduleSaveChapterFields(chapterId: string) {
    if (chapterSaveTimers.current[chapterId]) window.clearTimeout(chapterSaveTimers.current[chapterId]);

    chapterSaveTimers.current[chapterId] = window.setTimeout(async () => {
      const d = chapterDraftRef.current[chapterId];
      if (!d) return;

      const { error } = await supabase
        .from("student_grade_notes")
        .update({
          chapter_note: d.chapter_note,
          teacher_memo: d.teacher_memo,
          next_homework: d.next_homework,

          // 互換用
          note: d.chapter_note,

          updated_at: new Date().toISOString(),
        })
        .eq("id", chapterId);

      if (error) setErr("章メモ保存失敗: " + error.message);

      // UI updated_at 反映（「直近編集章」などに効く）
      setChapters((prev) =>
        prev.map((c) => (c.id === chapterId ? { ...c, chapter_note: d.chapter_note, teacher_memo: d.teacher_memo, next_homework: d.next_homework, note: d.chapter_note, updated_at: new Date().toISOString() } : c))
      );
    }, 700);
  }

  // ---------- computed ----------
  const gradeSummary = useMemo(() => (activeGrade ? summarize(activeGrade.marks) : null), [activeGrade]);

  const chapterProblemItems = useMemo(() => {
    if (!activeGrade || !activeChapter) return [];
    const { lo, hi } = chapterRangeIndices(activeChapter, activeGrade);
    const items: Array<{ idx: number; label: string; mark: Mark }> = [];
    for (let i = lo; i <= hi; i++) {
      const mark = activeGrade.marks[i] ?? "";
      if (!shouldShowByFilter(mark, filterMode)) continue;
      items.push({ idx: i, label: labelOf(activeGrade, i), mark });
    }
    return items;
  }, [activeGrade, activeChapter, filterMode]);

  // ---------- ui ----------
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 14, fontWeight: 950, color: "#0f172a" }}>問題集 / 章 編集</div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={ghostBtn()} onClick={loadGrades} disabled={loading}>
            再読み込み
          </button>
          <button style={ghostBtn()} onClick={addWorkbook}>
            ＋ 問題集追加
          </button>
        </div>
      </div>

      {err && <div style={errorBox()}>{err}</div>}
      {loading && <div style={muted()}>読み込み中...</div>}

      {/* main layout */}
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 12, alignItems: "start" }}>
        {/* left: workbook + chapters */}
        <div style={panel()}>
          <div style={{ fontWeight: 950, color: "#0f172a", fontSize: 13, marginBottom: 10 }}>問題集</div>

          {grades.length === 0 ? (
            <div style={muted()}>問題集がありません。</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {grades.map((g) => {
                const active = g.id === activeGradeId;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      setActiveGradeId(g.id);
                      setActiveChapterId(null); // 切替時は章選択を初期化（loadChaptersで復帰）
                      setFilterMode("all");
                      setErr(null);
                    }}
                    style={listBtn(active)}
                    title={g.title}
                  >
                    <div style={{ fontWeight: 950, fontSize: 13, color: active ? "#1d4ed8" : "#0f172a", textAlign: "left" }}>
                      {g.title}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textAlign: "left", marginTop: 4 }}>
                      {g.problem_count}問
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {activeGrade && (
            <>
              <div style={{ marginTop: 12, borderTop: "1px dashed rgba(148,163,184,0.35)", paddingTop: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontWeight: 950, color: "#0f172a", fontSize: 13 }}>章一覧</div>
                  <button style={ghostBtn()} onClick={createChapter}>
                    ＋ 章作成
                  </button>
                </div>

                {chapters.length === 0 ? (
                  <div style={{ marginTop: 8, ...muted() }}>章がありません。</div>
                ) : (
                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    {chapters.map((c) => {
                      const active = c.id === activeChapterId;
                      return (
                        <div key={c.id} style={chapterCard(active)}>
                          <button
                            type="button"
                            style={chapterPickBtn(active)}
                            onClick={() => {
                              setActiveChapterId(c.id);
                              setErr(null);
                            }}
                            title={chapterLabel(c)}
                          >
                            <div style={{ fontWeight: 950, fontSize: 12, color: active ? "#1d4ed8" : "#0f172a", textAlign: "left" }}>
                              {chapterLabel(c)}
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textAlign: "left", marginTop: 4 }}>
                              更新: {new Date(c.updated_at).toLocaleString()}
                            </div>
                          </button>

                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <button style={ghostBtn()} onClick={() => renameChapter(c)}>
                              名称
                            </button>
                            <button style={dangerBtn()} onClick={() => deleteChapter(c)}>
                              削除
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button style={dangerOutlineBtn()} onClick={() => activeGrade && deleteWorkbook(activeGrade)}>
                    この問題集を削除
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* right: chapter editor */}
        <div style={panel()}>
          {!activeGrade ? (
            <div style={muted()}>左から問題集を選択してください。</div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 950, color: "#0f172a", fontSize: 14 }}>{activeGrade.title}</div>
                  {gradeSummary && (
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginTop: 4 }}>
                      ○:{gradeSummary.o} ×:{gradeSummary.x} △:{gradeSummary.t} 未:{gradeSummary.blank}
                    </div>
                  )}
                </div>

                {/* filter */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={mutedChip()}>章内フィルタ</span>
                  <button style={chipBtn(filterMode === "all")} onClick={() => setFilterMode("all")}>
                    全て
                  </button>
                  <button style={chipBtn(filterMode === "x")} onClick={() => setFilterMode("x")}>
                    ×のみ
                  </button>
                  <button style={chipBtn(filterMode === "blank")} onClick={() => setFilterMode("blank")}>
                    未のみ
                  </button>
                  <button style={chipBtn(filterMode === "x_blank")} onClick={() => setFilterMode("x_blank")}>
                    ×/未
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 12, borderTop: "1px dashed rgba(148,163,184,0.35)", paddingTop: 12 }}>
                {!activeChapter ? (
                  <div style={muted()}>左の「章一覧」から章を選択してください（無ければ「章作成」）。</div>
                ) : (
                  <>
                    {/* bulk ops */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 950, fontSize: 13, color: "#0f172a" }}>選択中：{chapterLabel(activeChapter)}</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button style={markBtn("O")} onClick={() => bulkSetMarksInChapter("O")}>
                          この章を ○
                        </button>
                        <button style={markBtn("X")} onClick={() => bulkSetMarksInChapter("X")}>
                          この章を ×
                        </button>
                        <button style={markBtn("T")} onClick={() => bulkSetMarksInChapter("T")}>
                          この章を △
                        </button>
                        <button style={markBtn("")} onClick={() => bulkSetMarksInChapter("")}>
                          この章を 未
                        </button>
                      </div>
                    </div>

                    {/* marks grid (chapter only) */}
                    {activeGrade && (
                      <div
                        style={{
                          marginTop: 12,
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, 46px)",
                          gap: 8,
                          justifyContent: "start",
                        }}
                      >
                        {chapterProblemItems.map((it) => (
                          <button
                            key={it.idx}
                            type="button"
                            onClick={() => updateMarkLocal(activeGrade.id, it.idx, cycleMark(it.mark))}
                            style={markTile(it.mark, true, false)}
                            title={`${it.label} ${it.mark ? MARK_LABEL[it.mark] : "未"}`}
                          >
                            <div style={{ lineHeight: 1, fontSize: 16, fontWeight: 950 }}>{it.mark ? MARK_LABEL[it.mark] : ""}</div>
                            <div style={tileLabel()}>{it.label}</div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* chapter notes / teacher memo / homework */}
                    <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                      <div style={notePanel()}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                          <div style={{ fontWeight: 950, color: "#0f172a", fontSize: 12 }}>備考（生徒向け）</div>
                          <span style={mutedChip()}>章単位</span>
                        </div>
                        <textarea
                          value={chapterDraft[activeChapter.id]?.chapter_note ?? (activeChapter.chapter_note ?? activeChapter.note ?? "")}
                          onChange={(e) => {
                            const v = e.target.value;
                            setChapterDraft((p) => ({
                              ...p,
                              [activeChapter.id]: {
                                chapter_note: v,
                                teacher_memo: p[activeChapter.id]?.teacher_memo ?? (activeChapter.teacher_memo ?? ""),
                                next_homework: p[activeChapter.id]?.next_homework ?? (activeChapter.next_homework ?? ""),
                              },
                            }));
                            scheduleSaveChapterFields(activeChapter.id);
                          }}
                          style={noteArea()}
                          placeholder="生徒に見せる備考（章の説明・注意点など）"
                        />
                      </div>

                      <div style={notePanel()}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                          <div style={{ fontWeight: 950, color: "#0f172a", fontSize: 12 }}>先生メモ</div>
                          <span style={mutedChip()}>先生のみ</span>
                        </div>
                        <textarea
                          value={chapterDraft[activeChapter.id]?.teacher_memo ?? (activeChapter.teacher_memo ?? "")}
                          onChange={(e) => {
                            const v = e.target.value;
                            setChapterDraft((p) => ({
                              ...p,
                              [activeChapter.id]: {
                                chapter_note: p[activeChapter.id]?.chapter_note ?? (activeChapter.chapter_note ?? activeChapter.note ?? ""),
                                teacher_memo: v,
                                next_homework: p[activeChapter.id]?.next_homework ?? (activeChapter.next_homework ?? ""),
                              },
                            }));
                            scheduleSaveChapterFields(activeChapter.id);
                          }}
                          style={noteArea()}
                          placeholder="指導方針、弱点、次回やること、保護者連絡など"
                        />
                      </div>

                      <div style={notePanel()}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                          <div style={{ fontWeight: 950, color: "#0f172a", fontSize: 12 }}>次回宿題</div>
                          <span style={mutedChip()}>章単位</span>
                        </div>
                        <textarea
                          value={chapterDraft[activeChapter.id]?.next_homework ?? (activeChapter.next_homework ?? "")}
                          onChange={(e) => {
                            const v = e.target.value;
                            setChapterDraft((p) => ({
                              ...p,
                              [activeChapter.id]: {
                                chapter_note: p[activeChapter.id]?.chapter_note ?? (activeChapter.chapter_note ?? activeChapter.note ?? ""),
                                teacher_memo: p[activeChapter.id]?.teacher_memo ?? (activeChapter.teacher_memo ?? ""),
                                next_homework: v,
                              },
                            }));
                            scheduleSaveChapterFields(activeChapter.id);
                          }}
                          style={noteArea()}
                          placeholder="例：次回までに1〜20の×/未をやり直し。時間：30分。"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================= styles ================= */

function muted(): React.CSSProperties {
  return { fontSize: 13, fontWeight: 800, color: "#64748b" };
}

function errorBox(): React.CSSProperties {
  return {
    fontSize: 13,
    fontWeight: 900,
    color: "#b91c1c",
    background: "rgba(254,242,242,0.92)",
    border: "1px solid rgba(220,38,38,0.25)",
    borderRadius: 14,
    padding: "10px 12px",
    whiteSpace: "pre-wrap",
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

function dangerOutlineBtn(): React.CSSProperties {
  return {
    border: "1px solid rgba(220,38,38,0.35)",
    background: "rgba(255,255,255,0.92)",
    borderRadius: 9999,
    padding: "8px 12px",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
    color: "#dc2626",
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

function chipBtn(active: boolean): React.CSSProperties {
  return {
    border: active ? "1px solid rgba(37,99,235,0.35)" : "1px solid rgba(148,163,184,0.22)",
    background: active ? "rgba(219,234,254,0.85)" : "rgba(255,255,255,0.92)",
    borderRadius: 9999,
    padding: "8px 10px",
    fontWeight: 950,
    fontSize: 12,
    cursor: "pointer",
    color: active ? "#1d4ed8" : "#0f172a",
    whiteSpace: "nowrap",
  };
}

function listBtn(active: boolean): React.CSSProperties {
  return {
    width: "100%",
    border: active ? "1px solid rgba(37,99,235,0.35)" : "1px solid rgba(148,163,184,0.22)",
    background: active ? "rgba(219,234,254,0.65)" : "rgba(255,255,255,0.92)",
    borderRadius: 14,
    padding: "10px 10px",
    cursor: "pointer",
  };
}

function chapterCard(active: boolean): React.CSSProperties {
  return {
    borderRadius: 14,
    border: active ? "1px solid rgba(37,99,235,0.35)" : "1px solid rgba(148,163,184,0.18)",
    background: active ? "rgba(219,234,254,0.55)" : "rgba(248,250,252,0.85)",
    padding: 10,
    display: "grid",
    gap: 8,
  };
}

function chapterPickBtn(active: boolean): React.CSSProperties {
  return {
    all: "unset",
    cursor: "pointer",
    borderRadius: 12,
    padding: "8px 8px",
    background: "rgba(255,255,255,0.75)",
    border: active ? "1px solid rgba(37,99,235,0.35)" : "1px solid rgba(148,163,184,0.18)",
  } as React.CSSProperties;
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

function notePanel(): React.CSSProperties {
  return {
    borderRadius: 14,
    border: "1px dashed rgba(148,163,184,0.35)",
    background: "rgba(248,250,252,0.85)",
    padding: 10,
  };
}

function noteArea(): React.CSSProperties {
  return {
    width: "100%",
    minHeight: 72,
    resize: "vertical",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.22)",
    background: "rgba(255,255,255,0.95)",
    padding: 10,
    fontSize: 13,
    fontWeight: 800,
    color: "#0f172a",
    outline: "none",
    marginTop: 8,
  };
}
