// =========================================================
// EDU TECH HOTEL MANAGEMENT SYSTEM
// SUPABASE CONFIGURATION
// VERSION: 2026.11.14.03
// =========================================================

"use strict";


// =========================================================
// SUPABASE PROJECT DETAILS
// =========================================================

const SUPABASE_URL =
    "https://zrgbovyuivgiyyzwerng.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_2REtQBmtGpaLYIP1Y_8FGg_MJPtapMk";


// =========================================================
// GLOBAL STATE
// =========================================================

let edutechSupabaseClient = null;

window.EDUTECH_SUPABASE_READY = false;
window.EDUTECH_SUPABASE_ERROR = null;


// =========================================================
// CHECK WHETHER AN OBJECT IS A REAL SUPABASE CLIENT
// =========================================================

function isValidSupabaseClient(client) {

    return !!(
        client &&
        typeof client.from === "function" &&
        client.auth &&
        typeof client.auth.signInWithPassword === "function"
    );
}


// =========================================================
// CREATE / GET SUPABASE CLIENT
// =========================================================

function initializeEDUTechSupabase() {

    // -----------------------------------------------------
    // Already initialized by this file
    // -----------------------------------------------------

    if (isValidSupabaseClient(edutechSupabaseClient)) {

        window.supabaseClient = edutechSupabaseClient;
        window.EDUTECH_SUPABASE = edutechSupabaseClient;
        window.EDUTECH_SUPABASE_READY = true;

        return edutechSupabaseClient;
    }


    // -----------------------------------------------------
    // Reuse an existing valid client
    // -----------------------------------------------------

    if (isValidSupabaseClient(window.supabaseClient)) {

        edutechSupabaseClient = window.supabaseClient;

        window.EDUTECH_SUPABASE = edutechSupabaseClient;
        window.EDUTECH_SUPABASE_READY = true;

        return edutechSupabaseClient;
    }


    // -----------------------------------------------------
    // Reuse another valid EDU TECH client
    // -----------------------------------------------------

    if (isValidSupabaseClient(window.EDUTECH_SUPABASE)) {

        edutechSupabaseClient = window.EDUTECH_SUPABASE;

        window.supabaseClient = edutechSupabaseClient;
        window.EDUTECH_SUPABASE_READY = true;

        return edutechSupabaseClient;
    }


    // -----------------------------------------------------
    // IMPORTANT:
    //
    // window.supabase is normally the CDN namespace.
    // It is NOT the client.
    //
    // We must call:
    //
    // window.supabase.createClient(...)
    //
    // and NOT:
    //
    // window.supabase.from(...)
    // -----------------------------------------------------

    if (
        window.supabase &&
        typeof window.supabase.createClient === "function"
    ) {

        try {

            edutechSupabaseClient =
                window.supabase.createClient(
                    SUPABASE_URL,
                    SUPABASE_KEY
                );

            if (!isValidSupabaseClient(edutechSupabaseClient)) {

                throw new Error(
                    "Supabase client was created but is invalid."
                );
            }


            window.supabaseClient =
                edutechSupabaseClient;

            window.EDUTECH_SUPABASE =
                edutechSupabaseClient;

            window.EDUTECH_SUPABASE_READY =
                true;

            window.EDUTECH_SUPABASE_ERROR =
                null;


            // -------------------------------------------------
            // Notify pages waiting for Supabase
            // -------------------------------------------------

            try {

                window.dispatchEvent(
                    new CustomEvent(
                        "edutech:supabase-ready",
                        {
                            detail: {
                                client:
                                    edutechSupabaseClient
                            }
                        }
                    )
                );

            } catch (eventError) {

                console.warn(
                    "Supabase ready event could not be dispatched:",
                    eventError
                );
            }


            return edutechSupabaseClient;

        } catch (error) {

            window.EDUTECH_SUPABASE_READY =
                false;

            window.EDUTECH_SUPABASE_ERROR =
                error;

            console.error(
                "EDU TECH Supabase initialization failed:",
                error
            );

            return null;
        }
    }


    // -----------------------------------------------------
    // Supabase CDN has not loaded yet
    // -----------------------------------------------------

    window.EDUTECH_SUPABASE_READY =
        false;

    window.EDUTECH_SUPABASE_ERROR =
        new Error(
            "Supabase CDN has not loaded yet."
        );

    return null;
}


// =========================================================
// INITIALIZE IMMEDIATELY IF CDN IS READY
// =========================================================

initializeEDUTechSupabase();


// =========================================================
// RETRY INITIALIZATION
// =========================================================

let edutechSupabaseRetryCount = 0;

const EDUTECH_SUPABASE_MAX_RETRIES = 40;

const EDUTECH_SUPABASE_RETRY_INTERVAL = 250;


function retryEDUTechSupabaseInitialization() {

    if (
        window.EDUTECH_SUPABASE_READY === true &&
        isValidSupabaseClient(window.supabaseClient)
    ) {

        return;
    }


    edutechSupabaseRetryCount++;

    const client =
        initializeEDUTechSupabase();


    if (
        client &&
        isValidSupabaseClient(client)
    ) {

        return;
    }


    if (
        edutechSupabaseRetryCount <
        EDUTECH_SUPABASE_MAX_RETRIES
    ) {

        setTimeout(
            retryEDUTechSupabaseInitialization,
            EDUTECH_SUPABASE_RETRY_INTERVAL
        );
    }
}


