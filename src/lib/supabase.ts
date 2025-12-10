/*
 * src/lib/supabase.ts
 * Responsibility: Supabase クライアントの初期化とエクスポート。
 * - 環境変数から URL と ANON KEY を読み込み、1 つの shared client を提供する。
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
