/*
 * src/components/InviteMemberDialog.tsx
 * Responsibility: 指定したグループに生徒を一括招待するダイアログ
 * - グループに未所属の承認済み生徒をチェックボックスで複数選択
 * - 学年/教科で検索・絞り込み
 * - 一括招待機能
 */

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Role = string;
type PickUser = {
  id: string;
  name: string | null;
  role: Role;
  memo: string | null;
  school_year: string | null;
  subjects: string[];
};

type ProfileSubRow = {
  user_id: string;
  subject: { name: string | null } | null;
};

export default function InviteMemberDialog({
  groupId,
  onClose,
  onInvited,
}: {
  groupId: string;
  onClose: () => void;
  onInvited?: (userIds: string[]) => void;
}) {
  const [users, setUsers] = useState<PickUser[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 初期データ
  useEffect(() => {
    let alive = true;

    async function fetchAll() {
      setLoading(true);
      setMsg(null);

      // 既存メンバー
      const { data: m, error: me } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId);

      if (me) {
        if (alive) {
          setMsg("メンバー取得失敗: " + me.message);
          setLoading(false);
        }
        return;
      }
      const memberIds = (m ?? []).map((r) => String(r.user_id));

      // 承認済み生徒
      const { data: p, error: pe } = await supabase
        .from("profiles")
        .select("id, name, memo, role, is_approved, status, school_year")
        .eq("role", "student")
        .eq("is_approved", true)
        .eq("status", "active")
        .order("name", { ascending: true });

      if (pe) {
        if (alive) {
          setMsg("生徒取得失敗: " + pe.message);
          setLoading(false);
        }
        return;
      }

      // 既存メンバーをフィルタ
      const notYet = (p ?? []).filter((u) => !memberIds.includes(u.id));

      // 教科取得
      const ids = notYet.map((u) => u.id);
      const subMap = new Map<string, string[]>();

      if (ids.length > 0) {
        const { data: ps } = await supabase
          .from("profile_subjects")
          .select("user_id, subject:study_subjects(name)")
          .in("user_id", ids);

        for (const row of (ps ?? []) as unknown as ProfileSubRow[]) {
          const uid = String(row.user_id);
          const name = row.subject?.name ?? null;
          if (!name) continue;
          const arr = subMap.get(uid) ?? [];
          arr.push(name);
          subMap.set(uid, arr);
        }
        for (const [k, arr] of subMap.entries()) {
          subMap.set(k, Array.from(new Set(arr)));
        }
      }

      const merged: PickUser[] = notYet.map((u) => ({
        id: u.id,
        name: u.name,
        role: u.role,
        memo: u.memo,
        school_year: u.school_year,
        subjects: subMap.get(u.id) ?? [],
      }));

      if (alive) {
        setUsers(merged);
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
    if (!t) return users;
    return users.filter((u) => {
      const name = (u.name ?? "").toLowerCase();
      const memo = (u.memo ?? "").toLowerCase();
      const year = (u.school_year ?? "").toLowerCase();
      const subjects = u.subjects.join(" ").toLowerCase();
      return (
        name.includes(t) ||
        memo.includes(t) ||
        year.includes(t) ||
        subjects.includes(t) ||
        u.id.toLowerCase().includes(t)
      );
    });
  }, [q, users]);

  const selectedUsers = useMemo(() => {
    const set = new Set(selected);
    return users.filter((u) => set.has(u.id));
  }, [selected, users]);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function clearAll() {
    setSelected([]);
  }

  function selectAllVisible() {
    const ids = filtered.map((u) => u.id);
    setSelected((prev) => Array.from(new Set([...prev, ...ids])));
  }

  async function invite() {
    if (selected.length === 0) {
      setMsg("生徒を選択してください");
      return;
    }
    setSaving(true);
    setMsg(null);

    const rows = selected.map((uid) => ({
      group_id: groupId,
      user_id: uid,
      last_read_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("group_members").insert(rows);

    if (error && !/409|duplicate/i.test(error.message)) {
      setMsg("招待失敗: " + error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    onInvited?.(selected);
    onClose();
  }

  const s = styles;

  return (
    <div style={s.backdrop} onMouseDown={onClose}>
      <div style={s.modal} onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.titleWrap}>
            <div style={s.title}>生徒を一括招待</div>
            <div style={s.sub}>未所属の生徒を複数選択して招待できます</div>
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
              placeholder="氏名・学年・教科・メモ・ID で検索"
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
          ) : (
            <div style={s.panels}>
              {/* 左パネル */}
              <div style={s.leftPanel}>
                <div style={s.panelHead}>
                  <div style={s.panelTitle}>候補（{filtered.length}）</div>
                  {filtered.length > 0 && (
                    <button style={s.selectAllBtn} onClick={selectAllVisible}>
                      表示中を全選択
                    </button>
                  )}
                </div>

                {filtered.length === 0 ? (
                  <div style={s.empty}>
                    <div style={s.emptyTitle}>候補なし</div>
                    <div style={s.emptySub}>
                      該当する生徒が見つかりませんでした
                    </div>
                  </div>
                ) : (
                  <div style={s.list}>
                    {filtered.map((u) => {
                      const isChecked = selected.includes(u.id);
                      return (
                        <div
                          key={u.id}
                          style={s.listItem}
                          onClick={() => toggle(u.id)}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            readOnly
                            style={s.check}
                          />
                          <div style={s.listContent}>
                            <div style={s.userName}>{u.name ?? "（未設定）"}</div>
                            <div style={s.userLine}>
                              <span style={s.muted}>
                                {u.school_year ?? "-"}
                              </span>
                              {u.subjects.length > 0 && (
                                <span style={s.muted}>
                                  ・{u.subjects.join(" / ")}
                                </span>
                              )}
                            </div>
                            {u.memo && (
                              <div style={s.userMemo}>{u.memo}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 右パネル */}
              <div style={s.rightPanel}>
                <div style={s.panelHead}>
                  <div style={s.panelTitle}>選択中（{selected.length}）</div>
                  {selected.length > 0 && (
                    <button style={s.clearBtn} onClick={clearAll}>
                      全解除
                    </button>
                  )}
                </div>

                {selected.length === 0 ? (
                  <div style={s.empty}>
                    <div style={s.emptyTitle}>未選択</div>
                    <div style={s.emptySub}>
                      左から生徒をクリックして選択してください
                    </div>
                  </div>
                ) : (
                  <div style={s.chips}>
                    {selectedUsers.map((u) => (
                      <div key={u.id} style={s.chip}>
                        <div style={s.chipLabel}>{u.name ?? "（未設定）"}</div>
                        <button
                          style={s.chipX}
                          onClick={() => toggle(u.id)}
                          aria-label="削除"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {msg && <div style={s.error}>{msg}</div>}
        </div>

        {/* Footer */}
        <div style={s.footer}>
          <button style={s.closeBtn} onClick={onClose}>
            キャンセル
          </button>
          <button
            style={{ ...s.inviteBtn, ...(saving ? s.inviteBtnDisabled : {}) }}
            onClick={invite}
            disabled={saving || selected.length === 0}
          >
            {saving ? "招待中..." : `${selected.length}人を招待`}
          </button>
        </div>
      </div>
    </div>
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
    width: "min(1080px, 96vw)",
    maxHeight: "min(720px, 92vh)",
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

  panels: {
    display: "grid",
    gridTemplateColumns: "1fr 0.9fr",
    gap: 14,
    minHeight: 420,
  },

  leftPanel: {
    border: "1px solid #DCEFFF",
    borderRadius: 14,
    background: "#FFFFFF",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  rightPanel: {
    border: "1px solid #DCEFFF",
    borderRadius: 14,
    background: "#FFFFFF",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },

  panelHead: {
    padding: "10px 12px",
    borderBottom: "1px solid #DCEFFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "linear-gradient(180deg, #EAF6FF 0%, #F7FBFF 100%)",
  },
  panelTitle: { fontSize: 12.5, fontWeight: 900, color: "#0F172A" },

  selectAllBtn: {
    border: "1px solid #CFE8FF",
    background: "#FFFFFF",
    color: "#0F172A",
    padding: "6px 10px",
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 4px 10px rgba(15,23,42,0.05)",
  },

  clearBtn: {
    border: "1px solid #FECACA",
    background: "#FFF1F2",
    color: "#B91C1C",
    padding: "6px 10px",
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 4px 10px rgba(185,28,28,0.08)",
  },

  list: {
    padding: "8px",
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },

  listItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "10px",
    borderRadius: 10,
    border: "1px solid #E2F1FF",
    background: "#FAFCFF",
    cursor: "pointer",
    transition: "background 120ms ease",
  },

  check: {
    cursor: "pointer",
    marginTop: 2,
  },

  listContent: { flex: 1, minWidth: 0 },
  userName: { fontSize: 14, fontWeight: 900, color: "#0B1220" },
  userLine: {
    marginTop: 3,
    fontSize: 12,
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
  },
  muted: { color: "#64748B", fontSize: 12 },
  userMemo: { marginTop: 4, fontSize: 11.5, color: "#94A3B8" },

  chips: {
    padding: "10px",
    overflow: "auto",
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignContent: "flex-start",
  },

  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 10px",
    borderRadius: 8,
    border: "1px solid #7CC7FF",
    background: "linear-gradient(180deg, #EAF6FF 0%, #FFFFFF 100%)",
    fontSize: 12.5,
    fontWeight: 900,
    color: "#0F172A",
  },
  chipLabel: { flex: 1 },
  chipX: {
    border: "none",
    background: "transparent",
    color: "#64748B",
    fontSize: 12,
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
  },

  empty: {
    padding: "26px 14px",
    textAlign: "center",
    border: "1px dashed #BFE3FF",
    borderRadius: 10,
    background: "rgba(234, 246, 255, 0.55)",
    margin: 10,
  },
  emptyTitle: { fontSize: 13, fontWeight: 900, color: "#0F172A" },
  emptySub: { marginTop: 4, fontSize: 12, color: "#64748B" },

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
    gap: 10,
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
  inviteBtn: {
    border: "1px solid #7CC7FF",
    background: "linear-gradient(180deg, #53B9FF 0%, #2EA8FF 100%)",
    color: "#fff",
    padding: "9px 16px",
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(46, 168, 255, 0.20)",
    userSelect: "none",
    transition: "opacity 120ms ease",
  },
  inviteBtnDisabled: {
    opacity: 0.7,
    cursor: "not-allowed",
  },
};
