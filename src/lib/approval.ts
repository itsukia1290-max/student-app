import { supabase } from "./supabase";

/**
 * 未解決(resolved_at is null) の申請がなければ作る
 * - 既にあれば何もしない
 * - DB側の部分ユニーク index と併用して "二重申請事故" を防ぐ
 */
export async function ensureApprovalRequest(uid: string) {
  const { data: existing, error: selErr } = await supabase
    .from("approval_requests")
    .select("id")
    .eq("user_id", uid)
    .is("resolved_at", null)
    .limit(1);

  if (selErr) throw selErr;
  if (existing && existing.length > 0) return;

  const { error: insErr } = await supabase.from("approval_requests").insert({
    user_id: uid,
    approved: null,
    resolved_at: null,
    resolved_by: null,
  });

  // 既に誰かが同時に作った等（ユニーク違反）は無視してOK
  if (insErr && !/duplicate key|already exists|409/i.test(insErr.message)) {
    throw insErr;
  }
}
