// src/pages/Home.tsx
import { useMemo, useState } from "react";

type Tab = "record" | "timeline";

function Card({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl border p-4">
      {title && <h2 className="font-semibold text-sm mb-3">{title}</h2>}
      {children}
    </section>
  );
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("record");

  // 仮データ（あとで Supabase と接続）
  const todayHours = 0;
  const monthHours = 0;
  const totalHours = 0;

  const weeklyGoal = 10;
  const monthlyGoal = 40;

  const weeklyProgress = useMemo(
    () => (weeklyGoal ? Math.min(100, Math.round((todayHours / weeklyGoal) * 100)) : 0),
    [todayHours, weeklyGoal]
  );

  const monthlyProgress = useMemo(
    () => (monthlyGoal ? Math.min(100, Math.round((monthHours / monthlyGoal) * 100)) : 0),
    [monthHours, monthlyGoal]
  );

  return (
    <div className="space-y-4">
      {/* 記録 / タイムライン 切替 */}
      <div className="bg-white border rounded-2xl p-2">
        <div className="grid grid-cols-2 text-sm">
          <button
            className={`py-2 rounded-xl ${
              tab === "record" ? "bg-black text-white" : "text-gray-600"
            }`}
            onClick={() => setTab("record")}
          >
            記録
          </button>
          <button
            className={`py-2 rounded-xl ${
              tab === "timeline" ? "bg-black text-white" : "text-gray-600"
            }`}
            onClick={() => setTab("timeline")}
          >
            タイムライン
          </button>
        </div>
      </div>

      {tab === "record" ? (
        <>
          {/* 学習推移 */}
          <Card title="学習推移">
            <div className="grid grid-cols-3 bg-gray-50 border rounded-2xl overflow-hidden">
              <div className="p-3 text-center">
                <div className="text-xs text-gray-500">今日</div>
                <div className="text-lg font-bold">{todayHours}時間</div>
              </div>
              <div className="p-3 text-center border-l">
                <div className="text-xs text-gray-500">今月</div>
                <div className="text-lg font-bold">{monthHours}時間</div>
              </div>
              <div className="p-3 text-center border-l">
                <div className="text-xs text-gray-500">総学習時間</div>
                <div className="text-lg font-bold">{totalHours}時間</div>
              </div>
            </div>
            <p className="text-xs text-gray-500 text-center mt-3">
              該当期間のログがありません
            </p>
          </Card>

          {/* 週刊目標 */}
          <Card title="週刊目標">
            <div className="flex justify-between text-sm">
              <span>目標：{weeklyGoal}時間</span>
              <span className="font-semibold">{weeklyProgress}%</span>
            </div>
            <div className="mt-2 h-2 bg-gray-100 rounded-full">
              <div
                className="h-full bg-black rounded-full"
                style={{ width: `${weeklyProgress}%` }}
              />
            </div>
          </Card>

          {/* 月間目標 */}
          <Card title="月間目標">
            <div className="flex justify-between text-sm">
              <span>目標：{monthlyGoal}時間</span>
              <span className="font-semibold">{monthlyProgress}%</span>
            </div>
            <div className="mt-2 h-2 bg-gray-100 rounded-full">
              <div
                className="h-full bg-black rounded-full"
                style={{ width: `${monthlyProgress}%` }}
              />
            </div>
          </Card>

          {/* カレンダー枠 */}
          <Card title="カレンダー">
            <div className="text-sm text-gray-400 text-center py-10">
              （ここにカレンダー）
            </div>
          </Card>
        </>
      ) : (
        <Card title="タイムライン">
          <div className="text-sm text-gray-400 text-center py-10">
            （ここにタイムライン）
          </div>
        </Card>
      )}
    </div>
  );
}
