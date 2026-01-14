import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import ReportShell from "../components/report/ReportShell";
import ReportGoalsCard from "../components/report/ReportGoalsCard";
import ReportGradesCard from "../components/report/ReportGradesCard";

type Props = {
  // 先生が生徒ページから見る場合などに指定できる
  targetUserId?: string;

  // 先生側編集を許可するか（生徒は false）
  canEditGrades?: boolean;
};

export default function ReportView({ targetUserId, canEditGrades = false }: Props) {
  const [myId, setMyId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      setMyId(user?.id ?? "");
      setLoading(false);
    })();
  }, []);

  const userId = useMemo(() => targetUserId ?? myId, [targetUserId, myId]);

  if (loading) {
    return (
      <div style={{ color: "#64748b", fontWeight: 800, padding: 8 }}>
        読み込み中...
      </div>
    );
  }

  if (!userId) {
    return (
      <div style={{ color: "#ef4444", fontWeight: 900, padding: 8 }}>
        ユーザー情報が取得できませんでした。ログイン状態を確認してください。
      </div>
    );
  }

  return (
    <ReportShell
      title="レポート"
      subtitle="目標・成績をここに集約して、毎回の違和感を消す"
      right={
        <div
          style={{
            fontSize: 12,
            color: "#64748b",
            fontWeight: 900,
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid #e5e7eb",
            background: "#fff",
          }}
        >
          user: {userId.slice(0, 8)}...
        </div>
      }
    >
      {/* ここから "再利用コンポーネント" を並べるだけ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
        {/* ✅ 目標カード：進捗バーの近くに目標追加 */}
        <ReportGoalsCard userId={userId} />

        {/* ✅ 成績カード：既存 StudentGrades を利用 */}
        <ReportGradesCard userId={userId} editable={canEditGrades} />

        {/* 今後ここに追加予定：
            - 今日/今週の学習サマリー
            - 記録（生徒のみ）
            - タイムライン（先生のみ）など
        */}
      </div>
    </ReportShell>
  );
}
