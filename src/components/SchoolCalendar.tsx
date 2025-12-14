/*
 * src/components/SchoolCalendar.tsx
 * Responsibility:
 *  - 塾の予定（school_calendar_events）を月カレンダーで表示
 *  - 先生（teacher/admin）は追加できる（簡易フォーム）
 *  - 生徒は閲覧のみ（RLSでINSERT不可）
 */

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import MonthlyCalendar from "./Calendar/MonthlyCalendar";
import Button from "./ui/Button";
import Input, { Textarea } from "./ui/Input";

type Row = {
  id: string;
  title: string;
  description: string | null;
  event_date: string; // "YYYY-MM-DD"
  created_at: string;
};

export default function SchoolCalendar() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const [rows, setRows] = useState<Row[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 追加フォーム（簡易）
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  function prevMonth() {
    const d = new Date(year, month - 2, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  }
  function nextMonth() {
    const d = new Date(year, month, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  }

  async function load() {
    setLoading(true);

    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = new Date(year, month, 1);
    const end = `${endDate.getFullYear()}-${String(
      endDate.getMonth() + 1
    ).padStart(2, "0")}-01`;

    const { data, error } = await supabase
      .from("school_calendar_events")
      .select("id,title,description,event_date,created_at")
      .gte("event_date", start)
      .lt("event_date", end)
      .order("event_date", { ascending: true });

    if (error) {
      console.error("❌ load school_calendar_events:", error.message);
      setRows([]);
    } else {
      setRows((data ?? []) as Row[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const events = useMemo(
    () =>
      rows.map((r) => ({
        date: r.event_date,
        label: r.title,
      })),
    [rows]
  );

  const selectedRows = useMemo(() => {
    if (!selectedDate) return [];
    return rows.filter((r) => r.event_date === selectedDate);
  }, [rows, selectedDate]);

  async function addEvent() {
    if (!selectedDate) return alert("日付を選択してください");
    const t = title.trim();
    if (!t) return alert("タイトルを入力してください");

    setSaving(true);
    const { error } = await supabase.from("school_calendar_events").insert({
      title: t,
      description: desc.trim() || null,
      event_date: selectedDate,
    });

    if (error) {
      alert("保存失敗: " + error.message);
    } else {
      setTitle("");
      setDesc("");
      await load();
    }
    setSaving(false);
  }

  return (
    <div className="space-y-3">
      <MonthlyCalendar
        year={year}
        month={month}
        events={events}
        onSelectDate={(d) => setSelectedDate(d)}
        header={
          <div className="flex items-center justify-between">
            <button className="px-3 py-1 border rounded" onClick={prevMonth}>
              ←
            </button>
            <div className="font-bold">
              {year}年 {month}月（塾カレンダー）
            </div>
            <button className="px-3 py-1 border rounded" onClick={nextMonth}>
              →
            </button>
          </div>
        }
      />

      <div className="bg-white border rounded-2xl p-3">
        <div className="font-semibold mb-2">
          {selectedDate ? `${selectedDate} の予定` : "日付をタップすると詳細が出ます"}
        </div>

        {loading ? (
          <div className="text-sm text-gray-500">読み込み中...</div>
        ) : !selectedDate ? (
          <div className="text-sm text-gray-500">日付を選択してください。</div>
        ) : (
          <>
            {selectedRows.length === 0 ? (
              <div className="text-sm text-gray-500 mb-3">
                予定はありません。
              </div>
            ) : (
              <ul className="space-y-2 mb-3">
                {selectedRows.map((r) => (
                  <li key={r.id} className="border rounded-xl p-3">
                    <div className="font-bold">{r.title}</div>
                    {r.description && (
                      <div className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">
                        {r.description}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* 追加（teacher/adminのみ成功する想定。生徒はRLSで弾かれます） */}
            <div className="border-t pt-3">
              <div className="font-semibold mb-2">予定を追加</div>
              <div className="space-y-2">
                <Input
                  placeholder="タイトル"
                  value={title}
                  onChange={(e) => setTitle((e.target as HTMLInputElement).value)}
                />
                <Textarea
                  placeholder="説明（任意）"
                  className="h-24"
                  value={desc}
                  onChange={(e) =>
                    setDesc((e.target as HTMLTextAreaElement).value)
                  }
                />
                <Button disabled={saving} onClick={addEvent}>
                  {saving ? "保存中..." : "追加"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
