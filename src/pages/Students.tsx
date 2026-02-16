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
  school_year: string | null;
  subjects: string[];
};

const colors = {
  // 背景は薄いまま。アクセントだけ濃く。
  bgTop: "#ffffff",
  bg: "#f1f5f9",

  card: "#ffffff",
  border: "rgba(15,23,42,0.10)",
  borderSoft: "rgba(15,23,42,0.06)",

  textMain: "#0f172a",
  textSub: "#475569",

  // 濃い青（レポートと揃える）
  blue: "#1d4ed8",
  blueSoft: "rgba(29,78,216,0.10)",

  // アバター用の空色
  sky: "#0ea5e9",
  skySoft: "#e0f2fe",

  red: "#dc2626",
  redSoft: "rgba(220,38,38,0.12)",
};

const styles = {
  page: {
    minHeight: "100vh",
    background: `linear-gradient(180deg, ${colors.bgTop} 0px, ${colors.bg} 240px, ${colors.bg} 100%)`,
    padding: "20px",
  },
  container: {
    maxWidth: "1000px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px",
  },

  // ✅ 上部ヘッダーをカード化（ここが"淡泊"脱却の一手）
  hero: {
    background: colors.card,
    borderRadius: "18px",
    border: `1.5px solid ${colors.border}`,
    boxShadow: "0 10px 26px rgba(15,23,42,0.08)",
    overflow: "hidden",
    position: "relative" as const,
  },
  heroInner: {
    padding: "16px 18px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
  },
  title: {
    fontSize: "22px",
    fontWeight: 900,
    color: colors.textMain,
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: "13px",
    color: colors.textSub,
    marginTop: "6px",
    fontWeight: 800,
  },

  // ✅ セクションカード（左アクセントバー）
  card: {
    background: colors.card,
    borderRadius: "18px",
    border: `1.5px solid ${colors.border}`,
    boxShadow: "0 10px 26px rgba(15,23,42,0.08)",
    overflow: "hidden",
    position: "relative" as const,
  },
  cardHeader: {
    padding: "14px 18px",
    borderBottom: `1px solid ${colors.borderSoft}`,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardHeaderTitle: {
    fontWeight: 900,
    color: colors.textMain,
  },
  cardBody: {
    padding: "10px 12px 12px 12px",
  },

  // ✅ バッジを少し濃く
  badge: {
    fontSize: "12px",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(15,23,42,0.06)",
    color: "#334155",
    fontWeight: 900,
    border: "1px solid rgba(15,23,42,0.12)",
    whiteSpace: "nowrap" as const,
  },

  // ✅ 行デザイン：カードの中のカードをやめる
  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    padding: "12px 12px",
    borderRadius: "14px",
    border: `1px solid ${colors.borderSoft}`,
    background: "#fff",
    alignItems: "center",
  },
  rowHover: {
    background: "rgba(15,23,42,0.03)",
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    background: colors.skySoft,
    color: colors.sky,
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    flexShrink: 0,
  },

  // ✅ memoをチップ風に
  memoChip: {
    maxWidth: 280,
    fontSize: 12,
    fontWeight: 800,
    color: colors.textSub,
    border: `1px solid ${colors.borderSoft}`,
    borderRadius: 999,
    padding: "6px 10px",
    background: "rgba(248,250,252,0.9)",
    overflow: "hidden" as const,
    textOverflow: "ellipsis" as const,
    whiteSpace: "nowrap" as const,
  },

  btnPrimary: {
    background: colors.blue,
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    padding: "8px 14px",
    fontWeight: 900,
    cursor: "pointer",
  },
  btnGhost: {
    background: "#fff",
    border: `1.5px solid ${colors.border}`,
    borderRadius: "12px",
    padding: "8px 14px",
    fontWeight: 900,
    cursor: "pointer",
    color: colors.textMain,
  },
  btnDanger: {
    background: colors.red,
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    padding: "8px 14px",
    fontWeight: 900,
    cursor: "pointer",
  },

  hint: {
    fontSize: "12px",
    color: colors.textSub,
    marginTop: "8px",
    fontWeight: 800,
  },
  error: {
    marginTop: "10px",
    fontSize: "13px",
    fontWeight: 900,
    color: colors.red,
    background: colors.redSoft,
    border: `1px solid rgba(220,38,38,0.25)`,
    borderRadius: 12,
    padding: "10px 12px",
    whiteSpace: "pre-wrap" as const,
  },
};

