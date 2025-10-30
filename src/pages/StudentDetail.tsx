import { useState } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  student: { id: string; name: string | null; phone: string | null; memo: string | null };
  onBack: () => void;
  onDeleted?: (id: string) => void; // 利用停止後の一覧更新に使う
};

export default function StudentDetail({ student, onBack, onDeleted }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function suspend() {
    if (!confirm(`「${student.name ?? "（未設定）"}」を利用停止にします。よろしいですか？`)) return;
    setBusy(true);
    setMsg(null);

    const { error } = await supabase.rpc("suspend_student", {
      p_user_id: student.id,
      p_reason: "manual_suspend_by_staff",
    });

    if (error) {
      setMsg("利用停止に失敗: " + error.message);
      setBusy(false);
      return;
    }

    setMsg("利用停止しました。");
    // 一覧から消す（承認済みstudent一覧には出したくないため）
    onDeleted?.(student.id);
    setBusy(false);
    onBack();
  }

  return (
    <div className="p-6 space-y-4">
      <button onClick={onBack} className="px-3 py-1 rounded border">← 一覧へ戻る</button>

      <div>
        <h1 className="text-2xl font-bold">
          {student.name ?? "（未設定）"}
        </h1>
        <div className="text-sm text-gray-600">電話番号: {student.phone ?? "-"}</div>
        <div className="text-sm text-gray-600">メモ: {student.memo ?? "-"}</div>
      </div>

      <div className="flex gap-3">
        {/* ✅ 承認ボタンは削除しました */}
        {/* ✅ 完全削除ボタンも削除しました */}
        <button
          onClick={suspend}
          disabled={busy}
          className="px-4 py-2 rounded bg-amber-600 text-white disabled:opacity-50"
          title="ログイン不可（データは保持）"
        >
          退会（利用停止）
        </button>
      </div>

      {msg && <p className="text-sm text-gray-700">{msg}</p>}
    </div>
  );
}
