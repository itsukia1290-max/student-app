/*
 * src/pages/Students.tsx
 * - 教師/管理者: 承認待ち + 承認済み生徒一覧
 * - 生徒を選択すると StudentDetail を表示
 */
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

type PendingReq = {
  id: string;
  user_id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  created_at: string;
};

export default function Students() {
  const { isStaff } = useIsStaff();
  const [students, setStudents] = useState<Student[]>([]);
  const [pending, setPending] = useState<PendingReq[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);

  useEffect(() => {
    if (!isStaff) return;

    (async () => {
      const { data: ok, error: e1 } = await supabase
        .from("profiles")
        .select("id, name, phone, memo, role, is_approved, status")
        .eq("role", "student")
        .eq("is_approved", true)
        .eq("status", "active")
        .order("name", { ascending: true });

      if (!e1) setStudents((ok ?? []) as Student[]);

      const { data: wait, error: e2 } = await supabase
        .from("approval_requests")
        .select("id, user_id, email, name, phone, created_at")
        .is("resolved_at", null)
        .order("created_at", { ascending: true });

      if (!e2) setPending((wait ?? []) as PendingReq[]);
    })();
  }, [isStaff]);

  async function approve(req: PendingReq) {
    const { error } = await supabase.rpc("approve_student", {
      p_user_id: req.user_id,
    });
    if (error) {
      alert("承認失敗: " + error.message);
      return;
    }

    setPending((prev) => prev.filter((p) => p.id !== req.id));

    const { data: prof, error: pe } = await supabase
      .from("profiles")
      .select("id, name, phone, memo")
      .eq("id", req.user_id)
      .maybeSingle();

    if (!pe && prof) {
      setStudents((prev) => [...prev, prof as Student]);
    } else {
      const { data: ok2 } = await supabase
        .from("profiles")
        .select("id, name, phone, memo")
        .eq("role", "student")
        .eq("is_approved", true)
        .eq("status", "active")
        .order("name", { ascending: true });

      setStudents((ok2 ?? []) as Student[]);
    }

    alert("生徒を承認しました。ログイン可能になります。");
  }

  async function reject(req: PendingReq) {
    const { error } = await supabase
      .from("approval_requests")
      .update({ approved: false, resolved_at: new Date().toISOString() })
      .eq("id", req.id);

    if (error) return alert("却下失敗: " + error.message);

    setPending((prev) => prev.filter((p) => p.id !== req.id));
    alert("承認リクエストを却下しました。");
  }

  if (!isStaff) {
    return <div className="p-6 text-gray-600">教師または管理者のみ閲覧可能です。</div>;
  }

  if (selected) {
    return <StudentDetail student={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="p-6 space-y-8">
      {/* 承認待ち */}
      <section>
        <h2 className="text-lg font-semibold mb-2">承認待ち</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-500">承認待ちはありません。</p>
        ) : (
          <ul className="grid md:grid-cols-2 gap-3">
            {pending.map((p) => (
              <li key={p.id} className="border rounded-lg p-3 bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{p.name ?? "(氏名未設定)"}</div>
                    <div className="text-xs text-gray-500">{p.email ?? "-"}</div>
                    <div className="text-xs text-gray-500">{p.phone ?? "-"}</div>
                    <div className="text-[10px] text-gray-400 mt-1">
                      申請: {new Date(p.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => approve(p)} className="btn text-sm bg-green-600">
                      承認
                    </button>
                    <button onClick={() => reject(p)} className="btn-ghost text-sm">
                      却下
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 生徒一覧 */}
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
