const SUPABASE_URL = 'https://snsskclzbzxbwdoffykf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_6xfROo09sqOd1ef1KBdrEw_lVOmTYBN';

// The CDN script defines a global `var supabase` (the library). Re-declaring it with `const`
// throws "Identifier 'supabase' has already been declared", so we replace the library
// global with the client instance instead. Every other script then uses `supabase.from(...)`.
if (typeof supabase.createClient === "function") {
    supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
