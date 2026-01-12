/*
 * src/components/ProfileViewDialog.tsx
 * Responsibility: 相手プロフィールを表示するダイアログ（見た目強化版）
 * - DM/グループと同じトーン（淡いブルーのグラデ / ガラスっぽいカード / 角丸）
 */

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Profile = {
  id: string;
  name: string | null;
  role: string | null;
  phone: string | null;
  memo: string | null;
  status?: string | null;
};

function roleLabel(role?: string | null) {
  if (role === "teacher") return "先生";
  if (role === "student") return "生徒";
  if (role === "admin") return "管理者";
  return role ?? "不明";
}

export default function ProfileViewDialog({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [p, setP] = useState<Profile | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setMsg(null);

      const { data, error } = await supabase
        .from("profiles")
        .select("id,name,role,phone,memo,status")
        .eq("id", userId)
        .maybeSingle();

      if (!alive) return;

      if (error) {
        setMsg("プロフィール取得に失敗: " + error.message);
        setLoading(false);
        return;
      }

      setP((data ?? null) as Profile | null);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  const initials = useMemo(() => {
    const n = (p?.name ?? "").trim();
    if (!n) return "？";
    // 日本語でも1文字目をそれっぽく
    return n.slice(0, 1).toUpperCase();
  }, [p?.name]);

  // ===== スタイル（DMと同じ方針：インラインで確実に） =====
  const styles: Record<string, React.CSSProperties> = {
    overlay: {
      position: "fixed",
      inset: 0,
      zIndex: 999,
      background: "rgba(0,0,0,0.40)",
      display: "grid",
      placeItems: "center",
      padding: 12,
    },
    panel: {
      width: "min(680px, 95vw)",
      borderRadius: 22,
      border: "1px solid rgba(207,232,255,0.9)",
      background:
        "linear-gradient(180deg, rgba(240,250,255,1) 0%, rgba(255,255,255,1) 55%, rgba(247,251,255,1) 100%)",
      boxShadow: "0 18px 45px rgba(15, 23, 42, 0.20)",
      overflow: "hidden",
    },
    header: {
      padding: "14px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      borderBottom: "1px solid rgba(220,239,255,1)",
      background:
        "linear-gradient(90deg, rgba(234,246,255,1) 0%, rgba(240,250,255,1) 45%, rgba(255,255,255,1) 100%)",
    },
    titleWrap: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 },
    title: {
      fontSize: 18,
      fontWeight: 950,
      color: "#0B1220",
      letterSpacing: "0.2px",
      whiteSpace: "nowrap",
    },
    subtitle: {
      fontSize: 12,
      color: "#64748B",
      marginTop: 2,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    xBtn: {
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
      userSelect: "none",
    },
    body: {
      padding: 16,
      background:
        "linear-gradient(180deg, rgba(234,246,255,0.45) 0%, rgba(255,255,255,1) 55%, rgba(247,251,255,1) 100%)",
    },
    topCard: {
      borderRadius: 18,
      border: "1px solid rgba(220,239,255,1)",
      background: "#FFFFFF",
      boxShadow: "0 10px 22px rgba(15,23,42,0.06)",
      padding: 14,
      display: "flex",
      alignItems: "center",
      gap: 12,
    },
    avatar: {
      width: 54,
      height: 54,
      borderRadius: 18,
      background:
        "linear-gradient(180deg, rgba(83,185,255,1) 0%, rgba(46,168,255,1) 100%)",
      boxShadow: "0 12px 26px rgba(46,168,255,0.22)",
      color: "#fff",
      display: "grid",
      placeItems: "center",
      fontWeight: 950,
      fontSize: 20,
      flexShrink: 0,
    },
    nameBlock: { minWidth: 0, flex: 1 },
    name: {
      fontSize: 18,
      fontWeight: 950,
      color: "#0B1220",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    chips: { marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" },
    chip: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "6px 10px",
      borderRadius: 999,
      border: "1px solid rgba(220,239,255,1)",
      background: "rgba(234,246,255,0.55)",
      color: "#0F172A",
      fontSize: 12,
      fontWeight: 900,
    },
    grid: {
      marginTop: 12,
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: 10,
    },
    row: {
      borderRadius: 16,
      border: "1px solid rgba(220,239,255,1)",
      background: "#FFFFFF",
      boxShadow: "0 8px 18px rgba(15,23,42,0.05)",
      padding: 12,
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 10,
    },
    label: { fontSize: 12, color: "#64748B", fontWeight: 900 },
    value: {
      fontSize: 14,
      color: "#0B1220",
      fontWeight: 800,
      textAlign: "right",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      flex: 1,
    },
    footer: {
      padding: "12px 16px",
      borderTop: "1px solid rgba(220,239,255,1)",
      background: "linear-gradient(180deg, #FFFFFF 0%, #F7FBFF 100%)",
      display: "flex",
      justifyContent: "flex-end",
      gap: 10,
    },
    closeBtn: {
      border: "1px solid rgba(191,227,255,1)",
      background: "linear-gradient(180deg, #FFFFFF 0%, #F7FBFF 100%)",
      padding: "10px 14px",
      borderRadius: 999,
      fontSize: 13,
      fontWeight: 950,
      cursor: "pointer",
      boxShadow: "0 8px 18px rgba(15,23,42,0.06)",
      color: "#0F172A",
      userSelect: "none",
    },
    primaryBtn: {
      border: "1px solid rgba(124,199,255,1)",
      background: "linear-gradient(180deg, #53B9FF 0%, #2EA8FF 100%)",
      padding: "10px 14px",
      borderRadius: 999,
      fontSize: 13,
      fontWeight: 950,
      cursor: "pointer",
      boxShadow: "0 10px 22px rgba(46, 168, 255, 0.22)",
      color: "#fff",
      userSelect: "none",
    },
    error: {
      marginTop: 10,
      color: "#B91C1C",
      fontSize: 13,
      fontWeight: 800,
    },
    loading: { color: "#64748B", fontSize: 13 },
  };

  // overlayクリックで閉じる（カード内クリックは無視）
  function onOverlayClick() {
    onClose();
  }

  return (
    <div style={styles.overlay} onClick={onOverlayClick}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.titleWrap}>
            <div style={{ minWidth: 0 }}>
              <div style={styles.title}>相手のプロフィール</div>
              <div style={styles.subtitle}>
                {p?.name ? p.name : "プロフィール情報"} / {p?.role ? roleLabel(p.role) : "—"}
              </div>
            </div>
          </div>

          <button
            style={styles.xBtn}
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

        {/* Body */}
        <div style={styles.body}>
          {loading ? (
            <div style={styles.loading}>読み込み中…</div>
          ) : !p ? (
            <div style={styles.loading}>プロフィールが見つかりません。</div>
          ) : (
            <>
              <div style={styles.topCard}>
                <div style={styles.avatar}>{initials}</div>
                <div style={styles.nameBlock}>
                  <div style={styles.name}>{p.name ?? "（未設定）"}</div>
                  <div style={styles.chips}>
                    <span style={styles.chip}>👤 {roleLabel(p.role)}</span>
                    {p.status && <span style={styles.chip}>🟢 {p.status}</span>}
                  </div>
                </div>
              </div>

              <div style={styles.grid}>
                <div style={styles.row}>
                  <div style={styles.label}>電話番号</div>
                  <div style={styles.value}>{p.phone ?? "—"}</div>
                </div>

                <div style={styles.row}>
                  <div style={styles.label}>メモ</div>
                  <div style={styles.value}>{p.memo?.trim() ? p.memo : "—"}</div>
                </div>

                <div style={styles.row}>
                  <div style={styles.label}>ユーザーID</div>
                  <div style={styles.value}>{p.id}</div>
                </div>
              </div>
            </>
          )}

          {msg && <div style={styles.error}>{msg}</div>}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button
            style={styles.closeBtn}
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

          {/* ここは将来「通話」「ブロック」「通報」など追加したくなるので枠だけ用意 */}
          <button
            style={styles.primaryBtn}
            onClick={() => {
              // いまはダミー：必要なら後で「メモ編集」「共有」などに差し替え
              onClose();
            }}
            onMouseDown={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(1px)";
            }}
            onMouseUp={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0px)";
            }}
            aria-label="OK"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
