// src/pages/GradeManagement.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useIsStaff } from "../hooks/useIsStaff";
import { useNav } from "../hooks/useNav";
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
  green: "#16a34a",
  greenSoft: "#dcfce7",
  amber: "#f59e0b",
  amberSoft: "#fef3c7",
};

const styles = {
  page: {
    minHeight: "100vh",
    background: `linear-gradient(to bottom, ${colors.bg}, #ffffff)`,
    padding: "24px",
  },
  container: {
    maxWidth: "1280px",
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
  title: { fontSize: "22px", fontWeight: 700, color: colors.textMain },
  subtitle: { fontSize: "13px", color: colors.textSub, marginTop: "4px", fontWeight: 700 },
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
  cardBody: { padding: "16px 20px" },
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
  info: {
    marginTop: "10px",
    fontSize: "13px",
    fontWeight: 900,
    color: "#0f172a",
    background: "rgba(14,165,233,0.10)",
    border: "1px solid rgba(14,165,233,0.25)",
    borderRadius: 12,
    padding: "10px 12px",
    whiteSpace: "pre-wrap" as const,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    padding: "12px 12px",
    borderRadius: "14px",
    border: `1px solid rgba(15,23,42,0.06)`,
    background: "#fff",
    alignItems: "center",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    background: "rgba(14,165,233,0.12)",
    color: "#0ea5e9",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    flexShrink: 0,
  },
  memoChip: {
    maxWidth: 280,
    fontSize: 12,
    fontWeight: 800,
    color: colors.textSub,
    border: `1px solid rgba(15,23,42,0.06)`,
    borderRadius: 999,
    padding: "6px 10px",
    background: "rgba(248,250,252,0.9)",
    overflow: "hidden" as const,
    textOverflow: "ellipsis" as const,
    whiteSpace: "nowrap" as const,
  },
};

type StudentMini = {
  id: string;
  name: string | null;
  phone: string | null;
  school_year: string | null;
  subjects: string[];
};
type TemplateMini = { id: string; title: string; total_problems: number };

type DistStatus = {
  alreadyIds: Set<string>;
};

function overlayStyles(open: boolean): React.CSSProperties {
  return {
    display: open ? "grid" : "none",
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.45)",
    placeItems: "center",
    padding: 16,
    zIndex: 50,
  };
}

function modalStyles(): React.CSSProperties {
  return {
    width: "min(980px, 100%)",
    background: "#fff",
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.20)",
    boxShadow: "0 30px 90px rgba(15,23,42,0.30)",
    overflow: "hidden",
  };
}

function pill(color: "green" | "amber" | "sky", text: string) {
  const map = {
    green: { bg: colors.greenSoft, fg: colors.green, bd: "rgba(22,163,74,0.25)" },
    amber: { bg: colors.amberSoft, fg: colors.amber, bd: "rgba(245,158,11,0.25)" },
    sky: { bg: colors.skySoft, fg: colors.sky, bd: "rgba(14,165,233,0.25)" },
  }[color];
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 900,
        padding: "4px 10px",
        borderRadius: 999,
        background: map.bg,
        color: map.fg,
        border: `1px solid ${map.bd}`,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

function initial(name?: string | null) {
  return name?.trim()?.slice(0, 1) || "生";
}

async function loadSubjectsMap(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, string[]>();

  const { data, error } = await supabase
    .from("profile_subjects")
    .select("user_id, study_subjects(name)")
    .in("user_id", userIds);

  if (error) throw error;

  const map = new Map<string, string[]>();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const uid = row.user_id as string;
    const name = (row.study_subjects as Record<string, unknown> | null)?.name as string | undefined;
    if (!uid || !name) continue;
    map.set(uid, [...(map.get(uid) ?? []), name]);
  }

  for (const [k, v] of map.entries()) {
    map.set(k, [...new Set(v)].sort((a, b) => a.localeCompare(b, "ja")));
  }
  return map;
}

