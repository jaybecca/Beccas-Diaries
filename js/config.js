/* Public website configuration.
   Supabase is optional for local preview, but REQUIRED for secure admin login and
   shared content across mobile/desktop. Never put a service_role key in frontend code. */
window.FAITH_CONFIG = {
  supabaseUrl: "https://uauakucuflskinpsadrk.supabase.co", // e.g. https://YOUR-PROJECT.supabase.co
  supabaseAnonKey: "sb_publishable_gZB62KaKw3WJBPocYdQBxg_fa1bpOs2", // Supabase publishable/anon key only
  siteName: "Faith & Light",
  demoMode: false
};