import { useEffect, useMemo, useState } from "react";
import Button from "./ui/Button";
import Input from "./ui/Input";
import { supabase } from "../lib/supabase";

type Workbook = {
  id: string;
  user_id: string;
  title: string;
  total_problems: number;
  created_at: string;
};

type ProgressRow = {
  user_id: string;
  workbook_id: string;
  problem_no: number;
  status: "correct" | "partial" | "wrong";
  updated_at: string;
};

function statusToMark(s: ProgressRow["status"]) {
  if (s === "correct") return "○";
  if (s === "partial") return "△";
  return "×";
}

function nextStatus(s: ProgressRow["status"]): ProgressRow["status"] {
  if (s === "wrong") return "partial";
  if (s === "partial") return "correct";
  return "wrong";
}

export default function WorkbookTracker({
  userId,
  editable,
}: {
  userId: string;
  editable: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [workbooks, setWorkbooks] = useState<Workbook[]>([]);
  const [progressMap, setProgressMap] = useState<
    Record<string, Record<number, ProgressRow>>
  >({}); // workbook_id -> problem_no -> row

  // 追加フォーム
  const [title, setTitle] = useState("");
  const [total, setTotal] = useState<number>(10);

  // 読み込み
  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);

      // 問題集一覧
      const { data: wbs, error: e1 } = await supabase
        .from("workbooks")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (e1) {
        console.error("❌ load workbooks:", e1.message);
        setLoading(false);
        return;
      }
      const list = (wbs ?? []) as Workbook[];
      setWorkbooks(list);

      // 進捗まとめて
      if (list.length > 0) {
        const wbIds = list.map((w) => w.id);
        const { data: rows, error: e2 } = await supabase
          .from("workbook_progress")
          .select("*")
          .eq("user_id", userId)
          .in("workbook_id", wbIds);

        if (e2) {
          console.error("❌ load progress:", e2.message);
          setLoading(false);
          return;
        }

        const map: Record<string, Record<number, ProgressRow>> = {};
        (rows ?? []).forEach((r) => {
          const wr = r as unknown as ProgressRow;
          if (!map[wr.workbook_id]) map[wr.workbook_id] = {};
          map[wr.workbook_id][wr.problem_no] = wr;
        });
        setProgressMap(map);
      } else {
        setProgressMap({});
      }

      setLoading(false);
    })();
  }, [userId]);

  // 問題集作成（progressは1..Nを一括挿入）
  async function addWorkbook() {
    if (!editable) return;
    const name = title.trim();
    const n = Number(total);
    if (!name || !n || n <= 0) return alert("タイトルと問題数を正しく入力してください。");

    setLoading(true);

    // 1) workbooks
    const { data: wbIns, error: e1 } = await supabase
      .from("workbooks")
      .insert({ user_id: userId, title: name, total_problems: n })
      .select("*")
      .single();

    if (e1 || !wbIns) {
      setLoading(false);
      return alert("作成失敗: " + (e1?.message ?? ""));
    }

    const wb = wbIns as Workbook;

    // 2) workbook_progress を1..Nで作る（初期は wrong）
    const rows = Array.from({ length: n }, (_, i) => ({
      user_id: userId,
      workbook_id: wb.id,
      problem_no: i + 1,
      status: "wrong" as const,
    }));

    const { error: e2 } = await supabase.from("workbook_progress").insert(rows);
    if (e2) {
      setLoading(false);
      return alert("初期行の作成失敗: " + e2.message);
    }

    // state更新
    setWorkbooks((prev) => [...prev, wb]);
    setProgressMap((prev) => ({
      ...prev,
      [wb.id]: rows.reduce((acc, r) => {
        acc[r.problem_no] = {
          ...r,
          updated_at: new Date().toISOString(),
        } as ProgressRow;
        return acc;
      }, {} as Record<number, ProgressRow>),
    }));
    setTitle("");
    setTotal(10);
    setLoading(false);
  }

  // 1問分の状態をトグル保存
  async function toggleProblem(wb: Workbook, pno: number) {
    if (!editable) return;
    const cur = progressMap[wb.id]?.[pno];
    const next = nextStatus(cur?.status ?? "wrong");

    // upsert
    const { error } = await supabase.from("workbook_progress").upsert({
      user_id: userId,
      workbook_id: wb.id,
      problem_no: pno,
      status: next,
    });
    if (error) {
      console.error("❌ toggle:", error.message);
      return;
    }
    setProgressMap((prev) => {
      const book = { ...(prev[wb.id] ?? {}) };
      book[pno] = {
        user_id: userId,
        workbook_id: wb.id,
        problem_no: pno,
        status: next,
        updated_at: new Date().toISOString(),
      };
      return { ...prev, [wb.id]: book };
    });
  }

  // 削除
  async function removeWorkbook(wb: Workbook) {
    if (!editable) return;
    if (!confirm(`「${wb.title}」を削除します。よろしいですか？`)) return;

    // 先に子→親の順で消す（RLSによりdelete cascade任せでもOK）
    const { error: e1 } = await supabase
      .from("workbook_progress")
      .delete()
      .eq("workbook_id", wb.id)
      .eq("user_id", userId);
    if (e1) return alert("削除失敗(progress): " + e1.message);

    const { error: e2 } = await supabase
      .from("workbooks")
      .delete()
      .eq("id", wb.id);
    if (e2) return alert("削除失敗(workbooks): " + e2.message);

    setWorkbooks((prev) => prev.filter((x) => x.id !== wb.id));
    setProgressMap((prev) => {
      // 新しいオブジェクトを作成し、削除対象以外をコピー
      const newMap = Object.fromEntries(
        Object.entries(prev).filter(([key]) => key !== wb.id)
      );
      return newMap;
    });
  }

  // 集計（○/△/×）
  function summary(wb: Workbook) {
    const book = progressMap[wb.id] ?? {};
    let c = 0, p = 0, w = 0;
    for (let i = 1; i <= wb.total_problems; i++) {
      const st = book[i]?.status ?? "wrong";
      if (st === "correct") c++;
      else if (st === "partial") p++;
      else w++;
    }
    return { correct: c, partial: p, wrong: w };
  }

  const sorted = useMemo(() => workbooks, [workbooks]);

  return (
    <div className="space-y-6">
      {/* 追加フォーム */}
      {editable && (
        <div className="rounded-xl border bg-white p-4">
          <h3 className="font-semibold mb-3">問題集を追加</h3>
          <div className="flex flex-wrap gap-2">
            <Input
              className="flex-1 min-w-[220px]"
              placeholder="問題集の名前（例：Focus Gold 数学ⅠA）"
              value={title}
              onChange={(e) => setTitle((e.target as HTMLInputElement).value)}
              disabled={loading}
            />
            <Input
              className="w-32"
              type="number"
              min={1}
              placeholder="問題数"
              value={total}
              onChange={(e) => setTotal(Number((e.target as HTMLInputElement).value))}
              disabled={loading}
            />
            <Button onClick={addWorkbook} disabled={loading}>追加</Button>
          </div>
        </div>
      )}

      {/* 一覧 */}
      <div className="space-y-6">
        {loading && <p className="text-sm text-gray-500">読み込み中...</p>}
        {sorted.length === 0 && !loading && (
          <p className="text-sm text-gray-500">問題集はまだありません。</p>
        )}

        {sorted.map((wb) => {
          const sum = summary(wb);
          const book = progressMap[wb.id] ?? {};
          return (
            <section key={wb.id} className="rounded-xl border bg-white p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="font-bold">{wb.title}</h4>
                  <div className="text-xs text-gray-500">
                    全{wb.total_problems}問 / ○{sum.correct}・△{sum.partial}・×{sum.wrong}
                  </div>
                </div>
                {editable && (
                  <button
                    onClick={() => removeWorkbook(wb)}
                    className="text-sm border rounded px-2 py-1 text-red-600"
                  >
                    削除
                  </button>
                )}
              </div>

              {/* ○△× グリッド */}
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(48px,1fr))", gap: 8 }}>
                {Array.from({ length: wb.total_problems }, (_, i) => {
                  const no = i + 1;
                  const st = book[no]?.status ?? "wrong";
                  return (
                    <button
                      key={no}
                      onClick={() => toggleProblem(wb, no)}
                      disabled={!editable}
                      className={`border rounded px-0 py-3 text-sm font-semibold ${
                        st === "correct"
                          ? "bg-green-600 text-white"
                          : st === "partial"
                          ? "bg-yellow-400"
                          : "bg-gray-100"
                      }`}
                      title={`問題 ${no}`}
                    >
                      {no}<br />{statusToMark(st)}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
