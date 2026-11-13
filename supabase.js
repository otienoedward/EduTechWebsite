// =========================================================
// EDU TECH HOTEL MANAGEMENT SYSTEM
// SUPABASE CONFIGURATION
// VERSION: 2026.11.13.01
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

window.EDUTECH_SUPABASE_LOADING = false;


// =========================================================
// SUPABASE CDN
// =========================================================

const EDUTECH_SUPABASE_CDN =
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";


// =========================================================
// LOAD SUPABASE JAVASCRIPT LIBRARY
// =========================================================

function loadEDUTechSupabaseLibrary() {

    return new Promise(function (resolve, reject) {

        // -------------------------------------------------
        // Library already loaded
        // -------------------------------------------------

        if (
            window.supabase &&
            typeof window.supabase.createClient === "function"
        ) {

            console.log(
                "EDU TECH: Supabase JavaScript library already loaded."
            );

            resolve(window.supabase);

            return;
        }


        // -------------------------------------------------
        // Prevent duplicate loading
        // -------------------------------------------------

        if (window.EDUTECH_SUPABASE_LOADING) {

            const checkInterval =
                setInterval(function () {

                    if (
                        window.supabase &&
                        typeof window.supabase.createClient ===
                            "function"
                    ) {

                        clearInterval(checkInterval);

                        console.log(
                            "EDU TECH: Supabase library finished loading."
                        );

                        resolve(window.supabase);
                    }

                }, 50);


            setTimeout(function () {

                clearInterval(checkInterval);

                if (
                    !window.supabase ||
                    typeof window.supabase.createClient !==
                        "function"
                ) {

                    reject(
                        new Error(
                            "Supabase JavaScript library failed to load."
                        )
                    );

                }

            }, 15000);


            return;
        }


        // -------------------------------------------------
        // Start loading
        // -------------------------------------------------

        window.EDUTECH_SUPABASE_LOADING = true;


        const existingScript =
            document.querySelector(
                'script[data-edutech-supabase-library="true"]'
            );


        if (existingScript) {

            existingScript.addEventListener(
                "load",
                function () {

                    if (
                        window.supabase &&
                        typeof window.supabase.createClient ===
                            "function"
                    ) {

                        resolve(
                            window.supabase
                        );

                    } else {

                        reject(
                            new Error(
                                "Supabase library loaded but createClient() is unavailable."
                            )
                        );

                    }

                }
            );


            existingScript.addEventListener(
                "error",
                function () {

                    reject(
                        new Error(
                            "Unable to load Supabase JavaScript library."
                        )
                    );

                }
            );


            return;
        }


        // -------------------------------------------------
        // Create script
        // -------------------------------------------------

        const script =
            document.createElement("script");


        script.src =
            EDUTECH_SUPABASE_CDN;


        script.async = false;


        script.dataset.edutechSupabaseLibrary =
            "true";


        script.onload =
            function () {

                if (
                    window.supabase &&
                    typeof window.supabase.createClient ===
                        "function"
                ) {

                    console.log(
                        "EDU TECH: Supabase JavaScript library loaded successfully."
                    );

                    resolve(
                        window.supabase
                    );

                } else {

                    reject(
                        new Error(
                            "Supabase JavaScript library loaded, but createClient() was not found."
                        )
                    );

                }

            };


        script.onerror =
            function () {

                reject(
                    new Error(
                        "Unable to load Supabase JavaScript library from CDN."
                    )
                );

            };


        document.head.appendChild(
            script
        );

    });

}


// =========================================================
// CREATE SUPABASE CLIENT
// =========================================================

