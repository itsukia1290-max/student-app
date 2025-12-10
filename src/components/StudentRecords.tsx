import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useIsStaff } from "../hooks/useIsStaff";

type RecordRow = {
  id: string;
  title: string;
  comment: string | null;
  image_url: string | null;
  created_at: string;
};

/*
 * src/components/StudentRecords.tsx
 * Responsibility: テスト・模試などの画像つき記録を表示/編集するコンポーネント
 * - `studentId` を受け取り、関連レコードを一覧表示する
 */

export default function StudentRecords({ studentId, editable }: { studentId: string; editable?: boolean }) {
  const { isStaff } = useIsStaff();
  const canEdit = isStaff || !!editable;
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("student_records")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ load:", error);
      return;
    }
    setRecords(data as RecordRow[]);
  }, [studentId]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveRecord() {
    if (!canEdit) return;
    if (!title.trim()) return alert("タイトルは必須です");

    setLoading(true);

    let imageUrl: string | null = null;

    try {
  if (file) {
        const ext = file.name.split(".").pop();
        const path = `records/${studentId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("chat-media")
          .upload(path, file);
        if (upErr) throw upErr;

        const { data: pub } = supabase.storage
          .from("chat-media")
          .getPublicUrl(path);

        imageUrl = pub.publicUrl;
      }

      const { error } = await supabase.from("student_records").insert({
        student_id: studentId,
        title,
        comment,
        image_url: imageUrl,
      });

      if (error) throw error;

      setTitle("");
      setComment("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
  await load();
    } catch (e) {
      console.error("❌ save failed:", e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 p-4">
      {isStaff && (
        <div className="border p-4 rounded space-y-3 bg-white">
          <h3 className="font-bold text-lg">📥 新しい成績を追加</h3>

          <input
            className="border rounded px-3 py-2 w-full"
            placeholder="タイトル（例：数学模試 第3回）"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <textarea
            className="border rounded px-3 py-2 w-full"
            placeholder="コメント（任意）"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />

          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />

          <button
            onClick={saveRecord}
            disabled={loading}
            className="px-4 py-2 bg-black text-white rounded"
          >
            追加
          </button>
        </div>
      )}

      <div className="space-y-4">
        {records.map((r) => (
          <div key={r.id} className="border rounded p-3 bg-white">
            <h4 className="font-bold">{r.title}</h4>
            {r.comment && <p className="mt-1">{r.comment}</p>}
            {r.image_url && (
              <img
                src={r.image_url}
                alt="記録画像"
                className="mt-2 max-w-full rounded border"
              />
            )}
            <div className="text-xs opacity-60 mt-1">
              {new Date(r.created_at).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
