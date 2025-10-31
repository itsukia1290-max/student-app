// src/pages/Chat.tsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useEnsureDm } from "../hooks/useEnsureDm";

interface Message {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
}
interface Group {
  id: string;
  name: string | null;
  type: "class" | "dm";
}
interface GroupRow {
  id: string;
  name: string | null;
  type: "class" | "dm";
  group_members: { user_id: string }[];
}

export default function Chat() {
  const { user } = useAuth();
  const uid: string | null = user?.id ?? null;

  // ✅ DM作成の完了を受け取る
  const { ensured, groupId } = useEnsureDm();

  const [classRooms, setClassRooms] = useState<Group[]>([]);
  const [dmRooms, setDmRooms] = useState<Group[]>([]);
  const [active, setActive] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");

  // ---------- 所属グループ再読込 ----------
  useEffect(() => {
    if (!uid) return;
    async function loadGroups() {
      const { data: cls, error: e1 } = await supabase
        .from("groups")
        .select("id, name, type, group_members!inner(user_id)")
        .eq("group_members.user_id", uid)
        .eq("type", "class");
      if (!e1 && cls) {
        const rows = cls as unknown as GroupRow[];
        setClassRooms(rows.map((g) => ({ id: g.id, name: g.name, type: g.type })));
      }

      const { data: dms, error: e2 } = await supabase
        .from("groups")
        .select("id, name, type, group_members!inner(user_id)")
        .eq("group_members.user_id", uid)
        .eq("type", "dm");
      if (!e2 && dms) {
        const rows = dms as unknown as GroupRow[];
        setDmRooms(rows.map((g) => ({ id: g.id, name: g.name, type: g.type })));
      }
    }
    loadGroups();
  // ✅ ensured / groupId を依存に追加（作成後に必ず再読込）
  }, [uid, ensured, groupId]);

  // ---------- メッセージ購読 ----------
  useEffect(() => {
    if (!active) return;

    const loadMsgs = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, sender_id, body, created_at")
        .eq("group_id", active.id)
        .order("created_at", { ascending: true });
      if (!error && data) setMessages(data);
    };
    loadMsgs();

    const sub = supabase
      .channel(`room:${active.id}`)
      .on(
        "postgres_changes",
        { schema: "public", table: "messages", event: "INSERT", filter: `group_id=eq.${active.id}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Message])
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [active]);

  async function send() {
    if (!uid || !active || !text.trim()) return;
    const { error } = await supabase
      .from("messages")
      .insert({ group_id: active.id, sender_id: uid, body: text.trim() });
    if (!error) setText("");
  }

  return (
    <div className="grid grid-cols-12 h-[calc(100vh-64px)]">
      <aside className="col-span-4 border-r bg-white">
        <div className="p-3 border-b font-semibold">チャット</div>

        <div className="p-3 space-y-4">
          <section>
            <h3 className="text-xs text-gray-500 mb-1">グループ</h3>
            {classRooms.length === 0 && (
              <p className="text-xs text-gray-400 px-2">参加中のグループはありません</p>
            )}
            {classRooms.map((g) => (
              <button
                key={g.id}
                className={`w-full text-left px-2 py-1 rounded ${
                  active?.id === g.id ? "bg-black text-white" : "hover:bg-gray-100"
                }`}
                onClick={() => setActive(g)}
              >
                {g.name ?? "（無題）"}
              </button>
            ))}
          </section>

          <section>
            <h3 className="text-xs text-gray-500 mb-1">個別相談（DM）</h3>
            {dmRooms.length === 0 && (
              <p className="text-xs text-gray-400 px-2">DM はまだありません</p>
            )}
            {dmRooms.map((g) => (
              <button
                key={g.id}
                className={`w-full text-left px-2 py-1 rounded ${
                  active?.id === g.id ? "bg-black text-white" : "hover:bg-gray-100"
                }`}
                onClick={() => setActive(g)}
              >
                {g.name ?? "（DM）"}
              </button>
            ))}
          </section>
        </div>
      </aside>

      <main className="col-span-8 flex flex-col">
        {!active ? (
          <div className="flex-1 grid place-items-center text-gray-400">
            左の一覧からルームを選択してください
          </div>
        ) : (
          <>
            <header className="p-3 border-b bg-white">
              <h2 className="font-semibold">
                {active.name ?? (active.type === "dm" ? "DM" : "グループ")}
              </h2>
            </header>

            <div className="flex-1 overflow-auto p-3 space-y-2 bg-gray-50">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[80%] px-3 py-2 rounded-2xl ${
                    m.sender_id === uid ? "ml-auto bg-black text-white" : "bg-white"
                  }`}
                >
                  <div className="text-sm whitespace-pre-wrap">{m.body}</div>
                  <div className="text-[10px] text-gray-400 mt-1">
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            <footer className="p-3 border-t bg-white flex gap-2">
              <input
                className="flex-1 border rounded px-3 py-2"
                placeholder="メッセージを入力..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
              />
              <button onClick={send} className="px-4 py-2 rounded bg-black text-white">
                送信
              </button>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
