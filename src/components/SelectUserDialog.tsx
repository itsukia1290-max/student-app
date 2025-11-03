import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useIsStaff } from "../hooks/useIsStaff";

type UserRow = {
  id: string;
  name: string | null;
  role: "student" | "teacher" | "admin";
  phone: string | null;
};

export default function SelectUserDialog({
  onSelect,
  onClose,
}: {
  onSelect: (userId: string, name: string | null) => void;
  onClose: () => void;
}) {
  const { isStaff } = useIsStaff();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg(null);
      // 教師/管理者は student を一覧、学生は teacher/admin を一覧
      const query = supabase
        .from("profiles")
        .select("id, name, role, phone")
        .eq("is_approved", true);

      if (isStaff) {
        query.eq("role", "student");
      } else {
        query.in("role", ["teacher", "admin"]);
      }

      const { data, error } = await query.order("name", { ascending: true });
      if (error) {
        setMsg("取得に失敗: " + error.message);
      } else {
        setRows((data ?? []) as UserRow[]);
      }
      setLoading(false);
    })();
  }, [isStaff]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) => {
      const name = (r.name ?? "").toLowerCase();
      const phone = (r.phone ?? "").toLowerCase();
      return name.includes(t) || phone.includes(t) || r.id.toLowerCase().includes(t);
    });
  }, [q, rows]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
      <div className="w-[min(720px,95vw)] bg-white rounded-2xl shadow-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">相手を選択</h2>
          <button onClick={onClose} className="px-2 py-1 rounded hover:bg-gray-100">✕</button>
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="名前 / 電話 / ID で検索"
          className="w-full border rounded px-3 py-2 mb-3"
        />

        {loading ? (
          <p className="text-sm text-gray-600">読み込み中...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-500">該当ユーザーがいません。</p>
        ) : (
          <ul className="max-h-[50vh] overflow-y-auto divide-y">
            {filtered.map((u) => (
              <li key={u.id} className="py-2 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-medium truncate">{u.name ?? "（未設定）"}</div>
                  <div className="text-xs text-gray-500">{u.role} / {u.phone ?? "-"}</div>
                </div>
                <button
                  onClick={() => onSelect(u.id, u.name)}
                  className="ml-3 px-3 py-1 rounded bg-black text-white text-sm"
                >
                  選ぶ
                </button>
              </li>
            ))}
          </ul>
        )}

        {msg && <p className="mt-3 text-sm text-red-600">{msg}</p>}
      </div>
    </div>
  );
}
