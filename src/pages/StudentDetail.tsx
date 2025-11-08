import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useIsStaff } from "../hooks/useIsStaff";
import GoalsSection from "../components/GoalsSection";
import StudentProfileEditor from "../components/StudentProfileEditor.tsx"; // ← ★ .tsx を追加
import StudentGrades from "../components/StudentGrades.tsx"; // ← ★ .tsx を追加

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
      if (onDeleted) onDeleted(student.id);
      else onBack();
    } else {
      alert("退会（利用停止）にしました。");
      onBack();
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="border rounded px-3 py-1 hover:bg-gray-100"
        >
          ← 一覧に戻る
        </button>

        {isStaff && (
          <div className="flex gap-2">
            <button
              onClick={revokeApproval}
              className="px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
            >
              退会（利用停止）
            </button>
          </div>
        )}
      </div>

      <section className="space-y-1">
        <h1 className="text-2xl font-bold">{student.name ?? "（未設定）"}</h1>
        <p className="text-sm text-gray-600">電話番号: {student.phone ?? "-"}</p>
        <p className="text-sm text-gray-600">メモ: {student.memo ?? "-"}</p>
      </section>

      {/* タブ */}
      <div className="flex gap-2 border-b bg-white p-3 rounded-lg">
        <button
          className={`px-3 py-1 rounded ${tab === "profile" ? "bg-black text-white" : "border"}`}
          onClick={() => setTab("profile")}
        >
          プロフィール
        </button>
        <button
          className={`px-3 py-1 rounded ${tab === "grades" ? "bg-black text-white" : "border"}`}
          onClick={() => setTab("grades")}
        >
          成績
        </button>
        <button
          className={`px-3 py-1 rounded ${tab === "goals" ? "bg-black text-white" : "border"}`}
          onClick={() => setTab("goals")}
        >
          目標
        </button>
      </div>

      {/* コンテンツ */}
      {tab === "profile" && (
        <section className="rounded-xl border bg-white p-4">
          <StudentProfileEditor userId={student.id} />
        </section>
      )}

      {tab === "grades" && (
        <section className="rounded-xl border bg-white p-4">
          <StudentGrades userId={student.id} editable={isStaff} />
        </section>
      )}

      {tab === "goals" && (
        <section className="rounded-xl border bg-white p-4">
          <GoalsSection userId={student.id} editable={isStaff} />
        </section>
      )}
    </div>
  );
}
