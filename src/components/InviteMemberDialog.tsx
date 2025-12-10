/*
 * src/components/InviteMemberDialog.tsx
 * Responsibility: 指定したグループに生徒を招待するダイアログ
 * - グループに未所属の承認済み生徒を検索して招待を行う
 */

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Student = {
  id: string;
  name: string | null;
  phone: string | null;
  memo: string | null;
};

export default function InviteMemberDialog({
  groupId,
  onClose,
  onInvited,
}: {
  groupId: string;
  onClose: () => void;
  onInvited?: (userId: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function fetchAll() {
      setLoading(true);
      setMsg(null);

      // 1) 既存メンバーID
      const { data: m, error: me } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId);

      if (me) {
        if (alive) {
          setMsg("メンバー取得に失敗: " + me.message);
          setLoading(false);
        }
        return;
      }
      const memberIds = (m ?? []).map((r) => r.user_id as string);

      // 2) 承認済み・有効な生徒一覧
      const { data: s, error: se } = await supabase
        .from("profiles")
        .select("id, name, phone, memo, role, is_approved, status")
        .eq("role", "student")
        .eq("is_approved", true)
        .eq("status", "active")
        .order("name", { ascending: true });

      if (se) {
        if (alive) {
          setMsg("生徒一覧の取得に失敗: " + se.message);
          setLoading(false);
        }
        return;
      }

      // 3) 既メンバーを除外
      const notYet = (s ?? []).filter((st) => !memberIds.includes(st.id));

      if (alive) {
        setStudents(notYet as Student[]);
        setLoading(false);
      }
    }

    fetchAll();
    return () => {
      alive = false;
    };
  }, [groupId]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return students;
    return students.filter((s) => {
      const name = (s.name ?? "").toLowerCase();
      const phone = (s.phone ?? "").toLowerCase();
      const memo = (s.memo ?? "").toLowerCase();
      return (
        name.includes(t) ||
        phone.includes(t) ||
        memo.includes(t) ||
        s.id.toLowerCase().includes(t)
      );
    });
  }, [q, students]);

  async function invite(userId: string) {
    setMsg(null);
    const { error } = await supabase
      .from("group_members")
      .insert({ group_id: groupId, user_id: userId });

    // 409（重複）は成功扱い
    if (error && !/409|duplicate/i.test(error.message)) {
      setMsg("招待に失敗: " + error.message);
      return;
    }

    // UIから除外
    setStudents((prev) => prev.filter((s) => s.id !== userId));
    onInvited?.(userId);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
      <div className="w-[min(680px,95vw)] bg-white rounded-2xl shadow-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">生徒を招待</h2>
          <button onClick={onClose} className="px-2 py-1 rounded hover:bg-gray-100">
            ✕
          </button>
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="氏名・電話・メモ・ID で検索"
          className="w-full border rounded px-3 py-2 mb-3"
        />

        {loading ? (
          <p className="text-sm text-gray-600">読み込み中...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-500">招待できる生徒が見つかりません。</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-2">氏名</th>
                <th className="text-left p-2">電話番号</th>
                <th className="text-left p-2">メモ</th>
                <th className="p-2 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b">
                  <td className="p-2">{s.name ?? "（未設定）"}</td>
                  <td className="p-2 text-sm text-gray-600">{s.phone ?? "-"}</td>
                  <td className="p-2 text-sm text-gray-600">{s.memo ?? "-"}</td>
                  <td className="p-2">
                    <button
                      onClick={() => invite(s.id)}
                      className="px-3 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
                    >
                      招待
                    </button>
                  </td>
                </tr>
              ))}
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
