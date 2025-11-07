// src/pages/StudentDetail.tsx
import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useIsStaff } from "../hooks/useIsStaff";
import StudentMyPageView from "../components/StudentMyPageView";

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
  const [showView, setShowView] = useState(false); // ★ 追加

  async function revokeApproval() {
    if (!isStaff) return;
    const ok = confirm(
      `この生徒 (${student.name ?? "未設定"}) を『退会（利用停止）』にしますか？\n再利用には教師の再承認が必要になります。`
    );
    if (!ok) return;

    const { error } = await supabase.rpc("suspend_student", { uid: student.id });
    if (error) {
      if (onDeleted) onDeleted(student.id);
      else onBack();
    } else {
      alert("退会（利用停止）にしました。再承認されるまでログインできません。");
      onBack();
    }
  }

  return (
    <div className="p-6">
      <button onClick={onBack} className="border rounded px-3 py-1 mb-4 hover:bg-gray-100">
        ← 一覧に戻る
      </button>

      <h1 className="text-2xl font-bold mb-2">{student.name ?? "（未設定）"}</h1>
      <p className="text-sm text-gray-600">電話番号: {student.phone ?? "-"}</p>
      <p className="text-sm text-gray-600 mb-4">メモ: {student.memo ?? "-"}</p>

      <div className="flex flex-wrap gap-2">
        {/* ★ マイページ（閲覧）ボタン */}
        <button
          onClick={() => setShowView(true)}
          className="px-3 py-2 border rounded hover:bg-gray-50"
        >
          マイページを閲覧
        </button>

        {/* 退会ボタンは従来どおり */}
        <button
          onClick={revokeApproval}
          className="px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
        >
          退会（利用停止）
        </button>
      </div>

      {showView && (
        <StudentMyPageView
          studentId={student.id}
          onClose={() => setShowView(false)}
        />
      )}
    </div>
  );
}
