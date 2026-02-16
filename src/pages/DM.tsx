/*
 * src/pages/DM.tsx
 * Responsibility: 1対1 のダイレクトメッセージ（DM）画面
 * - 左カラム: DM 一覧（相手の名前ラベル・未読・最新プレビュー）
 * - 右カラム: アクティブ DM のメッセージ表示と送信（画像対応）
 * UI:
 * - モバイル: 一覧 → DM（戻る）
 * - PC(md+): 左に一覧、右にDM
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";

import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import SelectUserDialog from "../components/SelectUserDialog";
import ProfileViewDialog from "../components/ProfileViewDialog";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";

type Group = {
  id: string;
  name: string;
  type: "dm";
  owner_id: string | null;
};

type Message = {
  id: number;
  group_id: string;
  sender_id: string;
  body: string;
  image_url: string | null; // Storage パス or 既存フルURL
  created_at: string;
};

type LastReadRow = { group_id: string; last_read_at: string };
type PartnerRow = { group_id: string; user_id: string };
type ProfileMini = { id: string; name: string | null };

type LastPreview = {
  body: string;
  image_url: string | null;
  created_at: string;
};

// Storage のパスからブラウザで表示できる URL を作る（リンク用）
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

export default function DM() {
  const { user } = useAuth();
  const myId = user?.id ?? "";

  const [groups, setGroups] = useState<Group[]>([]);
  const [labelByGroup, setLabelByGroup] = useState<
    Record<string, { partnerId: string; partnerName: string | null }>
  >({});
  const [unreadByGroup, setUnreadByGroup] = useState<Record<string, number>>({});
  const [lastByGroup, setLastByGroup] = useState<Record<string, LastPreview>>({});

  const [active, setActive] = useState<Group | null>(null);
  const activeId = active?.id ?? null;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [showNewDm, setShowNewDm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // 左の検索
  const [q, setQ] = useState("");

  // 画像用
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // スクロール系
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [showJump, setShowJump] = useState(false);

  function scrollToBottom(smooth = true) {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    });
  }

  /** 既読更新（自分の group_members.last_read_at を now に） */
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

  /** DM一覧の未読数カウントをまとめて計算 */
  const fetchUnreadCounts = useCallback(
    async (dmIds: string[]) => {
      if (!myId || dmIds.length === 0) {
        setUnreadByGroup({});
        return;
      }

      const { data: myGm, error: e1 } = await supabase
        .from("group_members")
        .select("group_id,last_read_at")
        .eq("user_id", myId)
        .in("group_id", dmIds);

      if (e1) {
        console.error("❌ load last_read_at:", e1.message);
        return;
      }

      const lastReadMap: Record<string, string> = {};
      (myGm as LastReadRow[] | null)?.forEach((r) => {
        lastReadMap[r.group_id] = r.last_read_at;
      });

      const next: Record<string, number> = {};
      for (const gid of dmIds) {
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

  /** DM一覧の最新プレビューをまとめてロード */
  const fetchLastPreviews = useCallback(async (dmIds: string[]) => {
    if (dmIds.length === 0) {
      setLastByGroup({});
      return;
    }

    const next: Record<string, LastPreview> = {};
    for (const gid of dmIds) {
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

  // ---- 自分が所属するDM一覧をロード（相手名ラベルも計算） ----
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

      const allIds = (gm ?? []).map((r) => r.group_id as string);
      if (allIds.length === 0) {
        setGroups([]);
        setActive(null);
        setLabelByGroup({});
        setUnreadByGroup({});
        setLastByGroup({});
        return;
      }

      const { data: gs, error: e2 } = await supabase
        .from("groups")
        .select("id,name,type,owner_id")
        .in("id", allIds)
        .eq("type", "dm")
        .order("name", { ascending: true });

      if (e2) {
        console.error("❌ groups load:", e2.message);
        return;
      }

      const list: Group[] =
        (gs ?? []).map((g) => ({
          id: g.id as string,
          name: "DM",
          type: "dm",
          owner_id: (g.owner_id as string) ?? null,
        })) ?? [];

      setGroups(list);

      // activeの整合
      setActive((cur) => {
        if (!cur && list.length > 0) return list[0];
        if (cur && !list.find((x) => x.id === cur.id)) return list[0] ?? null;
        return cur;
      });

      if (list.length === 0) {
        setLabelByGroup({});
        setUnreadByGroup({});
        setLastByGroup({});
        return;
      }

      const ids = list.map((g) => g.id);

      // 相手ID抽出
      const { data: others, error: e3 } = await supabase
        .from("group_members")
        .select("group_id,user_id")
        .in("group_id", ids)
        .neq("user_id", myId);

      if (e3) {
        console.error("❌ group_members(others) load:", e3.message);
        return;
      }

      const partnerIds = Array.from(
        new Set(((others ?? []) as PartnerRow[]).map((o) => o.user_id))
      );

      let names: Record<string, string | null> = {};
      if (partnerIds.length > 0) {
        const { data: profs, error: e4 } = await supabase
          .from("profiles")
          .select("id,name")
          .in("id", partnerIds);

        if (e4) {
          console.error("❌ profiles load:", e4.message);
        } else if (profs) {
          const profArr = profs as ProfileMini[];
          names = Object.fromEntries(profArr.map((p) => [p.id, p.name]));
        }
      }

      const labelMap: Record<string, { partnerId: string; partnerName: string | null }> =
        {};
      ((others ?? []) as PartnerRow[]).forEach((o) => {
        const gid = o.group_id;
        const pid = o.user_id;
        if (!labelMap[gid]) {
          labelMap[gid] = { partnerId: pid, partnerName: names[pid] ?? null };
        }
      });
      setLabelByGroup(labelMap);

      await fetchUnreadCounts(ids);
      await fetchLastPreviews(ids);
    })();
  }, [myId, fetchUnreadCounts, fetchLastPreviews]);

  // ---- メッセージ読み込み（アクティブDM） ----
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
      scrollToBottom(false);
      await markRead(activeId);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeId, markRead]);

  // ---- Scroll監視：一番下から離れたら「↓ 最新へ」表示 ----
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      const threshold = 120; // これより上なら「最新へ」
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
      setShowJump(!atBottom);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [activeId]);

  // ---- labelByGroupが無いactiveIdは個別に相手名を補完（保険） ----
  useEffect(() => {
    if (!myId || !activeId) return;
    if (labelByGroup[activeId]?.partnerId) return;

    let alive = true;

    (async () => {
      const { data: gm, error } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", activeId)
        .neq("user_id", myId)
        .limit(1);

      if (!alive) return;
      if (error || !gm?.[0]) return;

      const partnerId = gm[0].user_id as string;

      const { data: prof } = await supabase
        .from("profiles")
        .select("id,name")
        .eq("id", partnerId)
        .maybeSingle();

      if (!alive) return;

      setLabelByGroup((prev) => ({
        ...prev,
        [activeId]: { partnerId, partnerName: prof?.name ?? null },
      }));
    })();

    return () => {
      alive = false;
    };
  }, [myId, activeId, labelByGroup]);

  // ---- Realtime（アクティブDMのみ購読） ----
  useEffect(() => {
    if (!activeId) return;

    const channel = supabase
      .channel(`dm:${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `group_id=eq.${activeId}`,
        },
        async (payload) => {
          const row = payload.new as Message;

          // 一覧プレビュー更新
          setLastByGroup((prev) => ({
            ...prev,
            [activeId]: {
              body: row.body ?? "",
              image_url: row.image_url ?? null,
              created_at: row.created_at,
            },
          }));

          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));

          // 下にいる時だけ自動スクロール
          const el = scrollRef.current;
          const threshold = 120;
          const atBottom = el
            ? el.scrollHeight - el.scrollTop - el.clientHeight < threshold
            : true;

          if (atBottom) scrollToBottom(true);
          await markRead(activeId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeId, markRead]);

  // ---- 画像選択 ----
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

  // ---- 送信（画像だけでもOK） ----
  async function send() {
    if (!activeId || !myId) return;

    const text = input.trim();
    if (!text && !selectedFile) return;

    setLoading(true);
    setUploading(true);

    let imagePath: string | null = null;

    try {
      if (selectedFile) {
        const ext = selectedFile.name.split(".").pop() || "jpg";
        imagePath = `dms/${activeId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from("chat-media")
          .upload(imagePath, selectedFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (upErr) throw upErr;
      }

      const { data: saved, error: msgErr } = await supabase
        .from("messages")
        .insert({
          group_id: activeId,
          sender_id: myId,
          body: text || "",
          image_url: imagePath,
        })
        .select("id,group_id,sender_id,body,image_url,created_at")
        .single();

      if (msgErr) throw msgErr;

      // 即時反映
      setMessages((prev) => [...prev, saved as Message]);
      setLastByGroup((prev) => ({
        ...prev,
        [activeId]: {
          body: saved.body ?? "",
          image_url: saved.image_url ?? null,
          created_at: saved.created_at,
        },
      }));

      setInput("");
      clearImageSelection();
      await markRead(activeId);
      scrollToBottom(true);
    } catch (e) {
      console.error("❌ send failed:", e);
      alert("送信に失敗しました: " + (e as Error).message);
    } finally {
      setLoading(false);
      setUploading(false);
    }
  }

  // ---- 新規DM作成 ----
  async function createDm(partnerId: string, partnerName: string | null) {
    if (!myId) return;

    const { data, error } = await supabase.rpc("create_or_get_dm", {
      partner_id: partnerId,
    });

    if (error) return alert("DM作成失敗: " + error.message);

    const row = Array.isArray(data) ? data[0] : data;
    const gid = row.group_id as string;

    const newGroup: Group = { id: gid, name: "DM", type: "dm", owner_id: null };

    setGroups((prev) => (prev.some((g) => g.id === gid) ? prev : [...prev, newGroup]));
    setLabelByGroup((prev) => ({ ...prev, [gid]: { partnerId, partnerName } }));
    setUnreadByGroup((prev) => ({ ...prev, [gid]: 0 }));
    setLastByGroup((prev) => ({ ...prev, [gid]: prev[gid] ?? { body: "", image_url: null, created_at: new Date().toISOString() } }));
    setActive(newGroup);
    setShowNewDm(false);
  }

  const activePartner = activeId ? labelByGroup[activeId] : undefined;

  const filteredGroups = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return groups;
    return groups.filter((g) => {
      const label = (labelByGroup[g.id]?.partnerName ?? "（相手）") || "";
      return label.toLowerCase().includes(t) || g.id.toLowerCase().includes(t);
    });
  }, [q, groups, labelByGroup]);

  // ===== インラインで“確実に”作る（グループと同じ方針） =====
  const styles = {
    page: {
      minHeight: "70vh",
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: 0,
    } as React.CSSProperties,

    asideOuter: {
      background:
        "linear-gradient(180deg, #EAF6FF 0%, #F7FBFF 60%, #FFFFFF 100%)",
      minHeight: "70vh",
      padding: 12,
      boxSizing: "border-box" as const,
    },
    asideCard: {
      background: "#FFFFFF",
      borderRadius: 18,
      border: "1px solid #CFE8FF",
      boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
      overflow: "hidden" as const,
    },
    asideHeader: {
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
      fontWeight: 900,
      color: "#0F172A",
      letterSpacing: "0.2px",
    },
    newBtn: {
      border: "1px solid #7CC7FF",
      background: "linear-gradient(180deg, #53B9FF 0%, #2EA8FF 100%)",
      color: "#fff",
      padding: "8px 12px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 900,
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
    searchInput: {
      width: "100%",
      border: "none",
      outline: "none",
      fontSize: 14,
      background: "transparent",
    },
    listWrap: {
      padding: 12,
      display: "flex",
      flexDirection: "column" as const,
      gap: 10,
    },
    dmBtnBase: {
      width: "100%",
      textAlign: "left" as const,
      borderRadius: 16,

      borderWidth: 1,
      borderStyle: "solid",
      borderColor: "#DCEFFF",

      background: "#FFFFFF",
      padding: "12px 12px",
      cursor: "pointer",
      transition:
        "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease, background 120ms ease",
    },

    dmBtnHover: {
      background: "#F3FAFF",
      borderColor: "#BFE3FF",
      boxShadow: "0 10px 20px rgba(15, 23, 42, 0.06)",
      transform: "translateY(-1px)",
    },

    dmBtnActive: {
      background: "#EAF6FF",
      borderColor: "#55B9FF",
      boxShadow: "0 10px 22px rgba(46, 168, 255, 0.18)",
    },
    dmRowTop: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 10,
    },
    dmName: {
      fontSize: 20,
      fontWeight: 950,
      color: "#0B1220",
      lineHeight: 1.15,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap" as const,
    },
    dmPreview: {
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
      fontWeight: 900,
      padding: "0 10px",
      boxShadow: "0 6px 14px rgba(46, 168, 255, 0.25)",
    },
    empty: { padding: "18px 12px 26px 12px", color: "#64748B", fontSize: 14 },

    // 右側
    mainOuter: {
      minHeight: "70vh",
      background: "#FFFFFF",
      borderLeft: "1px solid #DCEFFF",
      display: "flex",
      flexDirection: "column" as const,
      overflow: "hidden",
    },
    topBar: {
      padding: "12px 14px",
      borderBottom: "1px solid #DCEFFF",
      background: "linear-gradient(90deg, #EAF6FF 0%, #F0FAFF 45%, #FFFFFF 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    topLeft: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: 999,
      border: "1px solid #CFE8FF",
      background: "#FFFFFF",
      cursor: "pointer",
      boxShadow: "0 6px 14px rgba(15,23,42,0.06)",
      display: "grid",
      placeItems: "center",
      fontWeight: 900,
    } as React.CSSProperties,
    partnerWrap: { minWidth: 0 },
    partnerName: {
      fontSize: 18,
      fontWeight: 950,
      color: "#0B1220",
      lineHeight: 1.15,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap" as const,
    },
    partnerSub: { marginTop: 2, fontSize: 12.5, color: "#64748B" },

    profileBtn: {
      border: "1px solid #BFE3FF",
      background: "linear-gradient(180deg, #FFFFFF 0%, #F7FBFF 100%)",
      padding: "8px 12px",
      borderRadius: 999,
      fontSize: 12.5,
      fontWeight: 900,
      cursor: "pointer",
      boxShadow: "0 6px 14px rgba(15,23,42,0.06)",
      color: "#0F172A",
      userSelect: "none" as const,
    },

    msgArea: {
      flex: 1,
      background:
        "linear-gradient(180deg, rgba(234,246,255,0.55) 0%, rgba(247,251,255,0.65) 40%, rgba(255,255,255,1) 100%)",
      overflowY: "auto" as const,
      padding: "14px 14px 10px 14px",
      position: "relative" as const,
    },
    jumpBtnWrap: {
      position: "sticky" as const,
      bottom: 10,
      display: "flex",
      justifyContent: "center",
      pointerEvents: "none" as const,
    },
    jumpBtn: {
      pointerEvents: "auto" as const,
      border: "1px solid #7CC7FF",
      background: "linear-gradient(180deg, #53B9FF 0%, #2EA8FF 100%)",
      color: "#fff",
      padding: "8px 12px",
      borderRadius: 999,
      fontSize: 12.5,
      fontWeight: 950,
      cursor: "pointer",
      boxShadow: "0 10px 22px rgba(46, 168, 255, 0.22)",
    },

    bubbleRow: { display: "flex", marginBottom: 10 },
    bubbleMine: {
      marginLeft: "auto",
      maxWidth: "86%",
      borderRadius: 18,
      padding: "10px 12px",
      background: "linear-gradient(180deg, #53B9FF 0%, #2EA8FF 100%)",
      color: "#fff",
      boxShadow: "0 12px 26px rgba(46,168,255,0.22)",
      border: "1px solid rgba(46,168,255,0.35)",
    },
    bubbleOther: {
      marginRight: "auto",
      maxWidth: "86%",
      borderRadius: 18,
      padding: "10px 12px",
      background: "#FFFFFF",
      color: "#0B1220",
      boxShadow: "0 10px 22px rgba(15,23,42,0.06)",
      border: "1px solid #DCEFFF",
    },
    timeTinyMine: { marginTop: 6, fontSize: 10, opacity: 0.75 },
    timeTinyOther: { marginTop: 6, fontSize: 10, color: "#94A3B8" },
    attachLinkMine: { marginTop: 8, display: "inline-flex", gap: 6, fontSize: 12, color: "rgba(255,255,255,0.92)", textDecoration: "underline" },
    attachLinkOther: { marginTop: 8, display: "inline-flex", gap: 6, fontSize: 12, color: "#0369A1", textDecoration: "underline" },

    previewBar: {
      padding: "10px 14px",
      borderTop: "1px solid #DCEFFF",
      background: "#FFFFFF",
    },
    previewChip: {
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      border: "1px solid #DCEFFF",
      background: "rgba(234,246,255,0.55)",
      borderRadius: 16,
      padding: 10,
      boxShadow: "0 8px 18px rgba(15,23,42,0.06)",
    },
    previewImg: { height: 64, width: 64, objectFit: "cover" as const, borderRadius: 12 },
    delBtn: {
      border: "1px solid #FECACA",
      background: "#FFF1F2",
      color: "#B91C1C",
      padding: "8px 12px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 900,
      cursor: "pointer",
    },

    composer: {
      padding: "12px 14px",
      borderTop: "1px solid #DCEFFF",
      background: "linear-gradient(180deg, #FFFFFF 0%, #F7FBFF 100%)",
      display: "flex",
      alignItems: "center",
      gap: 10,
    },
    camBtn: {
      width: 44,
      height: 44,
      borderRadius: 16,
      border: "1px solid #BFE3FF",
      background: "#FFFFFF",
      cursor: "pointer",
      boxShadow: "0 6px 14px rgba(15,23,42,0.06)",
      userSelect: "none" as const,
    } as React.CSSProperties,
  };

  // responsive: md以上は2カラム

  return (
    <div style={styles.page}>
      <div
        className="grid grid-cols-1 md:grid-cols-12 min-h-[70vh] gap-0"
      >
        {/* ===== 左：DM一覧 ===== */}
        <aside className={`md:col-span-4 md:border-r ${active && !showNewDm ? "hidden md:block" : "block"}`}>
          <div style={styles.asideOuter}>
            <div style={styles.asideCard}>
              <div style={styles.asideHeader}>
                <div style={styles.titleRow}>
                  <div style={styles.title}>DM</div>
                  <button
                    style={styles.newBtn}
                    onClick={() => {
                      setShowNewDm(true);
                      setActive(null);
                    }}
                    aria-label="新しいDMを作成"
                  >
                    ＋新規
                  </button>
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

              <div style={styles.listWrap}>
                {filteredGroups.map((g) => {
                  const label = labelByGroup[g.id]?.partnerName ?? "（相手）";
                  const unread = unreadByGroup[g.id] ?? 0;

                  const last = lastByGroup[g.id];
                  const lastText = previewText(last);
                  const lastTime = last?.created_at ? formatTime(last.created_at) : "";

                  const isActiveRow = activeId === g.id;

                  return (
                    <button
                      key={g.id}
                      onClick={() => setActive(g)}
                      style={{
                        ...styles.dmBtnBase,
                        ...(isActiveRow ? styles.dmBtnActive : {}),
                      }}
                      onMouseEnter={(e) => {
                        if (isActiveRow) return;
                        Object.assign(e.currentTarget.style, styles.dmBtnHover);
                      }}
                      onMouseLeave={(e) => {
                        if (isActiveRow) {
                          Object.assign(e.currentTarget.style, styles.dmBtnActive);
                          return;
                        }
                        Object.assign(e.currentTarget.style, styles.dmBtnBase);
                      }}
                    >
                      <div style={styles.dmRowTop}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={styles.dmName}>{label}</div>
                          <div style={styles.dmPreview}>{lastText}</div>
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
                  <div style={styles.empty}>DMがまだありません</div>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* ===== 右：トーク ===== */}
        <main className={`md:col-span-8 flex flex-col ${active && !showNewDm ? "block" : "hidden md:flex"}`}>
          <div style={styles.mainOuter}>
            {/* ヘッダー */}
            <div style={styles.topBar}>
              <div style={styles.topLeft}>
                {/* モバイル戻る */}
                <button
                  style={styles.backBtn}
                  className="md:hidden"
                  onClick={() => setActive(null)}
                  aria-label="戻る"
                >
                  ←
                </button>

                <div style={styles.partnerWrap}>
                  <div style={styles.partnerName}>
                    {activeId
                      ? labelByGroup[activeId]?.partnerName ?? "（相手）"
                      : "DM未選択"}
                  </div>
                  <div style={styles.partnerSub}>
                    {activeId ? "ダイレクトメッセージ" : "左からDMを選択してください"}
                  </div>
                </div>
              </div>

              {activeId && activePartner?.partnerId && (
                <button
                  style={styles.profileBtn}
                  onClick={() => setShowProfile(true)}
                  onMouseDown={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform =
                      "translateY(1px)";
                  }}
                  onMouseUp={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform =
                      "translateY(0px)";
                  }}
                >
                  相手のプロフィール
                </button>
              )}
            </div>

            {/* メッセージ */}
            <div style={styles.msgArea} ref={scrollRef}>
              {activeId ? (
                messages.map((m) => {
                  const url = getImageUrl(m.image_url);
                  const mine = m.sender_id === myId;

                  return (
                    <div key={m.id} style={styles.bubbleRow}>
                      <div style={mine ? styles.bubbleMine : styles.bubbleOther}>
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
                            style={mine ? styles.attachLinkMine : styles.attachLinkOther}
                          >
                            📎 添付画像を開く
                          </a>
                        )}

                        <div style={mine ? styles.timeTinyMine : styles.timeTinyOther}>
                          {new Date(m.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ color: "#64748B", fontSize: 14, padding: 10 }}>
                  左からDMを選択してください
                </div>
              )}

              <div ref={bottomRef} />

              {/* ↓ 最新へ */}
              {activeId && showJump && (
                <div style={styles.jumpBtnWrap}>
                  <button style={styles.jumpBtn} onClick={() => scrollToBottom(true)}>
                    ↓ 最新へ
                  </button>
                </div>
              )}
            </div>

            {/* 画像プレビュー */}
            {previewUrl && (
              <div style={styles.previewBar}>
                <div style={styles.previewChip}>
                  <img
                    src={previewUrl}
                    alt="選択中の画像"
                    style={styles.previewImg}
                  />
                  <button style={styles.delBtn} type="button" onClick={clearImageSelection}>
                    削除
                  </button>
                </div>
              </div>
            )}

            {/* 入力欄 */}
            <div style={styles.composer}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />

              <button
                style={styles.camBtn}
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || loading || !activeId}
                aria-label="画像を選ぶ"
              >
                📷
              </button>

              <Input
                className="flex-1"
                placeholder={
                  activeId ? "メッセージを入力…（Enterで送信）" : "DMを選択してください"
                }
                value={input}
                onChange={(e) => setInput((e.target as HTMLInputElement).value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey
                    ? (e.preventDefault(), send())
                    : null
                }
                disabled={!activeId || loading}
              />

              <Button onClick={send} disabled={!activeId || loading || uploading}>
                送信
              </Button>
            </div>
          </div>

          {/* プロフィール閲覧 */}
          {showProfile && activePartner?.partnerId && (
            <ProfileViewDialog
              userId={activePartner.partnerId}
              onClose={() => setShowProfile(false)}
            />
          )}
        </main>

        {/* ===== 新規DM（モーダル）: mainの外に出す（重要） ===== */}
        {showNewDm && (
          <div className="fixed inset-0 z-999 bg-black/40 grid place-items-center">
            <div className="w-[min(720px,95vw)]">
              <SelectUserDialog
                onClose={() => setShowNewDm(false)}
                onSelect={(uid, name) => createDm(uid, name)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
