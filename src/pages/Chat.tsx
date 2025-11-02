import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useIsStaff } from "../hooks/useIsStaff";
import InviteMemberDialog from "../components/InviteMemberDialog";
import GroupMembersDialog from "../components/GroupMembersDialog.tsx";

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
  created_at: string;
};

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
  const bottomRef = useRef<HTMLDivElement>(null);

  const myId = user?.id ?? "";
  const activeId = active?.id ?? null;
  const canManage = isStaff;

  // --- グループ一覧取得 ---
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
        return;
      }

      const { data: gs, error: e2 } = await supabase
        .from("groups")
        .select("id, name, type, owner_id")
        .in("id", ids)
        .order("name", { ascending: true });

      if (e2) {
        console.error("❌ groups load:", e2.message);
        return;
      }

      const list: Group[] = (gs ?? []).map((g) => ({
        id: g.id as string,
        name: g.name as string,
        type: g.type as "class" | "dm",
        owner_id: (g.owner_id as string) ?? null,
      }));

      setGroups(list);
      if (!active && list.length > 0) setActive(list[0]);
      if (active && !list.find((g) => g.id === active.id)) {
        setActive(list[0] ?? null);
      }
    })();
  }, [myId, active]);

  // --- メッセージ一覧取得 ---
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id,group_id,sender_id,body,created_at")
        .eq("group_id", activeId)
        .order("created_at", { ascending: true });
      if (error) {
        console.error("❌ messages load:", error.message);
        return;
      }
      if (!cancelled) setMessages((data ?? []) as Message[]);
      scrollToBottom();
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  // --- Realtime購読 ---
  useEffect(() => {
    if (!activeId) return;
    const channel = supabase
      .channel(`room:${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `group_id=eq.${activeId}`,
        },
        (payload) => {
          const row = payload.new as Message;
          setMessages((prev) => [...prev, row]);
          scrollToBottom();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeId]);

  function scrollToBottom() {
    requestAnimationFrame(() =>
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    );
  }

  // --- メッセージ送信 ---
  async function send() {
    if (!active || !myId || !input.trim()) return;
    setLoading(true);
    const { error } = await supabase
      .from("messages")
      .insert({ group_id: active.id, sender_id: myId, body: input.trim() });
    setLoading(false);
    if (error) return console.error("❌ send:", error.message);
    setInput("");
  }

  // --- グループ作成 ---
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
      .insert({ group_id: id, user_id: myId });
    if (me) return alert("メンバー追加失敗: " + me.message);

    const newGroup: Group = { id, name, type: "class", owner_id: myId };
    setGroups((prev) => [...prev, newGroup]);
    setActive(newGroup);
  }

  const isActiveOwner = useMemo<boolean>(
    () => !!(active && active.owner_id === myId),
    [active, myId]
  );

  return (
    <div className="grid grid-cols-12 min-h-[70vh]">
      {/* 左側：グループ一覧 */}
      <aside className="col-span-4 border-r">
        <div className="flex items-center justify-between p-3">
          <h2 className="font-bold">グループ</h2>
          {canManage && (
            <button
              className="text-sm border rounded px-2 py-1"
              onClick={createGroup}
            >
              ＋作成（教師）
            </button>
          )}
        </div>
        <ul>
          {groups.map((g) => (
            <li key={g.id}>
              <button
                onClick={() => setActive(g)}
                className={`w-full text-left px-3 py-2 hover:bg-gray-100 ${
                  active?.id === g.id ? "bg-gray-100 font-semibold" : ""
                }`}
              >
                {g.name}{" "}
                <span className="text-xs text-gray-500">({g.type})</span>
              </button>
            </li>
          ))}
          {groups.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-500">
              所属グループがありません
            </p>
          )}
        </ul>
      </aside>

      {/* 右側：メッセージ */}
      <main className="col-span-8 flex flex-col">
        <div className="flex items-center justify-between p-3 border-b bg-white">
          <div className="font-bold">{active ? active.name : "グループ未選択"}</div>

          {canManage && isActiveOwner && (
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
            </div>
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
                <p className="whitespace-pre-wrap">{m.body}</p>
                <div className="text-[10px] opacity-60 mt-1">
                  {new Date(m.created_at).toLocaleString()}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">
              左からグループを選択してください
            </p>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="p-3 border-t bg-white flex gap-2">
          <input
            className="flex-1 border rounded px-3 py-2"
            placeholder={
              active ? "メッセージを入力..." : "グループを選択してください"
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
          <button
            onClick={send}
            disabled={!active || loading}
            className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
          >
            送信
          </button>
        </div>
      </main>

      {/* 生徒一覧から招待ダイアログ */}
      {showInvite && active && (
        <InviteMemberDialog
          groupId={active.id}
          onClose={() => setShowInvite(false)}
          onInvited={() => setShowInvite(false)}
        />
      )}

      {/* メンバー管理ダイアログ */}
      {showMembers && active && (
        <GroupMembersDialog
          groupId={active.id}
          isOwner={isActiveOwner}
          onClose={() => setShowMembers(false)}
        />
      )}
    </div>
  );
}
