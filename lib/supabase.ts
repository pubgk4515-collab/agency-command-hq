import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 1. Normal Client (Safe for Browser/UI)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
