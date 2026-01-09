/*
 * src/pages/Chat.tsx
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";

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

  if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString();
}

// あなたのBottomNavの高さに合わせて
const NAV_HEIGHT = 72;

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

  const [unreadByGroup, setUnreadByGroup] = useState<Record<string, number>>({});
  const [lastByGroup, setLastByGroup] = useState<Record<string, LastPreview>>({});

  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [showJump, setShowJump] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  // ヘッダー右のボタン押下演出用
  const [pressedKey, setPressedKey] = useState<null | "invite" | "members" | "delete">(null);

  function scrollToBottom(smooth = true) {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    });
  }

  function isNearBottom() {
    const el = scrollerRef.current;
    if (!el) return true;
    const threshold = 120;
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
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
        next[gid] = { body: m.body ?? "", image_url: m.image_url ?? null, created_at: m.created_at };
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

      if (!cancelled) {
        setMessages((data ?? []) as Message[]);
        setShowJump(false);
      }

      scrollToBottom(false);
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
              [gid]: { body: row.body ?? "", image_url: row.image_url ?? null, created_at: row.created_at },
            }));

            if (active?.id === gid) {
              const wasNear = isNearBottom();
              setMessages((prev) => [...prev, row]);

              if (wasNear) {
                scrollToBottom(true);
                setShowJump(false);
                await markRead(gid);
              } else {
                setShowJump(true);
              }
            } else {
              setUnreadByGroup((prev) => ({ ...prev, [gid]: (prev[gid] ?? 0) + 1 }));
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
    setPreviewUrl(URL.createObjectURL(file));
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
          .upload(imagePath, selectedFile, { cacheControl: "3600", upsert: false });

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

      scrollToBottom(true);
      setShowJump(false);
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

    const { error: ge } = await supabase.from("groups").insert({ id, name, type: "class", owner_id: myId });
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

    if (!confirm(`グループ「${g.name}」を削除しますか？（メッセージも削除）`)) return;

    const { error: e1 } = await supabase.from("messages").delete().eq("group_id", g.id);
    if (e1) return alert("削除失敗(messages): " + e1.message);

    const { error: e2 } = await supabase.from("group_members").delete().eq("group_id", g.id);
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

  const isActiveOwner = useMemo(() => !!(active && active.owner_id === myId), [active, myId]);

  const filteredGroups = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(t) || g.id.toLowerCase().includes(t));
  }, [q, groups]);

  // ===== 押下エフェクト付きピルボタン（インライン） =====
  const pillBase: CSSProperties = {
    border: "1px solid rgba(125, 211, 252, 0.55)",
    background: "rgba(255,255,255,0.92)",
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    color: "#0F172A",
    cursor: "pointer",
    boxShadow: "0 10px 18px rgba(15, 23, 42, 0.08)",
    transition: "transform 120ms ease, box-shadow 120ms ease, filter 120ms ease",
    userSelect: "none",
  };

  const pillPressed: CSSProperties = {
    transform: "translateY(1px) scale(0.98)",
    boxShadow: "0 6px 10px rgba(15, 23, 42, 0.10)",
    filter: "brightness(0.98)",
  };

  const pillHover: CSSProperties = {
    transform: "translateY(-1px)",
    boxShadow: "0 14px 24px rgba(15, 23, 42, 0.12)",
  };

  const pillDangerBase: CSSProperties = {
    ...pillBase,
    border: "1px solid rgba(248, 113, 113, 0.55)",
    color: "#DC2626",
    boxShadow: "0 10px 18px rgba(220, 38, 38, 0.12)",
  };

  // ===== インラインスタイル =====
  const styles = {
    page: {
      height: `calc(100vh - ${NAV_HEIGHT}px)`,
      overflow: "hidden" as const,
    },

    // 左
    asideOuter: {
      background: "linear-gradient(180deg, #EAF6FF 0%, #F7FBFF 60%, #FFFFFF 100%)",
      height: `calc(100vh - ${NAV_HEIGHT}px)`,
      padding: "12px",
      boxSizing: "border-box" as const,
      overflow: "auto" as const,
    },
    asideCard: {
      background: "#FFFFFF",
      borderRadius: 18,
      border: "1px solid #CFE8FF",
      boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
      overflow: "hidden" as const,
    },
    header: {
      padding: "14px 14px 12px 14px",
      borderBottom: "1px solid #DCEFFF",
      background: "linear-gradient(180deg, #F0FAFF 0%, #FFFFFF 100%)",
    },
    titleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
    title: { fontSize: 22, fontWeight: 800, color: "#0F172A", letterSpacing: "0.2px" },
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
    searchIcon: { fontSize: 14, color: "#64748B" },
    searchInput: { width: "100%", border: "none", outline: "none", fontSize: 14, background: "transparent" },
    listWrap: { padding: 12, display: "flex", flexDirection: "column" as const, gap: 10 },
    groupBtnBase: {
      width: "100%",
      textAlign: "left" as const,
      borderRadius: 16,
      border: "1px solid #DCEFFF",
      background: "#FFFFFF",
      padding: "12px 12px",
      cursor: "pointer",
      transition: "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease, background 120ms ease",
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
    groupRowTop: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
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
    rightCol: { display: "flex", flexDirection: "column" as const, alignItems: "flex-end" as const, gap: 8, flexShrink: 0 as const },
    time: { fontSize: 12, color: "#94A3B8" },
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
    empty: { padding: "18px 12px 26px 12px", color: "#64748B", fontSize: 14 },

    // 右
    chatOuter: {
      height: `calc(100vh - ${NAV_HEIGHT}px)`,
      overflow: "hidden" as const,
      background: "linear-gradient(180deg, #F0FAFF 0%, #FFFFFF 45%, #FFFFFF 100%)",
      borderLeft: "1px solid #DCEFFF",
      display: "flex",
      flexDirection: "column" as const,
    },

    // ★ クリックが効かない時は、まずここを最前面にする
    chatHeader: {
      position: "sticky" as const,
      top: 0,
      zIndex: 200, // ← 30から大幅アップ
      padding: "12px 14px",
      borderBottom: "1px solid rgba(125, 211, 252, 0.45)",
      background:
        "linear-gradient(180deg, rgba(240,250,255,0.98) 0%, rgba(255,255,255,0.96) 60%, rgba(255,255,255,0.92) 100%)",
      backdropFilter: "blur(10px)",
      boxShadow: "0 10px 22px rgba(15, 23, 42, 0.06)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      pointerEvents: "auto" as const, // 念のため
    },
    headerLeft: { display: "flex", alignItems: "center", gap: 12, minWidth: 0 },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 16,
      border: "1px solid #DCEFFF",
      background: "#fff",
      boxShadow: "0 8px 16px rgba(15,23,42,0.06)",
      cursor: "pointer",
      flexShrink: 0 as const,
    },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 14,
      background: "linear-gradient(180deg, #45B6FF 0%, #2EA8FF 100%)",
      boxShadow: "0 10px 18px rgba(46,168,255,0.22)",
      border: "1px solid rgba(255,255,255,0.55)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      fontWeight: 900,
      fontSize: 16,
      flexShrink: 0 as const,
    },
    titleWrap: { minWidth: 0, display: "flex", flexDirection: "column" as const, gap: 2 },
    headerTitle: {
      fontSize: 28,
      fontWeight: 900,
      lineHeight: 1.05,
      color: "#0B1220",
      letterSpacing: "0.2px",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap" as const,
    },
    headerSub: {
      fontSize: 12,
      color: "#64748B",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap" as const,
    },
    headerRight: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 as const },

    // スクロール領域
    scroller: {
      position: "relative" as const, // ← これで absolute はここ基準
      zIndex: 10,
      flex: 1,
      overflowY: "auto" as const,
      padding: "14px 14px 18px 14px",
      background:
        "radial-gradient(1200px 600px at 20% 0%, rgba(46,168,255,0.08) 0%, rgba(46,168,255,0.00) 60%)",
    },

    row: { display: "flex", marginBottom: 10 },
    rowMine: { justifyContent: "flex-end" },
    rowOther: { justifyContent: "flex-start" },

    bubbleBase: { maxWidth: "86%", borderRadius: 18, padding: "10px 12px", boxShadow: "0 8px 18px rgba(15,23,42,0.06)" },
    bubbleMine: { background: "linear-gradient(180deg, #53B9FF 0%, #2EA8FF 100%)", color: "#fff", border: "1px solid rgba(255,255,255,0.28)" },
    bubbleOther: { background: "#fff", color: "#0B1220", border: "1px solid #DCEFFF" },

    msgText: { whiteSpace: "pre-wrap" as const, margin: 0 },
    msgTime: { fontSize: 10, opacity: 0.75, marginTop: 6 },

    attachLink: { display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12, marginTop: 8, textDecoration: "underline", cursor: "pointer" },

    // 「↓ 最新へ」…ヘッダーより下に
    jumpBtn: {
      position: "sticky" as const,
      left: "calc(100% - 136px)",
      bottom: 92,
      zIndex: 20,
      borderRadius: 999,
      padding: "10px 12px",
      border: "1px solid rgba(125,211,252,0.7)",
      background: "rgba(255,255,255,0.92)",
      boxShadow: "0 14px 26px rgba(15,23,42,0.14)",
      fontWeight: 900,
      fontSize: 12,
      cursor: "pointer",
      color: "#0B1220",
      backdropFilter: "blur(10px)",
      width: "fit-content",
      marginLeft: "auto",
      marginRight: 0,
    },

    inputBar: {
      position: "sticky" as const,
      bottom: 0,
      zIndex: 150, // 入力欄もちゃんと上に
      padding: "12px 12px",
      background: "rgba(255,255,255,0.94)",
      backdropFilter: "blur(10px)",
      borderTop: "1px solid rgba(125, 211, 252, 0.45)",
      boxShadow: "0 -10px 22px rgba(15,23,42,0.06)",
      display: "flex",
      alignItems: "center",
      gap: 10,
    },
    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: 16,
      border: "1px solid #CFE8FF",
      background: "#fff",
      cursor: "pointer",
      boxShadow: "0 8px 16px rgba(15,23,42,0.06)",
    },

    previewBar: {
      padding: "10px 12px",
      borderTop: "1px solid rgba(125, 211, 252, 0.45)",
      background: "rgba(255,255,255,0.94)",
      backdropFilter: "blur(10px)",
    },
    previewChip: { display: "inline-flex", alignItems: "center", gap: 10, border: "1px solid #DCEFFF", borderRadius: 18, padding: 10, background: "#F3FAFF" },
    previewImg: { width: 64, height: 64, borderRadius: 14, objectFit: "cover" as const },
    previewDel: {
      borderRadius: 999,
      padding: "8px 10px",
      border: "1px solid rgba(248,113,113,0.55)",
      background: "rgba(255,255,255,0.9)",
      color: "#DC2626",
      fontWeight: 900,
      cursor: "pointer",
    },
  };

  return (
    <div style={styles.page}>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-0" style={{ height: "100%" }}>
        {/* 左 */}
        <aside className={`md:col-span-4 ${active ? "hidden md:block" : "block"}`}>
          <div style={styles.asideOuter}>
            <div style={styles.asideCard}>
              <div style={styles.header}>
                <div style={styles.titleRow}>
                  <div style={styles.title}>グループ</div>

                  {canManage && (
                    <button style={styles.createBtn} onClick={createGroup} aria-label="グループ作成">
                      ＋作成
                    </button>
                  )}
                </div>

                <div style={styles.searchWrap}>
                  <span style={styles.searchIcon}>🔎</span>
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="検索" style={styles.searchInput} />
                </div>
              </div>

              <div style={styles.listWrap}>
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

                {filteredGroups.length === 0 && <div style={styles.empty}>該当するグループがありません</div>}
              </div>
            </div>
          </div>
        </aside>

        {/* 右 */}
        <main className={`md:col-span-8 ${active ? "block" : "hidden md:block"}`}>
          <div style={styles.chatOuter}>
            {/* ヘッダー */}
            <div style={styles.chatHeader}>
              <div style={styles.headerLeft}>
                <button className="md:hidden" style={styles.backBtn} onClick={() => setActive(null)} aria-label="戻る">
                  ←
                </button>

                <div style={styles.avatar}>{(active?.name?.trim()?.[0] ?? "G").toUpperCase()}</div>

                <div style={styles.titleWrap}>
                  <div style={styles.headerTitle}>{active ? active.name : "グループ未選択"}</div>
                  <div style={styles.headerSub}>{active ? "グループチャット" : "左から選択してください"}</div>
                </div>
              </div>

              {canManage && isActiveOwner && active && (
                <div style={styles.headerRight}>
                  {/* 招待 */}
                  <button
                    type="button"
                    onClick={() => setShowInvite(true)}
                    style={{
                      ...pillBase,
                      ...(pressedKey === "invite" ? pillPressed : {}),
                    }}
                    onMouseEnter={(e) => Object.assign(e.currentTarget.style, pillHover)}
                    onMouseLeave={(e) => {
                      setPressedKey(null);
                      Object.assign(e.currentTarget.style, pillBase);
                    }}
                    onMouseDown={() => setPressedKey("invite")}
                    onMouseUp={() => setPressedKey(null)}
                  >
                    招待
                  </button>

                  {/* メンバー */}
                  <button
                    type="button"
                    onClick={() => setShowMembers(true)}
                    style={{
                      ...pillBase,
                      ...(pressedKey === "members" ? pillPressed : {}),
                    }}
                    onMouseEnter={(e) => Object.assign(e.currentTarget.style, pillHover)}
                    onMouseLeave={(e) => {
                      setPressedKey(null);
                      Object.assign(e.currentTarget.style, pillBase);
                    }}
                    onMouseDown={() => setPressedKey("members")}
                    onMouseUp={() => setPressedKey(null)}
                  >
                    メンバー
                  </button>

                  {/* 削除 */}
                  <button
                    type="button"
                    onClick={() => deleteGroup(active)}
                    style={{
                      ...pillDangerBase,
                      ...(pressedKey === "delete" ? pillPressed : {}),
                    }}
                    onMouseEnter={(e) => Object.assign(e.currentTarget.style, pillHover)}
                    onMouseLeave={(e) => {
                      setPressedKey(null);
                      Object.assign(e.currentTarget.style, pillDangerBase);
                    }}
                    onMouseDown={() => setPressedKey("delete")}
                    onMouseUp={() => setPressedKey(null)}
                  >
                    削除
                  </button>
                </div>
              )}
            </div>

            {/* メッセージ */}
            <div
              ref={scrollerRef}
              style={styles.scroller}
              onScroll={() => {
                if (isNearBottom()) setShowJump(false);
              }}
            >
              {active ? (
                messages.map((m) => {
                  const url = getImageUrl(m.image_url);
                  const mine = m.sender_id === myId;

                  return (
                    <div key={m.id} style={{ ...styles.row, ...(mine ? styles.rowMine : styles.rowOther) }}>
                      <div style={{ ...styles.bubbleBase, ...(mine ? styles.bubbleMine : styles.bubbleOther) }}>
                        {m.body && <p style={styles.msgText}>{m.body}</p>}

                        {url && (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ ...styles.attachLink, color: mine ? "rgba(255,255,255,0.92)" : "#0369A1" }}
                          >
                            📎 添付画像を開く
                          </a>
                        )}

                        <div style={styles.msgTime}>{new Date(m.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ color: "#64748B", fontSize: 14 }}>左からグループを選択してください</div>
              )}

              <div ref={bottomRef} />

              {showJump && (
                <button
                  type="button"
                  style={styles.jumpBtn}
                  onClick={() => {
                    scrollToBottom(true);
                    setShowJump(false);
                    if (active) markRead(active.id);
                  }}
                >
                  ↓ 最新へ
                </button>
              )}
            </div>

            {/* 画像プレビュー */}
            {previewUrl && (
              <div style={styles.previewBar}>
                <div style={styles.previewChip}>
                  <img src={previewUrl} alt="選択中の画像" style={styles.previewImg} />
                  <button type="button" onClick={clearImageSelection} style={styles.previewDel}>
                    削除
                  </button>
                </div>
              </div>
            )}

            {/* 入力欄 */}
            <div style={styles.inputBar}>
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={styles.iconBtn}
                disabled={uploading || loading}
                aria-label="画像を選ぶ"
                title="画像"
              >
                📷
              </button>

              <Input
                className="flex-1"
                placeholder={active ? "メッセージを入力..." : "グループを選択してください"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey ? (e.preventDefault(), send()) : null
                }
                disabled={!active || loading}
              />

              <Button onClick={send} disabled={!active || loading || uploading}>
                送信
              </Button>
            </div>
          </div>
        </main>
      </div>

      {/* ===== Dialogs: 画面最上位に固定表示（overflow/z-indexの影響を受けない） ===== */}
      {showInvite && active && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            pointerEvents: "auto",
          }}
        >
          <InviteMemberDialog
            groupId={active.id}
            onClose={() => setShowInvite(false)}
            onInvited={() => setShowInvite(false)}
          />
        </div>
      )}

      {showMembers && active && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            pointerEvents: "auto",
          }}
        >
          <GroupMembersDialog
            groupId={active.id}
            isOwner={isActiveOwner}
            ownerId={active.owner_id ?? null}
            onClose={() => setShowMembers(false)}
          />
        </div>
      )}
    </div>
  );
}
