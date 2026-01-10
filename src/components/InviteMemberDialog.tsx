/*
 * src/components/InviteMemberDialog.tsx
 * Responsibility: 指定したグループに生徒を招待するダイアログ
 * - グループに未所属の承認済み生徒を検索して招待を行う
 */

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Student = {
  id: string;
  name: string | null;
  phone: string | null;
  memo: string | null;
};

function MiniConfirmDialog({
  open,
  title,
  description,
  primaryLabel = "実行",
  cancelLabel = "キャンセル",
  onCancel,
  onConfirm,
  confirming = false,
}: {
  open: boolean;
  title: string;
  description?: string;
  primaryLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirming?: boolean;
}) {
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
          <div style={styles.confirmIcon}>✉️</div>
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
              ...styles.confirmPrimaryBtn,
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
            {confirming ? "処理中…" : primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InviteMemberDialog({
  groupId,
  onClose,
  onInvited,
}: {
  groupId: string;
  onClose: () => void;
  onInvited?: (userId: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  // 招待ボタンの二重押し防止
  const [invitingId, setInvitingId] = useState<string | null>(null);

  // 確認モーダル用
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Student | null>(null);

  // ESCで閉じる（メインダイアログ）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let alive = true;

    async function fetchAll() {
      setLoading(true);
      setMsg(null);

      // 1) 既存メンバーID
      const { data: m, error: me } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId);

      if (me) {
        if (alive) {
          setMsg("メンバー取得に失敗: " + me.message);
          setLoading(false);
        }
        return;
      }
      const memberIds = (m ?? []).map((r) => r.user_id as string);

      // 2) 承認済み・有効な生徒一覧
      const { data: s, error: se } = await supabase
        .from("profiles")
        .select("id, name, phone, memo, role, is_approved, status")
        .eq("role", "student")
        .eq("is_approved", true)
        .eq("status", "active")
        .order("name", { ascending: true });

      if (se) {
        if (alive) {
          setMsg("生徒一覧の取得に失敗: " + se.message);
          setLoading(false);
        }
        return;
      }

      // 3) 既メンバーを除外
      const notYet = (s ?? []).filter((st) => !memberIds.includes(st.id));

      if (alive) {
        setStudents(notYet as Student[]);
        setLoading(false);
      }
    }

    fetchAll();
    return () => {
      alive = false;
    };
  }, [groupId]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return students;
    return students.filter((s) => {
      const name = (s.name ?? "").toLowerCase();
      const phone = (s.phone ?? "").toLowerCase();
      const memo = (s.memo ?? "").toLowerCase();
      return (
        name.includes(t) ||
        phone.includes(t) ||
        memo.includes(t) ||
        s.id.toLowerCase().includes(t)
      );
    });
  }, [q, students]);

  function openInviteConfirm(s: Student) {
    setMsg(null);
    setConfirmTarget(s);
    setConfirmOpen(true);
  }

  function closeConfirm() {
    setConfirmOpen(false);
    setConfirmTarget(null);
  }

  async function doInviteConfirmed() {
    if (!confirmTarget) return;

    setMsg(null);
    setInvitingId(confirmTarget.id);

    const { error } = await supabase
      .from("group_members")
      .insert({ group_id: groupId, user_id: confirmTarget.id });

    // 409（重複）は成功扱い
    if (error && !/409|duplicate/i.test(error.message)) {
      setMsg("招待に失敗: " + error.message);
      setInvitingId(null);
      return;
    }

    // UIから除外
    setStudents((prev) => prev.filter((s) => s.id !== confirmTarget.id));

    setInvitingId(null);
    closeConfirm();
    onInvited?.(confirmTarget.id);
  }

  const s = styles;

  return (
    <>
      <div style={s.backdrop} onMouseDown={onClose}>
        <div style={s.modal} onMouseDown={(e) => e.stopPropagation()}>
          {/* Header */}
          <div style={s.header}>
            <div style={s.titleWrap}>
              <div style={s.title}>生徒を招待</div>
              <div style={s.sub}>未所属の承認済み生徒を追加できます</div>
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
                placeholder="氏名・電話・メモ・ID で検索"
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
                <div style={s.emptyTitle}>招待できる生徒がいません</div>
                <div style={s.emptySub}>
                  条件（承認済み/有効/未所属）に合う生徒が見つかりませんでした。
                </div>
              </div>
            ) : (
              <div style={s.table}>
                <div style={s.thead}>
                  <div style={{ ...s.th, ...s.colName }}>氏名</div>
                  <div style={{ ...s.th, ...s.colPhone }}>電話番号</div>
                  <div style={{ ...s.th, ...s.colMemo }}>メモ</div>
                  <div style={{ ...s.th, ...s.colAction }} />
                </div>

                <div style={s.tbody}>
                  {filtered.map((st) => {
                    const isInviting = invitingId === st.id;

                    return (
                      <div
                        key={st.id}
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
                            <div style={s.name}>{st.name ?? "（未設定）"}</div>
                          </div>
                          <div style={s.idText}>ID: {st.id}</div>
                        </div>

                        <div style={{ ...s.td, ...s.colPhone }}>
                          <span style={s.muted}>{st.phone ?? "-"}</span>
                        </div>

                        <div style={{ ...s.td, ...s.colMemo }}>
                          <span style={s.muted}>{st.memo ?? "-"}</span>
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
                          <button
                            onClick={() => openInviteConfirm(st)}
                            disabled={isInviting}
                            style={{
                              ...s.inviteBtn,
                              ...(isInviting ? s.inviteBtnDisabled : {}),
                            }}
                          >
                            {isInviting ? "処理中…" : "招待"}
                          </button>
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

      <MiniConfirmDialog
        open={confirmOpen}
        title="この生徒を招待しますか？"
        description={
          confirmTarget
            ? `${confirmTarget.name ?? "（未設定）"} をこのグループに追加します。`
            : undefined
        }
        primaryLabel="招待する"
        cancelLabel="キャンセル"
        confirming={!!(confirmTarget && invitingId === confirmTarget.id)}
        onCancel={closeConfirm}
        onConfirm={doInviteConfirmed}
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
    width: "min(920px, 96vw)",
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
    gridTemplateColumns: "1.1fr 0.8fr 1.3fr 0.5fr",
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
    gridTemplateColumns: "1.1fr 0.8fr 1.3fr 0.5fr",
    borderBottom: "1px solid #EEF6FF",
    background: "#FFFFFF",
    transition: "background 120ms ease",
  },
  td: { padding: "12px 12px", fontSize: 14, color: "#0B1220" },

  colName: {},
  colPhone: {},
  colMemo: {},
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

  inviteBtn: {
    border: "1px solid #7CC7FF",
    background: "linear-gradient(180deg, #53B9FF 0%, #2EA8FF 100%)",
    color: "#fff",
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 12.5,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(46, 168, 255, 0.20)",
    transition: "transform 120ms ease, box-shadow 120ms ease, filter 120ms ease",
    userSelect: "none",
  },
  inviteBtnDisabled: {
    opacity: 0.65,
    cursor: "not-allowed",
    filter: "grayscale(0.08)",
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
    zIndex: 10000,
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
    border: "1px solid #CFE8FF",
    background: "rgba(234,246,255,0.75)",
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
  confirmPrimaryBtn: {
    border: "1px solid #7CC7FF",
    background: "linear-gradient(180deg, #53B9FF 0%, #2EA8FF 100%)",
    color: "#fff",
    padding: "9px 12px",
    borderRadius: 12,
    fontSize: 12.5,
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(46, 168, 255, 0.20)",
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
