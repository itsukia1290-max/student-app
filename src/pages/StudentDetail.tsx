// src/pages/StudentDetail.tsx
import { supabase } from "../lib/supabase";
import { useIsStaff } from "../hooks/useIsStaff";
import StudentMyPagePanel from "../components/StudentMyPagePanel";

type Props = {
  student: {
    id: string;
    name: string | null;
    phone: string | null;
    memo: string | null;
  };
  onBack: () => void;
  onDeleted?: (id: string) => void;
};

export default function StudentDetail({ student, onBack, onDeleted }: Props) {
  const { isStaff } = useIsStaff();

  async function revokeApproval() {
    if (!isStaff) return;
    const ok = confirm(
      `この生徒 (${student.name ?? "未設定"}) を『退会（利用停止）』にしますか？\n再利用には教師の再承認が必要になります。`
    );
    if (!ok) return;

    const { error } = await supabase.rpc("suspend_student", { uid: student.id });
    if (error) {
      // 失敗時も一覧に戻す/反映（運用に合わせて変更可）
      if (onDeleted) onDeleted(student.id);
      else onBack();
    } else {
      alert("退会（利用停止）にしました。再承認されるまでログインできません。");
      onBack();
    }
  }

  return (
    <div className="p-6 space-y-6">
      <button
        onClick={onBack}
        className="border rounded px-3 py-1 hover:bg-gray-100"
      >
        ← 一覧に戻る
      </button>

      {/* 上段：基本情報（従来の詳細ヘッダ） */}
      <section>
        <h1 className="text-2xl font-bold mb-2">
          {student.name ?? "（未設定）"}
        </h1>
        <p className="text-sm text-gray-600">電話番号: {student.phone ?? "-"}</p>
        <p className="text-sm text-gray-600">メモ: {student.memo ?? "-"}</p>
      </section>

      {/* 中段：マイページ（閲覧）を常時表示 */}
      <section>
        <StudentMyPagePanel studentId={student.id} />
      </section>

      {/* 下段：操作（退会のみ） */}
      {isStaff && (
        <section className="pt-2">
          <button
            onClick={revokeApproval}
            className="px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
          >
            退会（利用停止）
          </button>
        </section>
      )}
    </div>
  );
}
