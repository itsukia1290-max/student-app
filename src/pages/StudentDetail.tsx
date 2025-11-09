import { useState } from "react";
import { useIsStaff } from "../hooks/useIsStaff";
import { supabase } from "../lib/supabase";
import StudentGrades from "../components/StudentGrades";
import StudentGoals from "../components/StudentGoals"; // 既に導入済みの目標コンポーネント

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

type Tab = "profile" | "grades" | "goals";

export default function StudentDetail({ student, onBack }: Props) {
  const { isStaff } = useIsStaff();
  const [tab, setTab] = useState<Tab>("profile");

  async function revokeApproval() {
    if (!isStaff) return;
    const ok = confirm(
      `この生徒 (${student.name ?? "未設定"}) を『退会（利用停止）』にしますか？\n再利用には教師の再承認が必要になります。`
    );
    if (!ok) return;
    const { error } = await supabase.rpc("suspend_student", { uid: student.id });
    if (error) alert("退会処理失敗: " + error.message);
    else {
      alert("退会（利用停止）にしました。");
      onBack();
    }
  }

  return (
    <div className="p-6 space-y-4">
      <button
        onClick={onBack}
        className="border rounded px-3 py-1 hover:bg-gray-100"
      >
        ← 一覧に戻る
      </button>

      <h1 className="text-2xl font-bold">
        {student.name ?? "（未設定）"}
      </h1>
      <p className="text-sm text-gray-600">電話番号: {student.phone ?? "-"}</p>
      <p className="text-sm text-gray-600">メモ: {student.memo ?? "-"}</p>

      {/* タブ */}
      <div className="flex gap-2 border-b mt-4">
        <button
          className={`px-3 py-1 rounded-t ${tab === "profile" ? "bg-black text-white" : "border"}`}
          onClick={() => setTab("profile")}
        >
          プロフィール
        </button>
        <button
          className={`px-3 py-1 rounded-t ${tab === "grades" ? "bg-black text-white" : "border"}`}
          onClick={() => setTab("grades")}
        >
          成績
        </button>
        <button
          className={`px-3 py-1 rounded-t ${tab === "goals" ? "bg-black text-white" : "border"}`}
          onClick={() => setTab("goals")}
        >
          目標
        </button>
      </div>

      {/* タブ中身 */}
      {tab === "profile" && (
        <div className="space-y-3">
          <button
            onClick={revokeApproval}
            className="px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
          >
            退会（利用停止）
          </button>
        </div>
      )}

      {tab === "grades" && (
        <div className="bg-white border rounded-2xl p-4">
          {/* 教師側は編集可能 */}
          <StudentGrades userId={student.id} editable={true} />
        </div>
      )}

      {tab === "goals" && (
        <div className="bg-white border rounded-2xl p-4">
          {/* 目標は生徒・教師とも編集OKの要件だったので editable=true */}
          <StudentGoals userId={student.id} editable={true} />
        </div>
      )}
    </div>
  );
}
