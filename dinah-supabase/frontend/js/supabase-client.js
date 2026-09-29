// js/supabase-client.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

// Performance: open the connection to Supabase as early as possible, in
// parallel with the rest of the page parsing/rendering.
(() => {
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = SUPABASE_URL;
  document.head.appendChild(link);
})();

// IMPORTANT session behavior: sessionStorage (not localStorage) holds the
// auth token on purpose. localStorage persists forever, so a logged-in
// session would silently survive closing and reopening the whole browser.
// sessionStorage clears when the browser/tab is closed, so re-opening the
// site always lands back on the login screen, while staying logged in
// across page reloads/navigation within the same visit.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
