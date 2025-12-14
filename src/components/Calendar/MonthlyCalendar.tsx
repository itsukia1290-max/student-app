/*
 * src/components/Calendar/MonthlyCalendar.tsx
 * Responsibility:
 *  - 月表示カレンダー（共通）
 *  - 日付セルに「ラベル」一覧を表示
 *  - 日付クリックで onSelectDate(date) を呼ぶ
 */

type CalendarEvent = {
  date: string;   // "YYYY-MM-DD"
  label: string;  // 表示文字
};

type Props = {
  year: number;
  month: number; // 1-12
  events: CalendarEvent[];
  onSelectDate?: (date: string) => void;
  header?: React.ReactNode;
};

function toDateString(year: number, month: number, day: number) {
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

export default function MonthlyCalendar({
  year,
  month,
  events,
  onSelectDate,
  header,
}: Props) {
  const first = new Date(year, month - 1, 1);
  const startDay = first.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();

  // 週見出し
  const week = ["日", "月", "火", "水", "木", "金", "土"];

  // セル生成（startDay 分の空 + 日数）
  const cells: Array<
    | null
    | {
        day: number;
        date: string;
        items: CalendarEvent[];
      }
  > = [];

  for (let i = 0; i < startDay; i++) cells.push(null);

  for (let d = 1; d <= daysInMonth; d++) {
    const date = toDateString(year, month, d);
    const items = events.filter((e) => e.date === date);
    cells.push({ day: d, date, items });
  }

  // 今日ハイライト（表示月が今日の月のときだけ）
  const now = new Date();
  const isThisMonth =
    now.getFullYear() === year && now.getMonth() + 1 === month;
  const todayDate = isThisMonth
    ? toDateString(year, month, now.getDate())
    : null;

  return (
    <div className="bg-white border rounded-2xl p-3">
      {header ? (
        <div className="mb-3">{header}</div>
      ) : (
        <div className="mb-3 font-bold">
          {year}年 {month}月
        </div>
      )}

      <div className="grid grid-cols-7 gap-1 text-sm">
        {week.map((w) => (
          <div key={w} className="text-center font-semibold text-gray-700">
            {w}
          </div>
        ))}

        {cells.map((c, idx) =>
          c ? (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectDate?.(c.date)}
              className={[
                "text-left border rounded-lg p-2 min-h-[74px] active:scale-[0.99]",
                c.date === todayDate ? "border-black" : "border-gray-200",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold">{c.day}</div>
                {c.items.length > 0 && (
                  <div className="text-[10px] text-gray-500">
                    {c.items.length}件
                  </div>
                )}
              </div>

              <div className="mt-1 space-y-1">
                {c.items.slice(0, 3).map((e, i) => (
                  <div key={i} className="text-[10px] text-gray-700 truncate">
                    • {e.label}
                  </div>
                ))}
                {c.items.length > 3 && (
                  <div className="text-[10px] text-gray-400">
                    …他 {c.items.length - 3}件
                  </div>
                )}
              </div>
            </button>
          ) : (
            <div key={idx} />
          )
        )}
      </div>
    </div>
  );
}
