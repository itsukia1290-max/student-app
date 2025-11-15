// src/components/AsyncImage.tsx
import { useEffect, useState } from "react";

type Props = {
  path: string; // 例: "dms/<groupId>/<filename>.jpg" 先頭スラなし
  getUrl: (p: string) => Promise<string | null>;
  className?: string;
  alt?: string;
};

export default function AsyncImage({ path, getUrl, className, alt }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setErr(null);
        const u = await getUrl(path);
        if (!alive) return;
        if (u) setUrl(u);
        else setErr("画像URLの取得に失敗しました");
      } catch (e) {
        if (!alive) return;
        setErr((e as Error)?.message ?? "画像の読み込みに失敗しました");
      }
    })();
    return () => {
      alive = false;
    };
  }, [path, getUrl]);

  if (err) {
    return (
      <div className={`w-40 h-28 rounded border grid place-items-center text-xs text-gray-500 ${className ?? ""}`}>
        {err}
      </div>
    );
  }

  if (!url) {
    return <div className={`w-40 h-28 bg-gray-200 rounded animate-pulse ${className ?? ""}`} />;
  }

  return <img src={url} className={`max-w-full rounded ${className ?? ""}`} loading="lazy" alt={alt ?? "image"} />;
}
