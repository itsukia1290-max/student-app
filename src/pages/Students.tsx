import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useIsStaff } from "../hooks/useIsStaff";
import StudentDetail from "./StudentDetail";

type Student = {
  id: string;
  name: string | null;
  phone: string | null;
  memo: string | null;
  is_approved?: boolean | null;
};

export default function Students() {
  const { isStaff } = useIsStaff();
  const [students, setStudents] = useState<Student[]>([]);
  const [pending, setPending] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);

  useEffect(() => {
    if (!isStaff) return;
    async function load() {
      // 生徒（承認済み）
      const { data: ok, error: e1 } = await supabase
        .from("profiles")
        .select("id, name, phone, memo, role, is_approved")
        .eq("role", "student")
        .eq("is_approved", true);
      if (!e1) setStudents((ok ?? []) as Student[]);

      // 承認待ちの生徒
      const { data: wait, error: e2 } = await supabase
        .from("profiles")
        .select("id, name, phone, memo, role, is_approved")
        .eq("role", "student")
        .neq("is_approved", true); // false or null
      if (!e2) setPending((wait ?? []) as Student[]);
    }
    load();
  }, [isStaff]);

  async function approve(id: string) {
    const { error } = await supabase.from("profiles").update({ is_approved: true }).eq("id", id);
    if (error) return alert("承認失敗: " + error.message);
    // 画面即時反映
    setPending((prev) => prev.filter((p) => p.id !== id));
    const { data } = await supabase.from("profiles").select("id, name, phone, memo").eq("id", id).maybeSingle();
    if (data) setStudents((prev) => [...prev, data as Student]);
  }

  if (!isStaff) {
    return <div className="p-6 text-gray-600">教師または管理者のみ閲覧可能です。</div>;
  }

  if (selected) {
    return (
      <StudentDetail
        student={selected}
        onBack={() => setSelected(null)}
        onDeleted={(id) => {
          setStudents((prev) => prev.filter((s) => s.id !== id));
          setPending((prev) => prev.filter((s) => s.id !== id));
        }}
      />
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* 承認待ちリスト */}
      <section>
        <h2 className="text-lg font-semibold mb-2">承認待ち</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-500">承認待ちはありません。</p>
        ) : (
          <ul className="grid md:grid-cols-2 gap-3">
            {pending.map((p) => (
              <li key={p.id} className="border rounded-lg p-3 bg-white flex items-center justify-between">
                <div>
                  <div className="font-medium">{p.name ?? "（未設定）"}</div>
                  <div className="text-xs text-gray-500">{p.phone ?? "-"}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => approve(p.id)}
                    className="px-3 py-1 rounded bg-green-600 text-white text-sm"
                  >
                    承認
                  </button>
                  <button
                    onClick={() => setSelected(p)}
                    className="px-3 py-1 rounded border text-sm"
                  >
                    詳細
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 承認済み 生徒一覧 */}
      <section>
        <h2 className="text-lg font-semibold mb-2">生徒一覧</h2>
        {students.length === 0 ? (
          <p className="text-gray-500">登録された生徒がいません。</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b bg-gray-100">
                <th className="text-left p-2">氏名</th>
                <th className="text-left p-2">電話番号</th>
                <th className="text-left p-2">メモ</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr
                  key={s.id}
                  className="border-b hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelected(s)}
                >
                  <td className="p-2">{s.name ?? "（未設定）"}</td>
                  <td className="p-2 text-sm text-gray-600">{s.phone ?? "-"}</td>
                  <td className="p-2 text-sm text-gray-600">{s.memo ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
