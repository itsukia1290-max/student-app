// src/pages/Home.tsx
/*
 * Responsibility: ホームダッシュボード（スマホ優先）
 * - 学習サマリー（今日 / 今月 / 直近7日）
 * - 週刊目標・月間目標
 * - カレンダー（当月、学習した日は●）
 * Note: ナビゲーションは App.tsx の下部固定帯で行う（Home内のショートカットは廃止）
 */

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

type TrendDay = {
  date: string;   // "YYYY-MM-DD"
  label: string;  // "2/10"
  minutes: number;
};

export default function Home() {
  const { user } = useAuth();

  const [todayMinutes, setTodayMinutes] = useState(0);
  const [monthMinutes, setMonthMinutes] = useState(0);
  const [trend, setTrend] = useState<TrendDay[]>([]);
  const [dayMinutesMap, setDayMinutesMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    (async () => {
      setLoading(true);
      setLoadError(null);

      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthStartStr = monthStart.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("study_logs")
        .select("studied_at, minutes")
        .eq("student_id", user.id)
        .gte("studied_at", monthStartStr)
        .lte("studied_at", todayStr);

      if (error) {
        console.error("❌ load study_logs:", error.message);
        setLoadError("学習記録の読み込みに失敗しました。");
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as { studied_at: string; minutes: number }[];

      const dayMap: Record<string, number> = {};
      let todayTotal = 0;
      let monthTotal = 0;

      for (const r of rows) {
        const d = r.studied_at.slice(0, 10);
        const m = r.minutes ?? 0;
        dayMap[d] = (dayMap[d] ?? 0) + m;
        monthTotal += m;
        if (d === todayStr) todayTotal += m;
      }

      const trendArr: TrendDay[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const minutes = dayMap[key] ?? 0;
        const label = `${d.getMonth() + 1}/${d.getDate()}`;
        trendArr.push({ date: key, label, minutes });
      }

      setDayMinutesMap(dayMap);
      setTodayMinutes(todayTotal);
      setMonthMinutes(monthTotal);
      setTrend(trendArr);
      setLoading(false);
    })();
  }, [user]);

  function formatMinutes(mins: number): string {
    if (!mins) return "0分";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}時間${m}分`;
    if (h > 0) return `${h}時間`;
    return `${m}分`;
  }

  const calendar = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1);
    const firstWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: { day: number | null; dateKey: string | null }[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push({ day: null, dateKey: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month, d);
      const key = dt.toISOString().slice(0, 10);
      cells.push({ day: d, dateKey: key });
    }

    return { year, month: month + 1, cells, today: now.getDate() };
  }, []);

  const maxTrendMinutes = useMemo(() => {
    if (trend.length === 0) return 0;
    return Math.max(...trend.map((t) => t.minutes));
  }, [trend]);

  return (
    <main className="pb-6 pt-2 space-y-4">
      {/* 学習サマリー */}
      <section className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white rounded-2xl border px-3 py-2">
            <p className="text-xs text-gray-500">今日の学習時間</p>
            <p className="text-lg font-bold mt-1">{formatMinutes(todayMinutes)}</p>
          </div>
          <div className="bg-white rounded-2xl border px-3 py-2">
            <p className="text-xs text-gray-500">今月の学習時間</p>
            <p className="text-lg font-bold mt-1">{formatMinutes(monthMinutes)}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border px-3 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500">直近7日間の学習推移</p>
            {loading && <span className="text-[10px] text-gray-400">読み込み中…</span>}
          </div>

          {loadError ? (
            <p className="text-xs text-red-500">{loadError}</p>
          ) : trend.length === 0 ? (
            <p className="text-xs text-gray-500">まだ今月の学習記録がありません。</p>
          ) : (
            <div className="flex items-end gap-1 h-24">
              {trend.map((t) => {
                const ratio = maxTrendMinutes > 0 ? t.minutes / maxTrendMinutes : 0;
                const height = Math.max(ratio * 80, t.minutes > 0 ? 8 : 0);
                return (
                  <div key={t.date} className="flex flex-col items-center justify-end flex-1">
                    <div className="w-4 rounded-t bg-green-500" style={{ height: `${height}px` }} />
                    <span className="mt-1 text-[9px] text-gray-500">{t.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 週刊 / 月間目標 */}
      <section className="space-y-3">
        <div className="bg-white rounded-2xl border px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">週刊目標</p>
          <p className="text-sm text-gray-700">
            （ここは次に、目標データと連動して「今週 〇/〇時間」のように表示できます）
          </p>
        </div>

        <div className="bg-white rounded-2xl border px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">月間目標</p>
          <p className="text-sm text-gray-700">
            （ここも次に、月間目標時間と今月実績を出せます）
          </p>
        </div>
      </section>

      {/* カレンダー */}
      <section className="bg-white rounded-2xl border px-3 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-gray-500">
            カレンダー（{calendar.year}年{calendar.month}月）
          </p>
          <span className="text-[10px] text-gray-400">●：学習記録あり</span>
        </div>

        <div className="grid grid-cols-7 text-center text-[10px] text-gray-500 mb-1">
          <span>日</span><span>月</span><span>火</span><span>水</span><span>木</span><span>金</span><span>土</span>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {calendar.cells.map((c, idx) => {
            if (c.day === null) return <div key={idx} className="h-8" />;
            const isToday = c.day === calendar.today;
            const hasStudy = c.dateKey && (dayMinutesMap[c.dateKey] ?? 0) > 0;

            return (
              <div
                key={idx}
                className={`h-8 flex flex-col items-center justify-center rounded ${
                  isToday ? "bg-green-50 border border-green-500" : "border border-transparent"
                }`}
              >
                <span className={`text-[11px] ${isToday ? "text-green-700 font-semibold" : "text-gray-700"}`}>
                  {c.day}
                </span>
                {hasStudy && <span className="mt-[1px] text-[8px] text-green-600">●</span>}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