function initial(name?: string | null) {
  return name?.trim()?.slice(0, 1) || "生";
}

function mapProfileRow(r: Record<string, unknown>): Student {
  return {
    id: r.id as string,
    name: (r.name ?? null) as string | null,
    phone: (r.phone ?? null) as string | null,
    memo: (r.memo ?? null) as string | null,
    is_approved: !!r.is_approved,
    status: (r.status ?? null) as string | null,
    school_year: (r.school_year ?? null) as string | null,
    subjects: [],
  };
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

export default function Students() {
  const { isStaff } = useIsStaff();

  const [students, setStudents] = useState<Student[]>([]);
  const [pending, setPending] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [withdrawnStudents, setWithdrawnStudents] = useState<Student[]>([]);
  const [withdrawnOpen, setWithdrawnOpen] = useState(false);
  const [q, setQ] = useState("");

  function norm(s: string) {
    return s
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[\u2010-\u2015-]/g, "-"); // なんとなくの記号ゆれ吸收
  }

  const filteredPending = useMemo(() => {
    const qq = norm(q.trim());
    if (!qq) return pending;

    return pending.filter((p) => {
      const hay = norm(
        [
          p.name ?? "",
          p.phone ?? "",
          p.memo ?? "",
          p.school_year ?? "",
          (p.subjects ?? []).join(" "),
        ].join(" ")
      );
      return hay.includes(qq);
    });
  }, [pending, q]);

  const filteredStudents = useMemo(() => {
    const qq = norm(q.trim());
    if (!qq) return students;

    return students.filter((s) => {
      const hay = norm(
        [
          s.name ?? "",
          s.phone ?? "",
          s.memo ?? "",
          s.school_year ?? "",
          (s.subjects ?? []).join(" "),
        ].join(" ")
      );
      return hay.includes(qq);
    });
  }, [students, q]);

  const filteredStudentCount = useMemo(() => filteredStudents.length, [filteredStudents]);
  const filteredPendingCount = useMemo(() => filteredPending.length, [filteredPending]);

  async function loadAll() {
    if (!isStaff) return;
    setLoading(true);
    setErr(null);

    try {
      // ① 在籍（activeのみ）
      const { data: activeData, error: activeErr } = await supabase
        .from("profiles")
        .select("id, name, phone, memo, is_approved, status, role, school_year")
        .eq("role", "student")
        .eq("status", "active");

      if (activeErr) throw activeErr;

      const activeRows = ((activeData ?? []) as Array<Record<string, unknown>>).map(mapProfileRow);

      const activeIds = activeRows.map((x) => x.id);
      const activeSubMap = await loadSubjectsMap(activeIds);
      for (const s of activeRows) s.subjects = activeSubMap.get(s.id) ?? [];

      setPending(activeRows.filter((x) => !x.is_approved));
      setStudents(activeRows.filter((x) => x.is_approved));

      // ② 退会（withdrawn）
      const { data: wData, error: wErr } = await supabase
        .from("profiles")
        .select("id, name, phone, memo, is_approved, status, role, school_year")
        .eq("role", "student")
        .eq("status", "withdrawn");

      if (wErr) throw wErr;

      const wRows = ((wData ?? []) as Array<Record<string, unknown>>).map(mapProfileRow);

      const wIds = wRows.map((x) => x.id);
      const wSubMap = await loadSubjectsMap(wIds);
      for (const s of wRows) s.subjects = wSubMap.get(s.id) ?? [];

      setWithdrawnStudents(wRows);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "不明なエラー";
      setErr("読み込み失敗: " + errorMessage);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaff]);

  async function approve(p: Student) {
    setErr(null);

    // RPC を呼んで承認（profiles.is_approved + approval_requests.resolved_at の整合性を保証）
    const { error } = await supabase.rpc("process_approval", {
      p_user_id: p.id,
      p_action: "approve",
    });

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

    // RPC を呼んで却下（profiles.status = suspended + approval_requests.resolved_at 更新）
    const { error } = await supabase.rpc("process_approval", {
      p_user_id: p.id,
      p_action: "reject",
    });

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
        <div style={styles.hero}>
          <div style={styles.heroInner}>
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
        </div>

        {/* 検索欄 */}
        <div
          style={{
            background: "#ffffff",
            border: "1.5px solid rgba(15,23,42,0.10)",
            borderRadius: 16,
            boxShadow: "0 8px 18px rgba(15,23,42,0.06)",
            padding: "12px 12px",
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="検索（名前 / 電話 / メモ）"
            style={{
              width: "100%",
              border: "1px solid rgba(15,23,42,0.10)",
              borderRadius: 12,
              padding: "10px 12px",
              fontWeight: 800,
              outline: "none",
            }}
          />
          {q.trim() && (
            <button
              style={{
                background: "#ffffff",
                border: "1.5px solid rgba(15,23,42,0.12)",
                borderRadius: 12,
                padding: "10px 12px",
                fontWeight: 900,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
              onClick={() => setQ("")}
            >
              クリア
            </button>
          )}
        </div>

        {/* 承認待ち */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <strong style={styles.cardHeaderTitle}>承認待ち</strong>
            <span style={styles.badge}>{filteredPendingCount} 件</span>
          </div>
          <div style={styles.cardBody}>
            {filteredPending.length === 0 ? (
              <div style={{ color: colors.textSub, fontSize: "14px" }}>
                {q.trim() ? "検索条件に一致する承認待ちはありません。" : "承認待ちはありません。"}
              </div>
            ) : (
              filteredPending.map((p) => (
                <div key={p.id} style={styles.row}>
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
            <strong style={styles.cardHeaderTitle}>生徒一覧</strong>
            <span style={styles.badge}>{filteredStudentCount} 人</span>
          </div>
          <div style={styles.cardBody}>
            {filteredStudents.length === 0 ? (
              <div style={{ color: colors.textSub, fontSize: "14px" }}>
                {q.trim() ? "検索条件に一致する生徒がいません。" : "生徒がいません。"}
              </div>
            ) : (
              filteredStudents.map((s) => (
                <div
                  key={s.id}
                  style={{ ...styles.row, cursor: "pointer" }}
                  onClick={() => setSelected(s)}
                >
                  <div style={{ display: "flex", gap: "12px" }}>
                    <div style={styles.avatar}>{initial(s.name)}</div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{s.name ?? "未設定"}</div>
                      <div style={{ fontSize: "12px", color: colors.textSub }}>{s.phone ?? "-"}</div>
                    </div>
                  </div>
                  <div
                    style={styles.memoChip}
                    title={`${s.school_year ?? "-"} / ${(s.subjects ?? []).join("・")}`}
                  >
                    {(s.school_year ?? "-") +
                      " / " +
                      (s.subjects?.length ? s.subjects.join("・") : "教科未設定")}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 退会済み（折りたたみ） */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <strong style={styles.cardHeaderTitle}>退会済み</strong>
              <span style={styles.badge}>{withdrawnStudents.length} 人</span>
            </div>

            <button
              type="button"
              style={styles.btnGhost}
              onClick={() => setWithdrawnOpen((v) => !v)}
            >
              {withdrawnOpen ? "折りたたむ" : "表示する"} →
            </button>
          </div>

          {withdrawnOpen && (
            <div style={styles.cardBody}>
              {withdrawnStudents.length === 0 ? (
                <div style={{ color: colors.textSub, fontSize: "14px" }}>退会済みの生徒はいません。</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {withdrawnStudents.map((s) => (
                    <div key={s.id} style={styles.row}>
                      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                        <div style={styles.avatar}>{initial(s.name)}</div>
                        <div>
                          <div style={{ fontWeight: 700 }}>{s.name ?? "未設定"}</div>
                          <div style={{ fontSize: "12px", color: colors.textSub }}>{s.phone ?? "-"}</div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={styles.memoChip}>{s.memo ?? "-"}</div>

                        {/* 任意：複活ボタン（必要ならON） */}
                        <button
                          type="button"
                          style={styles.btnGhost}
                          onClick={async () => {
                            setErr(null);
                            const ok = window.confirm(`「${s.name ?? "未設定"}」を複活（在籍に戻す）しますか？`);
                            if (!ok) return;

                            const { error } = await supabase
                              .from("profiles")
                              .update({
                                status: "active",
                                withdrawn_at: null,
                                // 複活後は承認待ちに戻す運用なら false のままでもOK
                                // is_approved: false,
                              })
                              .eq("id", s.id);

                            if (error) {
                              setErr("複活に失敗: " + error.message);
                              return;
                            }

                            // リストを即時反映（再読み込みでもOK）
                            setWithdrawnStudents((arr) => arr.filter((x) => x.id !== s.id));
                            setPending((arr) => [{ ...s, status: "active", is_approved: false }, ...arr]);
                          }}
                        >
                          複活
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={styles.hint} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
