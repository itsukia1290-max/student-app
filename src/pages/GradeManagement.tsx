// src/pages/GradeManagement.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useIsStaff } from "../hooks/useIsStaff";
import TeacherGradesPanel from "../components/report/TeacherGradesPanel";

const colors = {
  bg: "#f0f9ff",
  card: "#ffffff",
  border: "#e5e7eb",
  textMain: "#0f172a",
  textSub: "#475569",
  sky: "#0ea5e9",
  skySoft: "#e0f2fe",
  red: "#ef4444",
  redSoft: "#fee2e2",
};

const styles = {
  page: {
    minHeight: "100vh",
    background: `linear-gradient(to bottom, ${colors.bg}, #ffffff)`,
    padding: "24px",
  },
  container: {
    maxWidth: "1280px", // ✅ 広げる
    margin: "0 auto",
    display: "flex",
    flexDirection: "column" as const,
    gap: "24px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap" as const,
  },
  title: {
    fontSize: "22px",
    fontWeight: 700,
    color: colors.textMain,
  },
  subtitle: {
    fontSize: "13px",
    color: colors.textSub,
    marginTop: "4px",
    fontWeight: 700,
  },
  card: {
    background: colors.card,
    borderRadius: "18px",
    border: `1px solid ${colors.border}`,
    boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
  },
  cardHeader: {
    padding: "16px 20px",
    borderBottom: `1px solid ${colors.border}`,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap" as const,
  },
  cardBody: {
    padding: "16px 20px",
  },
  badge: {
    fontSize: "12px",
    padding: "4px 10px",
    borderRadius: "999px",
    background: colors.skySoft,
    color: colors.sky,
    fontWeight: 700,
    whiteSpace: "nowrap" as const,
  },
  btnPrimary: {
    background: colors.sky,
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  btnGhost: {
    background: "#fff",
    border: `1px solid ${colors.border}`,
    borderRadius: "12px",
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  error: {
    marginTop: "10px",
    fontSize: "13px",
    fontWeight: 800,
    color: colors.red,
    background: colors.redSoft,
    border: `1px solid rgba(239, 68, 68, 0.25)`,
    borderRadius: 12,
    padding: "10px 12px",
    whiteSpace: "pre-wrap" as const,
  },
};

type StudentMini = { id: string; name: string | null; phone: string | null; memo: string | null };

type TemplateMini = { id: string; title: string; total_problems: number };

export default function GradeManagement() {
  const { isStaff } = useIsStaff();
  const canUse = isStaff;

  const [teacherId, setTeacherId] = useState<string | null>(null);

  // --- template ---
  const [templates, setTemplates] = useState<TemplateMini[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [tplBusy, setTplBusy] = useState(false);
  const [tplMsg, setTplMsg] = useState<string | null>(null);

  // === common workbook card accordion ===
  const [commonOpen, setCommonOpen] = useState(false); // デフォルト：折りたたみ

  // --- counts ---
  const [approvedCount, setApprovedCount] = useState<number>(0);

  // --- student selection ---
  const [students, setStudents] = useState<StudentMini[]>([]);
  const [studentLoading, setStudentLoading] = useState(false);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedStudent = useMemo(() => students.find((s) => s.id === selectedId) ?? null, [students, selectedId]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setTeacherId(data.user?.id ?? null);
    })();
  }, []);

  async function refreshCounts() {
    if (!canUse) return;

    const { count, error } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "student")
      .eq("status", "active")
      .eq("is_approved", true);

    if (!error) setApprovedCount(count ?? 0);
  }

  async function loadStudents() {
    setStudentLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("id,name,phone,memo")
      .eq("role", "student")
      .eq("status", "active")
      .eq("is_approved", true)
      .order("name", { ascending: true });

    if (!error) setStudents((data ?? []) as StudentMini[]);
    setStudentLoading(false);
  }

  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase();
    if (!key) return students;
    return students.filter((s) => (s.name ?? "").toLowerCase().includes(key));
  }, [students, q]);

  // --- template list ---
  async function loadTemplates() {
    const { data, error } = await supabase
      .from("workbooks")
      .select("id,title,total_problems")
      .order("created_at", { ascending: false });

    if (error) return;

    const list = (data ?? []) as TemplateMini[];
    setTemplates(list);
    setActiveTemplateId((prev) => prev ?? list[0]?.id ?? null);
  }

  useEffect(() => {
    if (!canUse) return;
    refreshCounts();
    loadStudents();
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUse]);

  // --- template actions ---
  async function createTemplate() {
    if (!teacherId) return;
    const title = window.prompt("共通テンプレ名を入力してください（例：英語 基礎問題）");
    if (!title) return;

    setTplBusy(true);
    setTplMsg(null);

    // 1) workbooks 作成（最初0問）
    const { data: wb, error: wbErr } = await supabase
      .from("workbooks")
      .insert([{ title: title.trim(), total_problems: 0 }])
      .select("id,title,total_problems")
      .single();

    if (wbErr) {
      setTplMsg("テンプレ作成失敗(workbooks): " + wbErr.message);
      setTplBusy(false);
      return;
    }

    // 2) 先生用編集データ（student_grades）を作る
    const { error: gErr } = await supabase.from("student_grades").insert([
      {
        user_id: teacherId,
        workbook_id: wb.id,
        title: wb.title,
        problem_count: 0,
        marks: [],
        labels: [],
      },
    ]);

    if (gErr) {
      setTplMsg("テンプレ作成失敗(student_grades): " + gErr.message);
      setTplBusy(false);
      return;
    }

    await loadTemplates();
    setActiveTemplateId(wb.id);
    setTplMsg(`テンプレ「${wb.title}」を作成しました。下で章を作ってから「全員に配布」してください。`);
    setTplBusy(false);
  }

  async function distributeTemplateToAll() {
    if (!teacherId) return;
    if (!activeTemplateId) {
      setTplMsg("テンプレを選択してください。");
      return;
    }
    if (!confirm("選択中テンプレを承認済み生徒に配布します。章も同期して上書きします。よろしいですか？")) return;

    setTplBusy(true);
    setTplMsg(null);

    // 先生のテンプレ grade を取得（teacherId + workbook_id）
    const { data: tGrade, error: tgErr } = await supabase
      .from("student_grades")
      .select("id,workbook_id,title,problem_count,marks,labels")
      .eq("user_id", teacherId)
      .eq("workbook_id", activeTemplateId)
      .single();

    if (tgErr || !tGrade) {
      setTplMsg("テンプレ編集データが見つかりません: " + (tgErr?.message ?? "unknown"));
      setTplBusy(false);
      return;
    }

    // テンプレ章取得
    const { data: templateChapters, error: chErr } = await supabase
      .from("student_grade_notes")
      .select("start_idx,end_idx,chapter_title,chapter_note,teacher_memo,next_homework,note")
      .eq("grade_id", tGrade.id)
      .order("start_idx", { ascending: true });

    if (chErr) {
      setTplMsg("テンプレ章取得失敗: " + chErr.message);
      setTplBusy(false);
      return;
    }

    // 生徒一覧
    const { data: ps, error: psErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "student")
      .eq("status", "active")
      .eq("is_approved", true);

    if (psErr) {
      setTplMsg("生徒取得失敗: " + psErr.message);
      setTplBusy(false);
      return;
    }

    const studentIds = (ps ?? []).map((r) => r.id as string);
    if (studentIds.length === 0) {
      setTplMsg("配布対象の生徒がいません。");
      setTplBusy(false);
      return;
    }

    const payload = studentIds.map((uid) => ({
      user_id: uid,
      workbook_id: tGrade.workbook_id,
      title: tGrade.title,
      problem_count: tGrade.problem_count,
      marks: tGrade.marks,
      labels: tGrade.labels ?? Array.from({ length: tGrade.problem_count }, (_, i) => String(i + 1)),
    }));

    // ✅ upsert（student_grades に unique(user_id, workbook_id) 必須）
    const { error: upErr } = await supabase.from("student_grades").upsert(payload, { onConflict: "user_id,workbook_id" });
    if (upErr) {
      setTplMsg("配布失敗(student_grades): " + upErr.message);
      setTplBusy(false);
      return;
    }

    // 生徒側 grade_id 取得
    const { data: createdGrades, error: cgErr } = await supabase
      .from("student_grades")
      .select("id,user_id")
      .eq("workbook_id", tGrade.workbook_id)
      .in("user_id", studentIds);

    if (cgErr) {
      setTplMsg("配布後grade取得失敗: " + cgErr.message);
      setTplBusy(false);
      return;
    }

    // 章を複製（上書き運用）
    for (const g of createdGrades ?? []) {
      await supabase.from("student_grade_notes").delete().eq("grade_id", g.id);

      const chPayload = (templateChapters ?? []).map((c) => ({
        grade_id: g.id,
        start_idx: c.start_idx,
        end_idx: c.end_idx,
        chapter_title: c.chapter_title,
        chapter_note: c.chapter_note,
        teacher_memo: c.teacher_memo,
        next_homework: c.next_homework,
        note: c.note ?? c.chapter_note ?? "",
      }));

      if (chPayload.length > 0) {
        const { error: chInsErr } = await supabase.from("student_grade_notes").insert(chPayload);
        if (chInsErr) {
          setTplMsg(`章の配布失敗: user=${g.user_id}: ` + chInsErr.message);
          setTplBusy(false);
          return;
        }
      }
    }

    setTplMsg(`配布完了：${studentIds.length}人（章も同期）`);
    await refreshCounts();
    setTplBusy(false);
  }

  if (!canUse) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={styles.cardBody}>先生アカウントのみ利用できます。</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>成績編集（塾全体）</div>
            <div style={styles.subtitle}>共通テンプレを作成→章を編集→承認済み生徒へ配布（章も同期）</div>
            <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: colors.textSub }}>承認済み生徒: {approvedCount} 人</div>
          </div>

          <button style={styles.btnGhost} onClick={() => { refreshCounts(); loadStudents(); loadTemplates(); }} disabled={tplBusy}>
            再読み込み
          </button>
        </div>

        {/* ✅ ここだけがテンプレ作成・配布の入口 */}
        <div style={styles.card}>
          {/* ヘッダー（カード自体の開閉ボタン） */}
          <div style={styles.cardHeader}>
            <button
              type="button"
              onClick={() => setCommonOpen((v) => !v)}
              style={{
                all: "unset",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                width: "100%",
              }}
              aria-expanded={commonOpen}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <strong>共通問題集テンプレ（作成・編集・全員配布）</strong>
                <span style={styles.badge}>塾全体で1セット</span>
              </div>

              <span style={{ fontWeight: 900, fontSize: 12, color: colors.textSub, userSelect: "none" }}>
                {commonOpen ? "閉じる ▾" : "開く ▸"}
              </span>
            </button>
          </div>

          {/* 中身（開いているときだけ） */}
          {commonOpen && (
            <div style={styles.cardBody}>
              {!teacherId ? (
                <div style={{ fontSize: 13, color: colors.textSub, fontWeight: 800 }}>ログイン情報を確認中...</div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <button style={{ ...styles.btnGhost, opacity: tplBusy ? 0.6 : 1 }} disabled={tplBusy} onClick={createTemplate}>
                      ＋ テンプレ作成
                    </button>

                    <button
                      style={{ ...styles.btnPrimary, opacity: tplBusy || !activeTemplateId ? 0.6 : 1 }}
                      disabled={tplBusy || !activeTemplateId}
                      onClick={distributeTemplateToAll}
                      title={!activeTemplateId ? "テンプレを選択してください" : ""}
                    >
                      {tplBusy ? "処理中..." : "📦 全員に配布（章も同期）"}
                    </button>

                    <div style={{ fontSize: 12, color: colors.textSub, fontWeight: 800 }}>
                      ①テンプレ作成 → ②下で章を編集 → ③全員に配布
                    </div>
                  </div>

                  <label style={{ display: "grid", gap: 6, maxWidth: 520 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: colors.textSub }}>テンプレ選択</div>
                    <select
                      value={activeTemplateId ?? ""}
                      onChange={(e) => setActiveTemplateId(e.target.value || null)}
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 12,
                        padding: "10px 12px",
                        fontWeight: 800,
                        outline: "none",
                        fontSize: 13,
                        background: "#fff",
                      }}
                    >
                      <option value="" disabled>
                        テンプレを選択…
                      </option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}（{t.total_problems}問）
                        </option>
                      ))}
                    </select>
                  </label>

                  {/* テンプレ編集（章/成績） */}
                  {activeTemplateId ? (
                    <div style={{ border: `1px solid ${colors.border}`, borderRadius: 16, padding: 12, background: "#fff" }}>
                      {/* TeacherGradesPanel側は templateモード。テンプレUIは出さず編集だけ */}
                      <TeacherGradesPanel ownerUserId={teacherId} mode="template" />
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: colors.textSub, fontWeight: 800 }}>テンプレを選択すると、ここで編集できます。</div>
                  )}

                  {tplMsg && <div style={styles.error}>{tplMsg}</div>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 生徒選択→即編集（テンプレは一切出ない） */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <strong>生徒を選択して成績編集</strong>
            <span style={styles.badge}>選択→即編集</span>
          </div>

          <div style={styles.cardBody}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "360px minmax(0, 1fr)", // ✅ 右を広く
                gap: 16,
                alignItems: "start",
              }}
            >
              {/* 左：生徒一覧 */}
              <div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="生徒検索（名前）"
                    style={{
                      width: "100%",
                      border: `1px solid ${colors.border}`,
                      borderRadius: 12,
                      padding: "10px 12px",
                      fontWeight: 700,
                      outline: "none",
                    }}
                  />
                  <button style={styles.btnGhost} onClick={loadStudents} disabled={studentLoading}>
                    更新
                  </button>
                </div>

                {studentLoading ? (
                  <div style={{ fontSize: 13, color: colors.textSub, fontWeight: 800 }}>読み込み中...</div>
                ) : filtered.length === 0 ? (
                  <div style={{ fontSize: 13, color: colors.textSub, fontWeight: 800 }}>該当生徒がいません。</div>
                ) : (
                  <div style={{ display: "grid", gap: 8, maxHeight: 520, overflow: "auto" }}>
                    {filtered.map((s) => {
                      const active = s.id === selectedId;
                      return (
                        <button
                          key={s.id}
                          onClick={() => setSelectedId(s.id)}
                          style={{
                            textAlign: "left",
                            border: `1px solid ${active ? "rgba(14,165,233,0.55)" : colors.border}`,
                            background: active ? "rgba(14,165,233,0.10)" : "#fff",
                            borderRadius: 14,
                            padding: "12px 12px",
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ fontWeight: 900, color: colors.textMain }}>{s.name ?? "未設定"}</div>
                          <div style={{ fontSize: 12, color: colors.textSub, fontWeight: 700 }}>
                            {s.phone ?? "-"} / {s.memo ?? "-"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 右：成績編集パネル */}
              <div>
                {!selectedStudent ? (
                  <div style={{ fontSize: 13, color: colors.textSub, fontWeight: 800 }}>
                    左から生徒を選択すると、ここに成績編集が表示されます。
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                      <div style={{ fontSize: 16, fontWeight: 900, color: colors.textMain }}>
                        {selectedStudent.name ?? "未設定"} の成績
                      </div>
                      <div style={{ fontSize: 12, color: colors.textSub, fontWeight: 800 }}>先生：編集</div>
                    </div>

                    <div style={{ border: `1px solid ${colors.border}`, borderRadius: 16, padding: 12, background: "#fff" }}>
                      {/* ✅ ここは studentモード固定：テンプレ関連は絶対出ない */}
                      <TeacherGradesPanel ownerUserId={selectedStudent.id} mode="student" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
