/*
 * src/pages/Chat.tsx
 * Responsibility: グループチャット画面のページコンポーネント
 * - 左カラム: 所属するクラスグループ一覧（未読バッジ付き）
 * - 右カラム: メッセージ一覧 / 送信フォーム（画像アップロード対応）
 * - Realtime で新着メッセージを購読し、未読数を更新する
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  image_url: string | null; // Storage のパス or 既存のフルURL
  created_at: string;
};

type LastReadRow = { group_id: string; last_read_at: string };

// Storage のパスからブラウザで表示できる URL を作る（リンク用）
function getImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    // 既存データでフルURLが入っている場合はそのまま使う
    return path;
  }
  const { data } = supabase.storage
    .from("chat-media")
    .getPublicUrl(path);

  // デバッグ用：どんなURLになっているか確認したくなったらコメントアウト外す
  // console.log("image path -> url:", path, "→", data.publicUrl);

  return data.publicUrl ?? null;
}

export default function Chat() {
  const { user } = useAuth();
  const { isStaff } = useIsStaff();

  const [groups, setGroups] = useState<Group[]>([]);
  const [active, setActive] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showMembers, setShowMembers] = useState(false);

  // 未読数（group_id => 件数）
  const [unreadByGroup, setUnreadByGroup] = useState<Record<string, number>>(
    {}
  );

  // 画像アップロード用
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  const myId = user?.id ?? "";
  const activeId = active?.id ?? null;
  const canManage = isStaff;

  function scrollToBottom() {
    requestAnimationFrame(() =>
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    );
  }

  /** 自分の last_read_at を now にする（閲覧＝既読） */
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

  /** グループ一覧の未読数をまとめて再計算 */
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

  // --- グループ一覧（class のみ表示） ---
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
      if (!active && list.length > 0) setActive(list[0]);
      if (active && !list.find((g) => g.id === active.id)) {
        setActive(list[0] ?? null);
      }

      await fetchUnreadCounts(list.map((g) => g.id));
    })();
  }, [myId, active, fetchUnreadCounts]);

  // --- メッセージ一覧 ---
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

  // --- Realtime（新着で未読を反映） ---
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

  // ---- 画像選択（カメラ or ギャラリー） ----
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

  // --- メッセージ送信（テキストのみ or 画像付き or 画像だけOK） ---
  async function send() {
    if (!active || !myId) return;

    const text = input.trim();
    if (!text && !selectedFile) {
      return;
    }

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

      // body は NOT NULL なので、空でも "" を入れる
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

  // --- グループ作成（class 固定） ---
  async function createGroup() {
    if (!canManage) return;
    const name = prompt("グループ名？（例：2年A組）");
    if (!name || !myId) return;

    const id = crypto.randomUUID();
    const { error: ge } = await supabase
      .from("groups")
      .insert({ id, name, type: "class", owner_id: myId });
    if (ge) return alert("グループ作成失敗: " + ge.message);

    const { error: me } = await supabase
      .from("group_members")
      .insert({
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

  // --- グループ削除 ---
  async function deleteGroup(g: Group) {
    if (!g || g.type !== "class") return;
    if (!confirm(`グループ「${g.name}」を削除しますか？（メッセージも削除）`)) return;

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

    const { error: e3 } = await supabase
      .from("groups")
      .delete()
      .eq("id", g.id);
    if (e3) return alert("削除失敗(groups): " + e3.message);

    setGroups((prev) => prev.filter((x) => x.id !== g.id));
    setUnreadByGroup((prev) => {
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 min-h-[70vh] gap-4">
      {/* 左：クラス用グループ一覧（未読バッジ付き） */}
      <aside className="col-span-1 md:col-span-4 md:border-r">
        <div className="flex items-center justify-between p-3">
          <h2 className="font-bold">グループ</h2>
          {canManage && (
            <button
              className="btn-ghost text-sm"
              onClick={createGroup}
              aria-label="グループ作成"
            >
              ＋作成
            </button>
          )}
        </div>
        <ul>
          {groups.map((g) => {
            const unread = unreadByGroup[g.id] ?? 0;
            return (
              <li key={g.id}>
                <button
                  onClick={() => setActive(g)}
                  className={`w-full text-left px-3 py-2 hover:bg-gray-100 ${
                    active?.id === g.id ? "bg-gray-100 font-semibold" : ""
                  } flex items-center justify-between`}
                >
                  <span>{g.name}</span>
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
              所属グループがありません
            </p>
          )}
        </ul>
      </aside>

      {/* 右：メッセージ */}
      <main className="col-span-1 md:col-span-8 flex flex-col">
        <div className="flex items-center justify-between p-3 border-b bg-white">
          <div className="font-bold">
            {active ? active.name : "グループ未選択"}
          </div>

          {canManage && isActiveOwner && active && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowInvite(true)}
                className="text-sm border rounded px-2 py-1"
              >
                メンバー招待
              </button>
              <button
                onClick={() => setShowMembers(true)}
                className="text-sm border rounded px-2 py-1"
              >
                メンバー管理
              </button>
              <button
                onClick={() => deleteGroup(active)}
                className="text-sm border rounded px-2 py-1 text-red-600"
              >
                グループ削除
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
          {active ? (
            messages.map((m) => {
              const url = getImageUrl(m.image_url);
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
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-1 text-xs underline ${
                        m.sender_id === myId
                          ? "text-blue-200"
                          : "text-blue-600"
                      }`}
                    >
                      📎 添付画像を開く
                    </a>
                  )}
                  <div className="text-[10px] opacity-60 mt-1">
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-gray-500">
              左からグループを選択してください
            </p>
          )}
          <div ref={bottomRef} />
        </div>

        {/* 画像プレビュー */}
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
          {/* カメラ / 画像ボタン */}
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
                : "グループを選択してください"
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && !e.shiftKey
                ? (e.preventDefault(), send())
                : null
            }
            disabled={!active || loading}
          />
          <Button
            onClick={send}
            disabled={!active || loading || uploading}
            aria-label="メッセージ送信"
          >
            送信
          </Button>
        </div>
      </main>

      {/* 招待 / メンバー管理ダイアログ */}
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
    </div>
  );
}
