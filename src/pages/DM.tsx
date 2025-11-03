import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import SelectUserDialog from "../components/SelectUserDialog";

type Group = {
  id: string;
  name: string | null;
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

type Member = { group_id: string; user_id: string };

type PartnerRow = {
  group_id: string;
  partner_id: string;
  partner_name: string | null;
};

export default function DM() {
  const { user } = useAuth();
  const myId = user?.id ?? "";

  const [dmGroups, setDmGroups] = useState<Group[]>([]);
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [active, setActive] = useState<Group | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loadingSend, setLoadingSend] = useState(false);

  const [showNewDm, setShowNewDm] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 自分のDMグループを取得 → 相手の名前を解決
  useEffect(() => {
    if (!myId) return;

    (async () => {
      // 1) 自分が参加しているDMの group_id
      const { data: myDmMemberships, error: e1 } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", myId);
      if (e1) {
        console.error("❌ load my memberships:", e1.message);
        return;
      }
      const groupIds = (myDmMemberships ?? []).map((r) => r.group_id as string);
      if (groupIds.length === 0) {
        setDmGroups([]);
        setPartners([]);
        setActive(null);
        return;
      }

      // 2) groups から type='dm' のみ抜く
      const { data: dmGs, error: e2 } = await supabase
        .from("groups")
        .select("id,name,type,owner_id")
        .in("id", groupIds)
        .eq("type", "dm");
      if (e2) {
        console.error("❌ load dm groups:", e2.message);
        return;
      }
      const dmList = (dmGs ?? []) as Group[];
      setDmGroups(dmList);

      if (dmList.length === 0) {
        setPartners([]);
        setActive(null);
        return;
      }

      // 3) 各DMグループのメンバーを取り、相手（自分以外）のIDを取得
      const { data: allMembers, error: e3 } = await supabase
        .from("group_members")
        .select("group_id,user_id")
        .in("group_id", dmList.map((g) => g.id));
      if (e3) {
        console.error("❌ load members:", e3.message);
        return;
      }
      const members = (allMembers ?? []) as Member[];

      const partnerMap = new Map<string, string>(); // group_id -> partner_id
      for (const g of dmList) {
        const m = members.filter((r) => r.group_id === g.id).map((r) => r.user_id);
        const partner = m.find((uid) => uid !== myId) ?? null;
        if (partner) partnerMap.set(g.id, partner);
      }

      const partnerIds = Array.from(new Set(Array.from(partnerMap.values())));
      if (partnerIds.length === 0) {
        setPartners([]);
        return;
      }

      // 4) 相手のプロフィールで名前を引く
      const { data: profs, error: e4 } = await supabase
        .from("profiles")
        .select("id,name")
        .in("id", partnerIds);
      if (e4) {
        console.error("❌ load partner profiles:", e4.message);
        return;
      }

      const nameById = new Map<string, string | null>();
      (profs ?? []).forEach((p) => nameById.set(p.id as string, (p.name as string) ?? null));

      const viewRows: PartnerRow[] = dmList.map((g) => {
        const partner_id = partnerMap.get(g.id) ?? "";
        return {
          group_id: g.id,
          partner_id,
          partner_name: nameById.get(partner_id) ?? null,
        };
      });

      setPartners(viewRows);

      // アクティブが無ければひとつ目
      if (!active && dmList.length > 0) setActive(dmList[0]);
      // 既存がなくなってたらリセット
      if (active && !dmList.find((x) => x.id === active.id)) setActive(dmList[0] ?? null);
    })();
  }, [myId]); // DM 作成や削除時は適宜この effect を再走させる

  // アクティブDMのメッセージ
  useEffect(() => {
    if (!active?.id) return;
    let dead = false;
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
      if (!dead) {
        setMessages((data ?? []) as Message[]);
        scrollToBottom();
      }
    })();
    return () => {
      dead = true;
    };
  }, [active?.id]);

  // Realtime
  useEffect(() => {
    if (!active?.id) return;
    const ch = supabase
      .channel(`dm:${active.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `group_id=eq.${active.id}` },
        (payload) => {
          const row = payload.new as Message;
          setMessages((prev) => [...prev, row]);
          scrollToBottom();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [active?.id]);

  function scrollToBottom() {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  }

  async function send() {
    if (!active?.id || !myId || !input.trim()) return;
    setLoadingSend(true);
    const { error } = await supabase
      .from("messages")
      .insert({ group_id: active.id, sender_id: myId, body: input.trim() });
    setLoadingSend(false);
    if (error) return console.error("❌ send:", error.message);
    setInput("");
  }

  // 既存DMを探す（相手IDと自分IDの2人だけのdmグループ）
  async function findExistingDm(withUserId: string): Promise<Group | null> {
    // 自分が入っているDMの group_id
    const { data: gmMine, error: e1 } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", myId);
    if (e1) return null;
    const myGroupIds = (gmMine ?? []).map((r) => r.group_id as string);
    if (myGroupIds.length === 0) return null;

    // 相手が入っているDMの group_id
    const { data: gmHis, error: e2 } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", withUserId);
    if (e2) return null;
    const hisGroupIds = (gmHis ?? []).map((r) => r.group_id as string);

    // 積集合 → 同じグループに2人とも居る
    const common = myGroupIds.filter((id) => hisGroupIds.includes(id));
    if (common.length === 0) return null;

    // その中で type='dm' かつ メンバーが2人だけ のものを一つ返す
    const { data: gRows } = await supabase
      .from("groups")
      .select("id,name,type,owner_id")
      .in("id", common)
      .eq("type", "dm")
      .limit(5);

    if (!gRows || gRows.length === 0) return null;

    // 各候補のメンバー数を見て 2人だけなら DM として採用
    for (const g of gRows as Group[]) {
      const { data: ms } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", g.id);
      if ((ms ?? []).length === 2) return g;
    }
    return null;
  }

  // 新規DM作成（相手選択 → 既存チェック → なければ作る）
  async function createDm(withUserId: string, withUserName: string | null) {
    const existing = await findExistingDm(withUserId);
    if (existing) {
      setActive(existing);
      setShowNewDm(false);
      return;
    }

    const newId = crypto.randomUUID();
    // name は 相手の名前表示を基本に（必要なら「◯◯さんとのDM」などにしてもOK）
    const { error: eg } = await supabase
      .from("groups")
      .insert({ id: newId, name: withUserName ?? "DM", type: "dm", owner_id: myId });
    if (eg) return alert("DM作成失敗: " + eg.message);

    // 両者をメンバーに
    const { error: em1 } = await supabase.from("group_members").insert({ group_id: newId, user_id: myId });
    if (em1) return alert("DM作成失敗(自分追加): " + em1.message);

    const { error: em2 } = await supabase.from("group_members").insert({ group_id: newId, user_id: withUserId });
    if (em2) return alert("DM作成失敗(相手追加): " + em2.message);

    // 左の一覧を即時更新
    setDmGroups((prev) => [...prev, { id: newId, name: withUserName ?? "DM", type: "dm", owner_id: myId }]);
    setActive({ id: newId, name: withUserName ?? "DM", type: "dm", owner_id: myId });
    setShowNewDm(false);
  }

  const dmView = useMemo(() => {
    // パートナー名（なければ group.name）で表示
    return dmGroups
      .map((g) => {
        const p = partners.find((x) => x.group_id === g.id);
        const label = p?.partner_name ?? g.name ?? "(DM)";
        return { ...g, label };
      })
      .sort((a, b) => (a.label || "").localeCompare(b.label || ""));
  }, [dmGroups, partners]);

  return (
    <div className="grid grid-cols-12 min-h-[70vh]">
      {/* 左：DM一覧 */}
      <aside className="col-span-4 border-r">
        <div className="flex items-center justify-between p-3">
          <h2 className="font-bold">DM</h2>
          <button
            onClick={() => setShowNewDm(true)}
            className="text-sm border rounded px-2 py-1"
          >
            新しいDM
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
              DM がありません。「新しいDM」から開始できます。
            </p>
          )}
        </ul>
      </aside>

      {/* 右：メッセージ画面 */}
      <main className="col-span-8 flex flex-col">
        <div className="flex items-center justify-between p-3 border-b bg-white">
          <div className="font-bold">{active ? (dmView.find(x => x.id === active.id)?.label ?? "DM") : "DM未選択"}</div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
          {active ? (
            messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[80%] px-3 py-2 rounded ${
                  m.sender_id === myId ? "bg-black text-white ml-auto" : "bg-white border"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.body}</p>
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
          <input
            className="flex-1 border rounded px-3 py-2"
            placeholder={active ? "メッセージを入力..." : "DMを選択してください"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && !e.shiftKey ? (e.preventDefault(), send()) : null
            }
            disabled={!active || loadingSend}
          />
          <button
            onClick={send}
            disabled={!active || loadingSend}
            className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
          >
            送信
          </button>
        </div>
      </main>

      {/* 相手を選ぶダイアログ */}
      {showNewDm && (
        <SelectUserDialog
          onClose={() => setShowNewDm(false)}
          onSelect={(uid, name) => createDm(uid, name)}
        />
      )}
    </div>
  );
}
