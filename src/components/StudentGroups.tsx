// src/components/StudentGroups.tsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  userId: string;
  /** DM も含めて表示したい場合だけ true にする。デフォルトはクラス用グループのみ */
  showDm?: boolean;
};

type GroupRow = {
  id: string;
  name: string;
  type: "class" | "dm";
};

export default function StudentGroups({ userId, showDm = false }: Props) {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      // 1. group_members から、そのユーザーが所属している group_id を取得
      const { data: gm, error: e1 } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", userId);

      if (e1) {
        if (!cancelled) {
          setError("グループの読み込みに失敗しました: " + e1.message);
          setLoading(false);
        }
        return;
      }

      const ids = (gm ?? []).map((r) => r.group_id as string);
      if (ids.length === 0) {
        if (!cancelled) {
          setGroups([]);
          setLoading(false);
        }
        return;
      }

      // 2. groups から名前などを取得
      const { data: gs, error: e2 } = await supabase
        .from("groups")
        .select("id,name,type")
        .in("id", ids)
        .order("name", { ascending: true });

      if (e2) {
        if (!cancelled) {
          setError("グループの読み込みに失敗しました: " + e2.message);
          setLoading(false);
        }
        return;
      }

      const list: GroupRow[] =
        (gs ?? []).map((g) => ({
          id: g.id as string,
          name: (g.name as string) ?? "（名称未設定）",
          type: (g.type as "class" | "dm") ?? "class",
        })) ?? [];

      const filtered = showDm ? list : list.filter((g) => g.type === "class");

      if (!cancelled) {
        setGroups(filtered);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, showDm]);

  if (loading) {
    return <p className="text-sm text-gray-500">所属グループを読み込み中...</p>;
  }

  if (error) {
    return (
      <p className="text-sm text-red-600 whitespace-pre-wrap">
        {error}
      </p>
    );
  }

  if (groups.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        所属しているグループはありません。
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {groups.map((g) => (
        <li key={g.id} className="flex items-center gap-2 text-sm">
          <span className="inline-block rounded-full px-2 py-0.5 border bg-white">
            {g.name}
          </span>
          {g.type === "dm" && (
            <span className="text-[10px] text-gray-500 border rounded px-1 py-0.5">
              DM
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
