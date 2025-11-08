// src/pages/StudentDetail.tsx
import { supabase } from "../lib/supabase";
import { useIsStaff } from "../hooks/useIsStaff";
import GoalsSection from "../components/GoalsSection";

type Props = {
  student: {
    id: string;
    name: string | null;
    phone: string | null;
    memo: string | null;
  };
  onBack: () => void;
  onDeleted?: (id: string) => void; // 一覧更新用（親へ通知）
};

export default function StudentDetail({ student, onBack, onDeleted }: Props) {
  const { isStaff } = useIsStaff();

  // 退会（利用停止）
  async function revokeApproval() {
    if (!isStaff) return;
    const ok = confirm(
      `この生徒 (${student.name ?? "未設定"}) を『退会（利用停止）』にしますか？\n再利用には教師の再承認が必要になります。`
    );
    if (!ok) return;

    const { error } = await supabase.rpc("suspend_student", { uid: student.id });
    if (error) {
      // 親が onDeleted ハンドラを渡していれば削除通知、それ以外は一覧へ戻る
      if (onDeleted) onDeleted(student.id);
      else onBack();
    } else {
      alert("退会（利用停止）にしました。再承認されるまでログインできません。");
      onBack();
    }
  }

  // （任意）完全削除を使う場合は有効化
  // async function deleteStudent() {
  //   if (!isStaff) return;
  //   const ok = confirm(
  //     `本当に ${student.name ?? "この生徒"} を完全削除しますか？\n※DMやメッセージも整理されます。`
  //   );
  //   if (!ok) return;
  //   const { error } = await supabase.from("profiles").delete().eq("id", student.id);
  //   if (error) return alert("削除失敗: " + error.message);
  //   onDeleted?.(student.id);
  //   alert("削除しました。");
  //   onBack();
  // }

  return (
    <div className="p-6 space-y-6">
      <button
        onClick={onBack}
        className="border rounded px-3 py-1 hover:bg-gray-100"
      >
        ← 一覧に戻る
      </button>

      {/* 基本情報 */}
      <section className="space-y-1">
        <h1 className="text-2xl font-bold">{student.name ?? "（未設定）"}</h1>
        <p className="text-sm text-gray-600">電話番号: {student.phone ?? "-"}</p>
        <p className="text-sm text-gray-600">メモ: {student.memo ?? "-"}</p>
      </section>

      {/* アクション（退会のみ） */}
      {isStaff && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={revokeApproval}
            className="px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
          >
            退会（利用停止）
          </button>
          {/* 完全削除が必要なら復活させる
          <button
            onClick={deleteStudent}
            className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            生徒アカウントを削除（完全）
          </button>
          */}
        </div>
      )}

      {/* 目標（週・月） — 教師/管理者は編集可 */}
      <section className="mt-4">
        <h2 className="text-lg font-semibold mb-2">目標（週・月）</h2>
        <div className="rounded-xl border bg-white p-4">
          <GoalsSection userId={student.id} editable={isStaff} />
        </div>
      </section>
    </div>
  );
}
