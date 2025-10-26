import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useIsStaff } from "../hooks/useIsStaff";
import StudentDetail from "./StudentDetail";

type Student = {
  id: string;
  name: string | null;
  phone: string | null;
  memo: string | null;
};

export default function Students() {
  const { isStaff } = useIsStaff();   // ★ 教師/管理者のみ閲覧
  const [students, setStudents] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);

  useEffect(() => {
    if (!isStaff) return; // 権限が無ければ何もしない
    async function load() {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, phone, memo, role")
        .in("role", ["student"]); // 生徒のみ
      if (error) {
        console.error("❌ load students:", error.message);
        return;
      }
      setStudents((data ?? []) as Student[]);
    }
    load();
  }, [isStaff]);

  if (selected) {
    return <StudentDetail student={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">生徒一覧</h1>

      {!isStaff ? (
        <p className="text-gray-600">教師または管理者のみ閲覧可能です。</p>
      ) : students.length === 0 ? (
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
    </div>
  );
}
