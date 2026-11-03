/* SUPABASE CLIENT — ESTADISTICAS-MOLSAN. Solo clave publicable; nunca service_role. */
(() => {
    const CONFIG = Object.freeze({
        url: "https://agiagymgogwikxfounqd.supabase.co",
        publishableKey: "sb_publishable_yYgXI13ysOjotMc8ml67zQ_JJW-L7YW"
    });
    window.MOLSAN_SUPABASE_CONFIG = CONFIG;
    window.getMolsanSupabase = function () {
        if (window.molsanSupabaseClient) return window.molsanSupabaseClient;
        if (!window.supabase || typeof window.supabase.createClient !== "function") {
            throw new Error("No se ha podido cargar la librería de conexión con Supabase.");
        }
        window.molsanSupabaseClient = window.supabase.createClient(CONFIG.url, CONFIG.publishableKey, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
        return window.molsanSupabaseClient;
    };
})();
