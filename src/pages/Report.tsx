/*
 * src/pages/Report.tsx
 * - 生徒向け「レポート」ページ（記録/タイムライン）
 * - 学習時間サマリ + 週/月目標 + カレンダー + 日別内訳
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

// 既にあるなら差し替えてOK（無いなら下のプレースホルダが表示される）
import CalendarBoard from "../components/CalendarBoard";

type StudyLog = {
  id: string;
  user_id: string;
  subject: string;
  minutes: number;
  studied_at: string; // YYYY-MM-DD
  memo: string | null;
  created_at: string;
};

type Tab = "record" | "timeline";

function toYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtHours(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
      <div className="h-full bg-black" style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white px-3 py-3 text-center">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="mt-1 text-base font-bold">{value}</div>
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 rounded-xl border text-sm font-semibold ${
        active ? "bg-black text-white" : "bg-white"
      }`}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </button>
  );
}

export default function Report() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("record");

  const [todayMin, setTodayMin] = useState(0);
  const [monthMin, setMonthMin] = useState(0);
  const [totalMin, setTotalMin] = useState(0);

  const [selectedDay, setSelectedDay] = useState<string>(toYmd(new Date()));
  const [dayLogs, setDayLogs] = useState<StudyLog[]>([]);
  const [loadingDay, setLoadingDay] = useState(false);

  // 目標（いったん固定。後で goals テーブル等にしてOK）
  const weeklyTargetMin = 10 * 60;
  const monthlyTargetMin = 40 * 60;

  const todayYmd = useMemo(() => toYmd(new Date()), []);
  const monthPrefix = useMemo(() => todayYmd.slice(0, 7), [todayYmd]); // YYYY-MM

  // サマリ（今日/今月/総学習）
  useEffect(() => {
    if (!user) return;

    (async () => {
      const { data, error } = await supabase
        .from("study_logs")
        .select("minutes, studied_at")
        .eq("user_id", user.id);

      if (error || !data) return;

      const rows = data as { minutes?: number; studied_at?: string }[];
      const total = rows.reduce((s, r) => s + (r.minutes ?? 0), 0);
      const today = rows
        .filter((r) => r.studied_at === todayYmd)
        .reduce((s, r) => s + (r.minutes ?? 0), 0);
      const month = rows
        .filter((r) => String(r.studied_at).startsWith(monthPrefix))
        .reduce((s, r) => s + (r.minutes ?? 0), 0);

      setTotalMin(total);
      setTodayMin(today);
      setMonthMin(month);
    })();
  }, [user, todayYmd, monthPrefix]);

  // 選択日の内訳
  useEffect(() => {
    if (!user) return;

    (async () => {
      setLoadingDay(true);
      const { data, error } = await supabase
        .from("study_logs")
        .select("id,user_id,subject,minutes,studied_at,memo,created_at")
        .eq("user_id", user.id)
        .eq("studied_at", selectedDay)
        .order("created_at", { ascending: true });

      if (!error && data) setDayLogs(data as StudyLog[]);
      else setDayLogs([]);
      setLoadingDay(false);
    })();
  }, [user, selectedDay]);

  const dayTotalMin = useMemo(
    () => dayLogs.reduce((s, r) => s + (r.minutes ?? 0), 0),
    [dayLogs]
  );

  // ※週の集計は暫定で「今月」を代用（後で週集計を入れる）
  const weekProgress = Math.min(1, monthMin / weeklyTargetMin);
  const monthProgress = Math.min(1, monthMin / monthlyTargetMin);

  if (!user) return null;

  return (
    // 下部固定帯に隠れないように “安全な下余白” を確保
    <div className="px-3 pt-3 pb-[calc(88px+env(safe-area-inset-bottom))] space-y-3">
      {/* タブ（記録/タイムライン） - ページ上部に配置 */}
      <section className="flex gap-2">
        <TabButton active={tab === "record"} onClick={() => setTab("record")}>
          記録
        </TabButton>
        <TabButton active={tab === "timeline"} onClick={() => setTab("timeline")}>
          タイムライン
        </TabButton>
      </section>

      {/* 上段：学習推移（カード3つ） */}
      <section>
        <div className="text-sm font-semibold mb-2">学習推移</div>
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="今日" value={fmtHours(todayMin)} />
          <StatCard label="今月" value={fmtHours(monthMin)} />
          <StatCard label="総学習時間" value={fmtHours(totalMin)} />
        </div>
      </section>

      {tab === "record" ? (
        <div className="space-y-3">
          {/* 週目標 */}
          <section className="rounded-2xl border bg-white p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-sm">週刊目標</div>
              <div className="text-xs text-gray-600">{Math.round(weekProgress * 100)}%</div>
            </div>
            <div className="text-xs text-gray-600">目標：{fmtHours(weeklyTargetMin)}</div>
            <ProgressBar value={weekProgress} />
          </section>

          {/* 月目標 */}
          <section className="rounded-2xl border bg-white p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-sm">月間目標</div>
              <div className="text-xs text-gray-600">{Math.round(monthProgress * 100)}%</div>
            </div>
            <div className="text-xs text-gray-600">目標：{fmtHours(monthlyTargetMin)}</div>
            <ProgressBar value={monthProgress} />
          </section>

          {/* カレンダー */}
          <section className="rounded-2xl border bg-white p-4 space-y-3">
            <div className="font-semibold text-sm">カレンダー</div>

            {/* あなたのカレンダーコンポーネントがあるならここで表示 */}
            {CalendarBoard ? (
              <CalendarBoard
                viewerRole="student"
                ownerUserId={user.id}
                canEditPersonal={true}
                canEditSchool={false}
                onSelectDay={(ymd: string) => setSelectedDay(ymd)}
                selectedDay={selectedDay}
              />
            ) : (
              <div className="text-sm text-gray-500 border rounded-xl p-4">
                （ここにカレンダー）
              </div>
            )}

            {/* 選択日の内訳 */}
            <div className="border-t pt-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{selectedDay} の学習</div>
                <div className="text-sm font-bold">{fmtHours(dayTotalMin)}</div>
              </div>

              {loadingDay ? (
                <div className="text-sm text-gray-500 mt-2">読み込み中...</div>
              ) : dayLogs.length === 0 ? (
                <div className="text-sm text-gray-500 mt-2">該当日のログがありません</div>
              ) : (
                <ul className="mt-2 space-y-2">
                  {dayLogs.map((r) => (
                    <li key={r.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{r.subject}</div>
                        {r.memo && <div className="text-xs text-gray-500 wrap-break-word">{r.memo}</div>}
                      </div>
                      <div className="text-sm font-semibold whitespace-nowrap">
                        {fmtHours(r.minutes)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      ) : (
        <section className="rounded-2xl border bg-white p-4">
          <div className="font-semibold text-sm mb-2">タイムライン</div>
          <div className="text-sm text-gray-500">（ここは後で実装）</div>
        </section>
      )}
    </div>
  );
}
