// =========================================================
// EDU TECH HOTEL MANAGEMENT SYSTEM
// SUPABASE CONFIGURATION
// VERSION: 2026.11.12.04
// =========================================================

"use strict";

// =========================================================
// SUPABASE CONNECTION DETAILS
// =========================================================

const SUPABASE_URL =
    "https://zrgbovyuivgiyyzwerng.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_2REtQBmtGpaLYIP1Y_8FGg_MJPtapMk";

// =========================================================
// GLOBAL STATE
// =========================================================

window.supabaseClient = null;

window.EDUTECH_SUPABASE = null;

window.EDUTECH_SUPABASE_READY = false;

window.EDUTECH_SUPABASE_ERROR = null;


// =========================================================
// INITIALIZE SUPABASE
// =========================================================

function initializeEDUTechSupabase() {

    // -----------------------------------------------------
    // CHECK SUPABASE JAVASCRIPT LIBRARY
    // -----------------------------------------------------

    if (
        !window.supabase ||
        typeof window.supabase.createClient !== "function"
    ) {

        const error =
            new Error(
                "Supabase JavaScript library was not loaded."
            );

        window.EDUTECH_SUPABASE_ERROR =
            error;

        console.error(
            "EDU TECH: Supabase library was not loaded.",
            error
        );

        return null;
    }


    // -----------------------------------------------------
    // PREVENT DUPLICATE CLIENT CREATION
    // -----------------------------------------------------

    if (
        window.supabaseClient &&
        window.supabaseClient.auth
    ) {

        console.log(
            "EDU TECH: Existing Supabase client detected."
        );

        window.EDUTECH_SUPABASE_READY =
            true;

        return window.supabaseClient;
    }


    // -----------------------------------------------------
    // CREATE CLIENT
    // -----------------------------------------------------

    try {

        const client =
            window.supabase.createClient(
                SUPABASE_URL,
                SUPABASE_KEY,
                {
                    auth: {

                        persistSession: true,

                        autoRefreshToken: true,

                        detectSessionInUrl: true,

                        storageKey:
                            "edutech-supabase-auth"
                    }
                }
            );


        // -------------------------------------------------
        // STORE GLOBAL REFERENCES
        // -------------------------------------------------

        window.supabaseClient =
            client;

        window.EDUTECH_SUPABASE =
            client;


        // -------------------------------------------------
        // READY STATE
        // -------------------------------------------------

        window.EDUTECH_SUPABASE_READY =
            true;

        window.EDUTECH_SUPABASE_ERROR =
            null;


        console.log(
            "EDU TECH: Supabase client created successfully."
        );


        // -------------------------------------------------
        // FIRE READY EVENT
        // -------------------------------------------------

        window.dispatchEvent(
            new CustomEvent(
                "edutech:supabase-ready"
            )
        );


        return client;

    } catch (error) {

        window.supabaseClient =
            null;

        window.EDUTECH_SUPABASE =
            null;

        window.EDUTECH_SUPABASE_READY =
            false;

        window.EDUTECH_SUPABASE_ERROR =
            error;


        console.error(
            "EDU TECH: Failed to create Supabase client.",
            error
        );


        return null;
    }
}


// =========================================================
// CREATE SUPABASE CLIENT
// =========================================================

initializeEDUTechSupabase();


// =========================================================
// GET SUPABASE CLIENT
// =========================================================

window.getEDUTechSupabase =
    function () {

        if (
            window.supabaseClient &&
            window.supabaseClient.auth
        ) {

            return window.supabaseClient;
        }


        throw new Error(
            "EDU TECH Supabase client is not ready."
        );
    };


// =========================================================
// CHECK SUPABASE STATUS
// =========================================================

window.isEDUTechSupabaseReady =
    function () {

        return (
            window.EDUTECH_SUPABASE_READY === true &&
            !!window.supabaseClient
        );
    };


// =========================================================
// WAIT FOR SUPABASE
// =========================================================

window.waitForEDUTechSupabase =
    function (timeout = 10000) {

        return new Promise(
            function (resolve, reject) {

                // -----------------------------------------
                // ALREADY READY
                // -----------------------------------------

                if (
                    window.supabaseClient &&
                    window.supabaseClient.auth
                ) {

                    resolve(
                        window.supabaseClient
                    );

                    return;
                }


                // -----------------------------------------
                // WAIT FOR READY EVENT
                // -----------------------------------------

                let finished = false;


                function cleanup() {

                    window.removeEventListener(
                        "edutech:supabase-ready",
                        readyHandler
                    );

                    clearTimeout(
                        timer
                    );
                }


                function readyHandler() {

                    if (finished) {
                        return;
                    }

                    if (
                        window.supabaseClient &&
                        window.supabaseClient.auth
                    ) {

                        finished = true;

                        cleanup();

                        resolve(
                            window.supabaseClient
                        );
                    }
                }


                window.addEventListener(
                    "edutech:supabase-ready",
                    readyHandler
                );


                // -----------------------------------------
                // TIMEOUT
                // -----------------------------------------

                const timer =
                    setTimeout(
                        function () {

                            if (finished) {
                                return;
                            }

                            finished = true;

                            cleanup();

                            reject(
                                window.EDUTECH_SUPABASE_ERROR ||
                                new Error(
                                    "Timed out waiting for Supabase."
                                )
                            );

                        },
                        timeout
                    );
            }
        );
    };


// =========================================================
// AUTH SESSION HELPER
// =========================================================

window.getEDUTechSession =
    async function () {

        const client =
            window.getEDUTechSupabase();


        const result =
            await client.auth.getSession();


        if (result.error) {

            console.error(
                "EDU TECH: Failed to get Supabase session.",
                result.error
            );

            throw result.error;
        }


        return result.data.session || null;
    };


// =========================================================
// AUTH USER HELPER
// =========================================================

window.getEDUTechUser =
    async function () {

        const client =
            window.getEDUTechSupabase();


        const result =
            await client.auth.getUser();


        if (result.error) {

            console.error(
                "EDU TECH: Failed to get Supabase user.",
                result.error
            );

            throw result.error;
        }


        return result.data.user || null;
    };


// =========================================================
// AUTH STATE MONITOR
// =========================================================

if (
    window.supabaseClient &&
    window.supabaseClient.auth
) {

    window.supabaseClient.auth.onAuthStateChange(
        function (event, session) {

            console.log(
                "EDU TECH Auth State:",
                event
            );


            window.dispatchEvent(
                new CustomEvent(
                    "edutech:auth-state-change",
                    {
                        detail: {
                            event: event,
                            session: session
                        }
                    }
                )
            );
        }
    );
}


// =========================================================
// VERSION LOG
// =========================================================

console.log(
    "EDU TECH Supabase configuration loaded."
);

console.log(
    "EDU TECH Supabase Ready:",
    window.EDUTECH_SUPABASE_READY
);