setTimeout(
    retryEDUTechSupabaseInitialization,
    0
);


// =========================================================
// PUBLIC GETTER
// =========================================================

window.getEDUTechSupabase = function () {

    if (
        isValidSupabaseClient(
            window.supabaseClient
        )
    ) {

        return window.supabaseClient;
    }


    if (
        isValidSupabaseClient(
            window.EDUTECH_SUPABASE
        )
    ) {

        return window.EDUTECH_SUPABASE;
    }


    const client =
        initializeEDUTechSupabase();


    if (client) {

        return client;
    }


    return null;
};


// =========================================================
// CHECK READY
// =========================================================

window.isEDUTechSupabaseReady = function () {

    const client =
        window.getEDUTechSupabase();


    return isValidSupabaseClient(client);
};


// =========================================================
// WAIT FOR SUPABASE CLIENT
// =========================================================

window.waitForEDUTechSupabase = function (
    timeout = 15000
) {

    return new Promise(function (resolve, reject) {

        const started =
            Date.now();


        // -------------------------------------------------
        // Check immediately
        // -------------------------------------------------

        const immediate =
            window.getEDUTechSupabase();


        if (
            isValidSupabaseClient(immediate)
        ) {

            resolve(immediate);
            return;
        }


        // -------------------------------------------------
        // Listen for ready event
        // -------------------------------------------------

        let finished = false;


        function cleanup() {

            window.removeEventListener(
                "edutech:supabase-ready",
                readyHandler
            );

            clearInterval(interval);
            clearTimeout(timeoutTimer);
        }


        function finishSuccess(client) {

            if (finished) {
                return;
            }

            finished = true;

            cleanup();

            resolve(client);
        }


        function finishError(error) {

            if (finished) {
                return;
            }

            finished = true;

            cleanup();

            reject(error);
        }


        function readyHandler(event) {

            const client =
                event &&
                event.detail &&
                event.detail.client
                    ? event.detail.client
                    : window.getEDUTechSupabase();


            if (
                isValidSupabaseClient(client)
            ) {

                finishSuccess(client);
            }
        }


        window.addEventListener(
            "edutech:supabase-ready",
            readyHandler
        );


        // -------------------------------------------------
        // Poll while scripts initialize
        // -------------------------------------------------

        const interval =
            setInterval(function () {

                const client =
                    window.getEDUTechSupabase();


                if (
                    isValidSupabaseClient(client)
                ) {

                    finishSuccess(client);
                    return;
                }


                if (
                    Date.now() - started >= timeout
                ) {

                    finishError(
                        new Error(
                            "EDU TECH Supabase client is not ready. Please check supabase.js."
                        )
                    );
                }

            }, 200);


        // -------------------------------------------------
        // Safety timeout
        // -------------------------------------------------

        const timeoutTimer =
            setTimeout(function () {

                const client =
                    window.getEDUTechSupabase();


                if (
                    isValidSupabaseClient(client)
                ) {

                    finishSuccess(client);

                } else {

                    finishError(
                        new Error(
                            "EDU TECH Supabase client is not ready. Please check supabase.js."
                        )
                    );
                }

            }, timeout);
    });
};


// =========================================================
// AUTH HELPERS
// =========================================================

window.getEDUTechSession = async function () {

    const db =
        await window.waitForEDUTechSupabase();


    const result =
        await db.auth.getSession();


    if (result.error) {
        throw result.error;
    }


    return result.data
        ? result.data.session
        : null;
};


window.getEDUTechUser = async function () {

    const session =
        await window.getEDUTechSession();


    return session
        ? session.user
        : null;
};


// =========================================================
// AUTH STATE CHANGE
// =========================================================

function setupEDUTechAuthListener() {

    const db =
        window.getEDUTechSupabase();


    if (
        !db ||
        !db.auth ||
        typeof db.auth.onAuthStateChange !== "function"
    ) {

        return;
    }


    try {

        db.auth.onAuthStateChange(
            function (event, session) {

                try {

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

                } catch (error) {

                    console.warn(
                        "EDU TECH auth event error:",
                        error
                    );
                }
            }
        );

    } catch (error) {

        console.warn(
            "Could not initialize EDU TECH auth listener:",
            error
        );
    }
}


// =========================================================
// START AUTH LISTENER AFTER SUPABASE IS READY
// =========================================================

window.waitForEDUTechSupabase(15000)
    .then(function () {

        setupEDUTechAuthListener();

    })
    .catch(function (error) {

        console.error(
            "EDU TECH Supabase startup error:",
            error
        );
    });


// =========================================================
// GLOBAL CONFIGURATION
// =========================================================

window.EDUTECH_SUPABASE_CONFIG = {

    url:
        SUPABASE_URL,

    key:
        SUPABASE_KEY
};


// =========================================================
// DEBUG INFORMATION
// =========================================================

console.log(
    "EDU TECH Supabase configuration loaded."
);

console.log(
    "EDU TECH Supabase ready:",
    window.isEDUTechSupabaseReady()
);