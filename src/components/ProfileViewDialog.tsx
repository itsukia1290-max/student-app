import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Profile = {
  id: string;
  name: string | null;
  phone: string | null;
  memo: string | null;
  role: "student" | "teacher" | "admin";
};

export default function ProfileViewDialog({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const [p, setP] = useState<Profile | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg(null);
      const { data, error } = await supabase
        .from("profiles")
        .select("id,name,phone,memo,role")
        .eq("id", userId)
        .maybeSingle();
      if (error) setMsg("プロフィール取得に失敗: " + error.message);
      setP((data ?? null) as Profile | null);
      setLoading(false);
    })();
  }, [userId]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
      <div className="w-[min(560px,95vw)] bg-white rounded-2xl shadow-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">プロフィール（閲覧専用）</h2>
          <button onClick={onClose} className="px-2 py-1 rounded hover:bg-gray-100">✕</button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-600">読み込み中...</p>
        ) : msg ? (
          <p className="text-sm text-red-600">{msg}</p>
        ) : !p ? (
          <p className="text-sm text-gray-500">プロフィールが見つかりません。</p>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-500">氏名</div>
              <div className="font-medium">{p.name ?? "（未設定）"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">役割</div>
              <div className="font-medium">{p.role}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">電話番号</div>
              <div className="font-medium">{p.phone ?? "-"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">メモ</div>
              <div className="whitespace-pre-wrap">{p.memo ?? "-"}</div>
            </div>

            <p className="text-xs text-gray-400 mt-4">
              ※ この画面は閲覧専用です（編集不可）。編集はご自身の「MyPage」から行ってください。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
