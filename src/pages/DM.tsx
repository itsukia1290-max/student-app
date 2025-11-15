// src/pages/DM.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import SelectUserDialog from "../components/SelectUserDialog";
import ProfileViewDialog from "../components/ProfileViewDialog";
import { compressImage } from "../utils/image";

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
  created_at: string;
  // ★ 画像対応
  type?: "text" | "image";
  media_path?: string | null;
};

type LastReadRow = { group_id: string; last_read_at: string };
type PartnerRow = { group_id: string; user_id: string };
type ProfileMini = { id: string; name: string | null };

export default function DM() {
  const { user } = useAuth();
  const myId = user?.id ?? "";

  const [groups, setGroups] = useState<Group[]>([]);
  const [labelByGroup, setLabelByGroup] = useState<
    Record<string, { partnerId: string; partnerName: string | null }>
  >({});
  const [unreadByGroup, setUnreadByGroup] = useState<Record<string, number>>({});
  const [active, setActive] = useState<Group | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [showNewDm, setShowNewDm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // 画像用
  const [sendingImage, setSendingImage] = useState(false);
  const [signedUrlCache] = useState(() => new Map<string, string>());

  const bottomRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() =>
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    );
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
          name: (g.name as string) ?? "DM",
          type: "dm",
          owner_id: (g.owner_id as string) ?? null,
        })) ?? [];

      setGroups(list);
      if (!active && list.length > 0) setActive(list[0]);
      if (active && !list.find((g) => g.id === active.id)) {
        setActive(list[0] ?? null);
      }

      if (list.length > 0) {
        const ids = list.map((g) => g.id);
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

        const labelMap: Record<
          string,
          { partnerId: string; partnerName: string | null }
        > = {};
        ((others ?? []) as PartnerRow[]).forEach((o) => {
          const gid = o.group_id;
          const pid = o.user_id;
          if (!labelMap[gid]) {
            labelMap[gid] = { partnerId: pid, partnerName: names[pid] ?? null };
          }
        });
        setLabelByGroup(labelMap);

        await fetchUnreadCounts(ids);
      } else {
        setLabelByGroup({});
        setUnreadByGroup({});
      }
    })();
    // active はアクティブ選択の維持に参照
  }, [myId, active, fetchUnreadCounts]);

  // ---- メッセージ読み込み（アクティブDM） ----
  useEffect(() => {
    if (!active?.id) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id,group_id,sender_id,body,created_at,type,media_path") // ★ type, media_path
        .eq("group_id", active.id)
        .order("created_at", { ascending: true });
      if (error) {
        console.error("❌ messages load:", error.message);
        return;
      }
      if (!cancelled) setMessages((data ?? []) as Message[]);
      scrollToBottom();
      await markRead(active.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [active?.id, markRead]);

  // ---- Realtime（アクティブDMのみ購読） ----
  useEffect(() => {
    if (!active?.id) return;
    const channel = supabase
      .channel(`dm:${active.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `group_id=eq.${active.id}` },
        async (payload) => {
          const row = payload.new as Message;
          setMessages((prev) => [...prev, row]);
          scrollToBottom();
          await markRead(active.id);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [active?.id, markRead]);

  // --- 署名URL発行（キャッシュ付き） ---
  async function getSignedUrl(path: string): Promise<string | null> {
    if (!path) return null;
    const hit = signedUrlCache.get(path);
    if (hit) return hit;
    const { data, error } = await supabase
      .storage
      .from("chat-media")
      .createSignedUrl(path, 60 * 60);
    if (error || !data?.signedUrl) return null;
    signedUrlCache.set(path, data.signedUrl);
    return data.signedUrl;
  }

  // ---- 画像送信 ----
  async function sendImageFile(file: File) {
    if (!active || !myId) return;
    try {
      setSendingImage(true);
      const blob = await compressImage(file, 1280, 0.85);
      const path = `dms/${active.id}/${Date.now()}-${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase
        .storage
        .from("chat-media")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase
        .from("messages")
        .insert({
          group_id: active.id,
          sender_id: myId,
          type: "image",
          media_path: path,
          body: "",
        });
      if (insErr) throw insErr;
    } catch (e: unknown) {
      alert("画像送信に失敗しました: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSendingImage(false);
    }
  }

  // ---- 送信 ----
  async function send() {
    if (!active || !myId || !input.trim()) return;
    setLoading(true);
    const { error } = await supabase
      .from("messages")
      .insert({ group_id: active.id, sender_id: myId, body: input.trim(), type: "text" });
    setLoading(false);
    if (error) return console.error("❌ send:", error.message);
    setInput("");
    await markRead(active.id);
  }

  // ---- 新規DM作成 ----
  async function createDm(partnerId: string, partnerName: string | null) {
    if (!myId) return;
    const id = crypto.randomUUID();
    const name = partnerName ?? "DM";

    const { error: ge } = await supabase
      .from("groups")
      .insert({ id, name, type: "dm", owner_id: myId });
    if (ge) return alert("DM作成失敗: " + ge.message);

    const { error: me } = await supabase
      .from("group_members")
      .insert([
        { group_id: id, user_id: myId, last_read_at: new Date().toISOString() },
        { group_id: id, user_id: partnerId },
      ]);
    if (me) return alert("メンバー追加失敗: " + me.message);

    const newGroup: Group = { id, name, type: "dm", owner_id: myId };
    setGroups((prev) => [...prev, newGroup]);
    setLabelByGroup((prev) => ({
      ...prev,
      [id]: { partnerId, partnerName },
    }));
    setUnreadByGroup((prev) => ({ ...prev, [id]: 0 }));
    setActive(newGroup);
    setShowNewDm(false);
  }

  const activePartner = active ? labelByGroup[active.id] : undefined;

  return (
    <div className="grid grid-cols-12 min-h-[70vh]">
      {/* 左：DM一覧（相手名＋未読） */}
      <aside className="col-span-4 border-r">
        <div className="flex items-center justify-between p-3">
          <h2 className="font-bold">DM</h2>
          <button
            className="text-sm border rounded px-2 py-1"
            onClick={() => setShowNewDm(true)}
          >
            ＋新しいDM
          </button>
        </div>
        <ul>
          {groups.map((g) => {
            const label = labelByGroup[g.id]?.partnerName ?? g.name;
            const unread = unreadByGroup[g.id] ?? 0;
            return (
              <li key={g.id}>
                <button
                  onClick={() => setActive(g)}
                  className={`w-full text-left px-3 py-2 hover:bg-gray-100 ${
                    active?.id === g.id ? "bg-gray-100 font-semibold" : ""
                  } flex items-center justify-between`}
                >
                  <span>{label}</span>
                  {unread > 0 && (
                    <span className="ml-2 inline-flex min-w-6 h-6 items-center justify-center rounded-full bg-red-600 text-white text-xs px-2">
                      {unread}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {groups.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-500">DMがまだありません</p>
          )}
        </ul>
      </aside>

      {/* 右：メッセージ */}
      <main className="col-span-8 flex flex-col">
        <div className="flex items-center justify-between p-3 border-b bg-white">
          <div className="font-bold">
            {active ? labelByGroup[active.id]?.partnerName ?? "DM" : "DM未選択"}
          </div>
          {active && activePartner?.partnerId && (
            <button
              onClick={() => setShowProfile(true)}
              className="text-sm border rounded px-2 py-1"
            >
              相手のプロフィール
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
          {active ? (
            messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[80%] px-3 py-2 rounded ${
                  m.sender_id === myId
                    ? "bg-black text-white ml-auto"
                    : "bg-white border"
                }`}
              >
                {m.type === "image" && m.media_path ? (
                  <AsyncImage path={m.media_path} getUrl={getSignedUrl} />
                ) : (
                  <p className="whitespace-pre-wrap">{m.body}</p>
                )}
                <div className="text-[10px] opacity-60 mt-1">
                  {new Date(m.created_at).toLocaleString()}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">左からDMを選択してください</p>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="p-3 border-t bg-white flex gap-2">
          {/* 画像送信用 input（カメラ起動も可） */}
          <input
            id="dm-image-input"
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (f) sendImageFile(f);
            }}
          />
          <button
            type="button"
            onClick={() => document.getElementById("dm-image-input")?.click()}
            disabled={!active || sendingImage}
            className="px-3 py-2 rounded border disabled:opacity-50"
            title="写真を撮影/選択して送信"
          >
            📷
          </button>

          <input
            className="flex-1 border rounded px-3 py-2"
            placeholder={active ? "メッセージを入力..." : "DMを選択してください"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && !e.shiftKey
                ? (e.preventDefault(), send())
                : null
            }
            disabled={!active || loading}
          />
          <button
            onClick={send}
            disabled={!active || loading}
            className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
          >
            送信
          </button>
        </div>
      </main>

      {/* DM新規作成 */}
      {showNewDm && (
        <SelectUserDialog
          onClose={() => setShowNewDm(false)}
          onSelect={(uid, name) => createDm(uid, name)}
        />
      )}

      {/* プロフィール閲覧 */}
      {showProfile && activePartner?.partnerId && (
        <ProfileViewDialog
          userId={activePartner.partnerId}
          onClose={() => setShowProfile(false)}
        />
      )}
    </div>
  );
}

/** 画像の非同期表示（サインURLを取得して表示） */
function AsyncImage({
  path,
  getUrl,
}: {
  path: string;
  getUrl: (p: string) => Promise<string | null>;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const u = await getUrl(path);
      if (alive) setUrl(u);
    })();
    return () => {
      alive = false;
    };
  }, [path, getUrl]);

  if (!url) return <div className="w-40 h-28 bg-gray-200 rounded animate-pulse" />;

  return (
    <img
      src={url}
      className="max-w-full rounded"
      loading="lazy"
      alt="image message"
    />
  );
}
