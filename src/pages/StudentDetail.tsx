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
  onDeleted?: (id: string) => void; // 一覧更新用（親へ通知）
};

export default function StudentDetail({ student, onBack, onDeleted }: Props) {
  const { isStaff } = useIsStaff();

  async function approveStudent() {
    if (!isStaff) return;
    const { error } = await supabase
      .from("profiles")
      .update({ is_approved: true })
      .eq("id", student.id);
    if (error) return alert("承認失敗: " + error.message);
    alert("この生徒を承認しました（ログイン可能になります）。");
    onBack();
  }

  async function revokeApproval() {
    if (!isStaff) return;
    const ok = confirm(
      "この生徒を『退会（利用停止）』にしますか？\n再利用には教師の再承認が必要になります。"
    );
    if (!ok) return;
    const { error } = await supabase
      .from("profiles")
      .update({ is_approved: false })
      .eq("id", student.id);
    if (error) return alert("退会処理失敗: " + error.message);
    alert("退会（利用停止）にしました。再承認されるまで閲覧不可です。");
    onBack();
  }

  // 既存：完全削除（必要に応じて使用）
  async function deleteStudent() {
    if (!isStaff) return;
    const ok = confirm(
      `本当に ${student.name ?? "この生徒"} を完全削除しますか？\n※DMやメッセージも整理されます。`
    );
    if (!ok) return;

    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", student.id);
    if (error) {
      alert("削除失敗: " + error.message);
      return;
    }
    onDeleted?.(student.id); // 親の一覧から即時除去
    alert("削除しました。関連DMも自動的に削除されます。");
    onBack();
  }

  return (
    <div className="p-6">
      <button
        onClick={onBack}
        className="border rounded px-3 py-1 mb-4 hover:bg-gray-100"
      >
        ← 一覧に戻る
      </button>

      <h1 className="text-2xl font-bold mb-2">
        {student.name ?? "（未設定）"}
      </h1>
      <p className="text-sm text-gray-600">電話番号: {student.phone ?? "-"}</p>
      <p className="text-sm text-gray-600 mb-4">メモ: {student.memo ?? "-"}</p>

      {isStaff && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={approveStudent}
            className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            承認（利用許可）
          </button>
          <button
            onClick={revokeApproval}
            className="px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
          >
            退会（利用停止）
          </button>

          {/* 任意：完全削除が必要な場合のみ使用 */}
          <button
            onClick={deleteStudent}
            className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            生徒アカウントを削除（完全）
          </button>
        </div>
      )}
    </div>
  );
}
