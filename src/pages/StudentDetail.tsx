// src/pages/StudentDetail.tsx
import { useEffect, useState } from "react";
import { useIsStaff } from "../hooks/useIsStaff";
import { supabase } from "../lib/supabase";
import StudentGrades from "../components/StudentGrades";
import StudentGoals from "../components/StudentGoals";

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

  // --- プロフィール編集用 state ---
  const [name, setName] = useState<string>(student.name ?? "");
  const [phone, setPhone] = useState<string>(student.phone ?? "");
  const [memo, setMemo] = useState<string>(student.memo ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // 生徒を切り替えたときにフォームをリセット
  useEffect(() => {
    setName(student.name ?? "");
    setPhone(student.phone ?? "");
    setMemo(student.memo ?? "");
    setMsg(null);
    setSaving(false);
  }, [student.id, student.name, student.phone, student.memo]);

  // --- プロフィール保存 ---
  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!isStaff) return;

    setSaving(true);
    setMsg(null);

    const { error } = await supabase
      .from("profiles")
      .update({
        name: name || null,
        phone: phone || null,
        memo: memo || null,
      })
      .eq("id", student.id);

    if (error) {
      setMsg("保存失敗: " + error.message);
    } else {
      setMsg("プロフィールを保存しました。");
    }
    setSaving(false);
  }

  // --- 退会（利用停止） ---
  async function revokeApproval() {
    if (!isStaff) return;
    const ok = confirm(
      `この生徒 (${student.name ?? "未設定"}) を『退会（利用停止）』にしますか？\n再利用には教師の再承認が必要になります。`
    );
    if (!ok) return;
    const { error } = await supabase.rpc("suspend_student", {
      uid: student.id,
    });
    if (error) {
      alert("退会処理失敗: " + error.message);
    } else {
      alert("退会（利用停止）にしました。");
      if (onDeleted) onDeleted(student.id);
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
      <p className="text-sm text-gray-600">
        電話番号: {student.phone ?? "-"}
      </p>
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

      {/* プロフィール編集タブ */}
      {tab === "profile" && (
        <div className="space-y-4">
          <form
            onSubmit={saveProfile}
            className="bg-white border rounded-2xl p-4 space-y-4"
          >
            <div>
              <label className="block text-sm font-medium">氏名</label>
              <input
                className="mt-1 w-full border rounded px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium">電話番号</label>
              <input
                className="mt-1 w-full border rounded px-3 py-2"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium">メモ</label>
              <textarea
                className="mt-1 w-full border rounded px-3 py-2 h-28"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存"}
              </button>
              {msg && <p className="text-sm text-gray-700">{msg}</p>}
            </div>
          </form>

          <div>
            <button
              onClick={revokeApproval}
              className="px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
            >
              退会（利用停止）
            </button>
          </div>
        </div>
      )}

      {/* 成績タブ（教師は編集可） */}
      {tab === "grades" && (
        <div className="bg-white border rounded-2xl p-4">
          <StudentGrades userId={student.id} editable={true} />
        </div>
      )}

      {/* 目標タブ（教師も編集可） */}
      {tab === "goals" && (
        <div className="bg-white border rounded-2xl p-4">
          <StudentGoals userId={student.id} editable={true} />
        </div>
      )}
    </div>
  );
}
