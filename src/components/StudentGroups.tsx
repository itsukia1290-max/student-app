// src/components/StudentGroups.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  userId: string;
  /** DM も含めて表示したい場合だけ true にする。デフォルトはクラス用グループのみ */
  showDm?: boolean;
  /** 右側にタグ説明など置きたい場合に使う（任意） */
  rightHint?: React.ReactNode;
  /** 見出しを表示する（デフォルト true） */
  showHeader?: boolean;
};

type GroupRow = {
  id: string;
  name: string;
  type: "class" | "dm";
};

export default function StudentGroups({
  userId,
  showDm = false,
  rightHint,
  showHeader = true,
}: Props) {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

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

  const hasAny = useMemo(() => groups.length > 0, [groups]);

  return (
    <section style={wrap()}>
      {showHeader && (
        <div style={head()}>
          <div style={title()}>所属グループ</div>
          <div style={hint()}>{rightHint ?? "クラスに参加すると表示されます"}</div>
        </div>
      )}

      <div style={panel()}>
        {loading ? (
          <div style={stateText()}>読み込み中...</div>
        ) : error ? (
          <div style={{ ...stateText(), color: "#dc2626" }}>{error}</div>
        ) : !hasAny ? (
          <div style={stateText()}>所属しているグループはありません。</div>
        ) : (
          <div style={chipWrap()}>
            {groups.map((g) => (
              <div key={g.id} style={chip(g.type)}>
                <div style={chipDot(g.type)} />
                <div style={chipText()}>{g.name}</div>
                {g.type === "dm" && <div style={chipBadge()}>DM</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ================= styles ================= */

function wrap(): React.CSSProperties {
  return {
    display: "grid",
    gap: 10,
  };
}

function head(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  };
}

function title(): React.CSSProperties {
  return {
    fontSize: 14,
    fontWeight: 900,
    color: "#0f172a",
  };
}

function hint(): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 900,
    color: "#64748b",
  };
}

function panel(): React.CSSProperties {
  return {
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.18)",
    background:
      "linear-gradient(180deg, rgba(248,250,252,0.95) 0%, rgba(255,255,255,0.92) 100%)",
    padding: 12,
  };
}

function stateText(): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 900,
    color: "#64748b",
    padding: "2px 2px",
  };
}

function chipWrap(): React.CSSProperties {
  return {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  };
}

function chip(type: "class" | "dm"): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 12px",
    borderRadius: 9999,
    border: "1px solid rgba(148,163,184,0.22)",
    background: "rgba(255,255,255,0.94)",
    boxShadow: "0 10px 20px rgba(15,23,42,0.06)",
    maxWidth: "100%",
  };

  if (type === "dm") {
    return {
      ...base,
      background:
        "linear-gradient(180deg, rgba(239,246,255,0.90) 0%, rgba(255,255,255,0.94) 100%)",
      border: "1px solid rgba(59,130,246,0.18)",
    };
  }

  return base;
}

function chipDot(type: "class" | "dm"): React.CSSProperties {
  return {
    width: 10,
    height: 10,
    borderRadius: 9999,
    backgroundColor: type === "dm" ? "#3b82f6" : "#94a3b8",
    boxShadow: type === "dm" ? "0 8px 16px rgba(37,99,235,0.18)" : "none",
    flexShrink: 0,
  };
}

function chipText(): React.CSSProperties {
  return {
    fontSize: 13,
    fontWeight: 900,
    color: "#0f172a",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function chipBadge(): React.CSSProperties {
  return {
    marginLeft: 4,
    fontSize: 10,
    fontWeight: 900,
    color: "#1d4ed8",
    background: "rgba(59,130,246,0.12)",
    border: "1px solid rgba(59,130,246,0.20)",
    padding: "3px 8px",
    borderRadius: 9999,
    flexShrink: 0,
  };
}
