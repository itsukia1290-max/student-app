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
  workbook_id?: string | null;
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
  mode?: "student" | "template";
};

type FilterMode = "all" | "x" | "blank" | "x_blank";

function cycleMark(cur: Mark): Mark {
  if (cur === "") return "O";
  if (cur === "O") return "X";
  if (cur === "X") return "T";
  return "";
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export default function TeacherGradesPanel({ ownerUserId, mode = "student" }: Props) {
  const isTemplate = mode === "template";
  // grades
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

  // create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newWorkbookTitle, setNewWorkbookTitle] = useState("");
  const [newChapters, setNewChapters] = useState([{ title: "", count: 10 }]);

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

    let q = supabase
      .from("student_grades")
      .select("id,user_id,workbook_id,title,problem_count,marks,labels,created_at,updated_at")
      .eq("user_id", ownerUserId)
      .order("created_at", { ascending: true });

    // テンプレ編集モード = workbook_id があるものだけ
    if (mode === "template") {
      q = q.not("workbook_id", "is", null);
    }

    const { data, error } = await q;

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
        workbook_id: (r.workbook_id as string) ?? null,
        title: r.title as string,
        problem_count: r.problem_count as number,
        marks,
        labels,
        created_at: r.created_at as string,
        updated_at: r.updated_at as string,
      };
    });

    setGrades(mapped);

    const first = mapped[0]?.id ?? null;
    setActiveGradeId((prev) => prev ?? first);

    setLoading(false);
  }, [ownerUserId, mode]);

  const loadChapters = useCallback(async (gradeId: string) => {
    if (!gradeId) return;

    const { data, error } = await supabase
      .from("student_grade_notes")
      .select("id,grade_id,start_idx,end_idx,chapter_title,chapter_note,teacher_memo,next_homework,note,created_at,updated_at")
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

    // default select: last updated
    if (list.length > 0) {
      const sorted = [...list].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
      setActiveChapterId((prev) => prev ?? sorted[0].id);
    } else {
      setActiveChapterId(null);
    }
  }, []);

  useEffect(() => {
    loadGrades();
  }, [loadGrades]);

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

  function applyHover(el: HTMLButtonElement, hovering: boolean) {
    const base = el.dataset.baseBg ?? "rgba(255,255,255,0.92)";
    const hover = el.dataset.hoverBg ?? "rgba(219,234,254,0.55)";
    el.style.background = hovering ? hover : base;
  }

  // ---------- grade ops ----------
  async function createWorkbookWithChapters() {
    if (!newWorkbookTitle.trim()) {
      alert("問題集名を入力してください");
      return;
    }

    const total = newChapters.reduce((sum, c) => sum + Number(c.count || 0), 0);
    if (total <= 0) {
      alert("章の問題数を設定してください");
      return;
    }

    // 1. grade 作成
    const { data, error } = await supabase
      .from("student_grades")
      .insert([
        {
          user_id: ownerUserId,
          title: newWorkbookTitle.trim(),
          problem_count: total,
          marks: Array(total).fill(""),
          labels: Array.from({ length: total }, (_, i) => String(i + 1)),
        },
      ])
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    // 2. 章生成
    let cursor = 0;
    const chapterPayload = newChapters.map((ch) => {
      const start = cursor;
      const end = cursor + ch.count - 1;
      cursor += ch.count;

      return {
        grade_id: data.id,
        start_idx: start,
        end_idx: end,
        chapter_title: ch.title,
      };
    });

    await supabase.from("student_grade_notes").insert(chapterPayload);

    setCreateOpen(false);
    setNewWorkbookTitle("");
    setNewChapters([{ title: "", count: 10 }]);

    loadGrades();
  }

  async function deleteWorkbook(g: GradeRow) {
    if (!confirm(`問題集「${g.title}」を削除します。よろしいですか？`)) return;

    const { error } = await supabase.from("student_grades").delete().eq("id", g.id);
    if (error) {
      alert("削除失敗: " + error.message);
      return;
    }

    setGrades((prev) => prev.filter((x) => x.id !== g.id));
    setActiveGradeId(null);
    setChapters([]);
    setActiveChapterId(null);
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
    if (isTemplate) return;
    setGrades((prev) =>
      prev.map((g) => (g.id === gradeId ? { ...g, marks: g.marks.map((m, i) => (i === idx ? next : m)) } : g))
    );
    scheduleSaveMarks(gradeId);
  }

  async function bulkSetMarksInChapter(mark: Mark) {
    if (isTemplate) return;
    if (!activeGrade || !activeChapter) return;
    const { lo, hi } = chapterRangeIndices(activeChapter, activeGrade);

    setGrades((prev) =>
      prev.map((g) => {
        if (g.id !== activeGrade.id) return g;
        const nextMarks = g.marks.map((m, i) => (i >= lo && i <= hi ? mark : m));
        return { ...g, marks: nextMarks };
      })
    );

    scheduleSaveMarks(activeGrade.id);
  }

  function scheduleSaveChapterFields(chapterId: string) {
    if (isTemplate) return; // ⚠ テンプラでは保存しない
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
          note: d.chapter_note,
          updated_at: new Date().toISOString(),
        })
        .eq("id", chapterId);

      if (error) setErr("章メモ保存失敗: " + error.message);

      setChapters((prev) =>
        prev.map((c) =>
          c.id === chapterId
            ? {
                ...c,
                chapter_note: d.chapter_note,
                teacher_memo: d.teacher_memo,
                next_homework: d.next_homework,
                note: d.chapter_note,
                updated_at: new Date().toISOString(),
              }
            : c
        )
      );
    }, 700);
  }

  // ---------- computed ----------
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
      {createOpen && (
        <div style={modalOverlay()}>
          <div style={modalCard()}>
            <div style={modalTitle()}>問題集を作成</div>

            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <div style={labelStyle()}>問題集名</div>
                <input
                  value={newWorkbookTitle}
                  onChange={(e) => setNewWorkbookTitle(e.target.value)}
                  style={inputStyle()}
                />
              </div>

              <div>
                <div style={labelStyle()}>章設定</div>

                {newChapters.map((ch, i) => (
                  <div key={i} style={chapterRowStyle()}>
                    <input
                      placeholder="章名"
                      value={ch.title}
                      onChange={(e) => {
                        const next = [...newChapters];
                        next[i].title = e.target.value;
                        setNewChapters(next);
                      }}
                      style={inputStyle()}
                    />

                    <input
                      type="number"
                      min={1}
                      value={ch.count}
                      onChange={(e) => {
                        const next = [...newChapters];
                        next[i].count = Number(e.target.value);
                        setNewChapters(next);
                      }}
                      style={{ ...inputStyle(), width: 80 }}
                    />

                    <button
                      onClick={() =>
                        setNewChapters((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      style={smallDeleteBtn()}
                    >
                      🗑
                    </button>
                  </div>
                ))}

                <button
                  onClick={() =>
                    setNewChapters((prev) => [...prev, { title: "", count: 5 }])
                  }
                  style={addChapterBtn()}
                >
                  ＋ 章を追加
                </button>

                <div style={{ marginTop: 8, fontWeight: 900 }}>
                  合計問題数：
                  {newChapters.reduce((sum, c) => sum + Number(c.count || 0), 0)}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button onClick={() => setCreateOpen(false)} style={cancelBtn()}>
                  キャンセル
                </button>

                <button onClick={createWorkbookWithChapters} style={primaryBtn()}>
                  作成
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {err && <div style={errorBox()}>{err}</div>}
      {loading && <div style={muted()}>読み込み中...</div>}

      {/* main layout */}
      <div style={{ display: "grid", gridTemplateColumns: "280px minmax(0, 1fr)", gap: 12, alignItems: "start" }}>
        {/* left: workbook + chapters */}
        <div style={panel()}>
          <div style={mainSectionHeader()}>
            {mode === "template" ? "テンプレ問題集" : "問題集"}
          </div>
          <div style={mainSectionDivider()} />

          {grades.length === 0 ? (
            <div style={muted()}>{mode === "template" ? "テンプレがありません。" : "問題集がありません。"}</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {grades.map((g) => {
                const active = g.id === activeGradeId;

                return (
                  <div key={g.id} style={{ display: "grid", gap: 6 }}>
                    {/* 問題集ボタン */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveGradeId(g.id);
                        setActiveChapterId(null);
                        setFilterMode("all");
                        setErr(null);
                      }}
                      style={listBtn(active)}
                      data-base-bg={active ? "rgba(219,234,254,0.65)" : "rgba(255,255,255,0.92)"}
                      data-hover-bg="rgba(219,234,254,0.55)"
                      onMouseEnter={(e) => applyHover(e.currentTarget, true)}
                      onMouseLeave={(e) => applyHover(e.currentTarget, false)}
                    >
                      <div style={{ fontWeight: 950 }}>
                        {g.title}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginTop: 4 }}>
                        {g.problem_count}問
                      </div>
                    </button>

                    {/* ▼ 展開部分（activeのときだけ表示） */}
                    {active && (
                      <div style={expandedChapterArea()}>
                        {chapters.length === 0 ? (
                          <div style={muted()}>章がありません。</div>
                        ) : (
                          chapters.map((c) => {
                            const cActive = c.id === activeChapterId;
                            return (
                              <div key={c.id} style={chapterRow()}>
                                <button
                                  type="button"
                                  style={chapterInlineBtn(cActive)}
                                  onClick={() => setActiveChapterId(c.id)}
                                  data-base-bg={cActive ? "rgba(219,234,254,0.65)" : "rgba(255,255,255,0.92)"}
                                  data-hover-bg="rgba(219,234,254,0.55)"
                                  onMouseEnter={(e) => applyHover(e.currentTarget, true)}
                                  onMouseLeave={(e) => applyHover(e.currentTarget, false)}
                                >
                                  {chapterLabel(c)}
                                </button>

                                {!isTemplate && (
                                  <button
                                    type="button"
                                    onClick={() => deleteChapter(c)}
                                    style={chapterDeleteBtn()}
                                    title="章を削除"
                                  >
                                    🗑
                                  </button>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {mode === "student" && (
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  style={addWorkbookRowBtn()}
                  onMouseEnter={(e) => applyHover(e.currentTarget, true)}
                  onMouseLeave={(e) => applyHover(e.currentTarget, false)}
                >
                  ＋ 問題集を追加
                </button>
              )}

              {mode === "student" && activeGrade && (
                <button
                  type="button"
                  onClick={() => deleteWorkbook(activeGrade)}
                  style={deleteWorkbookRowBtn()}
                  disabled={loading}
                  title={`「${activeGrade.title}」を削除`}
                >
                  🗑 この問題集を削除
                </button>
              )}
            </div>
          )}
        </div>

        {/* right: chapter editor */}
        <div style={panel()}>
          {!activeGrade ? (
            <div style={muted()}>左から{mode === "template" ? "テンプレ" : "問題集"}を選択してください。</div>
          ) : (
            <>
              {/* 章内フィルタ（ヘッダーカードは廃止） */}
              <div style={filterBar()}>
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

              <div>
                {!activeChapter ? (
                  <div style={muted()}>左の「章一覧」から章を選択してください（無ければ「章作成」）。</div>
                ) : (
                  <>
                    {isTemplate && (
                      <div
                        style={{
                          margin: "10px 0 12px",
                          padding: "10px 12px",
                          borderRadius: 12,
                          background: "rgba(245,158,11,0.12)",
                          border: "1px solid rgba(245,158,11,0.22)",
                          color: "#0f172a",
                          fontWeight: 900,
                          fontSize: 12,
                          lineHeight: 1.5,
                        }}
                      >
                        この画面は<strong>共通テンプレ</strong>です。〇×△（達成状況）は編集できません。
                        <br />
                        達成状況は「生徒を選択して成績編集」側で変更してください。
                      </div>
                    )}
                    {/* bulk ops */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                        <span style={sectionTitle()}>選択中</span>
                        <span style={{ fontWeight: 950, color: "#0f172a", fontSize: 13 }}>{chapterLabel(activeChapter)}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          style={markBtn("O", isTemplate)}
                          onClick={() => bulkSetMarksInChapter("O")}
                          disabled={isTemplate}
                          title={isTemplate ? "共通テンプレでは変更できません" : ""}
                        >
                          この章を ○
                        </button>
                        <button
                          style={markBtn("X", isTemplate)}
                          onClick={() => bulkSetMarksInChapter("X")}
                          disabled={isTemplate}
                          title={isTemplate ? "共通テンプレでは変更できません" : ""}
                        >
                          この章を ×
                        </button>
                        <button
                          style={markBtn("T", isTemplate)}
                          onClick={() => bulkSetMarksInChapter("T")}
                          disabled={isTemplate}
                          title={isTemplate ? "共通テンプレでは変更できません" : ""}
                        >
                          この章を △
                        </button>
                        <button
                          style={markBtn("", isTemplate)}
                          onClick={() => bulkSetMarksInChapter("")}
                          disabled={isTemplate}
                          title={isTemplate ? "共通テンプレでは変更できません" : ""}
                        >
                          この章を 未
                        </button>
                      </div>
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
                      {chapterProblemItems.map((it) => (
                        <button
                          key={it.idx}
                          type="button"
                          onClick={() => updateMarkLocal(activeGrade.id, it.idx, cycleMark(it.mark))}
                          style={markTile(it.mark, !isTemplate, false)}
                          title={
                            isTemplate
                              ? "共通テンプレでは変更できません"
                              : `${it.label} ${it.mark ? MARK_LABEL[it.mark] : "未"}`
                          }
                          disabled={isTemplate}
                        >
                          <div style={{ lineHeight: 1, fontSize: 16, fontWeight: 950 }}>{it.mark ? MARK_LABEL[it.mark] : ""}</div>
                          <div style={tileLabel()}>{it.label}</div>
                        </button>
                      ))}
                    </div>

                    {/* notes */}
                    <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                      <div style={notePanel()}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                          <div style={sectionHeading()}>備考（生徒向け）</div>
                          <span style={mutedChip()}>章単位</span>
                        </div>
                        <textarea
                          value={chapterDraft[activeChapter.id]?.chapter_note ?? (activeChapter.chapter_note ?? activeChapter.note ?? "")}
                          onChange={(e) => {
                            if (isTemplate) return; // ⚠ テンプレーでは編集不可
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
                          disabled={isTemplate}
                          style={isTemplate ? lockedNoteArea() : noteArea()}
                          placeholder={isTemplate ? "（テンプレートでは編集できません。生徒の成績編集画面で入力してください）" : "生徒に見せる備考（章の説明・注意点など）"}
                        />
                      </div>

                      <div style={{ height: 1, background: "rgba(148,163,184,0.22)" }} />

                      <div style={notePanel()}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                          <div style={sectionHeading()}>先生メモ</div>
                          <span style={mutedChip()}>先生のみ</span>
                        </div>
                        <textarea
                          value={chapterDraft[activeChapter.id]?.teacher_memo ?? (activeChapter.teacher_memo ?? "")}
                          onChange={(e) => {
                            if (isTemplate) return;
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
                          disabled={isTemplate}
                          style={isTemplate ? lockedNoteArea() : noteArea()}
                          placeholder={isTemplate ? "（テンプレートでは編集できません。生徒の成績編集画面で入力してください）" : "指導方針、弱点、次回やること、保護者連絡など"}
                        />
                      </div>

                      <div style={{ height: 1, background: "rgba(148,163,184,0.22)" }} />

                      <div style={notePanel()}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                          <div style={sectionHeading()}>次回宿題</div>
                          <span style={mutedChip()}>章単位</span>
                        </div>
                        <textarea
                          value={chapterDraft[activeChapter.id]?.next_homework ?? (activeChapter.next_homework ?? "")}
                          onChange={(e) => {
                            if (isTemplate) return;
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
                          disabled={isTemplate}
                          style={isTemplate ? lockedNoteArea() : noteArea()}
                          placeholder={isTemplate ? "（テンプレートでは編集できません。生徒の成績編集画面で入力してください）" : "例：次回までに1〜20の×/未をやり直し。時間：30分。"}
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

function sectionTitle(): React.CSSProperties {
  return {
    fontWeight: 1000,
    color: "#0f172a",
    fontSize: 12,
    letterSpacing: "0.02em",
    textTransform: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  };
}

function sectionHeading(): React.CSSProperties {
  return {
    fontSize: 14,
    fontWeight: 950,
    color: "#0f172a",
    letterSpacing: 0.2,
  };
}

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
    border: "2px solid rgba(15,23,42,0.15)",
    background: "#fff",
    borderRadius: 16,
    padding: "12px 12px",
    cursor: "pointer",
    position: "relative",
    fontWeight: active ? 950 : 900,
    transition: "all 0.15s ease",
    boxShadow: active
      ? "0 0 0 1px rgba(37,99,235,0.18)"
      : "none",
  };
}

function markBtn(mark: Mark, disabled?: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    borderRadius: 9999,
    padding: "8px 12px",
    fontWeight: 950,
    fontSize: 12,
    cursor: disabled ? "not-allowed" : "pointer",
    border: "1px solid rgba(148,163,184,0.22)",
    opacity: disabled ? 0.6 : 1,
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

function lockedNoteArea(): React.CSSProperties {
  return {
    ...noteArea(),
    background: "rgba(148,163,184,0.10)",
    color: "#64748b",
    cursor: "not-allowed",
  };
}

function mainSectionHeader(): React.CSSProperties {
  return {
    fontSize: 18,
    fontWeight: 1000,
    color: "#0f172a",
    letterSpacing: "0.02em",
    marginBottom: 6,
  };
}

function mainSectionDivider(): React.CSSProperties {
  return {
    height: 3,
    width: "fit-content",
    minWidth: 60,
    background: "linear-gradient(90deg, rgba(37,99,235,0.45), rgba(37,99,235,0.15))",
    borderRadius: 999,
    marginBottom: 14,
  };
}

function filterBar(): React.CSSProperties {
  return {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 10,
    marginBottom: 10,
    borderBottom: "1px solid rgba(148,163,184,0.18)",
  };
}

function expandedChapterArea(): React.CSSProperties {
  return {
    marginLeft: 16,
    paddingLeft: 10,
    borderLeft: "2px solid rgba(37,99,235,0.20)",
    display: "grid",
    gap: 6,
  };
}

function chapterInlineBtn(active: boolean): React.CSSProperties {
  return {
    textAlign: "left",
    borderRadius: 10,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 900,
    border: active
      ? "1px solid rgba(37,99,235,0.35)"
      : "1px solid rgba(148,163,184,0.22)",
    background: active
      ? "rgba(219,234,254,0.65)"
      : "rgba(255,255,255,0.92)",
    cursor: "pointer",
  };
}

function addWorkbookRowBtn(): React.CSSProperties {
  return {
    width: "100%",
    borderRadius: 14,
    padding: "10px 10px",
    cursor: "pointer",
    border: "1px dashed rgba(37,99,235,0.35)",
    background: "rgba(255,255,255,0.92)",
    color: "#1d4ed8",
    fontWeight: 1000,
    fontSize: 12,
    textAlign: "center",
  };
}

function deleteWorkbookRowBtn(): React.CSSProperties {
  return {
    width: "100%",
    borderRadius: 14,
    padding: "10px 10px",
    cursor: "pointer",
    border: "1px solid rgba(220,38,38,0.30)",
    background: "rgba(254,242,242,0.92)",
    color: "#dc2626",
    fontWeight: 1000,
    fontSize: 12,
    textAlign: "center",
  };
}

function chapterRow(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1fr 34px",
    gap: 8,
    alignItems: "center",
  };
}

function chapterDeleteBtn(): React.CSSProperties {
  return {
    height: 32,
    width: 34,
    borderRadius: 10,
    border: "1px solid rgba(220,38,38,0.28)",
    background: "rgba(254,242,242,0.92)",
    color: "#dc2626",
    cursor: "pointer",
    fontWeight: 1000,
    display: "grid",
    placeItems: "center",
  };
}

function modalOverlay(): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  };
}

function modalCard(): React.CSSProperties {
  return {
    width: 520,
    background: "#fff",
    borderRadius: 18,
    padding: 20,
    boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
  };
}

function modalTitle(): React.CSSProperties {
  return { fontSize: 18, fontWeight: 1000, marginBottom: 16 };
}

function labelStyle(): React.CSSProperties {
  return { fontWeight: 900, fontSize: 13, marginBottom: 6 };
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.30)",
  };
}

function chapterRowStyle(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1fr 80px 40px",
    gap: 8,
    marginBottom: 6,
  };
}

function smallDeleteBtn(): React.CSSProperties {
  return {
    borderRadius: 8,
    border: "1px solid rgba(220,38,38,0.30)",
    background: "rgba(254,242,242,0.92)",
    cursor: "pointer",
  };
}

function addChapterBtn(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px dashed rgba(37,99,235,0.35)",
    background: "rgba(255,255,255,0.92)",
    color: "#1d4ed8",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
  };
}

function cancelBtn(): React.CSSProperties {
  return {
    padding: "8px 14px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.3)",
    background: "#fff",
    cursor: "pointer",
  };
}

function primaryBtn(): React.CSSProperties {
  return {
    padding: "8px 14px",
    borderRadius: 10,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  };
}


