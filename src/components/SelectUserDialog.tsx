/*
 * src/components/SelectUserDialog.tsx
 * Responsibility: DM相手（ユーザー）を選択するモーダル
 * - 承認済みの生徒（必要なら teacher/admin も追加可）を検索して選択
 * - UIはグループ/DMと同じ “白×水色” トーンのカード型
 */

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type UserRow = {
  id: string;
  name: string | null;
  role: "student" | "teacher" | "admin";
  phone: string | null;
  memo: string | null;
  is_approved?: boolean | null;
  status?: string | null;
};

export default function SelectUserDialog({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (userId: string, name: string | null) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setMsg(null);

      // ✅ ここは必要に応じて条件を変えてOK
      // 「承認済み・activeの生徒」を対象
      const { data, error } = await supabase
        .from("profiles")
        .select("id,name,role,phone,memo,is_approved,status")
        .eq("role", "student")
        .eq("is_approved", true)
        .eq("status", "active")
        .order("name", { ascending: true });

      if (!alive) return;

      if (error) {
        setMsg("ユーザー一覧の取得に失敗: " + error.message);
        setUsers([]);
        setLoading(false);
        return;
      }

      setUsers((data ?? []) as UserRow[]);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return users;

    return users.filter((u) => {
      const name = (u.name ?? "").toLowerCase();
      const phone = (u.phone ?? "").toLowerCase();
      const memo = (u.memo ?? "").toLowerCase();
      return (
        name.includes(t) ||
        phone.includes(t) ||
        memo.includes(t) ||
        u.id.toLowerCase().includes(t) ||
        u.role.toLowerCase().includes(t)
      );
    });
  }, [q, users]);

  // ===== “確実に”デザインする（インライン + 最小Tailwind） =====
  const styles = {
    // 背景
    overlay: {
      background: "rgba(2, 6, 23, 0.45)",
      backdropFilter: "blur(6px)",
      WebkitBackdropFilter: "blur(6px)",
    } as React.CSSProperties,

    card: {
      width: "min(820px, 95vw)",
      borderRadius: 22,
      border: "1px solid rgba(207,232,255,0.9)",
      background:
        "linear-gradient(180deg, rgba(240,250,255,1) 0%, rgba(255,255,255,1) 55%, rgba(255,255,255,1) 100%)",
      boxShadow: "0 22px 60px rgba(15,23,42,0.25)",
      overflow: "hidden",
    } as React.CSSProperties,

    header: {
      padding: "14px 16px 12px 16px",
      borderBottom: "1px solid rgba(220,239,255,1)",
      background:
        "linear-gradient(90deg, rgba(234,246,255,1) 0%, rgba(240,250,255,1) 45%, rgba(255,255,255,1) 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    } as React.CSSProperties,

    titleWrap: { display: "flex", flexDirection: "column" as const, gap: 2 },
    title: {
      fontSize: 18,
      fontWeight: 950,
      color: "#0B1220",
      letterSpacing: "0.2px",
    },
    sub: { fontSize: 12.5, color: "#64748B" },

    closeBtn: {
      width: 38,
      height: 38,
      borderRadius: 999,
      border: "1px solid rgba(207,232,255,1)",
      background: "#FFFFFF",
      cursor: "pointer",
      boxShadow: "0 6px 14px rgba(15,23,42,0.06)",
      display: "grid",
      placeItems: "center",
      fontWeight: 900,
      color: "#0F172A",
      userSelect: "none" as const,
    } as React.CSSProperties,

    searchWrap: {
      margin: "12px 16px 12px 16px",
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 12px",
      borderRadius: 999,
      border: "1px solid rgba(207,232,255,1)",
      background: "#FFFFFF",
      boxShadow: "0 8px 18px rgba(15,23,42,0.06)",
    } as React.CSSProperties,
    searchIcon: { fontSize: 14, color: "#64748B" },
    searchInput: {
      width: "100%",
      border: "none",
      outline: "none",
      fontSize: 14,
      background: "transparent",
    } as React.CSSProperties,

    body: {
      padding: "0 16px 14px 16px",
    },

    list: {
      display: "flex",
      flexDirection: "column" as const,
      gap: 10,
      maxHeight: "min(62vh, 540px)",
      overflowY: "auto" as const,
      paddingRight: 2,
    },

    row: {
      borderRadius: 18,
      border: "1px solid rgba(220,239,255,1)",
      background: "#FFFFFF",
      padding: 12,
      boxShadow: "0 10px 22px rgba(15,23,42,0.05)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      cursor: "pointer",
      transition: "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease, background 120ms ease",
    } as React.CSSProperties,

    rowLeft: { minWidth: 0, flex: 1 },
    name: {
      fontSize: 16,
      fontWeight: 950,
      color: "#0B1220",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap" as const,
    },
    meta: {
      marginTop: 4,
      fontSize: 12.5,
      color: "#64748B",
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap" as const,
    },

    pill: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 10px",
      borderRadius: 999,
      border: "1px solid rgba(191,227,255,1)",
      background: "rgba(234,246,255,0.65)",
      color: "#0F172A",
      fontSize: 11.5,
      fontWeight: 900,
    } as React.CSSProperties,

    selectBtn: {
      border: "1px solid rgba(124,199,255,1)",
      background: "linear-gradient(180deg, #53B9FF 0%, #2EA8FF 100%)",
      color: "#fff",
      padding: "10px 12px",
      borderRadius: 999,
      fontSize: 12.5,
      fontWeight: 950,
      cursor: "pointer",
      boxShadow: "0 10px 22px rgba(46,168,255,0.22)",
      flexShrink: 0 as const,
      userSelect: "none" as const,
    } as React.CSSProperties,

    footer: {
      padding: "12px 16px",
      borderTop: "1px solid rgba(220,239,255,1)",
      background: "rgba(255,255,255,0.9)",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
    } as React.CSSProperties,

    footerHint: { fontSize: 12.5, color: "#64748B" },

    cancelBtn: {
      border: "1px solid rgba(191,227,255,1)",
      background: "linear-gradient(180deg, #FFFFFF 0%, #F7FBFF 100%)",
      padding: "9px 12px",
      borderRadius: 999,
      fontSize: 12.5,
      fontWeight: 950,
      cursor: "pointer",
      boxShadow: "0 6px 14px rgba(15,23,42,0.06)",
      color: "#0F172A",
    } as React.CSSProperties,

    msg: { marginTop: 10, fontSize: 13, color: "#B91C1C" },
    empty: {
      padding: "14px 12px",
      borderRadius: 16,
      border: "1px dashed rgba(191,227,255,1)",
      background: "rgba(234,246,255,0.35)",
      color: "#64748B",
      fontSize: 13.5,
    } as React.CSSProperties,
  };

  return (
    <div className="fixed inset-0 z-[999] grid place-items-center" style={styles.overlay}>
      <div style={styles.card} role="dialog" aria-modal="true">
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.titleWrap}>
            <div style={styles.title}>生徒一覧（DM相手を選択）</div>
            <div style={styles.sub}>検索して選ぶだけでDMが作成されます</div>
          </div>

          <button
            style={styles.closeBtn}
            onClick={onClose}
            aria-label="閉じる"
            onMouseDown={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(1px)";
            }}
            onMouseUp={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0px)";
            }}
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div style={styles.searchWrap}>
          <span style={styles.searchIcon}>🔎</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="名前 / 電話 / メモ / ID で検索"
            style={styles.searchInput}
          />
        </div>

        {/* Body */}
        <div style={styles.body}>
          {loading ? (
            <div style={styles.empty}>読み込み中…</div>
          ) : filtered.length === 0 ? (
            <div style={styles.empty}>該当する生徒が見つかりません。</div>
          ) : (
            <div style={styles.list}>
              {filtered.map((u) => {
                const displayName = u.name ?? "（未設定）";

                return (
                  <div
                    key={u.id}
                    style={styles.row}
                    onMouseEnter={(e) => {
                      Object.assign(e.currentTarget.style, {
                        background: "rgba(243,250,255,1)",
                        borderColor: "rgba(191,227,255,1)",
                        boxShadow: "0 14px 28px rgba(15,23,42,0.08)",
                        transform: "translateY(-1px)",
                      });
                    }}
                    onMouseLeave={(e) => {
                      Object.assign(e.currentTarget.style, styles.row);
                    }}
                    onClick={() => onSelect(u.id, u.name)}
                    role="button"
                    tabIndex={0}
                  >
                    <div style={styles.rowLeft}>
                      <div style={styles.name}>{displayName}</div>

                      <div style={styles.meta}>
                        <span style={styles.pill}>ID: {u.id.slice(0, 8)}…</span>
                        {u.phone ? (
                          <span style={styles.pill}>📞 {u.phone}</span>
                        ) : (
                          <span style={styles.pill}>📞 -</span>
                        )}
                        {u.memo ? (
                          <span style={styles.pill}>📝 {u.memo}</span>
                        ) : (
                          <span style={styles.pill}>📝 -</span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      style={styles.selectBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(u.id, u.name);
                      }}
                      onMouseDown={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.transform =
                          "translateY(1px)";
                      }}
                      onMouseUp={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.transform =
                          "translateY(0px)";
                      }}
                    >
                      選択
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {msg && <div style={styles.msg}>{msg}</div>}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <div style={styles.footerHint}>Esc で閉じる（※任意で実装してOK）</div>
          <button
            style={styles.cancelBtn}
            onClick={onClose}
            onMouseDown={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(1px)";
            }}
            onMouseUp={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0px)";
            }}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