async function initializeEDUTechSupabase() {

    try {

        console.log(
            "EDU TECH: Initializing Supabase..."
        );


        // -------------------------------------------------
        // Load Supabase library first
        // -------------------------------------------------

        const supabaseLibrary =
            await loadEDUTechSupabaseLibrary();


        // -------------------------------------------------
        // Check library
        // -------------------------------------------------

        if (
            !supabaseLibrary ||
            typeof supabaseLibrary.createClient !==
                "function"
        ) {

            throw new Error(
                "Supabase JavaScript library is unavailable."
            );

        }


        // -------------------------------------------------
        // Prevent duplicate client
        // -------------------------------------------------

        if (
            window.supabaseClient &&
            typeof window.supabaseClient.from ===
                "function"
        ) {

            console.log(
                "EDU TECH: Existing Supabase client detected."
            );


            window.EDUTECH_SUPABASE_READY =
                true;


            window.EDUTECH_SUPABASE_ERROR =
                null;


            window.dispatchEvent(
                new CustomEvent(
                    "edutech:supabase-ready"
                )
            );


            return window.supabaseClient;

        }


        // -------------------------------------------------
        // Create client
        // -------------------------------------------------

        const client =
            supabaseLibrary.createClient(
                SUPABASE_URL,
                SUPABASE_KEY,
                {
                    auth: {

                        persistSession:
                            true,

                        autoRefreshToken:
                            true,

                        detectSessionInUrl:
                            true,

                        storageKey:
                            "edutech-supabase-auth"

                    }
                }
            );


        // -------------------------------------------------
        // Store global references
        // -------------------------------------------------

        window.supabaseClient =
            client;


        window.EDUTECH_SUPABASE =
            client;


        // -------------------------------------------------
        // Ready state
        // -------------------------------------------------

        window.EDUTECH_SUPABASE_READY =
            true;


        window.EDUTECH_SUPABASE_ERROR =
            null;


        console.log(
            "================================================="
        );

        console.log(
            "EDU TECH: SUPABASE CLIENT READY"
        );

        console.log(
            "Supabase URL:",
            SUPABASE_URL
        );

        console.log(
            "Client:",
            window.supabaseClient
        );

        console.log(
            "================================================="
        );


        // -------------------------------------------------
        // Fire ready event
        // -------------------------------------------------

        window.dispatchEvent(
            new CustomEvent(
                "edutech:supabase-ready"
            )
        );


        // -------------------------------------------------
        // Auth state monitor
        // -------------------------------------------------

        if (
            client.auth &&
            typeof client.auth.onAuthStateChange ===
                "function"
        ) {

            client.auth.onAuthStateChange(
                function (
                    event,
                    session
                ) {

                    console.log(
                        "EDU TECH Auth State:",
                        event
                    );


                    window.dispatchEvent(
                        new CustomEvent(
                            "edutech:auth-state-change",
                            {
                                detail: {

                                    event:
                                        event,

                                    session:
                                        session

                                }
                            }
                        )
                    );

                }
            );

        }


        return client;

    }
    catch (error) {

        window.supabaseClient =
            null;


        window.EDUTECH_SUPABASE =
            null;


        window.EDUTECH_SUPABASE_READY =
            false;


        window.EDUTECH_SUPABASE_ERROR =
            error;


        console.error(
            "================================================="
        );

        console.error(
            "EDU TECH: SUPABASE INITIALIZATION FAILED"
        );

        console.error(
            error
        );

        console.error(
            "================================================="
        );


        window.dispatchEvent(
            new CustomEvent(
                "edutech:supabase-error",
                {
                    detail: error
                }
            )
        );


        return null;

    }

}


// =========================================================
// START SUPABASE INITIALIZATION
// =========================================================

window.EDUTECH_SUPABASE_INITIALIZATION =
    initializeEDUTechSupabase();


// =========================================================
// GET SUPABASE CLIENT
// =========================================================

window.getEDUTechSupabase =
    function () {

        if (
            window.supabaseClient &&
            typeof window.supabaseClient.from ===
                "function"
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
            !!window.supabaseClient &&
            typeof window.supabaseClient.from ===
                "function"
        );

    };


// =========================================================
// WAIT FOR SUPABASE
// =========================================================

window.waitForEDUTechSupabase =
    function (timeout = 15000) {

        return new Promise(
            function (
                resolve,
                reject
            ) {

                // -----------------------------------------
                // Already ready
                // -----------------------------------------

                if (
                    window.supabaseClient &&
                    typeof window.supabaseClient.from ===
                        "function"
                ) {

                    resolve(
                        window.supabaseClient
                    );

                    return;

                }


                // -----------------------------------------
                // Ready event handler
                // -----------------------------------------

                let finished =
                    false;


                let timer;


                function cleanup() {

                    window.removeEventListener(
                        "edutech:supabase-ready",
                        readyHandler
                    );


                    window.removeEventListener(
                        "edutech:supabase-error",
                        errorHandler
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
                        typeof window.supabaseClient.from ===
                            "function"
                    ) {

                        finished =
                            true;


                        cleanup();


                        resolve(
                            window.supabaseClient
                        );

                    }

                }


                function errorHandler(event) {

                    if (finished) {
                        return;
                    }


                    finished =
                        true;


                    cleanup();


                    reject(
                        event.detail ||
                        window.EDUTECH_SUPABASE_ERROR ||
                        new Error(
                            "Supabase initialization failed."
                        )
                    );

                }


                window.addEventListener(
                    "edutech:supabase-ready",
                    readyHandler
                );


                window.addEventListener(
                    "edutech:supabase-error",
                    errorHandler
                );


                // -----------------------------------------
                // Timeout
                // -----------------------------------------

                timer =
                    setTimeout(
                        function () {

                            if (finished) {
                                return;
                            }


                            finished =
                                true;


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
            await window.waitForEDUTechSupabase();


        const result =
            await client.auth.getSession();


        if (result.error) {

            console.error(
                "EDU TECH: Failed to get Supabase session.",
                result.error
            );


            throw result.error;

        }


        return (
            result.data.session ||
            null
        );

    };


// =========================================================
// AUTH USER HELPER
// =========================================================

window.getEDUTechUser =
    async function () {

        const client =
            await window.waitForEDUTechSupabase();


        const result =
            await client.auth.getUser();


        if (result.error) {

            console.error(
                "EDU TECH: Failed to get Supabase user.",
                result.error
            );


            throw result.error;

        }


        return (
            result.data.user ||
            null
        );

    };


// =========================================================
// VERSION LOG
// =========================================================

console.log(
    "EDU TECH Supabase configuration loaded."
);

console.log(
    "EDU TECH Supabase version:",
    "2026.11.13.01"
);