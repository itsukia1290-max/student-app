// src/utils/storage.ts
import { supabase } from "../lib/supabase";

/** Private バケット(chat-media)のファイルに対して署名付きURLを発行して返す。 */
export async function getSignedUrl(path: string, expires = 60 * 60): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from("chat-media").createSignedUrl(path, expires);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** 画像を chat-media にアップロードして media_path を返す（先頭スラなし） */
export async function uploadImageToChatMedia(folder: string, file: File): Promise<{ media_path: string | null; error?: string; }> {
  try {
    if (!file) return { media_path: null, error: "画像が選択されていません" };
    // 例: folder = "groups/<groupId>" or "dms/<dmId>"
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const fname = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const path = `${folder}/${fname}`; // 先頭スラなし

    const { error } = await supabase.storage
      .from("chat-media")
      .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false, cacheControl: "3600" });

    if (error) return { media_path: null, error: error.message };
    return { media_path: path };
  } catch (e) {
    return { media_path: null, error: (e as Error)?.message ?? "アップロード失敗" };
  }
}
