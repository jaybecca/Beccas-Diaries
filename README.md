# Faith & Light — Christian Blog Starter

A responsive Christian blog starter with 6 major categories, subtopics, 100 prepared article ideas, article search/filtering, article pages, and a mobile-friendly admin workspace.

## Included
- `index.html` — public homepage with category introductions, topic cards, article search and filters.
- `article.html` — readable individual article page.
- `admin.html` — admin login, editor, draft/publish workflow, word counter, preview, article library and 100-slot roadmap.
- `js/content.js` — six category descriptions and 100 article prompts.
- `supabase/schema.sql` — database schema and row-level security policies.
- `js/config.js` — configuration placeholders.

## Preview locally
Because browser security can restrict some features when opening a file directly, run a tiny local web server from this folder:

```bash
python3 -m http.server 8080
```

Then open:
- Website: http://localhost:8080/
- Admin: http://localhost:8080/admin.html

Demo mode: enter any email and a password of at least 4 characters. Demo content is saved in that browser's local storage only. It is useful for trying the interface, but it is **not secure authentication** and does not sync between devices. Do not use demo mode for a public production admin area.

## Connect a real admin backend (recommended before launch)
This starter supports Supabase Auth + database for secure sign-in and shared content.

1. Create a project at https://supabase.com/.
2. In Supabase Authentication, enable Email/Password and create your own admin user. If the site is only for you, disable public sign-ups.
3. Open the Supabase SQL Editor and run `supabase/schema.sql`.
4. In `js/config.js`, add your project's Project URL and publishable/anon key:
   ```js
   window.FAITH_CONFIG = {
     supabaseUrl: "https://YOUR-PROJECT.supabase.co",
     supabaseAnonKey: "YOUR-PUBLISHABLE-OR-ANON-KEY",
     siteName: "Faith & Light",
     demoMode: false
   };
   ```
   Never put the Supabase `service_role` key in browser code.
5. Host the site over HTTPS (for example, Cloudflare Pages). Ensure `js/config.js` is deployed with the correct public URL/key.
6. Open `/admin.html`, sign in using the admin user created in Supabase, and write/publish. The public site can then load published posts from the database.

### Before public launch
The homepage and article pages can read published articles from Supabase when the project URL and public anon/publishable key are configured. Test sign-in, create/edit/delete, draft privacy, published article rendering, and mobile layouts before launch. The starter is a strong foundation, but production deployment still requires your own Supabase project, admin account, domain/hosting setup, and end-to-end testing.

## Suggested workflow
- Start with one article slot.
- Keep articles around 200–320 words (about 250 is a useful target).
- Use a short, welcoming intro and a relevant Scripture reference.
- Save drafts while writing; publish only when ready.
- Review Bible references and theological wording before publishing.

## Customise the branding
Search the project for `Faith & Light` and replace it with your chosen ministry/blog name. Colours, typography, and layout live in `css/styles.css`.
