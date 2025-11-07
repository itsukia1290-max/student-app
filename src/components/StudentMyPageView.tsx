// src/components/StudentMyPageView.tsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  studentId: string;
  onClose: () => void;
};

type Profile = {
  id: string;
  name: string | null;
  phone: string | null;
  memo: string | null;
};

export default function StudentMyPageView({ studentId, onClose }: Props) {
  const [data, setData] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,name,phone,memo")
        .eq("id", studentId)
        .maybeSingle();

      if (error) setErr(error.message);
      else setData(data as Profile);
      setLoading(false);
    })();
  }, [studentId]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-lg">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-bold">生徒マイページ（閲覧）</h3>
          <button className="text-sm border rounded px-2 py-1" onClick={onClose}>
            閉じる
          </button>
        </div>

        <div className="p-4 space-y-3">
          {loading && <div>読み込み中...</div>}
          {err && <div className="text-red-600">読み込み失敗: {err}</div>}
          {data && (
            <>
              <div>
                <div className="text-xs text-gray-500">氏名</div>
                <div className="text-base">{data.name ?? "（未設定）"}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">電話番号</div>
                <div className="text-base">{data.phone ?? "-"}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">メモ</div>
                <div className="whitespace-pre-wrap text-base">
                  {data.memo ?? "-"}
                </div>
              </div>

              {/* ここに成績（閲覧専用）を今後追加予定 */}
              <div className="rounded-xl border p-3 text-gray-500">
                成績（閲覧専用）: まだ未実装
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
