import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

type Props = {
  student: {
    id: string;
    name: string | null;
    phone: string | null;
    memo: string | null;
  };
  onBack: () => void;
};

export default function StudentDetail({ student, onBack }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // 既存DMを探し、無ければ作成して遷移
  async function openDM() {
    if (!user) return;
    setLoading(true);
    setMsg(null);

    try {
      // 1) 自分が入っているグループID一覧
      const { data: mine, error: e1 } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user.id);
      if (e1) throw e1;
      const myGroupIds = new Set((mine ?? []).map((r) => r.group_id as string));

      // 2) 生徒が入っているグループID一覧
      const { data: his, error: e2 } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", student.id);
      if (e2) throw e2;
      const studentGroupIds = new Set(
        (his ?? []).map((r) => r.group_id as string)
      );

      // 3) 交差（両方がメンバー）
      const both: string[] = [];
      myGroupIds.forEach((id) => {
        if (studentGroupIds.has(id)) both.push(id);
      });

      // 4) 交差の中から type='dm' を1件探す
      let dmId: string | null = null;
      for (const gid of both) {
        const { data: g, error: eg } = await supabase
          .from("groups")
          .select("id, type")
          .eq("id", gid)
          .maybeSingle();
        if (eg) throw eg;
        if (g && g.type === "dm") {
          dmId = g.id as string;
          break;
        }
      }

      // 5) 無ければ作成（先にUUID発行→members追加）
      if (!dmId) {
        const newId = crypto.randomUUID();
        const { error: ge } = await supabase
          .from("groups")
          .insert({
            id: newId,
            name: `${(student.name ?? "生徒")}とのDM`,
            type: "dm",
            owner_id: user.id,
          });
        if (ge) throw ge;

        const { error: me } = await supabase
          .from("group_members")
          .insert([
            { group_id: newId, user_id: user.id },
            { group_id: newId, user_id: student.id },
          ]);
        if (me) throw me;

        dmId = newId;
      }

      // 6) 遷移（仕様のURLに合わせる）
      window.location.href = `/app/talk?view=dm&gid=${dmId}`;
    } catch (e) {
      console.error(e);
      setMsg("DMを開く処理に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6">
      <button onClick={onBack} className="mb-4 border rounded px-3 py-1">
        ← 戻る
      </button>

      <h1 className="text-2xl font-bold mb-2">{student.name ?? "（未設定）"}</h1>
      <p className="text-gray-600 mb-1">電話番号: {student.phone ?? "-"}</p>
      <p className="text-gray-600 mb-4">メモ: {student.memo ?? "-"}</p>

      <button
        onClick={openDM}
        disabled={loading}
        className="px-4 py-2 bg-black text-white rounded disabled:opacity-50"
      >
        {loading ? "開いています..." : "個別相談を開く（DM）"}
      </button>
      {msg && <p className="mt-2 text-sm text-red-600">{msg}</p>}
    </div>
  );
}
