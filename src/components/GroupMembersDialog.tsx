/*
 * src/components/GroupMembersDialog.tsx
 * Responsibility: グループのメンバー一覧と管理ダイアログ
 * - グループに所属するユーザーを一覧化し、オーナーはメンバー削除が可能
 */

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Member = {
  id: string;              // profiles.id
  name: string | null;
  role: "student" | "teacher" | "admin";
  phone: string | null;
};

export default function GroupMembersDialog({
  groupId,
  isOwner,     // 表示中ユーザーがこのグループの作成者か
  ownerId,     // グループのオーナーの user_id（この人は外せない）
  onClose,
}: {
  groupId: string;
  isOwner: boolean;
  ownerId: string | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setMsg(null);

    const { data: gm, error: ge } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", groupId);

    if (ge) {
      setMsg("メンバー取得に失敗: " + ge.message);
      setLoading(false);
      return;
    }

    const ids = (gm ?? []).map((r) => r.user_id as string);
    if (ids.length === 0) {
      setMembers([]);
      setLoading(false);
      return;
    }

    const { data: ps, error: pe } = await supabase
      .from("profiles")
      .select("id, name, role, phone")
      .in("id", ids);

    if (pe) {
      setMsg("プロフィール取得に失敗: " + pe.message);
      setLoading(false);
      return;
    }

    setMembers((ps ?? []) as Member[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return members;
    return members.filter((m) => {
      const name = (m.name ?? "").toLowerCase();
      const phone = (m.phone ?? "").toLowerCase();
      return (
        name.includes(t) ||
        phone.includes(t) ||
        m.id.toLowerCase().includes(t) ||
        m.role.includes(t)
      );
    });
  }, [q, members]);

  async function removeMember(userId: string) {
    if (!isOwner) return;
    // オーナー本人は外せない
    if (ownerId && userId === ownerId) return;

    const ok = confirm("このメンバーをグループから外しますか？");
    if (!ok) return;

    const { error } = await supabase
      .from("group_members")
      .delete()
      .match({ group_id: groupId, user_id: userId });

    if (error) {
      setMsg("削除に失敗: " + error.message);
      return;
    }
    setMembers((prev) => prev.filter((m) => m.id !== userId));
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
      <div className="w-[min(720px,95vw)] bg-white rounded-2xl shadow-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">メンバー管理</h2>
          <button onClick={onClose} className="px-2 py-1 rounded hover:bg-gray-100">✕</button>
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="名前 / 電話 / ID / 役割 で検索"
          className="w-full border rounded px-3 py-2 mb-3"
        />

        {loading ? (
          <p className="text-sm text-gray-600">読み込み中...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-500">メンバーがいません。</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-2">氏名</th>
                <th className="text-left p-2">役割</th>
                <th className="text-left p-2">電話番号</th>
                <th className="p-2 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const isGroupOwner = ownerId ? m.id === ownerId : false;
                return (
                  <tr key={m.id} className="border-b">
                    <td className="p-2">
                      {m.name ?? "（未設定）"}
                      {isGroupOwner && (
                        <span className="ml-2 text-xs text-indigo-600 border border-indigo-200 bg-indigo-50 rounded px-1">
                          オーナー
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-sm text-gray-600">{m.role}</td>
                    <td className="p-2 text-sm text-gray-600">{m.phone ?? "-"}</td>
                    <td className="p-2">
                      {isOwner && !isGroupOwner ? (
                        <button
                          onClick={() => removeMember(m.id)}
                          className="px-3 py-1 rounded bg-red-600 text-white text-sm hover:bg-red-700"
                        >
                          外す
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">閲覧のみ</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {msg && <p className="mt-3 text-sm text-red-600">{msg}</p>}

        <div className="mt-4 text-right">
          <button onClick={onClose} className="px-3 py-2 rounded border hover:bg-gray-50">
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
