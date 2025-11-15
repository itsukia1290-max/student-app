// src/pages/StudentDetail.tsx
import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useIsStaff } from "../hooks/useIsStaff";
import StudentGrades from "../components/StudentGrades";
import StudentGoals from "../components/StudentGoals";

type Student = {
  id: string;
  name: string | null;
  phone: string | null;
  memo: string | null;
};

type Props = {
  student: Student;
  onBack: () => void;
  /** 退会や削除などで一覧から取り除きたいときに親へ通知 */
  onDeleted?: (id: string) => void;
};

type Tab = "profile" | "grades" | "goals";

export default function StudentDetail({ student, onBack, onDeleted }: Props) {
  const { isStaff } = useIsStaff();
  const [tab, setTab] = useState<Tab>("profile");

  async function revokeApproval() {
    if (!isStaff) return;
    const ok = confirm(
      `この生徒 (${student.name ?? "未設定"}) を『退会（利用停止）』にしますか？\n再利用には教師の再承認が必要になります。`
    );
    if (!ok) return;

    const { error } = await supabase.rpc("suspend_student", { uid: student.id });
    if (error) {
      alert("退会処理失敗: " + error.message);
      return;
    }

    alert("退会（利用停止）にしました。再承認されるまでログインできません。");
    // ★ 親へ削除通知（一覧から即時反映）。無ければ何もしない
    onDeleted?.(student.id);
    // 詳細画面を閉じて一覧へ戻る
    onBack();
  }

  return (
    <div className="p-6 space-y-4">
      <button
        onClick={onBack}
        className="border rounded px-3 py-1 hover:bg-gray-100"
      >
        ← 一覧に戻る
      </button>

      <h1 className="text-2xl font-bold">{student.name ?? "（未設定）"}</h1>
      <p className="text-sm text-gray-600">電話番号: {student.phone ?? "-"}</p>
      <p className="text-sm text-gray-600">メモ: {student.memo ?? "-"}</p>

      {/* タブ */}
      <div className="flex gap-2 border-b mt-4">
        <button
          className={`px-3 py-1 rounded-t ${
            tab === "profile" ? "bg-black text-white" : "border"
          }`}
          onClick={() => setTab("profile")}
        >
          プロフィール
        </button>
        <button
          className={`px-3 py-1 rounded-t ${
            tab === "grades" ? "bg-black text-white" : "border"
          }`}
          onClick={() => setTab("grades")}
        >
          成績
        </button>
        <button
          className={`px-3 py-1 rounded-t ${
            tab === "goals" ? "bg-black text-white" : "border"
          }`}
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
          {/* 先生側は編集可能 */}
          <StudentGrades userId={student.id} editable={true} />
        </div>
      )}

      {tab === "goals" && (
        <div className="bg-white border rounded-2xl p-4">
          {/* 目標は先生が編集可（要件に合わせてtrue） */}
          <StudentGoals userId={student.id} editable={true} />
        </div>
      )}
    </div>
  );
}
