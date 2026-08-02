import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://gwzebinonoaaxtdkpqem.supabase.co";
const SUPABASE_KEY = "sb_publishable_Sj4GFkR23dsbe07y04-YRA_JlVDBPan";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);