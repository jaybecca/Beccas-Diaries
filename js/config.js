/* Public website configuration.
   Supabase is optional for local preview, but REQUIRED for secure admin login and
   shared content across mobile/desktop. Never put a service_role key in frontend code. */
window.FAITH_CONFIG = {
  supabaseUrl: "", // e.g. https://YOUR-PROJECT.supabase.co
  supabaseAnonKey: "", // Supabase publishable/anon key only
  siteName: "Faith & Light",
  demoMode: true
};