/* ============================================================
   watermusic · account server
   Fill these two values in and accounts stop being device-only:
   every username then keeps its stars, settings and game saves
   on the server and loads them on any browser.
   Leave them empty and the site still works exactly as before,
   with accounts stored locally.
   ============================================================ */
window.WM_SYNC = {
    url: '',   // e.g. 'https://abcdefgh.supabase.co'
    key: ''    // the project's anon / publishable key
};
