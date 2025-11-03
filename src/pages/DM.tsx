import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import SelectUserDialog from "../components/SelectUserDialog";
import ProfileViewDialog from "../components/ProfileViewDialog";

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
};

type Partner = {
  group_id: string;
  partner_id: string;
  partner_name: string | null;
};

export default function DM() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [active, setActive] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showNewDm, setShowNewDm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const myId = user?.id ?? "";

  // --- DMグループ一覧をロード ---
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
        .eq("type", "dm")
        .order("name", { ascending: true });

      if (e2) {
        console.error("❌ groups load:", e2.message);
        return;
      }

      const list = (gs ?? []).map((g) => ({
        id: g.id as string,
        name: g.name as string,
        type: "dm" as const,
        owner_id: g.owner_id as string | null,
      }));

      setGroups(list);
      if (!active && list.length > 0) setActive(list[0]);
      if (active && !list.find((g) => g.id === active.id)) {
        setActive(list[0] ?? null);
      }
    })();
  }, [myId, active]);

  // --- パートナー情報ロード ---
  useEffect(() => {
    if (!myId) return;
    (async () => {
      const { data, error } = await supabase.rpc("get_dm_partners", {
        p_user_id: myId,
      });
      if (error) {
        console.error("❌ get_dm_partners:", error.message);
        return;
      }
      setPartners(data ?? []);
    })();
  }, [myId, groups]);

  // --- アクティブな相手ID更新 ---
  useEffect(() => {
    if (!active?.id) {
      setActivePartnerId(null);
      return;
    }
    const partner = partners.find((x) => x.group_id === active.id);
    setActivePartnerId(partner?.partner_id ?? null);
  }, [active, partners]);

  // --- メッセージロード ---
  useEffect(() => {
    if (!active?.id) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id,group_id,sender_id,body,created_at")
        .eq("group_id", active.id)
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
  }, [active]);

  // --- Realtime購読 ---
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
  }, [active]);

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

  // --- 新規DM作成 ---
  async function createDm(partnerId: string, partnerName: string | null) {
    if (!myId) return;

    // 既にDMが存在するか確認
    const { data: existing, error: e0 } = await supabase
      .from("groups")
      .select("id, name, owner_id")
      .eq("type", "dm")
      .contains("name", [partnerId])
      .maybeSingle();
    if (e0) console.error("❌ DM存在確認:", e0.message);
    // 存在していれば既存をアクティブにして終了
    if (existing) {
      setActive({ id: existing.id as string, name: existing.name as string, type: "dm", owner_id: existing.owner_id as string | null });
      setShowNewDm(false);
      return;
    }

    // 新規作成
    const id = crypto.randomUUID();
    const name = partnerName ?? "DM";
    const { error: ge } = await supabase
      .from("groups")
      .insert({ id, name, type: "dm", owner_id: myId });
    if (ge) return alert("DM作成失敗: " + ge.message);

    await supabase.from("group_members").insert([
      { group_id: id, user_id: myId },
      { group_id: id, user_id: partnerId },
    ]);

    const newGroup = { id, name, type: "dm" as const, owner_id: myId };
    setGroups((prev) => [...prev, newGroup]);
    setActive(newGroup);
    setShowNewDm(false);
  }

  const dmView = groups.map((g) => {
    const partner = partners.find((p) => p.group_id === g.id);
    return { ...g, label: partner?.partner_name ?? g.name };
  });

  return (
    <div className="grid grid-cols-12 min-h-[70vh]">
      {/* 左側：DM一覧 */}
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
          {dmView.map((g) => (
            <li key={g.id}>
              <button
                onClick={() => setActive(g)}
                className={`w-full text-left px-3 py-2 hover:bg-gray-100 ${
                  active?.id === g.id ? "bg-gray-100 font-semibold" : ""
                }`}
              >
                {g.label}
              </button>
            </li>
          ))}
          {dmView.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-500">
              DMがまだありません
            </p>
          )}
        </ul>
      </aside>

      {/* 右側：メッセージ */}
      <main className="col-span-8 flex flex-col">
        <div className="flex items-center justify-between p-3 border-b bg-white">
          <div className="font-bold">
            {active
              ? dmView.find((x) => x.id === active.id)?.label ?? "DM"
              : "DM未選択"}
          </div>
          {active && activePartnerId && (
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
                <p className="whitespace-pre-wrap">{m.body}</p>
                <div className="text-[10px] opacity-60 mt-1">
                  {new Date(m.created_at).toLocaleString()}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">
              左からDMを選択してください
            </p>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="p-3 border-t bg-white flex gap-2">
          <input
            className="flex-1 border rounded px-3 py-2"
            placeholder={
              active ? "メッセージを入力..." : "DMを選択してください"
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

      {/* DM新規作成ダイアログ */}
      {showNewDm && (
        <SelectUserDialog
          onClose={() => setShowNewDm(false)}
          onSelect={(uid, name) => createDm(uid, name)}
        />
      )}

      {/* プロフィール閲覧ダイアログ */}
      {showProfile && activePartnerId && (
        <ProfileViewDialog
          userId={activePartnerId}
          onClose={() => setShowProfile(false)}
        />
      )}
    </div>
  );
}
