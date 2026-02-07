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
    maxWidth: "1000px",
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

export default function GradeManagement() {
  const { isStaff } = useIsStaff();

  // === create & distribute workbook ===
  const [wbTitle, setWbTitle] = useState("");
  const [wbTotal, setWbTotal] = useState<number>(100);
  const [wbBusy, setWbBusy] = useState(false);
  const [wbMsg, setWbMsg] = useState<string | null>(null);

  const [approvedCount, setApprovedCount] = useState<number>(0);

  // === student selection ===
  const [students, setStudents] = useState<StudentMini[]>([]);
  const [studentLoading, setStudentLoading] = useState(false);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const canUse = isStaff;

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

    if (error) {
      setStudentLoading(false);
      return;
    }

    setStudents((data ?? []) as StudentMini[]);
    setStudentLoading(false);
  }

  useEffect(() => {
    if (!canUse) return;
    refreshCounts();
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUse]);

  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase();
    if (!key) return students;
    return students.filter((s) => (s.name ?? "").toLowerCase().includes(key));
  }, [students, q]);

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedId) ?? null,
    [students, selectedId]
  );

  async function createAndDistributeWorkbook() {
    if (!canUse) return;

    const title = wbTitle.trim();
    const total = Number(wbTotal);

    if (!title) {
      setWbMsg("問題集名を入力してください。");
      return;
    }
    if (!Number.isInteger(total) || total <= 0 || total > 1000) {
      setWbMsg("問題数は 1〜1000 の整数で入力してください。");
      return;
    }

    setWbBusy(true);
    setWbMsg(null);

    // 1) workbooks 作成（塾全体テンプレ）
    const { data: wb, error: wbErr } = await supabase
      .from("workbooks")
      .insert([{ title, total_problems: total }])
      .select("id,title,total_problems")
      .single();

    if (wbErr) {
      setWbMsg("workbooks 作成に失敗: " + wbErr.message);
      setWbBusy(false);
      return;
    }

    // 2) 承認済みの生徒一覧
    const { data: ps, error: psErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "student")
      .eq("status", "active")
      .eq("is_approved", true);

    if (psErr) {
      setWbMsg("生徒一覧の取得に失敗: " + psErr.message);
      setWbBusy(false);
      return;
    }

    const studentIds = (ps ?? []).map((r) => r.id as string);
    if (studentIds.length === 0) {
      setWbMsg("在籍生徒がいないため、テンプレだけ作成しました。");
      setWbBusy(false);
      return;
    }

    const marks = Array(total).fill("");
    const labels = Array.from({ length: total }, (_, i) => String(i + 1));

    // 3) student_grades 一括作成（workbook_id を入れる）
    const payload = studentIds.map((uid) => ({
      user_id: uid,
      workbook_id: wb.id,
      title: wb.title,
      problem_count: wb.total_problems,
      marks,
      labels,
    }));

    const { error: insErr } = await supabase.from("student_grades").insert(payload);

    if (insErr) {
      setWbMsg(
        "配布に失敗: " +
          insErr.message +
          "\n（workbooks は作成済み。student_grades の unique 制約や RLS を確認してください）"
      );
      setWbBusy(false);
      return;
    }

    setWbMsg(`「${wb.title}」を作成し、在籍生徒 ${studentIds.length}人に配布しました。`);
    setWbTitle("");
    setWbTotal(100);
    await refreshCounts();
    setWbBusy(false);
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
            <div style={styles.subtitle}>共通問題集（塾全体で1セット）を作成し、在籍生徒へ配布します。</div>
            <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: colors.textSub }}>
              承認済み生徒: {approvedCount} 人
            </div>
          </div>

          <button style={styles.btnGhost} onClick={refreshCounts} disabled={wbBusy}>
            再読み込み
          </button>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <strong>共通問題集（全員に配布）</strong>
            <span style={styles.badge}>塾全体で1セット</span>
          </div>

          <div style={styles.cardBody}>
            <div style={{ display: "grid", gap: 10, maxWidth: 520 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: colors.textSub }}>問題集名</div>
                <input
                  value={wbTitle}
                  onChange={(e) => setWbTitle(e.target.value)}
                  placeholder="例）数学 基礎問題"
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 12,
                    padding: "10px 12px",
                    fontWeight: 700,
                    outline: "none",
                  }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: colors.textSub }}>問題数（1〜1000）</div>
                <input
                  type="number"
                  value={wbTotal}
                  onChange={(e) => setWbTotal(Number(e.target.value))}
                  min={1}
                  max={1000}
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 12,
                    padding: "10px 12px",
                    fontWeight: 700,
                    outline: "none",
                  }}
                />
              </label>

              <button
                style={{ ...styles.btnPrimary, opacity: wbBusy ? 0.6 : 1 }}
                disabled={wbBusy}
                onClick={createAndDistributeWorkbook}
              >
                {wbBusy ? "配布中..." : "作成して全員に配布"}
              </button>

              <div style={{ fontSize: 12, color: colors.textSub, fontWeight: 700 }}>
                ※ 新規生徒への自動付与（承認時）は次の Step3（トリガー/サーバー処理）で対応
              </div>

              {wbMsg && <div style={styles.error}>{wbMsg}</div>}
            </div>
          </div>
        </div>

        {/* 生徒選択→即編集 */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <strong>生徒を選択して成績編集</strong>
            <span style={styles.badge}>選択→即編集</span>
          </div>

          <div style={styles.cardBody}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1.4fr",
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

                    <div
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 16,
                        padding: 12,
                        background: "#fff",
                      }}
                    >
                      <TeacherGradesPanel ownerUserId={selectedStudent.id} />
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
