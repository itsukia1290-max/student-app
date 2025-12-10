/*
 * src/pages/DM.tsx
 * Responsibility: 1対1 のダイレクトメッセージ（DM）画面
 * - 左カラム: DM 一覧（相手の名前ラベル・未読）
 * - 右カラム: アクティブ DM のメッセージ表示と送信（画像対応）
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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

// Storage のパスからブラウザで表示できる URL を作る
function getImageSrc(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const { data } = supabase.storage.from("chat-media").getPublicUrl(path);
  return data.publicUrl ?? null;
}

export default function DM() {
  const { user } = useAuth();
  const myId = user?.id ?? "";

  const [groups, setGroups] = useState<Group[]>([]);
  const [labelByGroup, setLabelByGroup] = useState<
    Record<string, { partnerId: string; partnerName: string | null }>
  >({});
  const [unreadByGroup, setUnreadByGroup] = useState<Record<string, number>>(
    {}
  );
  const [active, setActive] = useState<Group | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [showNewDm, setShowNewDm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // 画像用
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
  }, [myId, active, fetchUnreadCounts]);

  // ---- メッセージ読み込み（アクティブDM） ----
  useEffect(() => {
    if (!active?.id) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id,group_id,sender_id,body,image_url,created_at")
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
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `group_id=eq.${active.id}`,
        },
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
    if (!active || !myId) return;

    const text = input.trim();
    if (!text && !selectedFile) return;

    setLoading(true);
    setUploading(true);

    let imagePath: string | null = null;
    try {
      if (selectedFile) {
        const ext = selectedFile.name.split(".").pop() || "jpg";
        imagePath = `dms/${active.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("chat-media")
          .upload(imagePath, selectedFile, {
            cacheControl: "3600",
            upsert: false,
          });
        if (upErr) throw upErr;
      }

      // body は NOT NULL なので、空のときも "" を入れる
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
      alert("送信に失敗しました: " + (e as Error).message);
    } finally {
      setLoading(false);
      setUploading(false);
    }
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
    <div className="grid grid-cols-1 md:grid-cols-12 min-h-[70vh] gap-4">
      {/* 左：DM一覧（相手名＋未読） */}
      <aside className="col-span-1 md:col-span-4 md:border-r">
        <div className="flex items-center justify-between p-3">
          <h2 className="font-bold">DM</h2>
          <button
            className="btn-ghost text-sm"
            onClick={() => setShowNewDm(true)}
            aria-label="新しいDMを作成"
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
            <p className="px-3 py-2 text-sm text-gray-500">
              DMがまだありません
            </p>
          )}
        </ul>
      </aside>

      {/* 右：メッセージ */}
      <main className="col-span-1 md:col-span-8 flex flex-col">
        <div className="flex items-center justify-between p-3 border-b bg-white">
          <div className="font-bold">
            {active
              ? labelByGroup[active.id]?.partnerName ?? "DM"
              : "DM未選択"}
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
            messages.map((m) => {
              const src = getImageSrc(m.image_url);
              return (
                <div
                  key={m.id}
                  className={`max-w-[80%] px-3 py-2 rounded ${
                    m.sender_id === myId
                      ? "bg-black text-white ml-auto"
                      : "bg-white border"
                  }`}
                >
                  {m.body && (
                    <p className="whitespace-pre-wrap mb-1">{m.body}</p>
                  )}
                  {src && (
                    <img
                      src={src}
                      alt="添付画像"
                      className="max-w-full rounded border bg-white"
                    />
                  )}
                  <div className="text-[10px] opacity-60 mt-1">
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-gray-500">
              左からDMを選択してください
            </p>
          )}
          <div ref={bottomRef} />
        </div>

        {/* プレビュー */}
        {previewUrl && (
          <div className="px-3 pb-2 bg-white border-t">
            <div className="inline-flex items-center gap-2 border rounded-lg p-2">
              <img
                src={previewUrl}
                alt="選択中の画像"
                className="h-16 w-16 object-cover rounded"
              />
              <button
                type="button"
                onClick={clearImageSelection}
                className="text-xs text-red-600 border px-2 py-1 rounded"
              >
                削除
              </button>
            </div>
          </div>
        )}

        <div className="p-3 border-t bg-white flex gap-2 items-center">
          {/* カメラボタン */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 border rounded"
              disabled={uploading || loading}
            >
              📷
            </button>
          </div>

          <Input
            className="flex-1"
            placeholder={
              active
                ? "メッセージを入力...（画像だけでも送信可）"
                : "DMを選択してください"
            }
            value={input}
            onChange={(e) => setInput((e.target as HTMLInputElement).value)}
            onKeyDown={(e) =>
              e.key === "Enter" && !e.shiftKey
                ? (e.preventDefault(), send())
                : null
            }
            disabled={!active || loading}
          />
          <Button onClick={send} disabled={!active || loading || uploading} aria-label="メッセージ送信">
            送信
          </Button>
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
