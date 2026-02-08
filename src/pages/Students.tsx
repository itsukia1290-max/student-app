// src/pages/Students.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useIsStaff } from "../hooks/useIsStaff";
import StudentDetail from "./StudentDetail";

type Student = {
  id: string;
  name: string | null;
  phone: string | null;
  memo: string | null;
  is_approved: boolean;
  status: string | null;
};

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
  },
  title: {
    fontSize: "22px",
    fontWeight: 600,
    color: colors.textMain,
  },
  subtitle: {
    fontSize: "13px",
    color: colors.textSub,
    marginTop: "4px",
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
    fontWeight: 600,
  },
  listItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    padding: "14px",
    borderRadius: "14px",
    border: `1px solid ${colors.border}`,
    marginBottom: "12px",
  },
  avatar: {
    width: "40px",
    height: "40px",
    borderRadius: "14px",
    background: colors.skySoft,
    color: colors.sky,
    display: "grid",
    placeItems: "center",
    fontWeight: 700,
    flexShrink: 0,
  },
  btnPrimary: {
    background: colors.sky,
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    padding: "8px 14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  btnGhost: {
    background: "#fff",
    border: `1px solid ${colors.border}`,
    borderRadius: "12px",
    padding: "8px 14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  btnDanger: {
    background: colors.red,
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    padding: "8px 14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  hint: {
    fontSize: "12px",
    color: colors.textSub,
    marginTop: "8px",
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

function initial(name?: string | null) {
  return name?.trim()?.slice(0, 1) || "生";
}

export default function Students() {
  const { isStaff } = useIsStaff();

  const [students, setStudents] = useState<Student[]>([]);
  const [pending, setPending] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const studentCount = useMemo(() => students.length, [students]);
  const pendingCount = useMemo(() => pending.length, [pending]);

  async function loadAll() {
    if (!isStaff) return;
    setLoading(true);
    setErr(null);

    // 承認待ち & 承認済みを profiles から取得（単一の真実）
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, phone, memo, is_approved, status, role")
      .eq("role", "student")
      .eq("status", "active");

    if (error) {
      setErr("読み込み失敗: " + error.message);
      setLoading(false);
      return;
    }

    const rows = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: r.id as string,
      name: (r.name ?? null) as string | null,
      phone: (r.phone ?? null) as string | null,
      memo: (r.memo ?? null) as string | null,
      is_approved: !!r.is_approved,
      status: (r.status ?? null) as string | null,
    })) as Student[];

    setPending(rows.filter((x) => !x.is_approved));
    setStudents(rows.filter((x) => x.is_approved));
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaff]);

  async function approve(p: Student) {
    setErr(null);

    const { error } = await supabase
      .from("profiles")
      .update({ is_approved: true })
      .eq("id", p.id);

    if (error) {
      setErr("承認に失敗: " + error.message);
      return;
    }

    // UI即時反映
    setPending((arr) => arr.filter((x) => x.id !== p.id));
    setStudents((arr) => [{ ...p, is_approved: true }, ...arr]);
  }

  async function reject(p: Student) {
    setErr(null);

    // 却下の扱いは「無効化」推奨（消さない）
    const { error } = await supabase
      .from("profiles")
      .update({ status: "inactive", is_approved: false })
      .eq("id", p.id);

    if (error) {
      setErr("却下に失敗: " + error.message);
      return;
    }

    setPending((arr) => arr.filter((x) => x.id !== p.id));
  }

  if (selected) {
    return <StudentDetail student={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>生徒</div>
            <div style={styles.subtitle}>承認待ちの管理と在籍生徒の確認</div>
            {loading && <div style={styles.hint}>読み込み中...</div>}
            {err && <div style={styles.error}>{err}</div>}
          </div>

          <button style={styles.btnGhost} onClick={loadAll} disabled={loading}>
            再読み込み
          </button>
        </div>

        {/* 承認待ち */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <strong>承認待ち</strong>
            <span style={styles.badge}>{pendingCount} 件</span>
          </div>
          <div style={styles.cardBody}>
            {pending.length === 0 ? (
              <div style={{ color: colors.textSub, fontSize: "14px" }}>承認待ちはありません。</div>
            ) : (
              pending.map((p) => (
                <div key={p.id} style={styles.listItem}>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <div style={styles.avatar}>{initial(p.name)}</div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{p.name ?? "未設定"}</div>
                      <div style={{ fontSize: "12px", color: colors.textSub }}>{p.phone ?? "-"}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button style={styles.btnPrimary} onClick={() => approve(p)}>
                      承認
                    </button>
                    <button style={styles.btnDanger} onClick={() => reject(p)}>
                      却下
                    </button>
                  </div>
                </div>
              ))
            )}
            <div style={styles.hint} />
          </div>
        </div>

        {/* 生徒一覧 */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <strong>生徒一覧</strong>
            <span style={styles.badge}>{studentCount} 人</span>
          </div>
          <div style={styles.cardBody}>
            {students.length === 0 ? (
              <div style={{ color: colors.textSub, fontSize: "14px" }}>生徒がいません。</div>
            ) : (
              students.map((s) => (
                <div
                  key={s.id}
                  style={{ ...styles.listItem, cursor: "pointer" }}
                  onClick={() => setSelected(s)}
                >
                  <div style={{ display: "flex", gap: "12px" }}>
                    <div style={styles.avatar}>{initial(s.name)}</div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{s.name ?? "未設定"}</div>
                      <div style={{ fontSize: "12px", color: colors.textSub }}>{s.phone ?? "-"}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: "12px", color: colors.textSub }}>{s.memo ?? "-"}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
