/*
 * src/components/GroupMembersDialog.tsx
 * Responsibility: グループのメンバー一覧と管理ダイアログ
 * - グループに所属するユーザーを一覧化し、オーナーはメンバー削除が可能
 */

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Member = {
  id: string; // profiles.id
  name: string | null;
  role: "student" | "teacher" | "admin";
  phone: string | null;
};

function roleLabel(role: Member["role"]) {
  if (role === "admin") return "管理者";
  if (role === "teacher") return "講師";
  return "生徒";
}

function roleBadgeStyle(role: Member["role"]): React.CSSProperties {
  if (role === "admin") return styles.badgeAdmin;
  if (role === "teacher") return styles.badgeTeacher;
  return styles.badgeStudent;
}

/** 小さめ確認モーダル（confirm の置き換え） */
function MiniConfirmDialog({
  open,
  title,
  description,
  dangerLabel = "削除",
  cancelLabel = "キャンセル",
  onCancel,
  onConfirm,
  confirming = false,
}: {
  open: boolean;
  title: string;
  description?: string;
  dangerLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirming?: boolean;
}) {
  // ESC で閉じる（親でもESC処理してるけど、ダブルでも害なし）
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div style={styles.confirmBackdrop} onMouseDown={onCancel}>
      <div style={styles.confirmCard} onMouseDown={(e) => e.stopPropagation()}>
        <div style={styles.confirmHead}>
          <div style={styles.confirmIcon}>⚠️</div>
          <div style={{ minWidth: 0 }}>
            <div style={styles.confirmTitle}>{title}</div>
            {description && <div style={styles.confirmDesc}>{description}</div>}
          </div>
        </div>

        <div style={styles.confirmActions}>
          <button
            style={{
              ...styles.confirmCancelBtn,
              ...(confirming ? styles.btnDisabled : {}),
            }}
            onClick={onCancel}
            disabled={confirming}
          >
            {cancelLabel}
          </button>

          <button
            style={{
              ...styles.confirmDangerBtn,
              ...(confirming ? styles.btnDisabled : {}),
            }}
            onClick={onConfirm}
            disabled={confirming}
            onMouseDown={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform =
                "translateY(1px)";
            }}
            onMouseUp={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform =
                "translateY(0px)";
            }}
          >
            {confirming ? "処理中…" : dangerLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GroupMembersDialog({
  groupId,
  isOwner, // 表示中ユーザーがこのグループの作成者か
  ownerId, // グループのオーナーの user_id（この人は外せない）
  onClose,
}: {
  groupId: string;
  isOwner: boolean;
  ownerId: string | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  // UI: 外すボタンの押下中状態
  const [removingId, setRemovingId] = useState<string | null>(null);

  // 確認モーダル用 state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Member | null>(null);

  // ESCで閉じる（メインダイアログ）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function load() {
    setLoading(true);
    setMsg(null);

    const { data: gm, error: ge } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", groupId);

    if (ge) {
      setMsg("メンバー取得に失敗: " + ge.message);
      setLoading(false);
      return;
    }

    const ids = (gm ?? []).map((r) => r.user_id as string);
    if (ids.length === 0) {
      setMembers([]);
      setLoading(false);
      return;
    }

    const { data: ps, error: pe } = await supabase
      .from("profiles")
      .select("id, name, role, phone")
      .in("id", ids);

    if (pe) {
      setMsg("プロフィール取得に失敗: " + pe.message);
      setLoading(false);
      return;
    }

    setMembers((ps ?? []) as Member[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return members;
    return members.filter((m) => {
      const name = (m.name ?? "").toLowerCase();
      const phone = (m.phone ?? "").toLowerCase();
      return (
        name.includes(t) ||
        phone.includes(t) ||
        m.id.toLowerCase().includes(t) ||
        m.role.includes(t)
      );
    });
  }, [q, members]);

  function openRemoveConfirm(m: Member) {
    if (!isOwner) return;
    const isGroupOwner = ownerId ? m.id === ownerId : false;
    if (isGroupOwner) return;

    setMsg(null);
    setConfirmTarget(m);
    setConfirmOpen(true);
  }

  function closeConfirm() {
    setConfirmOpen(false);
    setConfirmTarget(null);
  }

  async function doRemoveConfirmed() {
    if (!confirmTarget) return;
    if (!isOwner) return;
    if (ownerId && confirmTarget.id === ownerId) return;

    setMsg(null);
    setRemovingId(confirmTarget.id);

    const { error } = await supabase
      .from("group_members")
      .delete()
      .match({ group_id: groupId, user_id: confirmTarget.id });

    if (error) {
      setMsg("削除に失敗: " + error.message);
      setRemovingId(null);
      return;
    }

    setMembers((prev) => prev.filter((m) => m.id !== confirmTarget.id));
    setRemovingId(null);
    closeConfirm();
  }

  const s = styles;

  return (
    <>
      <div style={s.backdrop} onMouseDown={onClose}>
        <div style={s.modal} onMouseDown={(e) => e.stopPropagation()}>
          {/* Header */}
          <div style={s.header}>
            <div style={s.titleWrap}>
              <div style={s.title}>メンバー管理</div>
              <div style={s.sub}>
                {isOwner ? "メンバーの確認・削除ができます" : "メンバーの確認ができます"}
              </div>
            </div>

            <button style={s.iconBtn} onClick={onClose} aria-label="閉じる">
              ✕
            </button>
          </div>

          {/* Search */}
          <div style={s.searchArea}>
            <div style={s.searchBox}>
              <span style={s.searchIcon}>🔎</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="名前 / 電話 / ID / 役割 で検索"
                style={s.searchInput}
              />
            </div>
          </div>

          {/* Body */}
          <div style={s.body}>
            {loading ? (
              <div style={s.loadingBox}>
                <div style={s.spinner} />
                <div style={s.loadingText}>読み込み中...</div>
              </div>
            ) : filtered.length === 0 ? (
              <div style={s.empty}>
                <div style={s.emptyTitle}>メンバーがいません</div>
                <div style={s.emptySub}>招待から追加してください。</div>
              </div>
            ) : (
              <div style={s.table}>
                <div style={s.thead}>
                  <div style={{ ...s.th, ...s.colName }}>氏名</div>
                  <div style={{ ...s.th, ...s.colRole }}>役割</div>
                  <div style={{ ...s.th, ...s.colPhone }}>電話番号</div>
                  <div style={{ ...s.th, ...s.colAction }} />
                </div>

                <div style={s.tbody}>
                  {filtered.map((m) => {
                    const isGroupOwner = ownerId ? m.id === ownerId : false;
                    const canRemove = isOwner && !isGroupOwner;
                    const isRemoving = removingId === m.id;

                    return (
                      <div
                        key={m.id}
                        style={s.row}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLDivElement).style.background =
                            "rgba(234, 246, 255, 0.55)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLDivElement).style.background =
                            "#FFFFFF";
                        }}
                      >
                        <div style={{ ...s.td, ...s.colName }}>
                          <div style={s.nameRow}>
                            <div style={s.name}>{m.name ?? "（未設定）"}</div>

                            {isGroupOwner && (
                              <span style={s.ownerPill}>オーナー</span>
                            )}
                          </div>
                          <div style={s.idText}>ID: {m.id}</div>
                        </div>

                        <div style={{ ...s.td, ...s.colRole }}>
                          <span style={{ ...s.rolePill, ...roleBadgeStyle(m.role) }}>
                            {roleLabel(m.role)}
                          </span>
                        </div>

                        <div style={{ ...s.td, ...s.colPhone }}>
                          <span style={s.muted}>{m.phone ?? "-"}</span>
                        </div>

                        <div
                          style={{
                            ...s.td,
                            ...s.colAction,
                            display: "flex",
                            justifyContent: "flex-end",
                            alignItems: "center",
                          }}
                        >
                          {canRemove ? (
                            <button
                              onClick={() => openRemoveConfirm(m)}
                              disabled={isRemoving}
                              style={{
                                ...s.removeBtn,
                                ...(isRemoving ? s.removeBtnDisabled : {}),
                              }}
                              aria-label="メンバーを外す"
                            >
                              {isRemoving ? "処理中…" : "外す"}
                            </button>
                          ) : (
                            <span style={s.viewOnly}>閲覧のみ</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {msg && <div style={s.error}>{msg}</div>}
          </div>

          {/* Footer */}
          <div style={s.footer}>
            <button style={s.closeBtn} onClick={onClose}>
              閉じる
            </button>
          </div>
        </div>
      </div>

      {/* 確認モーダル（小さめ） */}
      <MiniConfirmDialog
        open={confirmOpen}
        title="このメンバーを外しますか？"
        description={
          confirmTarget
            ? `${confirmTarget.name ?? "（未設定）"} をこのグループから外します。`
            : undefined
        }
        dangerLabel="外す"
        cancelLabel="キャンセル"
        confirming={!!(confirmTarget && removingId === confirmTarget.id)}
        onCancel={closeConfirm}
        onConfirm={doRemoveConfirmed}
      />
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    background: "rgba(15, 23, 42, 0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },

  modal: {
    width: "min(900px, 96vw)",
    maxHeight: "min(640px, 92vh)",
    background: "linear-gradient(180deg, #F2FAFF 0%, #FFFFFF 55%)",
    border: "1px solid #CFE8FF",
    borderRadius: 18,
    boxShadow: "0 18px 55px rgba(15, 23, 42, 0.22)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },

  header: {
    padding: "14px 16px",
    borderBottom: "1px solid #DCEFFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  titleWrap: { minWidth: 0 },
  title: { fontSize: 20, fontWeight: 900, color: "#0B1220", letterSpacing: 0.2 },
  sub: { marginTop: 2, fontSize: 12.5, color: "#64748B" },

  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    border: "1px solid #CFE8FF",
    background: "#FFFFFF",
    cursor: "pointer",
    boxShadow: "0 6px 14px rgba(15,23,42,0.06)",
  },

  searchArea: { padding: "10px 16px 12px 16px" },
  searchBox: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid #CFE8FF",
    background: "#FFFFFF",
    boxShadow: "0 2px 10px rgba(15, 23, 42, 0.05)",
  },
  searchIcon: { fontSize: 14, color: "#64748B" },
  searchInput: {
    width: "100%",
    border: "none",
    outline: "none",
    fontSize: 14,
    background: "transparent",
  },

  body: {
    padding: "0 16px 12px 16px",
    overflow: "auto",
    flex: 1,
  },

  loadingBox: {
    border: "1px dashed #BFE3FF",
    borderRadius: 14,
    background: "rgba(234, 246, 255, 0.55)",
    padding: "18px 14px",
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  spinner: {
    width: 18,
    height: 18,
    borderRadius: 999,
    border: "3px solid #BFE3FF",
    borderTopColor: "#2EA8FF",
    animation: "spin 0.9s linear infinite",
  },
  loadingText: { fontSize: 13, fontWeight: 800, color: "#0F172A" },

  table: {
    border: "1px solid #DCEFFF",
    borderRadius: 14,
    overflow: "hidden",
    background: "#FFFFFF",
  },
  thead: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.7fr 0.9fr 0.6fr",
    background: "linear-gradient(180deg, #EAF6FF 0%, #F7FBFF 100%)",
    borderBottom: "1px solid #DCEFFF",
  },
  th: {
    padding: "10px 12px",
    fontSize: 12,
    fontWeight: 900,
    color: "#0F172A",
  },

  tbody: { display: "flex", flexDirection: "column", gap: 0 },
  row: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.7fr 0.9fr 0.6fr",
    borderBottom: "1px solid #EEF6FF",
    background: "#FFFFFF",
    transition: "background 120ms ease",
  },
  td: { padding: "12px 12px", fontSize: 14, color: "#0B1220" },

  colName: {},
  colRole: {},
  colPhone: {},
  colAction: {},

  nameRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  name: {
    fontWeight: 900,
    fontSize: 15.5,
    lineHeight: 1.2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  idText: { marginTop: 4, fontSize: 11.5, color: "#94A3B8" },
  muted: { color: "#64748B" },

  ownerPill: {
    border: "1px solid #93C5FD",
    background: "rgba(219,234,254,0.65)",
    color: "#1D4ED8",
    borderRadius: 999,
    padding: "3px 8px",
    fontSize: 11.5,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  rolePill: {
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid transparent",
  },
  badgeStudent: {
    borderColor: "#CFE8FF",
    background: "rgba(234,246,255,0.75)",
    color: "#0F172A",
  },
  badgeTeacher: {
    borderColor: "#99F6E4",
    background: "rgba(204,251,241,0.75)",
    color: "#065F46",
  },
  badgeAdmin: {
    borderColor: "#FDBA74",
    background: "rgba(255,237,213,0.75)",
    color: "#9A3412",
  },

  removeBtn: {
    border: "1px solid #FCA5A5",
    background: "linear-gradient(180deg, #FB7185 0%, #EF4444 100%)",
    color: "#fff",
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 12.5,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(239, 68, 68, 0.22)",
    transition: "transform 120ms ease, box-shadow 120ms ease, filter 120ms ease",
    userSelect: "none",
  },
  removeBtnDisabled: {
    opacity: 0.65,
    cursor: "not-allowed",
    filter: "grayscale(0.08)",
  },

  viewOnly: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: 900,
  },

  empty: {
    padding: "26px 16px",
    border: "1px dashed #BFE3FF",
    borderRadius: 14,
    background: "rgba(234, 246, 255, 0.55)",
    textAlign: "center",
  },
  emptyTitle: { fontSize: 14, fontWeight: 900, color: "#0F172A" },
  emptySub: { marginTop: 6, fontSize: 12.5, color: "#64748B" },

  error: {
    marginTop: 12,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #FECACA",
    background: "#FFF1F2",
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: 800,
  },

  footer: {
    padding: "12px 16px",
    borderTop: "1px solid #DCEFFF",
    display: "flex",
    justifyContent: "flex-end",
    background: "#FFFFFF",
  },
  closeBtn: {
    border: "1px solid #CFE8FF",
    background: "#FFFFFF",
    color: "#0F172A",
    padding: "9px 14px",
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 6px 14px rgba(15,23,42,0.06)",
  },

  // ===== mini confirm =====
  confirmBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 10000, // 本体より上
    background: "rgba(15, 23, 42, 0.30)",
    display: "grid",
    placeItems: "center",
    padding: 16,
  },
  confirmCard: {
    width: "min(420px, 92vw)",
    borderRadius: 16,
    border: "1px solid #CFE8FF",
    background: "linear-gradient(180deg, #F2FAFF 0%, #FFFFFF 70%)",
    boxShadow: "0 18px 50px rgba(15, 23, 42, 0.22)",
    padding: 14,
  },
  confirmHead: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
  },
  confirmIcon: {
    width: 34,
    height: 34,
    borderRadius: 999,
    border: "1px solid #FDE68A",
    background: "rgba(254, 243, 199, 0.75)",
    display: "grid",
    placeItems: "center",
    fontSize: 16,
    flexShrink: 0,
  },
  confirmTitle: {
    fontSize: 14.5,
    fontWeight: 950,
    color: "#0B1220",
    letterSpacing: 0.2,
  },
  confirmDesc: {
    marginTop: 4,
    fontSize: 12.5,
    color: "#64748B",
    lineHeight: 1.45,
    wordBreak: "break-word",
  },
  confirmActions: {
    marginTop: 12,
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
  },
  confirmCancelBtn: {
    border: "1px solid #CFE8FF",
    background: "#FFFFFF",
    color: "#0F172A",
    padding: "9px 12px",
    borderRadius: 12,
    fontSize: 12.5,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 6px 14px rgba(15,23,42,0.06)",
  },
  confirmDangerBtn: {
    border: "1px solid #FCA5A5",
    background: "linear-gradient(180deg, #FB7185 0%, #EF4444 100%)",
    color: "#fff",
    padding: "9px 12px",
    borderRadius: 12,
    fontSize: 12.5,
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(239, 68, 68, 0.22)",
    userSelect: "none",
  },
  btnDisabled: {
    opacity: 0.7,
    cursor: "not-allowed",
  },
};

/**
 * NOTE:
 * spinnerの animation を動かしたい場合は index.css に追加：
 * @keyframes spin { to { transform: rotate(360deg); } }
 */
