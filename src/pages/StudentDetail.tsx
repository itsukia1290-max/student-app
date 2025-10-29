// src/pages/StudentDetail.tsx
import { supabase } from "../lib/supabase";
import { useIsStaff } from "../hooks/useIsStaff";

type Props = {
  student: {
    id: string;
    name: string | null;
    phone: string | null;
    memo: string | null;
  };
  onBack: () => void;
  onDeleted?: (id: string) => void;   // ★ 追加：親へ通知
};

export default function StudentDetail({ student, onBack, onDeleted }: Props) {
  const { isStaff } = useIsStaff();

  async function deleteStudent() {
    if (!isStaff) return;
    const ok = confirm(`本当に ${student.name ?? "この生徒"} を削除しますか？`);
    if (!ok) return;

    const { error } = await supabase.from("profiles").delete().eq("id", student.id);
    if (error) {
      alert("削除失敗: " + error.message);
      return;
    }

    // 親へ通知して一覧から即除去
    onDeleted?.(student.id);
    alert("削除しました。関連するDMも自動的に削除されます。");
    onBack();
  }

  return (
    <div className="p-6">
      <button onClick={onBack} className="border rounded px-3 py-1 mb-4 hover:bg-gray-100">
        ← 一覧に戻る
      </button>

      <h1 className="text-2xl font-bold mb-2">{student.name ?? "（未設定）"}</h1>
      <p className="text-sm text-gray-600">電話番号: {student.phone ?? "-"}</p>
      <p className="text-sm text-gray-600 mb-4">メモ: {student.memo ?? "-"}</p>

      {isStaff && (
        <button onClick={deleteStudent} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
          生徒アカウントを削除
        </button>
      )}
    </div>
  );
}
