/*
 * src/components/CreateGroupDialog.tsx
 * Responsibility: グループ作成（1枚パネル）
 * - グループ名入力 + メンバー複数選択（学年/教科/メモで検索）
 * - 作成時に groups + group_members を一括 insert
 */

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

type Role = "student" | "teacher" | "admin";

type PickUser = {
  id: string;
  name: string | null;
  role: Role;
  memo: string | null;
  school_year: string | null;
  subjects: string[];
};

type ProfileSubRow = { user_id: string; subject: { name: string | null } | null };

export default function CreateGroupDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (g: { id: string; name: string; type: "class"; owner_id: string | null }) => void;
}) {
  const { user } = useAuth();
  const myId = user?.id ?? "";

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [users, setUsers] = useState<PickUser[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!myId) return;

    let alive = true;

    (async () => {
      setLoading(true);
      setMsg(null);

      // ★作成時に「最初に含めるメンバー」は基本 生徒を選ぶ（必要なら roles を拡張）
      const { data: p, error: pe } = await supabase
        .from("profiles")
        .select("id,name,role,memo,school_year,is_approved,status")
        .eq("role", "student")
        .eq("is_approved", true)
        .eq("status", "active")
        .order("name", { ascending: true });

      if (!alive) return;

      if (pe) {
        setMsg("ユーザー取得に失敗: " + pe.message);
        setUsers([]);
        setLoading(false);
        return;
      }

      const base = (p ?? []).map((u) => ({
        id: String(u.id),
        name: (u.name ?? null) as string | null,
        role: u.role as Role,
        memo: (u.memo ?? null) as string | null,
        school_year: (u.school_year ?? null) as string | null,
        subjects: [] as string[],
      })) as PickUser[];

      // 教科を一括取得
      const ids = base.map((x) => x.id);
      const subjectMap = new Map<string, string[]>();

      if (ids.length > 0) {
        const { data: ps, error: pse } = await supabase
          .from("profile_subjects")
          .select("user_id, subject:study_subjects(name)")
          .in("user_id", ids);

        if (!alive) return;

        if (pse) {
          // 致命ではない（名前/学年だけでも選択できる）
          setMsg((prev) => prev ?? "教科の取得に失敗: " + pse.message);
        } else {
          for (const row of (ps ?? []) as unknown as ProfileSubRow[]) {
            const uid = String(row.user_id);
            const sname = row.subject?.name ?? null;
            if (!sname) continue;
            const arr = subjectMap.get(uid) ?? [];
            arr.push(sname);
            subjectMap.set(uid, arr);
          }
          for (const [k, arr] of subjectMap.entries()) {
            subjectMap.set(k, Array.from(new Set(arr)));
          }
        }
      }

      setUsers(base.map((u) => ({ ...u, subjects: subjectMap.get(u.id) ?? [] })));
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [myId]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function clearAll() {
    setSelected([]);
  }
  function selectAllVisible(list: PickUser[]) {
    setSelected((prev) => Array.from(new Set([...prev, ...list.map((x) => x.id)])));
  }

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return users;
    return users.filter((u) => {
      const nm = (u.name ?? "").toLowerCase();
      const memo = (u.memo ?? "").toLowerCase();
      const year = (u.school_year ?? "").toLowerCase();
      const subj = (u.subjects ?? []).join(" ").toLowerCase();
      return nm.includes(t) || memo.includes(t) || year.includes(t) || subj.includes(t) || u.id.toLowerCase().includes(t);
    });
  }, [q, users]);

  const selectedUsers = useMemo(() => {
    const map = new Map(users.map((u) => [u.id, u]));
    return selected.map((id) => map.get(id)).filter(Boolean) as PickUser[];
  }, [selected, users]);

  async function create() {
    if (!myId) return;
    const n = name.trim();
    if (!n) {
      setMsg("グループ名を入力してください。");
      return;
    }

    setSaving(true);
    setMsg(null);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    try {
      const { error: ge } = await supabase
        .from("groups")
        .insert({ id, name: n, type: "class", owner_id: myId });

      if (ge) throw ge;

      // ★オーナー自身は必ずメンバーに含める
      const memberIds = Array.from(new Set([myId, ...selected]));

      const rows = memberIds.map((uid) => ({
        group_id: id,
        user_id: uid,
        last_read_at: now, // ★null回避（unread集計で困らない）
      }));

      const { error: me } = await supabase.from("group_members").insert(rows);
      if (me && !/409|duplicate/i.test(me.message)) throw me;

      onCreated({ id, name: n, type: "class", owner_id: myId });
      onClose();
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      setMsg("作成に失敗: " + msg);
    } finally {
      setSaving(false);
    }
  }

  const s = styles;

  return (
    <div style={s.backdrop} onMouseDown={onClose}>
      <div style={s.card} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div style={s.header}>
          <div style={{ minWidth: 0 }}>
            <div style={s.title}>グループを作成</div>
            <div style={s.sub}>グループ名 + 最初のメンバーをまとめて選択できます</div>
          </div>
          <button style={s.iconBtn} onClick={onClose} aria-label="閉じる">✕</button>
        </div>

        {/* グループ名 */}
        <div style={s.nameArea}>
          <div style={s.label}>グループ名</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例：2年A組"
            style={s.nameInput}
          />
        </div>

        {/* 検索 + 操作 */}
        <div style={s.searchRow}>
          <div style={s.searchBox}>
            <span style={s.searchIcon}>🔎</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="氏名 / 学年 / 教科 / メモ / ID で検索"
              style={s.searchInput}
            />
          </div>

          <button style={s.ghostBtn} onClick={() => selectAllVisible(filtered)} disabled={loading || filtered.length === 0}>
            表示中を全選択
          </button>
          <button style={s.ghostBtn} onClick={clearAll} disabled={selected.length === 0}>
            全解除
          </button>
        </div>

        <div style={s.body}>
          {loading ? (
            <div style={s.loadingBox}>読み込み中…</div>
          ) : (
            <div style={s.grid}>
              {/* 左：候補 */}
              <div style={s.left}>
                {filtered.length === 0 ? (
                  <div style={s.empty}>候補がありません</div>
                ) : (
                  <div style={s.list}>
                    {filtered.map((u) => {
                      const checked = selected.includes(u.id);
                      const year = u.school_year ?? "-";
                      const subj = u.subjects.length ? u.subjects.join(" / ") : "-";

                      return (
                        <label key={u.id} style={{ ...s.row, ...(checked ? s.rowActive : {}) }}>
                          <input type="checkbox" checked={checked} onChange={() => toggle(u.id)} style={s.checkbox} />
                          <div style={{ minWidth: 0 }}>
                            <div style={s.name}>{u.name ?? "（未設定）"}</div>
                            <div style={s.meta}>
                              <span style={s.pill}>学年: {year}</span>
                              <span style={s.pill}>教科: {subj}</span>
                              {u.memo && <span style={s.pill}>📝 {u.memo}</span>}
                            </div>
                            <div style={s.idText}>ID: {u.id}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 右：選択済み */}
              <div style={s.right}>
                <div style={s.rightHead}>
                  <div style={s.rightTitle}>選択中（{selectedUsers.length}）</div>
                  <div style={s.rightSub}>クリックで解除</div>
                </div>

                {selectedUsers.length === 0 ? (
                  <div style={s.empty}>まだ選択されていません</div>
                ) : (
                  <div style={s.chips}>
                    {selectedUsers.map((u) => (
                      <button key={u.id} style={s.chip} onClick={() => toggle(u.id)} title="クリックで解除">
                        {u.name ?? "（未設定）"} <span style={s.chipX}>✕</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {msg && <div style={s.msg}>{msg}</div>}
        </div>

        <div style={s.footer}>
          <div style={s.countText}>選択中: {selectedUsers.length}人（＋自分は自動で含まれます）</div>
          <button style={s.cancelBtn} onClick={onClose} disabled={saving}>キャンセル</button>
          <button style={{ ...s.primaryBtn, ...(saving ? s.btnDisabled : {}) }} onClick={create} disabled={saving}>
            {saving ? "作成中…" : "作成"}
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
    zIndex: 10000,
    background: "rgba(15, 23, 42, 0.35)",
    display: "grid",
    placeItems: "center",
    padding: 16,
  },
  card: {
    width: "min(980px, 96vw)",
    maxHeight: "min(760px, 92vh)",
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
  title: { fontSize: 18, fontWeight: 950, color: "#0B1220" },
  sub: { marginTop: 3, fontSize: 12.5, color: "#64748B" },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    border: "1px solid #CFE8FF",
    background: "#FFFFFF",
    cursor: "pointer",
    boxShadow: "0 6px 14px rgba(15,23,42,0.06)",
    fontWeight: 900,
  },

  nameArea: { padding: "10px 16px 0 16px" },
  label: { fontSize: 12, fontWeight: 950, color: "#0F172A", marginBottom: 6 },
  nameInput: {
    width: "100%",
    border: "1px solid #CFE8FF",
    borderRadius: 14,
    padding: "10px 12px",
    outline: "none",
    background: "#FFFFFF",
    boxShadow: "0 2px 10px rgba(15, 23, 42, 0.05)",
    fontSize: 14,
  },

  searchRow: {
    padding: "10px 16px 12px 16px",
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  searchBox: {
    flex: 1,
    minWidth: 240,
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
  searchInput: { width: "100%", border: "none", outline: "none", fontSize: 14, background: "transparent" },
  ghostBtn: {
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

  body: { padding: "0 16px 12px 16px", overflow: "auto", flex: 1 },
  loadingBox: {
    marginTop: 6,
    padding: "14px 12px",
    borderRadius: 14,
    border: "1px dashed #BFE3FF",
    background: "rgba(234, 246, 255, 0.55)",
    color: "#64748B",
    fontWeight: 850,
  },
  msg: {
    marginTop: 12,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #FECACA",
    background: "#FFF1F2",
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: 800,
  },

  grid: { display: "grid", gridTemplateColumns: "1.45fr 0.85fr", gap: 12 },
  left: {},
  right: {},

  list: { display: "flex", flexDirection: "column", gap: 8 },
  row: {
    display: "flex",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid #DCEFFF",
    background: "#FFFFFF",
    boxShadow: "0 10px 22px rgba(15,23,42,0.04)",
    cursor: "pointer",
  },
  rowActive: { borderColor: "#7CC7FF", background: "rgba(234,246,255,0.55)" },
  checkbox: { marginTop: 2, width: 18, height: 18 },
  name: { fontSize: 15, fontWeight: 950, color: "#0B1220", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  meta: { marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap", color: "#64748B", fontSize: 12.5 },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 10px",
    borderRadius: 999,
    border: "1px solid rgba(191,227,255,1)",
    background: "rgba(234,246,255,0.65)",
    fontWeight: 900,
    color: "#0F172A",
  },
  idText: { marginTop: 4, fontSize: 11.5, color: "#94A3B8" },

  rightHead: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid #DCEFFF",
    background: "linear-gradient(180deg, #EAF6FF 0%, #F7FBFF 100%)",
    marginBottom: 8,
  },
  rightTitle: { fontSize: 13, fontWeight: 950, color: "#0B1220" },
  rightSub: { marginTop: 2, fontSize: 12, color: "#64748B" },
  chips: { display: "flex", flexWrap: "wrap", gap: 8 },
  chip: {
    border: "1px solid #BFE3FF",
    background: "rgba(234,246,255,0.65)",
    color: "#0F172A",
    padding: "8px 10px",
    borderRadius: 999,
    fontSize: 12.5,
    fontWeight: 950,
    cursor: "pointer",
  },
  chipX: { marginLeft: 6, color: "#64748B", fontWeight: 900 },

  empty: {
    padding: "14px 12px",
    borderRadius: 14,
    border: "1px dashed #BFE3FF",
    background: "rgba(234, 246, 255, 0.35)",
    color: "#64748B",
    fontWeight: 850,
  },

  footer: {
    padding: "12px 16px",
    borderTop: "1px solid #DCEFFF",
    background: "#FFFFFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
  },
  countText: { marginRight: "auto", color: "#64748B", fontWeight: 900, fontSize: 12.5 },
  cancelBtn: {
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
  primaryBtn: {
    border: "1px solid #7CC7FF",
    background: "linear-gradient(180deg, #53B9FF 0%, #2EA8FF 100%)",
    color: "#fff",
    padding: "9px 12px",
    borderRadius: 12,
    fontSize: 12.5,
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(46, 168, 255, 0.20)",
  },
  btnDisabled: { opacity: 0.7, cursor: "not-allowed" },
};
