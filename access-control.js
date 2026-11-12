/* =========================================================
   EDU TECH HOTEL MANAGEMENT SYSTEM
   UNIVERSAL ACCESS CONTROL
   ---------------------------------------------------------
   IMPORTANT:
   - This file ONLY controls page permissions.
   - It NEVER replaces document.body.
   - It NEVER builds or removes the sidebar.
   - It NEVER destroys page content.
   ========================================================= */

(function () {
    "use strict";

    /* Prevent duplicate initialization */
    if (window.__EDUTECH_ACCESS_CONTROL__) {
        return;
    }

    window.__EDUTECH_ACCESS_CONTROL__ = true;

    /* =====================================================
       ROLE PERMISSIONS
       ===================================================== */

    const PERMISSIONS = {

        system_owner: [
            "dashboard",
            "rooms",
            "guests",
            "reservations",
            "checkin",
            "checkout",
            "restaurant",
            "inventory",
            "payments",
            "expenses",
            "employees",
            "housekeeping",
            "maintenance",
            "reports",
            "settings",
            "cashier",
            "bank_accounts",
            "financial_transactions"
        ],

        hotel_owner: [
            "dashboard",
            "rooms",
            "guests",
            "reservations",
            "checkin",
            "checkout",
            "restaurant",
            "inventory",
            "payments",
            "expenses",
            "employees",
            "housekeeping",
            "maintenance",
            "reports",
            "settings",
            "cashier",
            "bank_accounts",
            "financial_transactions"
        ],

        manager: [
            "dashboard",
            "rooms",
            "guests",
            "reservations",
            "checkin",
            "checkout",
            "restaurant",
            "inventory",
            "payments",
            "expenses",
            "employees",
            "housekeeping",
            "maintenance",
            "reports",
            "settings",
            "cashier",
            "bank_accounts",
            "financial_transactions"
        ],

        receptionist: [
            "dashboard",
            "rooms",
            "guests",
            "reservations",
            "checkin",
            "checkout",
            "restaurant",
            "inventory",
            "payments",
            "housekeeping",
            "maintenance"
        ]
    };


    /* =====================================================
       PAGE → MODULE MAP
       ===================================================== */

    const PAGE_MODULES = {

        "index.html": "dashboard",
        "": "dashboard",

        "rooms.html": "rooms",
        "guests.html": "guests",
        "reservations.html": "reservations",

        "checkin.html": "checkin",
        "checkout.html": "checkout",

        "restaurant.html": "restaurant",
        "inventory.html": "inventory",
        "payments.html": "payments",

        "expenses.html": "expenses",
        "employees.html": "employees",

        "housekeeping.html": "housekeeping",
        "maintenance.html": "maintenance",

        "reports.html": "reports",
        "settings.html": "settings",

        "cashier.html": "cashier",
        "bank-accounts.html": "bank_accounts",
        "financial-transactions.html": "financial_transactions"
    };


    const PROFILE_CACHE_KEY = "EDUTECH_ACCESS_PROFILE";


    /* =====================================================
       SUPABASE
       ===================================================== */

    function getSupabase() {

        if (window.supabase &&
            typeof window.supabase.from === "function") {

            return window.supabase;
        }

        if (window.supabaseClient &&
            typeof window.supabaseClient.from === "function") {

            return window.supabaseClient;
        }

        return null;
    }


    /* =====================================================
       CURRENT PAGE
       ===================================================== */

    function getCurrentPage() {

        let page =
            window.location.pathname
                .split("/")
                .pop()
                .toLowerCase();

        if (!page) {
            page = "index.html";
        }

        return page;
    }


    /* =====================================================
       CURRENT MODULE
       ===================================================== */

    function getCurrentModule() {

        const page = getCurrentPage();

        return PAGE_MODULES[page] || null;
    }


    /* =====================================================
       CACHE PROFILE
       ===================================================== */

    function saveProfile(profile) {

        try {

            if (!profile) {
                return;
            }

            sessionStorage.setItem(
                PROFILE_CACHE_KEY,
                JSON.stringify(profile)
            );

        } catch (error) {

            console.warn(
                "Unable to cache access profile:",
                error
            );
        }
    }


    function getCachedProfile() {

        try {

            const data =
                sessionStorage.getItem(
                    PROFILE_CACHE_KEY
                );

            if (!data) {
                return null;
            }

            return JSON.parse(data);

        } catch (error) {

            console.warn(
                "Unable to read cached access profile:",
                error
            );

            return null;
        }
    }


    /* =====================================================
       LOAD PROFILE
       ===================================================== */

    async function loadProfile() {

        const supabase = getSupabase();

        if (!supabase) {

            console.warn(
                "Supabase client not available yet."
            );

            return null;
        }


        try {

            const {
                data: sessionData,
                error: sessionError
            } = await supabase.auth.getSession();


            if (sessionError) {

                console.warn(
                    "Session check warning:",
                    sessionError
                );

                return null;
            }


            const session =
                sessionData &&
                sessionData.session;


            if (!session ||
                !session.user) {

                return null;
            }


            const userId =
                session.user.id;


            const {
                data: profile,
                error
            } = await supabase
                .from("profiles")
                .select(
                    "id, full_name, role, hotel_id, is_active"
                )
                .eq("id", userId)
                .maybeSingle();


            if (error) {

                console.warn(
                    "Profile loading warning:",
                    error
                );

                return null;
            }


            if (!profile) {

                console.warn(
                    "No profile found for current user."
                );

                return null;
            }


            saveProfile(profile);

            return profile;

        } catch (error) {

            console.warn(
                "Access profile error:",
                error
            );

            return null;
        }
    }


    /* =====================================================
       ACCESS DENIED OVERLAY
       -----------------------------------------------------
       NEVER replace document.body.innerHTML.
       ===================================================== */

    function showAccessDenied(moduleName) {

        removeAccessDenied();


        const overlay =
            document.createElement("div");

        overlay.id =
            "edutechAccessDenied";


        overlay.innerHTML = `
            <div class="edutech-access-card">

                <div class="edutech-access-icon">
                    🔒
                </div>

                <h2>
                    Access Restricted
                </h2>

                <p>
                    You do not have permission to access
                    this module.
                </p>

                <p class="edutech-access-module">
                    Module:
                    <strong>
                        ${escapeHTML(moduleName || "Unknown")}
                    </strong>
                </p>

                <button
                    type="button"
                    id="edutechAccessBack"
                >
                    ← Return
                </button>

            </div>
        `;


        document.body.appendChild(overlay);


        const backButton =
            document.getElementById(
                "edutechAccessBack"
            );


        if (backButton) {

            backButton.addEventListener(
                "click",
                function () {

                    if (window.history.length > 1) {

                        window.history.back();

                    } else {

                        window.location.href =
                            "index.html";
                    }
                }
            );
        }
    }


    function removeAccessDenied() {

        const existing =
            document.getElementById(
                "edutechAccessDenied"
            );

        if (existing) {
            existing.remove();
        }
    }


    /* =====================================================
       HTML ESCAPE
       ===================================================== */

    function escapeHTML(value) {

        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    /* =====================================================
       ACCESS CSS
       ===================================================== */

    function installAccessCSS() {

        if (
            document.getElementById(
                "edutech-access-control-css"
            )
        ) {
            return;
        }


        const style =
            document.createElement("style");


        style.id =
            "edutech-access-control-css";


        style.textContent = `

            #edutechAccessDenied {
                position: fixed;
                inset: 0;
                z-index: 999999;
                background: rgba(15, 23, 42, 0.82);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 24px;
                box-sizing: border-box;
            }

            .edutech-access-card {
                width: min(430px, 100%);
                background: #ffffff;
                border-radius: 16px;
                padding: 32px;
                text-align: center;
                box-shadow: 0 25px 70px rgba(0,0,0,.35);
                font-family: Arial, sans-serif;
            }

            .edutech-access-icon {
                font-size: 42px;
                margin-bottom: 12px;
            }

            .edutech-access-card h2 {
                margin: 0 0 12px;
                font-size: 24px;
                color: #111827;
            }

            .edutech-access-card p {
                color: #4b5563;
                line-height: 1.6;
                margin: 8px 0;
            }

            .edutech-access-module {
                margin-top: 18px !important;
                padding: 12px;
                background: #f3f4f6;
                border-radius: 8px;
            }

            #edutechAccessBack {
                margin-top: 20px;
                border: none;
                border-radius: 8px;
                padding: 11px 20px;
                background: #1d4ed8;
                color: white;
                font-weight: 600;
                cursor: pointer;
            }

            #edutechAccessBack:hover {
                opacity: .9;
            }
        `;


        document.head.appendChild(style);
    }


    /* =====================================================
       CHECK PERMISSION
       ===================================================== */

    function hasPermission(profile, moduleName) {

        if (!profile ||
            !profile.role ||
            !profile.is_active) {

            return false;
        }


        const role =
            String(profile.role)
                .toLowerCase()
                .trim();


        const allowed =
            PERMISSIONS[role];


        if (!allowed) {
            return false;
        }


        return allowed.includes(moduleName);
    }


    /* =====================================================
       PROTECT CURRENT PAGE
       ===================================================== */

    async function protectCurrentPage() {

        installAccessCSS();


        const moduleName =
            getCurrentModule();


        /*
         * If this is not a registered protected page,
         * do nothing.
         */
        if (!moduleName) {
            return true;
        }


        /*
         * First use cached profile.
         *
         * This prevents the page/sidebar from becoming
         * blank simply because Supabase is still loading.
         */

        let profile =
            getCachedProfile();


        if (profile &&
            profile.is_active &&
            hasPermission(profile, moduleName)) {

            /*
             * Page is allowed immediately.
             * Continue refreshing profile in background.
             */
            loadProfile()
                .catch(function (error) {
                    console.warn(
                        "Background profile refresh:",
                        error
                    );
                });

            return true;
        }


        /*
         * No usable cache.
         *
         * Give Supabase time to initialize.
         */

        for (
            let attempt = 0;
            attempt < 20;
            attempt++
        ) {

            profile =
                await loadProfile();


            if (profile) {
                break;
            }


            await wait(250);
        }


        /*
         * If profile still cannot be loaded,
         * DO NOT destroy the page.
         *
         * This is important.
         *
         * A temporary Supabase loading problem must
         * not turn the Dashboard into a blank page.
         */

        if (!profile) {

            console.warn(
                "Access control could not load profile. Page left intact."
            );

            return true;
        }


        /*
         * Inactive account.
         */

        if (profile.is_active !== true) {

            showAccessDenied(
                "Inactive Account"
            );

            return false;
        }


        /*
         * Unknown role.
         */

        if (
            !profile.role ||
            !PERMISSIONS[
                String(profile.role)
                    .toLowerCase()
                    .trim()
            ]
        ) {

            showAccessDenied(
                "Unknown User Role"
            );

            return false;
        }


        /*
         * Module permission.
         */

        if (
            !hasPermission(
                profile,
                moduleName
            )
        ) {

            showAccessDenied(
                moduleName
            );

            return false;
        }


        return true;
    }


    /* =====================================================
       WAIT HELPER
       ===================================================== */

    function wait(milliseconds) {

        return new Promise(function (resolve) {

            setTimeout(
                resolve,
                milliseconds
            );

        });
    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    window.EDUTECH_ACCESS = {

        permissions: PERMISSIONS,

        pageModules: PAGE_MODULES,

        getCurrentPage: getCurrentPage,

        getCurrentModule: getCurrentModule,

        getCachedProfile: getCachedProfile,

        loadProfile: loadProfile,

        hasPermission: hasPermission,

        protectCurrentPage: protectCurrentPage
    };


    /* =====================================================
       START
       ===================================================== */

    async function initialize() {

        /*
         * Do not run before the page exists.
         */

        if (
            document.readyState ===
            "loading"
        ) {

            document.addEventListener(
                "DOMContentLoaded",
                initialize,
                { once: true }
            );

            return;
        }


        /*
         * Small delay allows Supabase scripts
         * and page scripts to initialize without
         * us destroying anything.
         */

        await wait(100);


        try {

            await protectCurrentPage();

        } catch (error) {

            /*
             * NEVER blank the page because access control
             * encountered a JavaScript error.
             */

            console.error(
                "EDU TECH access-control initialization error:",
                error
            );
        }
    }


    initialize();

})();