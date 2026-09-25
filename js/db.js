const SUPABASE_URL = 'https://snsskclzbzxbwdoffykf.supabase.co';
const SUPABASE_ANON_KEY = 'PASTE_YOUR_ANON_KEY_HERE'; // <-- PLEASE REPLACE THIS!

// Initialize Supabase Client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
