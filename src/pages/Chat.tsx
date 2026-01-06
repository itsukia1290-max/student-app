/*
 * src/pages/Chat.tsx
 * Responsibility: グループチャット画面のページコンポーネント
 * - 左: グループ一覧（検索 / 未読 / 最新メッセージプレビュー）
 * - 右: メッセージ一覧 / 送信フォーム（画像アップロード対応）
 * - Realtime で新着メッセージを購読し、未読数と最新プレビューを更新する
 *
 * UI:
 * - モバイル: 一覧 → チャット (戻る)
 * - PC(md+): 左に一覧、右にチャットの2カラム
 *
 * IMPORTANT:
 * - 「2か所スクロール」問題の解消:
 *   1) Chatページ全体を viewport 高さに固定（BottomNav分を引く）
 *   2) body(ページ全体)はスクロールさせない（overflow hidden）
 *   3) スクロールはメッセージ領域のみ（msgArea: overflowY auto, minHeight 0）
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";

import { supabase } from "../lib/supabase";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { useAuth } from "../contexts/AuthContext";
import { useIsStaff } from "../hooks/useIsStaff";
import InviteMemberDialog from "../components/InviteMemberDialog";
import GroupMembersDialog from "../components/GroupMembersDialog";

type Group = {
  id: string;
  name: string;
  type: "class" | "dm";
  owner_id: string | null;
};

type Message = {
  id: number;
  group_id: string;
  sender_id: string;
  body: string;
  image_url: string | null;
  created_at: string;
};

type LastReadRow = { group_id: string; last_read_at: string };

type LastPreview = {
  body: string;
  image_url: string | null;
  created_at: string;
};

function getImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const { data } = supabase.storage.from("chat-media").getPublicUrl(path);
  return data.publicUrl ?? null;
}

function previewText(p?: LastPreview | null) {
  if (!p) return "（まだメッセージがありません）";
  const text = (p.body ?? "").trim();
  if (text) return text.length > 60 ? text.slice(0, 60) + "…" : text;
  if (p.image_url) return "📷 画像を送信しました";
  return "（メッセージ）";
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString();
}

export default function Chat() {
  const { user } = useAuth();
  const { isStaff } = useIsStaff();

  const myId = user?.id ?? "";
  const canManage = isStaff;

  const [groups, setGroups] = useState<Group[]>([]);
  const [active, setActive] = useState<Group | null>(null);
  const activeId = active?.id ?? null;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [showInvite, setShowInvite] = useState(false);
  const [showMembers, setShowMembers] = useState(false);

  const [q, setQ] = useState("");

  const [unreadByGroup, setUnreadByGroup] = useState<Record<string, number>>(
    {}
  );
  const [lastByGroup, setLastByGroup] = useState<Record<string, LastPreview>>(
    {}
  );

  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() =>
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    );
  }

  const markRead = useCallback(
    async (groupId: string) => {
      if (!myId) return;

      const { error } = await supabase
        .from("group_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("group_id", groupId)
        .eq("user_id", myId);

      if (error) {
        console.warn("⚠️ markRead failed:", error.message);
        return;
      }

      setUnreadByGroup((prev) => ({ ...prev, [groupId]: 0 }));
    },
    [myId]
  );

  const fetchUnreadCounts = useCallback(
    async (groupIds: string[]) => {
      if (!myId || groupIds.length === 0) {
        setUnreadByGroup({});
        return;
      }

      const { data: myGm, error: e1 } = await supabase
        .from("group_members")
        .select("group_id,last_read_at")
        .eq("user_id", myId)
        .in("group_id", groupIds);

      if (e1) {
        console.error("❌ load last_read_at:", e1.message);
        return;
      }

      const lastReadMap: Record<string, string> = {};
      (myGm as LastReadRow[] | null)?.forEach((r) => {
        lastReadMap[r.group_id] = r.last_read_at;
      });

      const next: Record<string, number> = {};
      for (const gid of groupIds) {
        const since = lastReadMap[gid] ?? "1970-01-01T00:00:00Z";

        const { count, error: e2 } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("group_id", gid)
          .gt("created_at", since);

        if (e2) {
          console.warn("⚠️ count unread failed:", e2.message);
          continue;
        }
        next[gid] = count ?? 0;
      }

      setUnreadByGroup(next);
    },
    [myId]
  );

  const fetchLastPreviews = useCallback(async (groupIds: string[]) => {
    if (groupIds.length === 0) {
      setLastByGroup({});
      return;
    }

    const next: Record<string, LastPreview> = {};
    for (const gid of groupIds) {
      const { data, error } = await supabase
        .from("messages")
        .select("body,image_url,created_at")
        .eq("group_id", gid)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        console.warn("⚠️ load last message failed:", gid, error.message);
        continue;
      }

      const m = (data?.[0] ?? null) as
        | { body: string; image_url: string | null; created_at: string }
        | null;

      if (m) {
        next[gid] = {
          body: m.body ?? "",
          image_url: m.image_url ?? null,
          created_at: m.created_at,
        };
      }
    }

    setLastByGroup(next);
  }, []);

  useEffect(() => {
    if (!myId) return;

    (async () => {
      const { data: gm, error: e1 } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", myId);

      if (e1) {
        console.error("❌ group_members load:", e1.message);
        return;
      }

      const ids = (gm ?? []).map((r) => r.group_id as string);
      if (ids.length === 0) {
        setGroups([]);
        setActive(null);
        setUnreadByGroup({});
        setLastByGroup({});
        return;
      }

      const { data: gs, error: e2 } = await supabase
        .from("groups")
        .select("id, name, type, owner_id")
        .in("id", ids)
        .eq("type", "class")
        .order("name", { ascending: true });

      if (e2) {
        console.error("❌ groups load:", e2.message);
        return;
      }

      const list: Group[] = (gs ?? []).map((g) => ({
        id: g.id as string,
        name: g.name as string,
        type: "class",
        owner_id: (g.owner_id as string) ?? null,
      }));

      setGroups(list);

      setActive((cur) => {
        if (!cur && list.length > 0) return list[0];
        if (cur && !list.find((x) => x.id === cur.id)) return list[0] ?? null;
        return cur;
      });

      const groupIds = list.map((g) => g.id);
      await fetchUnreadCounts(groupIds);
      await fetchLastPreviews(groupIds);
    })();
  }, [myId, fetchUnreadCounts, fetchLastPreviews]);

  useEffect(() => {
    if (!activeId) return;

    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id,group_id,sender_id,body,image_url,created_at")
        .eq("group_id", activeId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("❌ messages load:", error.message);
        return;
      }

      if (!cancelled) setMessages((data ?? []) as Message[]);

      scrollToBottom();
      await markRead(activeId);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeId, markRead]);

  useEffect(() => {
    const ids = groups.map((g) => g.id);
    if (ids.length === 0) return;

    const channels = ids.map((gid) =>
      supabase
        .channel(`grp:${gid}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `group_id=eq.${gid}`,
          },
          async (payload) => {
            const row = payload.new as Message;

            setLastByGroup((prev) => ({
              ...prev,
              [gid]: {
                body: row.body ?? "",
                image_url: row.image_url ?? null,
                created_at: row.created_at,
              },
            }));

            if (active?.id === gid) {
              setMessages((prev) => [...prev, row]);
              scrollToBottom();
              await markRead(gid);
            } else {
              setUnreadByGroup((prev) => ({
                ...prev,
                [gid]: (prev[gid] ?? 0) + 1,
              }));
            }
          }
        )
        .subscribe()
    );

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [groups, active?.id, markRead]);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  }

  function clearImageSelection() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function send() {
    if (!active || !myId) return;

    const text = input.trim();
    if (!text && !selectedFile) return;

    setLoading(true);
    setUploading(true);

    let imagePath: string | null = null;

    try {
      if (selectedFile) {
        const ext = selectedFile.name.split(".").pop() || "jpg";
        imagePath = `groups/${active.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from("chat-media")
          .upload(imagePath, selectedFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (upErr) throw upErr;
      }

      const { error: msgErr } = await supabase.from("messages").insert({
        group_id: active.id,
        sender_id: myId,
        body: text || "",
        image_url: imagePath,
      });

      if (msgErr) throw msgErr;

      setInput("");
      clearImageSelection();
      await markRead(active.id);
    } catch (e) {
      console.error("❌ send failed:", e);
      alert("送信に失敗しました。: " + (e as Error).message);
    } finally {
      setLoading(false);
      setUploading(false);
    }
  }

  async function createGroup() {
    if (!canManage) return;

    const name = prompt("グループ名？（例：2年A組）");
    if (!name || !myId) return;

    const id = crypto.randomUUID();

    const { error: ge } = await supabase
      .from("groups")
      .insert({ id, name, type: "class", owner_id: myId });

    if (ge) return alert("グループ作成失敗: " + ge.message);

    const { error: me } = await supabase.from("group_members").insert({
      group_id: id,
      user_id: myId,
      last_read_at: new Date().toISOString(),
    });

    if (me) return alert("メンバー追加失敗: " + me.message);

    const newGroup: Group = { id, name, type: "class", owner_id: myId };
    setGroups((prev) => [...prev, newGroup]);
    setUnreadByGroup((prev) => ({ ...prev, [id]: 0 }));
    setActive(newGroup);
  }

  async function deleteGroup(g: Group) {
    if (!g || g.type !== "class") return;

    if (!confirm(`グループ「${g.name}」を削除しますか？（メッセージも削除）`))
      return;

    const { error: e1 } = await supabase
      .from("messages")
      .delete()
      .eq("group_id", g.id);
    if (e1) return alert("削除失敗(messages): " + e1.message);

    const { error: e2 } = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", g.id);
    if (e2) return alert("削除失敗(group_members): " + e2.message);

    const { error: e3 } = await supabase.from("groups").delete().eq("id", g.id);
    if (e3) return alert("削除失敗(groups): " + e3.message);

    setGroups((prev) => prev.filter((x) => x.id !== g.id));
    setUnreadByGroup((prev) => {
      const rest = { ...prev };
      delete rest[g.id];
      return rest;
    });
    setLastByGroup((prev) => {
      const rest = { ...prev };
      delete rest[g.id];
      return rest;
    });
    setActive((cur) => (cur?.id === g.id ? null : cur));
  }

  const isActiveOwner = useMemo(
    () => !!(active && active.owner_id === myId),
    [active, myId]
  );

  const filteredGroups = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return groups;
    return groups.filter(
      (g) => g.name.toLowerCase().includes(t) || g.id.toLowerCase().includes(t)
    );
  }, [q, groups]);

  // ===== BottomNav の高さ（ここをあなたの実値に合わせる）=====
  // BottomNavが fixed で画面下に居座るなら、その高さ分だけ Chat の高さを引く必要あり
  const NAV_H = 72;

  // ===== インラインで確実に見た目を作るためのスタイル =====
  const OUTER_PAD = 12;

  const styles = {
    // Chatページ全体：BottomNav分を引いた viewport 高に固定（←ここが「二重スクロール」回避の核）
    page: {
      height: `calc(100dvh - ${NAV_H}px)`,
      overflow: "hidden" as const,
    },

    // 左
    asideOuter: {
      background:
        "linear-gradient(180deg, #EAF6FF 0%, #F7FBFF 60%, #FFFFFF 100%)",
      height: "100%",
      padding: OUTER_PAD,
      boxSizing: "border-box" as const,
      overflow: "hidden" as const,
    },
    asideCard: {
      height: "100%",
      background: "#FFFFFF",
      borderRadius: 18,
      border: "1px solid #CFE8FF",
      boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
      overflow: "hidden" as const,
      display: "flex",
      flexDirection: "column" as const,
    },
    header: {
      padding: "14px 14px 12px 14px",
      borderBottom: "1px solid #DCEFFF",
      background: "linear-gradient(180deg, #F0FAFF 0%, #FFFFFF 100%)",
    },
    titleRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    title: {
      fontSize: 22,
      fontWeight: 800,
      color: "#0F172A",
      letterSpacing: "0.2px",
    },
    createBtn: {
      border: "1px solid #7CC7FF",
      background: "linear-gradient(180deg, #53B9FF 0%, #2EA8FF 100%)",
      color: "#fff",
      padding: "8px 12px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700,
      cursor: "pointer",
      boxShadow: "0 6px 14px rgba(46, 168, 255, 0.25)",
    },
    searchWrap: {
      marginTop: 10,
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "10px 12px",
      borderRadius: 999,
      border: "1px solid #CFE8FF",
      background: "#FFFFFF",
      boxShadow: "0 2px 10px rgba(15, 23, 42, 0.04)",
    },
    searchIcon: {
      fontSize: 14,
      color: "#64748B",
    },
    searchInput: {
      width: "100%",
      border: "none",
      outline: "none",
      fontSize: 14,
      background: "transparent",
    },
    listScroll: {
      flex: 1,
      minHeight: 0, // ←スクロール領域のため必須
      overflowY: "auto" as const,
      padding: 12,
      display: "flex",
      flexDirection: "column" as const,
      gap: 10,
    },
    groupBtnBase: {
      width: "100%",
      textAlign: "left" as const,
      borderRadius: 16,
      border: "1px solid #DCEFFF",
      background: "#FFFFFF",
      padding: "12px 12px",
      cursor: "pointer",
      transition:
        "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease, background 120ms ease",
    },
    groupBtnHover: {
      background: "#F3FAFF",
      borderColor: "#BFE3FF",
      boxShadow: "0 10px 20px rgba(15, 23, 42, 0.06)",
      transform: "translateY(-1px)",
    },
    groupBtnActive: {
      background: "#EAF6FF",
      borderColor: "#55B9FF",
      boxShadow: "0 10px 22px rgba(46, 168, 255, 0.18)",
    },
    groupRowTop: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 10,
    },
    groupName: {
      fontSize: 24,
      fontWeight: 900,
      color: "#0B1220",
      lineHeight: 1.15,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap" as const,
    },
    preview: {
      marginTop: 6,
      fontSize: 13,
      color: "#64748B",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap" as const,
    },
    rightCol: {
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "flex-end" as const,
      gap: 8,
      flexShrink: 0 as const,
    },
    time: {
      fontSize: 12,
      color: "#94A3B8",
    },
    badge: {
      minWidth: 28,
      height: 28,
      borderRadius: 999,
      background: "#2EA8FF",
      color: "#fff",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 12,
      fontWeight: 800,
      padding: "0 10px",
      boxShadow: "0 6px 14px rgba(46, 168, 255, 0.25)",
    },
    empty: {
      padding: "18px 12px 26px 12px",
      color: "#64748B",
      fontSize: 14,
    },

    // 右（チャット）
    mainOuter: {
      height: "100%",
      padding: OUTER_PAD,
      boxSizing: "border-box" as const,
      overflow: "hidden" as const,
      background:
        "linear-gradient(180deg, #EAF6FF 0%, #F7FBFF 60%, #FFFFFF 100%)",
    },
    mainCard: {
      height: "100%",
      background: "#FFFFFF",
      borderRadius: 18,
      border: "1px solid #CFE8FF",
      boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
      overflow: "hidden" as const,
      display: "flex",
      flexDirection: "column" as const,
    },
    chatHeader: {
      padding: "12px 14px",
      borderBottom: "1px solid #DCEFFF",
      background: "linear-gradient(180deg, #F0FAFF 0%, #FFFFFF 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    chatHeaderLeft: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      minWidth: 0,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 999,
      border: "1px solid #DCEFFF",
      background: "#fff",
      cursor: "pointer",
    },
    chatTitle: {
      fontSize: 16,
      fontWeight: 800,
      color: "#0F172A",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap" as const,
    },
    chatSub: {
      fontSize: 12,
      color: "#64748B",
      marginTop: 2,
    },
    chatActions: {
      display: "flex",
      gap: 8,
      flexShrink: 0,
    },
    actionBtn: {
      border: "1px solid #CFE8FF",
      background: "#FFFFFF",
      borderRadius: 999,
      padding: "8px 10px",
      fontSize: 12,
      fontWeight: 700,
      cursor: "pointer",
    },
    actionBtnDanger: {
      border: "1px solid #FFD2D2",
      color: "#DC2626",
      background: "#FFF",
      borderRadius: 999,
      padding: "8px 10px",
      fontSize: 12,
      fontWeight: 800,
      cursor: "pointer",
    },
    msgArea: {
      flex: 1,
      minHeight: 0, // ←必須（ここだけスクロールにする）
      overflowY: "auto" as const,
      padding: "14px 14px",
      background:
        "linear-gradient(180deg, rgba(234,246,255,0.55) 0%, rgba(247,251,255,0.35) 55%, rgba(255,255,255,0.75) 100%)",
    },
    bubbleRow: {
      display: "flex",
      marginBottom: 8,
    },
    bubbleMine: {
      justifyContent: "flex-end",
    },
    bubbleOther: {
      justifyContent: "flex-start",
    },
    bubble: {
      maxWidth: "86%",
      borderRadius: 16,
      padding: "10px 12px",
      border: "1px solid #DCEFFF",
      background: "#FFFFFF",
      color: "#0F172A",
      boxShadow: "0 6px 14px rgba(15, 23, 42, 0.05)",
      wordBreak: "break-word" as const,
    },
    bubbleMineBox: {
      border: "1px solid #2EA8FF",
      background: "linear-gradient(180deg, #53B9FF 0%, #2EA8FF 100%)",
      color: "#FFFFFF",
      boxShadow: "0 10px 22px rgba(46, 168, 255, 0.18)",
    },
    attachLink: {
      display: "inline-flex",
      gap: 6,
      alignItems: "center",
      marginTop: 8,
      fontSize: 12,
      textDecoration: "underline",
      color: "#0B5ED7",
    },
    attachLinkMine: {
      color: "rgba(255,255,255,0.92)",
    },
    ts: {
      fontSize: 10,
      marginTop: 6,
      opacity: 0.7,
    },
    previewBar: {
      padding: "10px 14px",
      borderTop: "1px solid #DCEFFF",
      background: "#FFFFFF",
    },
    previewInner: {
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      borderRadius: 16,
      border: "1px solid #DCEFFF",
      background: "#F3FAFF",
      padding: 10,
    },
    inputBar: {
      padding: "12px 14px",
      borderTop: "1px solid #DCEFFF",
      background: "#FFFFFF",
      display: "flex",
      alignItems: "center",
      gap: 10,
    },
    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: 16,
      border: "1px solid #CFE8FF",
      background: "#FFFFFF",
      cursor: "pointer",
    },
  } as const;

  return (
    <div style={styles.page}>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-0" style={{ height: "100%" }}>
        {/* ===== 左：グループ一覧 ===== */}
        <aside
          className={`md:col-span-4 ${active ? "hidden md:block" : "block"}`}
          style={{ height: "100%" }}
        >
          <div style={styles.asideOuter}>
            <div style={styles.asideCard}>
              <div style={styles.header}>
                <div style={styles.titleRow}>
                  <div style={styles.title}>グループ</div>

                  {canManage && (
                    <button
                      style={styles.createBtn}
                      onClick={createGroup}
                      aria-label="グループ作成"
                    >
                      ＋作成
                    </button>
                  )}
                </div>

                <div style={styles.searchWrap}>
                  <span style={styles.searchIcon}>🔎</span>
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="検索"
                    style={styles.searchInput}
                  />
                </div>
              </div>

              <div style={styles.listScroll}>
                {filteredGroups.map((g) => {
                  const unread = unreadByGroup[g.id] ?? 0;
                  const isActiveRow = active?.id === g.id;

                  const last = lastByGroup[g.id];
                  const lastText = previewText(last);
                  const lastTime = last?.created_at ? formatTime(last.created_at) : "";

                  return (
                    <button
                      key={g.id}
                      onClick={() => setActive(g)}
                      style={{
                        ...styles.groupBtnBase,
                        ...(isActiveRow ? styles.groupBtnActive : {}),
                      }}
                      onMouseEnter={(e) => {
                        if (isActiveRow) return;
                        Object.assign(e.currentTarget.style, styles.groupBtnHover);
                      }}
                      onMouseLeave={(e) => {
                        if (isActiveRow) {
                          Object.assign(e.currentTarget.style, styles.groupBtnActive);
                          return;
                        }
                        Object.assign(e.currentTarget.style, styles.groupBtnBase);
                      }}
                    >
                      <div style={styles.groupRowTop}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={styles.groupName}>{g.name}</div>
                          <div style={styles.preview}>{lastText}</div>
                        </div>

                        <div style={styles.rightCol}>
                          <div style={styles.time}>{lastTime}</div>
                          {unread > 0 && <span style={styles.badge}>{unread}</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}

                {filteredGroups.length === 0 && (
                  <div style={styles.empty}>該当するグループがありません</div>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* ===== 右：チャット ===== */}
        <main
          className={`md:col-span-8 ${active ? "block" : "hidden md:block"}`}
          style={{ height: "100%" }}
        >
          <div style={styles.mainOuter}>
            <div style={styles.mainCard}>
              {/* ヘッダー */}
              <div style={styles.chatHeader}>
                <div style={styles.chatHeaderLeft}>
                  <button
                    className="md:hidden"
                    style={styles.backBtn}
                    onClick={() => setActive(null)}
                    aria-label="戻る"
                  >
                    ←
                  </button>

                  <div style={{ minWidth: 0 }}>
                    <div style={styles.chatTitle}>
                      {active ? active.name : "グループ未選択"}
                    </div>
                    <div style={styles.chatSub}>
                      {active ? "グループチャット" : "左から選択してください"}
                    </div>
                  </div>
                </div>

                {canManage && isActiveOwner && active && (
                  <div style={styles.chatActions}>
                    <button
                      onClick={() => setShowInvite(true)}
                      style={styles.actionBtn}
                    >
                      招待
                    </button>
                    <button
                      onClick={() => setShowMembers(true)}
                      style={styles.actionBtn}
                    >
                      メンバー
                    </button>
                    <button
                      onClick={() => deleteGroup(active)}
                      style={styles.actionBtnDanger}
                    >
                      削除
                    </button>
                  </div>
                )}
              </div>

              {/* メッセージ（ここだけスクロール） */}
              <div style={styles.msgArea}>
                {active ? (
                  messages.map((m) => {
                    const url = getImageUrl(m.image_url);
                    const mine = m.sender_id === myId;

                    return (
                      <div
                        key={m.id}
                        style={{
                          ...styles.bubbleRow,
                          ...(mine ? styles.bubbleMine : styles.bubbleOther),
                        }}
                      >
                        <div
                          style={{
                            ...styles.bubble,
                            ...(mine ? styles.bubbleMineBox : {}),
                          }}
                        >
                          {m.body && (
                            <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                              {m.body}
                            </p>
                          )}

                          {url && (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                ...styles.attachLink,
                                ...(mine ? styles.attachLinkMine : {}),
                              }}
                            >
                              📎 添付画像を開く
                            </a>
                          )}

                          <div style={styles.ts}>
                            {new Date(m.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ color: "#64748B", fontSize: 14 }}>
                    左からグループを選択してください
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* 画像プレビュー */}
              {previewUrl && (
                <div style={styles.previewBar}>
                  <div style={styles.previewInner}>
                    <img
                      src={previewUrl}
                      alt="選択中の画像"
                      style={{
                        height: 64,
                        width: 64,
                        borderRadius: 14,
                        objectFit: "cover",
                      }}
                    />
                    <button
                      type="button"
                      onClick={clearImageSelection}
                      style={{
                        border: "1px solid #FFD2D2",
                        color: "#DC2626",
                        background: "#fff",
                        borderRadius: 999,
                        padding: "8px 12px",
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      削除
                    </button>
                  </div>
                </div>
              )}

              {/* 入力欄（mainCardの最下部固定：ページスクロールしないので常に見える） */}
              <div style={styles.inputBar}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={styles.iconBtn}
                  disabled={uploading || loading}
                  aria-label="画像を選ぶ"
                >
                  📷
                </button>

                <Input
                  className="flex-1"
                  placeholder={active ? "メッセージを入力..." : "グループを選択してください"}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && !e.shiftKey
                      ? (e.preventDefault(), send())
                      : null
                  }
                  disabled={!active || loading}
                />

                <Button onClick={send} disabled={!active || loading || uploading}>
                  送信
                </Button>
              </div>
            </div>
          </div>

          {showInvite && active && (
            <InviteMemberDialog
              groupId={active.id}
              onClose={() => setShowInvite(false)}
              onInvited={() => setShowInvite(false)}
            />
          )}
          {showMembers && active && (
            <GroupMembersDialog
              groupId={active.id}
              isOwner={isActiveOwner}
              ownerId={active.owner_id ?? null}
              onClose={() => setShowMembers(false)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
