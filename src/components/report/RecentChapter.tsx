// src/components/report/RecentChapter.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Mark = "O" | "X" | "T" | "";

type GradeRow = {
  id: string;
  user_id: string;
  title: string;
  marks: unknown;
  labels?: unknown;
  last_edited_chapter_id?: string | null;
};

type NoteRow = {
  id: string;
  grade_id: string;
  start_idx: number;
  end_idx: number;

  // 新設計
  chapter_title: string | null;
  chapter_note: string | null;

  // 互換用（旧設計）
  note: string | null;

  updated_at: string;
};

function parseMarks(raw: unknown): Mark[] {
  const arr = Array.isArray(raw) ? (raw as unknown[]) : [];
  return arr.map((m) => (m === "O" || m === "X" || m === "T" ? (m as Mark) : ""));
}

function labelOf(labels: unknown, idx: number) {
  const arr = Array.isArray(labels) ? (labels as unknown[]) : [];
  const s = arr[idx];
  if (typeof s === "string" && s.trim()) return s.trim();
  return String(idx + 1);
}

export default function RecentChapter({
  ownerUserId,
}: {
  ownerUserId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [grade, setGrade] = useState<GradeRow | null>(null);
  const [note, setNote] = useState<NoteRow | null>(null);

  useEffect(() => {
    if (!ownerUserId) return;

    let cancelled = false;
    (async () => {
      setLoading(true);

      // ① 最新の student_grades を取得（last_edited_chapter_id 含む）
      const { data: gradeData, error: gradeErr } = await supabase
        .from("student_grades")
        .select("id,user_id,title,marks,labels,last_edited_chapter_id")
        .eq("user_id", ownerUserId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (gradeErr) {
        console.error("❌ load recent grade:", gradeErr.message);
        if (!cancelled) {
          setGrade(null);
          setNote(null);
          setLoading(false);
        }
        return;
      }

      if (!gradeData) {
        if (!cancelled) {
          setGrade(null);
          setNote(null);
          setLoading(false);
        }
        return;
      }

      const g = gradeData as GradeRow;

      // ② 章取得（★重要：last_edited_chapter_id優先）
      let noteData = null;

      if (g.last_edited_chapter_id) {
        const { data: n, error: nErr } = await supabase
          .from("student_grade_notes")
          .select(
            "id,grade_id,start_idx,end_idx,chapter_title,chapter_note,teacher_memo,next_homework,updated_at"
          )
          .eq("id", g.last_edited_chapter_id)
          .eq("grade_id", g.id) // ← 安全性強化
          .maybeSingle();

        if (!nErr && n) {
          noteData = n;
        }
      }

      // ★ フォールバック（万一chapter_idが消えていた場合）
      if (!noteData) {
        const { data: n } = await supabase
          .from("student_grade_notes")
          .select(
            "id,grade_id,start_idx,end_idx,chapter_title,chapter_note,teacher_memo,next_homework,updated_at"
          )
          .eq("grade_id", g.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        noteData = n;
      }

      if (!cancelled) {
        setGrade(g);
        setNote(
          noteData
            ? {
                id: noteData.id,
                grade_id: noteData.grade_id,
                start_idx: noteData.start_idx,
                end_idx: noteData.end_idx,
                note: null,
                chapter_title: noteData.chapter_title ?? null,
                chapter_note: noteData.chapter_note ?? null,
                updated_at: noteData.updated_at,
              }
            : null
        );
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ownerUserId]);

  const displayTitle = useMemo(() => {
    const t = (note?.chapter_title ?? "").trim();
    if (t) return t;

    // 互換：旧 note の最初の非空行を使う
    const raw = String(note?.note ?? "");
    const lines = raw.replace(/\r\n/g, "\n").split("\n");
    const first = lines.find((l) => l.trim().length > 0)?.trim() ?? "";
    return first || "（章名未設定）";
  }, [note?.chapter_title, note?.note]);

  const displayBody = useMemo(() => {
    const b = (note?.chapter_note ?? "").trim();
    if (b) return b;

    // 互換：旧 note の2行目以降
    const raw = String(note?.note ?? "").replace(/\r\n/g, "\n");
    const lines = raw.split("\n");
    const firstNonEmptyIdx = lines.findIndex((l) => l.trim().length > 0);
    const body = lines.slice(firstNonEmptyIdx + 1).join("\n").trim();
    return body;
  }, [note?.chapter_note, note?.note]);

  if (loading) {
    return <div style={{ fontSize: 13, fontWeight: 900, color: "#94a3b8" }}>読み込み中...</div>;
  }

  if (!grade || !note) {
    return (
      <div style={{ fontSize: 13, fontWeight: 900, color: "#64748b" }}>
        直近に編集された章（備考）はありません。
      </div>
    );
  }

  const marks = parseMarks(grade.marks);
  const startLabel = labelOf(grade.labels, note.start_idx);
  const endLabel = labelOf(grade.labels, note.end_idx);

  // 章内の集計（範囲だけ）
  let o = 0, x = 0, t = 0, blank = 0;
  for (let i = note.start_idx; i <= note.end_idx; i++) {
    const m = marks[i] ?? "";
    if (m === "O") o++;
    else if (m === "X") x++;
    else if (m === "T") t++;
    else blank++;
  }

  return (
    <section
      style={{
        borderRadius: 18,
        border: "1px solid rgba(148,163,184,0.18)",
        background: "rgba(255,255,255,0.92)",
        padding: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 14 }}>
            {displayTitle}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, fontWeight: 900, color: "#64748b" }}>
            {grade.title} / 範囲: {startLabel}〜{endLabel} / ○:{o} ×:{x} △:{t} 未:{blank}
          </div>
        </div>

        <div style={{ fontSize: 12, fontWeight: 900, color: "#94a3b8", whiteSpace: "nowrap" }}>
          更新: {new Date(note.updated_at).toLocaleString()}
        </div>
      </div>

      {/* 備考本文（2行目以降） */}
      <div
        style={{
          marginTop: 10,
          whiteSpace: "pre-wrap",
          fontSize: 13,
          fontWeight: 800,
          color: "#0f172a",
          background: "rgba(248,250,252,0.85)",
          border: "1px dashed rgba(148,163,184,0.35)",
          borderRadius: 14,
          padding: 12,
        }}
      >
        {displayBody ? displayBody : "（備考なし）"}
      </div>

      {/* ===== 章内の評価（〇×△） ===== */}
      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, 44px)",
          gap: 8,
        }}
      >
        {Array.from(
          { length: note.end_idx - note.start_idx + 1 },
          (_, k) => {
            const idx = note.start_idx + k;
            const m = marks[idx] ?? "";
            const label = labelOf(grade.labels, idx);

            return (
              <div
                key={idx}
                style={{
                  height: 40,
                  width: 44,
                  borderRadius: 12,
                  border: "1px solid rgba(148,163,184,0.25)",
                  background:
                    m === "O"
                      ? "rgba(34,197,94,0.20)"
                      : m === "X"
                      ? "rgba(239,68,68,0.18)"
                      : m === "T"
                      ? "rgba(245,158,11,0.18)"
                      : "rgba(255,255,255,0.95)",
                  color:
                    m === "O"
                      ? "#166534"
                      : m === "X"
                      ? "#991b1b"
                      : m === "T"
                      ? "#92400e"
                      : "#0f172a",
                  fontWeight: 900,
                  fontSize: 14,
                  display: "grid",
                  placeItems: "center",
                  position: "relative",
                }}
                title={`${label} : ${m || "未"}`}
              >
                {m ? (m === "O" ? "○" : m === "X" ? "×" : "△") : ""}

                {/* 右下に番号 */}
                <div
                  style={{
                    position: "absolute",
                    right: 6,
                    bottom: 4,
                    fontSize: 10,
                    fontWeight: 900,
                    color: "rgba(15,23,42,0.65)",
                  }}
                >
                  {label}
                </div>
              </div>
            );
          }
        )}
      </div>
    </section>
  );
}
