import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useIsStaff } from "../hooks/useIsStaff";
import StudentDetail from "./StudentDetail";

type Student = {
  id: string;
  name: string | null;
  phone: string | null;
  memo: string | null;
};

type PendingReq = {
  id: string;
  user_id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  created_at: string;
};

const colors = {
  bg: "#f0f9ff",
  card: "#ffffff",
  border: "#e5e7eb",
  textMain: "#0f172a",
  textSub: "#475569",
  sky: "#0ea5e9",
  skySoft: "#e0f2fe",
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
};

function initial(name?: string | null) {
  return name?.trim()?.slice(0, 1) || "生";
}

export default function Students() {
  const { isStaff } = useIsStaff();
  const [students, setStudents] = useState<Student[]>([]);
  const [pending, setPending] = useState<PendingReq[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);

  const studentCount = useMemo(() => students.length, [students]);
  const pendingCount = useMemo(() => pending.length, [pending]);

  useEffect(() => {
    if (!isStaff) return;

    (async () => {
      const { data: ok } = await supabase
        .from("profiles")
        .select("id, name, phone, memo")
        .eq("role", "student")
        .eq("is_approved", true)
        .eq("status", "active");

      setStudents((ok ?? []) as Student[]);

      const { data: wait } = await supabase
        .from("approval_requests")
        .select("id, user_id, email, name, phone, created_at")
        .is("resolved_at", null);

      setPending((wait ?? []) as PendingReq[]);
    })();
  }, [isStaff]);

  async function approve(req: PendingReq) {
    await supabase.rpc("approve_student", { p_user_id: req.user_id });
    setPending((p) => p.filter((x) => x.id !== req.id));
  }

  async function reject(req: PendingReq) {
    await supabase
      .from("approval_requests")
      .update({ approved: false, resolved_at: new Date().toISOString() })
      .eq("id", req.id);

    setPending((p) => p.filter((x) => x.id !== req.id));
  }

  if (selected) {
    return <StudentDetail student={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* ヘッダー */}
        <div style={styles.header}>
          <div>
            <div style={styles.title}>生徒</div>
            <div style={styles.subtitle}>
              承認待ちの管理と在籍生徒の確認
            </div>
          </div>
        </div>

        {/* 承認待ち */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <strong>承認待ち</strong>
            <span style={styles.badge}>{pendingCount} 件</span>
          </div>
          <div style={styles.cardBody}>
            {pending.length === 0 ? (
              <div style={{ color: colors.textSub, fontSize: "14px" }}>
                承認待ちはありません。
              </div>
            ) : (
              pending.map((p) => (
                <div key={p.id} style={styles.listItem}>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <div style={styles.avatar}>{initial(p.name)}</div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{p.name ?? "未設定"}</div>
                      <div style={{ fontSize: "12px", color: colors.textSub }}>
                        {p.email ?? "-"}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button style={styles.btnPrimary} onClick={() => approve(p)}>
                      承認
                    </button>
                    <button style={styles.btnGhost} onClick={() => reject(p)}>
                      却下
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 生徒一覧 */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <strong>生徒一覧</strong>
            <span style={styles.badge}>{studentCount} 人</span>
          </div>
          <div style={styles.cardBody}>
            {students.map((s) => (
              <div
                key={s.id}
                style={{ ...styles.listItem, cursor: "pointer" }}
                onClick={() => setSelected(s)}
              >
                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={styles.avatar}>{initial(s.name)}</div>
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {s.name ?? "未設定"}
                    </div>
                    <div style={{ fontSize: "12px", color: colors.textSub }}>
                      {s.phone ?? "-"}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: "12px", color: colors.textSub }}>
                  {s.memo ?? "-"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