export default function GradeManagement() {
  const { isStaff } = useIsStaff();
  const nav = useNav();
  const canUse = isStaff;

  const [teacherId, setTeacherId] = useState<string | null>(null);

  // --- template ---
  const [templates, setTemplates] = useState<TemplateMini[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [tplBusy, setTplBusy] = useState(false);
  const [tplMsg, setTplMsg] = useState<string | null>(null);

  // === common workbook card accordion ===
  const [commonOpen, setCommonOpen] = useState(false);

  // --- counts ---
  const [approvedCount, setApprovedCount] = useState<number>(0);

  // --- student selection (right panel for single-student edit) ---
  const [students, setStudents] = useState<StudentMini[]>([]);
  const [studentLoading, setStudentLoading] = useState(false);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedStudent = useMemo(() => students.find((s) => s.id === selectedId) ?? null, [students, selectedId]);

  // --- distribute dialog ---
  const [distOpen, setDistOpen] = useState(false);
  const [distBusy, setDistBusy] = useState(false);
  const [distMsg, setDistMsg] = useState<string | null>(null);
  const [distTab, setDistTab] = useState<"notYet" | "already">("notYet");
  const [distQuery, setDistQuery] = useState("");
  const [distStatus, setDistStatus] = useState<DistStatus>({ alreadyIds: new Set() });
  const [distSelected, setDistSelected] = useState<Set<string>>(new Set());
  const [distOverwrite, setDistOverwrite] = useState(false);

  // --- template create modal (NEW) ---
  const [tplCreateOpen, setTplCreateOpen] = useState(false);
  const [tplNewTitle, setTplNewTitle] = useState("");
  const [tplNewChapters, setTplNewChapters] = useState<Array<{ title: string; count: number }>>([{ title: "", count: 10 }]);
  const [tplRefreshNonce, setTplRefreshNonce] = useState(0);

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

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,name,phone,school_year")
        .eq("role", "student")
        .eq("status", "active")
        .eq("is_approved", true)
        .order("name", { ascending: true });

      if (error) throw error;

      const list = (data ?? []) as Array<{
        id: string;
        name: string | null;
        phone: string | null;
        school_year: string | null;
      }>;

      const ids = list.map((x) => x.id);
      const subMap = await loadSubjectsMap(ids);

      const enriched: StudentMini[] = list.map((r) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        school_year: r.school_year,
        subjects: subMap.get(r.id) ?? [],
      }));

      setStudents(enriched);
    } catch {
      // 今はUIにエラー欄がないので黙って落とす（必要ならメッセージstate追加OK）
    } finally {
      setStudentLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase();
    if (!key) return students;

    return students.filter((s) => {
      const hay = [
        s.name ?? "",
        s.phone ?? "",
        s.school_year ?? "",
        (s.subjects ?? []).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(key);
    });
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
  async function createTemplateWithChapters() {
    if (!teacherId) return;

    const title = tplNewTitle.trim();
    if (!title) {
      setTplMsg("問題集名を入力してください。");
      return;
    }

    const cleaned = tplNewChapters
      .map((c) => ({ title: (c.title ?? "").trim(), count: Number(c.count || 0) }))
      .filter((c) => c.count > 0);

    if (cleaned.length === 0) {
      setTplMsg("章を1つ以上追加し、問題数を設定してください。");
      return;
    }

    const total = cleaned.reduce((s, c) => s + c.count, 0);
    if (total <= 0) {
      setTplMsg("合計問題数が0です。");
      return;
    }

    setTplBusy(true);
    setTplMsg(null);

    // 1) workbooks
    const { data: wb, error: wbErr } = await supabase
      .from("workbooks")
      .insert([{ title, total_problems: total }])
      .select("id,title,total_problems")
      .single();

    if (wbErr || !wb) {
      setTplMsg("テンプレ作成失敗(workbooks): " + (wbErr?.message ?? "unknown"));
      setTplBusy(false);
      return;
    }

    // 2) teacher's grade (template source)
    const { data: g, error: gErr } = await supabase
      .from("student_grades")
      .insert([
        {
          user_id: teacherId,
          workbook_id: wb.id,
          title: wb.title,
          problem_count: total,
          marks: [],
          labels: Array.from({ length: total }, (_, i) => String(i + 1)),
        },
      ])
      .select("id")
      .single();

    if (gErr || !g) {
      setTplMsg("テンプレ作成失敗(student_grades): " + (gErr?.message ?? "unknown"));
      setTplBusy(false);
      return;
    }

    // 3) chapters for teacher grade
    let cursor = 0;
    const chPayload = cleaned.map((ch) => {
      const start = cursor;
      const end = cursor + ch.count - 1;
      cursor += ch.count;

      return {
        grade_id: g.id,
        start_idx: start,
        end_idx: end,
        chapter_title: ch.title || null,
        chapter_note: "",
        teacher_memo: "",
        next_homework: "",
        note: "",
      };
    });

    if (chPayload.length > 0) {
      const { error: chErr } = await supabase.from("student_grade_notes").insert(chPayload);
      if (chErr) {
        setTplMsg("テンプレ章作成失敗(student_grade_notes): " + chErr.message);
        setTplBusy(false);
        return;
      }
    }

    // refresh UI（即時反映を最優先）
    setTemplates((prev) => [
      { id: wb.id, title: wb.title, total_problems: wb.total_problems },
      ...prev,
    ]);

    setActiveTemplateId(wb.id);

    // TeacherGradesPanel を強制リマウント（=再読み込み）
    setTplRefreshNonce((n) => n + 1);

    // ついでに最新と整合（失敗してもUIはもう出てるのでOK）
    loadTemplates();

    setTplCreateOpen(false);
    setTplMsg(`テンプレ「${wb.title}」を作成しました。章も作成済みです。「🎯 配布先を選ぶ」から追加してください。`);
    setTplBusy(false);
  }

  async function loadDistributionStatus(templateId: string) {
    const ids = students.map((s) => s.id);
    if (ids.length === 0) return { alreadyIds: new Set<string>() };

    const { data, error } = await supabase
      .from("student_grades")
      .select("user_id")
      .eq("workbook_id", templateId)
      .in("user_id", ids);

    if (error) return { alreadyIds: new Set<string>() };

    const set = new Set<string>((data ?? []).map((r) => String((r as { user_id: string }).user_id)));
    return { alreadyIds: set };
  }

  function openDistributeDialog() {
    if (!activeTemplateId) {
      setTplMsg("テンプレを選択してください。");
      return;
    }
    setDistMsg(null);
    setDistSelected(new Set());
    setDistTab("notYet");
    setDistQuery("");
    setDistOverwrite(false);
    setDistOpen(true);

    (async () => {
      setDistBusy(true);
      const st = await loadDistributionStatus(activeTemplateId);
      setDistStatus(st);
      setDistBusy(false);
    })();
  }

  function closeDistributeDialog() {
    if (distBusy) return;
    setDistOpen(false);
  }

  const distList = useMemo(() => {
    const key = distQuery.trim().toLowerCase();
    const base = students.slice();

    const notYet = base.filter((s) => !distStatus.alreadyIds.has(s.id));
    const already = base.filter((s) => distStatus.alreadyIds.has(s.id));

    const pick = distTab === "notYet" ? notYet : already;
    if (!key) return pick;

    return pick.filter((s) => (s.name ?? "").toLowerCase().includes(key));
  }, [students, distStatus, distTab, distQuery]);

  function toggleDistSelected(id: string) {
    setDistSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setSelectAllVisible(on: boolean) {
    setDistSelected((prev) => {
      const next = new Set(prev);
      if (on) {
        for (const s of distList) next.add(s.id);
      } else {
        for (const s of distList) next.delete(s.id);
      }
      return next;
    });
  }

  const selectAllState = useMemo(() => {
    if (distList.length === 0) return { checked: false, indeterminate: false };
    const sel = distList.filter((s) => distSelected.has(s.id)).length;
    if (sel === 0) return { checked: false, indeterminate: false };
    if (sel === distList.length) return { checked: true, indeterminate: false };
    return { checked: false, indeterminate: true };
  }, [distList, distSelected]);

  async function distributeToSelected() {
    if (!teacherId) return;
    if (!activeTemplateId) return;

    const chosen = Array.from(distSelected);
    if (chosen.length === 0) {
      setDistMsg("配布先の生徒を選択してください。");
      return;
    }

    setDistBusy(true);
    setDistMsg(null);

    const { data: tGrade, error: tgErr } = await supabase
      .from("student_grades")
      .select("id,workbook_id,title,problem_count,marks,labels")
      .eq("user_id", teacherId)
      .eq("workbook_id", activeTemplateId)
      .single();

    if (tgErr || !tGrade) {
      setDistMsg("テンプレ編集データが見つかりません: " + (tgErr?.message ?? "unknown"));
      setDistBusy(false);
      return;
    }

    const { data: templateChapters, error: chErr } = await supabase
      .from("student_grade_notes")
      .select("start_idx,end_idx,chapter_title,chapter_note,teacher_memo,next_homework,note")
      .eq("grade_id", tGrade.id)
      .order("start_idx", { ascending: true });

    if (chErr) {
      setDistMsg("テンプレ章取得失敗: " + chErr.message);
      setDistBusy(false);
      return;
    }

    const targets = distOverwrite ? chosen : chosen.filter((id) => !distStatus.alreadyIds.has(id));

    if (targets.length === 0) {
      setDistMsg("選択した生徒は全員すでに追加済みです。上書きする場合は「追加済にも上書き同期」をONにしてください。");
      setDistBusy(false);
      return;
    }

    const payload = targets.map((uid) => ({
      user_id: uid,
      workbook_id: tGrade.workbook_id,
      title: tGrade.title,
      problem_count: tGrade.problem_count,
      marks: tGrade.marks,
      labels: tGrade.labels ?? Array.from({ length: tGrade.problem_count }, (_, i) => String(i + 1)),
    }));

    const { error: upErr } = await supabase.from("student_grades").upsert(payload, { onConflict: "user_id,workbook_id" });
    if (upErr) {
      setDistMsg("配布失敗(student_grades): " + upErr.message);
      setDistBusy(false);
      return;
    }

    const { data: createdGrades, error: cgErr } = await supabase
      .from("student_grades")
      .select("id,user_id")
      .eq("workbook_id", tGrade.workbook_id)
      .in("user_id", targets);

    if (cgErr) {
      setDistMsg("配布後grade取得失敗: " + cgErr.message);
      setDistBusy(false);
      return;
    }

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
          setDistMsg(`章の配布失敗: user=${g.user_id}: ` + chInsErr.message);
          setDistBusy(false);
          return;
        }
      }
    }

    const newStatus = await loadDistributionStatus(activeTemplateId);
    setDistStatus(newStatus);

    setDistMsg(`配布完了：${targets.length}人（章も同期）`);
    await refreshCounts();
    setDistBusy(false);
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

  const activeTpl = templates.find((t) => t.id === activeTemplateId) ?? null;

  function gmModalOverlay(): React.CSSProperties {
    return {
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,42,0.35)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
    };
  }

  function gmModalCard(): React.CSSProperties {
    return {
      width: 520,
      background: "#fff",
      borderRadius: 18,
      padding: 20,
      boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
    };
  }

  function gmModalTitle(): React.CSSProperties {
    return { fontSize: 18, fontWeight: 1000, marginBottom: 16, color: "#0f172a" };
  }

  function gmLabelStyle(): React.CSSProperties {
    return { fontWeight: 900, fontSize: 13, marginBottom: 6, color: "#0f172a" };
  }

  function gmInputStyle(): React.CSSProperties {
    return {
      width: "100%",
      padding: "8px 10px",
      borderRadius: 10,
      border: "1px solid rgba(148,163,184,0.30)",
      fontWeight: 800,
      outline: "none",
    };
  }

  function gmChapterRowStyle(): React.CSSProperties {
    return {
      display: "grid",
      gridTemplateColumns: "1fr 80px 40px",
      gap: 8,
      marginBottom: 6,
      alignItems: "center",
    };
  }

  function gmSmallDeleteBtn(): React.CSSProperties {
    return {
      borderRadius: 8,
      border: "1px solid rgba(220,38,38,0.30)",
      background: "rgba(254,242,242,0.92)",
      cursor: "pointer",
      fontWeight: 900,
      height: 36,
    };
  }

  function gmAddChapterBtn(): React.CSSProperties {
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

  function gmCancelBtn(): React.CSSProperties {
    return {
      padding: "8px 14px",
      borderRadius: 10,
      border: "1px solid rgba(148,163,184,0.3)",
      background: "#fff",
      cursor: "pointer",
      fontWeight: 900,
    };
  }

  function gmPrimaryBtn(disabled?: boolean): React.CSSProperties {
    return {
      padding: "8px 14px",
      borderRadius: 10,
      border: "none",
      background: disabled ? "rgba(37,99,235,0.6)" : "#2563eb",
      color: "#fff",
      fontWeight: 900,
      cursor: disabled ? "not-allowed" : "pointer",
    };
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>成績編集（塾全体）</div>
            <div style={styles.subtitle}>共通テンプレを作成→章を編集→配布先を選んで追加（章も同期）</div>
            <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: colors.textSub }}>
              承認済み生徒: {approvedCount} 人
            </div>
          </div>

          <button
            style={styles.btnGhost}
            onClick={() => {
              refreshCounts();
              loadStudents();
              loadTemplates();
              setTplRefreshNonce((n) => n + 1);
            }}
            disabled={tplBusy}
          >
            再読み込み
          </button>
        </div>

        {/* 共通テンプレ（作成・編集・配布入口） */}
        <div style={styles.card}>
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
                <strong>共通問題集テンプレ（作成・章編集・生徒へ追加）</strong>
                <span style={styles.badge}>塾全体で1セット</span>
              </div>

              <span style={{ fontWeight: 900, fontSize: 12, color: colors.textSub, userSelect: "none" }}>
                {commonOpen ? "閉じる ▾" : "開く ▸"}
              </span>
            </button>
          </div>

          {commonOpen && (
            <div style={styles.cardBody}>
              {!teacherId ? (
                <div style={{ fontSize: 13, color: colors.textSub, fontWeight: 800 }}>ログイン情報を確認中...</div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <button
                      style={{ ...styles.btnGhost, opacity: tplBusy ? 0.6 : 1 }}
                      disabled={tplBusy}
                      onClick={() => {
                        setTplMsg(null);
                        setTplNewTitle("");
                        setTplNewChapters([{ title: "", count: 10 }]);
                        setTplCreateOpen(true);
                      }}
                    >
                      ＋ テンプレ作成
                    </button>

                    <button
                      style={{ ...styles.btnPrimary, opacity: tplBusy || !activeTemplateId ? 0.6 : 1 }}
                      disabled={tplBusy || !activeTemplateId}
                      onClick={openDistributeDialog}
                      title={!activeTemplateId ? "テンプレを選択してください" : ""}
                    >
                      {tplBusy ? "処理中..." : "🎯 配布先を選ぶ"}
                    </button>

                    <div style={{ fontSize: 12, color: colors.textSub, fontWeight: 800 }}>
                      ①テンプレ作成 → ②下で章を編集 → ③配布先を選んで追加
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

                  <div style={{ fontSize: 12, fontWeight: 900, color: colors.textSub }}>
                    ※ 共通テンプレでは〇×△は編集できません（配布元のため）
                  </div>

                  {activeTemplateId ? (
                    <div style={{ border: `1px solid ${colors.border}`, borderRadius: 16, padding: 12, background: "#fff" }}>
                      <TeacherGradesPanel
                        key={`tpl-${teacherId}-${activeTemplateId}-${tplRefreshNonce}`}
                        ownerUserId={teacherId}
                        mode="template"
                      />
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

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <strong>生徒を選択して成績編集</strong>
            <span style={styles.badge}>選択→即編集</span>
          </div>

          <div style={styles.cardBody}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "360px minmax(0, 1fr)",
                gap: 16,
                alignItems: "start",
              }}
            >
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
                  <div style={{ display: "grid", gap: 10, maxHeight: 520, overflow: "auto" }}>
                    {filtered.map((s) => {
                      const active = s.id === selectedId;
                      const chipText =
                        (s.school_year ?? "-") + " / " + (s.subjects?.length ? s.subjects.join("・") : "教科未設定");

                      return (
                        <div
                          key={s.id}
                          style={{
                            ...styles.row,
                            cursor: "pointer",
                            border: `1px solid ${active ? "rgba(14,165,233,0.35)" : "rgba(15,23,42,0.06)"}`,
                            background: active ? "rgba(14,165,233,0.08)" : "#fff",
                          }}
                          onClick={() => setSelectedId(s.id)}
                        >
                          <div style={{ display: "flex", gap: 12 }}>
                            <div style={styles.avatar}>{initial(s.name)}</div>
                            <div>
                              <div style={{ fontWeight: 700, color: colors.textMain }}>{s.name ?? "未設定"}</div>
                              <div style={{ fontSize: 12, color: colors.textSub, fontWeight: 700 }}>
                                {s.phone ?? "-"}
                              </div>
                            </div>
                          </div>

                          <div style={styles.memoChip} title={chipText}>
                            {chipText}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                {!selectedStudent ? (
                  <div style={{ fontSize: 13, color: colors.textSub, fontWeight: 800 }}>
                    左から生徒を選択すると、ここに成績編集が表示されます。
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <div style={{ fontSize: 16, fontWeight: 900, color: colors.textMain }}>
                        {selectedStudent.name ?? "未設定"} の成績
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ fontSize: 12, color: colors.textSub, fontWeight: 800 }}>
                          先生：編集
                        </div>

                        <button
                          style={{
                            ...styles.btnPrimary,
                            padding: "8px 12px",
                            fontSize: 12,
                          }}
                          onClick={() => {
                            if (!selectedStudent) return;
                            nav.setView("dm");
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            (nav as any).openDmWith?.(selectedStudent.id);
                          }}
                        >
                          ✉ DMへ
                        </button>
                      </div>
                    </div>

                    <div style={{ border: `1px solid ${colors.border}`, borderRadius: 16, padding: 12, background: "#fff" }}>
                      <TeacherGradesPanel ownerUserId={selectedStudent.id} mode="student" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={overlayStyles(distOpen)} role="dialog" aria-modal="true" aria-label="配布先を選択">
          <div style={modalStyles()}>
            <div
              style={{
                padding: "14px 16px",
                borderBottom: `1px solid ${colors.border}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontWeight: 900, fontSize: 16, color: colors.textMain }}>配布先を選択</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: colors.textSub }}>
                  テンプレ：{activeTpl?.title ?? "-"}（{activeTpl?.total_problems ?? 0}問） / 選択数：{distSelected.size}
                </div>
              </div>
              <button style={styles.btnGhost} onClick={closeDistributeDialog} disabled={distBusy}>
                閉じる
              </button>
            </div>

            <div style={{ padding: 16, display: "grid", gap: 12 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  style={{
                    ...styles.btnGhost,
                    background: distTab === "notYet" ? "rgba(14,165,233,0.10)" : "#fff",
                    borderColor: distTab === "notYet" ? "rgba(14,165,233,0.35)" : colors.border,
                  }}
                  onClick={() => setDistTab("notYet")}
                  disabled={distBusy}
                >
                  未追加
                </button>
                <button
                  style={{
                    ...styles.btnGhost,
                    background: distTab === "already" ? "rgba(22,163,74,0.10)" : "#fff",
                    borderColor: distTab === "already" ? "rgba(22,163,74,0.35)" : colors.border,
                  }}
                  onClick={() => setDistTab("already")}
                  disabled={distBusy}
                >
                  追加済み
                </button>

                <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 900, fontSize: 12, color: colors.textSub }}>
                    <input
                      type="checkbox"
                      checked={distOverwrite}
                      onChange={(e) => setDistOverwrite(e.target.checked)}
                      disabled={distBusy}
                    />
                    追加済にも上書き同期（章も上書き）
                  </label>
                  <button
                    style={{ ...styles.btnPrimary, opacity: distBusy ? 0.65 : 1 }}
                    onClick={distributeToSelected}
                    disabled={distBusy}
                  >
                    {distBusy ? "配布中..." : "✅ 選択した生徒に追加"}
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    value={distQuery}
                    onChange={(e) => setDistQuery(e.target.value)}
                    placeholder="生徒検索（名前）"
                    style={{
                      flex: 1,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 12,
                      padding: "10px 12px",
                      fontWeight: 700,
                      outline: "none",
                      minWidth: 260,
                    }}
                    disabled={distBusy}
                  />

                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 900, fontSize: 12, color: colors.textSub }}>
                    <input
                      type="checkbox"
                      checked={selectAllState.checked}
                      ref={(el) => {
                        if (el) el.indeterminate = selectAllState.indeterminate;
                      }}
                      onChange={(e) => setSelectAllVisible(e.target.checked)}
                      disabled={distBusy || distList.length === 0}
                    />
                    表示中を一括選択
                  </label>

                  <button style={styles.btnGhost} onClick={() => setSelectAllVisible(false)} disabled={distBusy || distSelected.size === 0}>
                    選択解除
                  </button>

                  <button
                    style={styles.btnGhost}
                    onClick={async () => {
                      if (!activeTemplateId) return;
                      setDistBusy(true);
                      const st = await loadDistributionStatus(activeTemplateId);
                      setDistStatus(st);
                      setDistBusy(false);
                    }}
                    disabled={distBusy}
                  >
                    状態更新
                  </button>
                </div>

                {distBusy ? (
                  <div style={{ fontSize: 13, color: colors.textSub, fontWeight: 800 }}>読み込み中...</div>
                ) : distList.length === 0 ? (
                  <div style={{ fontSize: 13, color: colors.textSub, fontWeight: 800 }}>該当生徒がいません。</div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: 10,
                      maxHeight: 420,
                      overflow: "auto",
                      padding: 2,
                    }}
                  >
                    {distList.map((s) => {
                      const checked = distSelected.has(s.id);
                      const already = distStatus.alreadyIds.has(s.id);
                      const chipText =
                        (s.school_year ?? "-") + " / " + (s.subjects?.length ? s.subjects.join("・") : "教科未設定");
                      return (
                        <button
                          key={s.id}
                          onClick={() => toggleDistSelected(s.id)}
                          style={{
                            textAlign: "left",
                            border: `1px solid ${checked ? "rgba(14,165,233,0.55)" : colors.border}`,
                            background: checked ? "rgba(14,165,233,0.10)" : "#fff",
                            borderRadius: 14,
                            padding: "12px 12px",
                            cursor: "pointer",
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                            alignItems: "center",
                          }}
                        >
                          <div style={{ display: "grid", gap: 2 }}>
                            <div style={{ fontWeight: 900, color: colors.textMain }}>{s.name ?? "未設定"}</div>
                            <div style={{ fontSize: 12, color: colors.textSub, fontWeight: 700 }}>
                              {chipText}
                            </div>
                          </div>
                          <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                            <input type="checkbox" checked={checked} readOnly />
                            {already ? pill("green", "追加済") : pill("amber", "未追加")}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {distMsg && <div style={distMsg.includes("完了") ? styles.info : styles.error}>{distMsg}</div>}
              </div>
            </div>
          </div>
        </div>

        {tplCreateOpen && (
          <div style={gmModalOverlay()} role="dialog" aria-modal="true" aria-label="テンプレ作成">
            <div style={gmModalCard()}>
              <div style={gmModalTitle()}>共通テンプレを作成</div>

              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <div style={gmLabelStyle()}>問題集名</div>
                  <input
                    value={tplNewTitle}
                    onChange={(e) => setTplNewTitle(e.target.value)}
                    placeholder="例：英語 基礎問題"
                    style={gmInputStyle()}
                    disabled={tplBusy}
                  />
                </div>

                <div>
                  <div style={gmLabelStyle()}>章設定</div>

                  {tplNewChapters.map((ch, i) => (
                    <div key={i} style={gmChapterRowStyle()}>
                      <input
                        placeholder="章名"
                        value={ch.title}
                        onChange={(e) => {
                          const next = [...tplNewChapters];
                          next[i] = { ...next[i], title: e.target.value };
                          setTplNewChapters(next);
                        }}
                        style={gmInputStyle()}
                        disabled={tplBusy}
                      />

                      <input
                        type="number"
                        min={1}
                        value={ch.count}
                        onChange={(e) => {
                          const next = [...tplNewChapters];
                          next[i] = { ...next[i], count: Number(e.target.value) };
                          setTplNewChapters(next);
                        }}
                        style={{ ...gmInputStyle(), width: 80 }}
                        disabled={tplBusy}
                      />

                      <button
                        onClick={() => setTplNewChapters((prev) => prev.filter((_, idx) => idx !== i))}
                        style={gmSmallDeleteBtn()}
                        disabled={tplBusy || tplNewChapters.length <= 1}
                        title={tplNewChapters.length <= 1 ? "最低1章は必要です" : "この章を削除"}
                      >
                        🗑
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={() => setTplNewChapters((prev) => [...prev, { title: "", count: 5 }])}
                    style={gmAddChapterBtn()}
                    disabled={tplBusy}
                  >
                    ＋ 章を追加
                  </button>

                  <div style={{ marginTop: 8, fontWeight: 900, color: "#0f172a" }}>
                    合計問題数：{tplNewChapters.reduce((sum, c) => sum + Number(c.count || 0), 0)}
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button onClick={() => setTplCreateOpen(false)} style={gmCancelBtn()} disabled={tplBusy}>
                    キャンセル
                  </button>

                  <button onClick={createTemplateWithChapters} style={gmPrimaryBtn(tplBusy)} disabled={tplBusy}>
                    {tplBusy ? "作成中..." : "作成"}
                  </button>
                </div>

                {tplMsg && (
                  <div style={tplMsg.includes("作成しました") ? styles.info : styles.error}>
                    {tplMsg}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
