// src/components/StudentMyPagePanel.tsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  studentId: string;
};

type Profile = {
  id: string;
  name: string | null;
  phone: string | null;
  memo: string | null;
};

export default function StudentMyPagePanel({ studentId }: Props) {
  const [data, setData] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,name,phone,memo")
        .eq("id", studentId)
        .maybeSingle();

      if (!alive) return;
      if (error) setErr(error.message);
      else setData(data as Profile);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [studentId]);

  return (
    <div className="rounded-2xl border bg-white">
      <div className="px-4 py-3 border-b font-semibold">マイページ（閲覧）</div>
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

            {/* 今後ここに“成績（閲覧専用）”を組み込み予定 */}
            <div className="rounded-xl border p-3 text-gray-500">
              成績（閲覧専用）: まだ未実装
            </div>
          </>
        )}
      </div>
    </div>
  );
}
