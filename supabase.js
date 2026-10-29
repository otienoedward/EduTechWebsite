// ==========================================
// EDU TECH HOTEL MANAGEMENT SYSTEM
// Supabase Configuration
// ==========================================

const SUPABASE_URL = "https://zrgbovyuivgiyyzwerng.supabase.co";

const SUPABASE_KEY = "sb_publishable_2REtQBmtGpaLYIP1Y_8FGg_MJPtapMk";

// Check that the Supabase library has loaded
if (!window.supabase) {
    console.error(
        "Supabase library was not loaded. Make sure the Supabase CDN script is included before supabase.js."
    );
} else {
    // Create the Supabase client
    const supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

    // Make the client available globally
    window.supabaseClient = supabaseClient;

    console.log("Supabase connected successfully.");
}