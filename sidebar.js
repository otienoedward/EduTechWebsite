/* =========================================================
   EDU TECH HOTEL MANAGEMENT SYSTEM
   UNIVERSAL SIDEBAR
   ---------------------------------------------------------
   ONE SIDEBAR
   ONE LOGOUT
   ONE NAVIGATION SYSTEM

   IMPORTANT:
   - This file ONLY controls the sidebar.
   - It does NOT replace document.body.
   - It does NOT replace page content.
   - It does NOT perform access denial.
   - Access control is handled by access-control.js.
   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       PREVENT DUPLICATE SIDEBAR INITIALIZATION
       ===================================================== */

    if (window.__EDUTECH_UNIVERSAL_SIDEBAR__) {
        return;
    }

    window.__EDUTECH_UNIVERSAL_SIDEBAR__ = true;


    /* =====================================================
       CONFIGURATION
       ===================================================== */

    const SIDEBAR_ID =
        "appSidebar";

    const PROFILE_CACHE_KEY =
        "EDUTECH_SIDEBAR_PROFILE";


    /* =====================================================
       MODULES
       ===================================================== */

    const MODULES = [

        {
            key: "dashboard",
            label: "Dashboard",
            icon: "🏠",
            page: "index.html"
        },

        {
            key: "rooms",
            label: "Rooms",
            icon: "🛏️",
            page: "rooms.html"
        },

        {
            key: "guests",
            label: "Guests",
            icon: "👥",
            page: "guests.html"
        },

        {
            key: "reservations",
            label: "Reservations",
            icon: "📅",
            page: "reservations.html"
        },

        {
            key: "checkin",
            label: "Check-in",
            icon: "➡️",
            page: "checkin.html"
        },

        {
            key: "checkout",
            label: "Check-out",
            icon: "⬅️",
            page: "checkout.html"
        },

        {
            key: "restaurant",
            label: "Restaurant",
            icon: "🍽️",
            page: "restaurant.html"
        },

        {
            key: "inventory",
            label: "Inventory",
            icon: "📦",
            page: "inventory.html"
        },

        {
            key: "payments",
            label: "Payments",
            icon: "💳",
            page: "payments.html"
        },

        {
            key: "expenses",
            label: "Expenses",
            icon: "💸",
            page: "expenses.html"
        },

        {
            key: "employees",
            label: "Employees",
            icon: "👨‍💼",
            page: "employees.html"
        },

        {
            key: "housekeeping",
            label: "Housekeeping",
            icon: "🧹",
            page: "housekeeping.html"
        },

        {
            key: "maintenance",
            label: "Maintenance",
            icon: "🔧",
            page: "maintenance.html"
        },

        {
            key: "reports",
            label: "Reports",
            icon: "📊",
            page: "reports.html"
        },

        {
            key: "settings",
            label: "Settings",
            icon: "⚙️",
            page: "settings.html"
        },

        {
            key: "cashier",
            label: "Cashier & Cash",
            icon: "💰",
            page: "cashier.html"
        },

        {
            key: "bank_accounts",
            label: "Bank Accounts",
            icon: "🏦",

            /* ACTUAL FILE NAME IN THE REPOSITORY */
            page: "bank_accounts.html"
        },

        {
            key: "financial_transactions",
            label: "Financial Transactions",
            icon: "📒",

            /* ACTUAL FILE NAME IN THE REPOSITORY */
            page: "financial_transactions.html"
        }
    ];


    /* =====================================================
       ROLE PERMISSIONS
       ===================================================== */

    const ROLE_PERMISSIONS = {

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
       SUPABASE
       ===================================================== */

    function getSupabase() {

        if (
            window.supabase &&
            typeof window.supabase.from ===
            "function"
        ) {
            return window.supabase;
        }


        if (
            window.supabaseClient &&
            typeof window.supabaseClient.from ===
            "function"
        ) {
            return window.supabaseClient;
        }


        return null;
    }


    /* =====================================================
       FIND / CREATE SIDEBAR
       ===================================================== */

    function getSidebar() {

        let sidebar =
            document.getElementById(
                SIDEBAR_ID
            );


        if (sidebar) {
            return sidebar;
        }


        /*
         * Create the sidebar ourselves if the page
         * does not already contain it.
         *
         * This prevents pages from depending on
         * different sidebar HTML.
         */

        sidebar =
            document.createElement("aside");


        sidebar.id =
            SIDEBAR_ID;


        sidebar.className =
            "edutech-universal-sidebar";


        /*
         * IMPORTANT:
         * append only the sidebar.
         * Never replace document.body.
         */

        if (document.body) {

            document.body.insertBefore(
                sidebar,
                document.body.firstChild
            );

        }


        return sidebar;
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
       ROLE DISPLAY
       ===================================================== */

    function formatRole(role) {

        if (!role) {
            return "User";
        }


        return String(role)
            .replace(/_/g, " ")
            .replace(/\b\w/g, function (letter) {
                return letter.toUpperCase();
            });
    }


    /* =====================================================
       CACHE PROFILE
       ===================================================== */

    function saveProfile(profile) {

        if (!profile) {
            return;
        }


        try {

            sessionStorage.setItem(
                PROFILE_CACHE_KEY,
                JSON.stringify(profile)
            );

        } catch (error) {

            console.warn(
                "Unable to save sidebar profile:",
                error
            );
        }
    }


    function getCachedProfile() {

        try {

            const value =
                sessionStorage.getItem(
                    PROFILE_CACHE_KEY
                );


            if (!value) {
                return null;
            }


            return JSON.parse(value);

        } catch (error) {

            return null;
        }
    }


    /* =====================================================
       LOAD PROFILE
       ===================================================== */

    async function loadProfile() {

        const cached =
            getCachedProfile();


        const supabase =
            getSupabase();


        /*
         * If Supabase is not ready yet,
         * immediately use the cached profile.
         */

        if (!supabase) {

            return cached;
        }


        try {

            const {
                data: sessionData
            } =
                await supabase.auth.getSession();


            const session =
                sessionData &&
                sessionData.session;


            if (
                !session ||
                !session.user
            ) {

                return cached;
            }


            const {
                data: profile,
                error
            } =
                await supabase
                    .from("profiles")
                    .select(
                        "id, full_name, role, hotel_id, is_active"
                    )
                    .eq(
                        "id",
                        session.user.id
                    )
                    .maybeSingle();


            if (
                error ||
                !profile
            ) {

                console.warn(
                    "Sidebar profile could not be refreshed:",
                    error
                );

                return cached;
            }


            saveProfile(profile);

            return profile;

        } catch (error) {

            console.warn(
                "Sidebar profile loading warning:",
                error
            );

            return cached;
        }
    }


    /* =====================================================
       LOAD HOTEL
       ===================================================== */

    async function loadHotel(hotelId) {

        if (!hotelId) {
            return null;
        }


        const supabase =
            getSupabase();


        if (!supabase) {
            return null;
        }


        try {

            const {
                data: hotel,
                error
            } =
                await supabase
                    .from("hotels")
                    .select(
                        "id, name, location, phone, status"
                    )
                    .eq(
                        "id",
                        hotelId
                    )
                    .maybeSingle();


            if (
                error ||
                !hotel
            ) {

                console.warn(
                    "Hotel loading warning:",
                    error
                );

                return null;
            }


            return hotel;

        } catch (error) {

            console.warn(
                "Hotel loading error:",
                error
            );

            return null;
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
       INSTALL SIDEBAR CSS
       ===================================================== */

    function installCSS() {

        if (
            document.getElementById(
                "edutech-universal-sidebar-css"
            )
        ) {
            return;
        }


        const style =
            document.createElement("style");


        style.id =
            "edutech-universal-sidebar-css";


        style.textContent = `

            /* =================================================
               SIDEBAR
               ================================================= */

            #appSidebar {
                position: fixed !important;
                left: 0 !important;
                top: 0 !important;
                bottom: 0 !important;

                width: 225px !important;
                min-width: 225px !important;
                max-width: 225px !important;

                height: 100vh !important;

                margin: 0 !important;
                padding: 0 !important;

                z-index: 99999 !important;

                display: flex !important;
                flex-direction: column !important;

                background: #111827 !important;

                color: #ffffff !important;

                box-sizing: border-box !important;

                overflow: hidden !important;

                font-family:
                    Arial,
                    Helvetica,
                    sans-serif !important;
            }


            /* =================================================
               BRAND
               ================================================= */

            #appSidebar .edutech-brand {
                flex-shrink: 0 !important;

                height: 66px !important;

                display: flex !important;
                align-items: center !important;

                padding:
                    0 16px !important;

                box-sizing: border-box !important;

                border-bottom:
                    1px solid
                    rgba(255,255,255,.10) !important;
            }


            #appSidebar .edutech-brand-title {
                font-size: 18px !important;
                font-weight: 800 !important;
                line-height: 1.1 !important;

                color: #ffffff !important;
            }


            #appSidebar .edutech-brand-subtitle {
                font-size: 10px !important;
                color: #9ca3af !important;

                margin-top: 3px !important;
            }


            /* =================================================
               HOTEL
               ================================================= */

            #appSidebar .edutech-hotel {
                flex-shrink: 0 !important;

                padding:
                    13px 15px !important;

                border-bottom:
                    1px solid
                    rgba(255,255,255,.10) !important;
            }


            #appSidebar .edutech-hotel-name {
                color: #ffffff !important;

                font-size: 14px !important;
                font-weight: 700 !important;

                line-height: 1.3 !important;
            }


            #appSidebar .edutech-hotel-location {
                color: #9ca3af !important;

                font-size: 11px !important;

                margin-top: 3px !important;

                line-height: 1.3 !important;
            }


            /* =================================================
               USER
               ================================================= */

            #appSidebar .edutech-user {
                flex-shrink: 0 !important;

                padding:
                    11px 15px !important;

                border-bottom:
                    1px solid
                    rgba(255,255,255,.10) !important;
            }


            #appSidebar .edutech-user-name {
                color: #ffffff !important;

                font-size: 13px !important;
                font-weight: 700 !important;
            }


            #appSidebar .edutech-user-role {
                color: #9ca3af !important;

                font-size: 11px !important;

                margin-top: 3px !important;
            }


            /* =================================================
               NAVIGATION
               ================================================= */

            #appSidebar .edutech-nav {
                flex: 1 1 auto !important;

                min-height: 0 !important;

                overflow-y: auto !important;
                overflow-x: hidden !important;

                padding:
                    8px 7px !important;

                box-sizing: border-box !important;
            }


            #appSidebar .edutech-nav::-webkit-scrollbar {
                width: 6px !important;
            }


            #appSidebar .edutech-nav::-webkit-scrollbar-track {
                background: transparent !important;
            }


            #appSidebar .edutech-nav::-webkit-scrollbar-thumb {
                background:
                    rgba(255,255,255,.20) !important;

                border-radius: 10px !important;
            }


            #appSidebar .edutech-nav a {
                display: flex !important;

                align-items: center !important;

                width: 100% !important;

                min-height: 38px !important;

                margin:
                    2px 0 !important;

                padding:
                    8px 10px !important;

                box-sizing: border-box !important;

                border-radius: 7px !important;

                text-decoration: none !important;

                color: #d1d5db !important;

                background: transparent !important;

                font-size: 12px !important;

                font-weight: 600 !important;

                line-height: 1.2 !important;

                transition:
                    background .15s ease,
                    color .15s ease !important;
            }


            #appSidebar .edutech-nav a:hover {
                background:
                    rgba(255,255,255,.10) !important;

                color: #ffffff !important;
            }


            #appSidebar .edutech-nav a.active {
                background:
                    #2563eb !important;

                color: #ffffff !important;
            }


            #appSidebar .edutech-nav-icon {
                width: 24px !important;
                min-width: 24px !important;

                margin-right: 7px !important;

                text-align: center !important;

                font-size: 15px !important;
            }


            #appSidebar .edutech-nav-text {
                white-space: nowrap !important;

                overflow: hidden !important;

                text-overflow: ellipsis !important;
            }


            /* =================================================
               LOGOUT
               ================================================= */

            #appSidebar .edutech-logout-area {
                flex-shrink: 0 !important;

                padding:
                    9px 8px !important;

                border-top:
                    1px solid
                    rgba(255,255,255,.10) !important;
            }


            #appSidebar .edutech-logout {
                width: 100% !important;

                min-height: 40px !important;

                border: none !important;

                border-radius: 7px !important;

                background:
                    #b91c1c !important;

                color: #ffffff !important;

                cursor: pointer !important;

                font-size: 12px !important;

                font-weight: 700 !important;
            }


            #appSidebar .edutech-logout:hover {
                background:
                    #dc2626 !important;
            }


            /* =================================================
               MOBILE
               ================================================= */

            @media (max-width: 700px) {

                #appSidebar {
                    width: 215px !important;
                    min-width: 215px !important;
                    max-width: 215px !important;
                }

            }

        `;


        document.head.appendChild(style);
    }


    /* =====================================================
       BUILD SIDEBAR
       ===================================================== */

    function buildSidebar(
        profile,
        hotel
    ) {

        const sidebar =
            getSidebar();


        if (!sidebar) {
            return;
        }


        const role =
            profile &&
            profile.role
                ? String(profile.role)
                    .toLowerCase()
                    .trim()
                : "receptionist";


        const allowedModules =
            ROLE_PERMISSIONS[role] ||
            ROLE_PERMISSIONS.receptionist;


        const currentPage =
            getCurrentPage();


        const hotelName =
            hotel &&
            hotel.name
                ? hotel.name
                : "Hotel Management System";


        const hotelLocation =
            hotel &&
            hotel.location
                ? hotel.location
                : "";


        const userName =
            profile &&
            profile.full_name
                ? profile.full_name
                : "System User";


        /*
         * Build HTML in memory first.
         *
         * Only the SIDEBAR itself is replaced.
         *
         * The rest of the page is completely untouched.
         */

        let navHTML = "";


        MODULES.forEach(function (module) {

            if (
                !allowedModules.includes(
                    module.key
                )
            ) {
                return;
            }


            const isActive =
                currentPage ===
                module.page;


            navHTML += `

                <a
                    href="${module.page}"
                    class="${isActive ? "active" : ""}"
                    data-module="${module.key}"
                >

                    <span class="edutech-nav-icon">
                        ${module.icon}
                    </span>

                    <span class="edutech-nav-text">
                        ${escapeHTML(module.label)}
                    </span>

                </a>

            `;
        });


        sidebar.innerHTML = `

            <div class="edutech-brand">

                <div>

                    <div class="edutech-brand-title">
                        EDU TECH
                    </div>

                    <div class="edutech-brand-subtitle">
                        Hotel Management System
                    </div>

                </div>

            </div>


            <div class="edutech-hotel">

                <div class="edutech-hotel-name">
                    ${escapeHTML(hotelName)}
                </div>

                ${
                    hotelLocation
                    ? `
                        <div class="edutech-hotel-location">
                            ${escapeHTML(hotelLocation)}
                        </div>
                    `
                    : ""
                }

            </div>


            <div class="edutech-user">

                <div class="edutech-user-name">
                    ${escapeHTML(userName)}
                </div>

                <div class="edutech-user-role">
                    ${escapeHTML(
                        formatRole(role)
                    )}
                </div>

            </div>


            <nav
                class="edutech-nav"
                aria-label="Hotel modules"
            >

                ${navHTML}

            </nav>


            <div class="edutech-logout-area">

                <button
                    type="button"
                    class="edutech-logout"
                    id="edutechLogoutButton"
                >
                    🚪 Logout
                </button>

            </div>
        `;


        /*
         * ONE logout handler.
         */

        const logoutButton =
            document.getElementById(
                "edutechLogoutButton"
            );


        if (logoutButton) {

            logoutButton.addEventListener(
                "click",
                logoutUser
            );
        }
    }


    /* =====================================================
       LOGOUT
       ===================================================== */

    async function logoutUser() {

        const button =
            document.getElementById(
                "edutechLogoutButton"
            );


        if (button) {

            button.disabled = true;

            button.textContent =
                "Logging out...";
        }


        try {

            const supabase =
                getSupabase();


            if (supabase) {

                await supabase.auth.signOut();
            }

        } catch (error) {

            console.warn(
                "Logout warning:",
                error
            );

        } finally {

            try {

                sessionStorage.removeItem(
                    PROFILE_CACHE_KEY
                );

                sessionStorage.removeItem(
                    "EDUTECH_ACCESS_PROFILE"
                );

                sessionStorage.removeItem(
                    "hotelId"
                );

            } catch (error) {
                // Ignore storage errors
            }


            window.location.href =
                "login.html";
        }
    }


    /* =====================================================
       INITIALIZE
       ===================================================== */

    async function initialize() {

        /*
         * Wait until DOM exists.
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
         * Install CSS immediately.
         */

        installCSS();


        /*
         * Get cached profile first.
         *
         * This means the sidebar can appear immediately.
         */

        let profile =
            getCachedProfile();


        /*
         * Create sidebar immediately.
         *
         * No waiting for Supabase.
         */

        buildSidebar(
            profile,
            null
        );


        /*
         * Load fresh profile.
         */

        try {

            const freshProfile =
                await loadProfile();


            if (freshProfile) {

                profile =
                    freshProfile;


                /*
                 * Load hotel information.
                 */

                const hotel =
                    await loadHotel(
                        profile.hotel_id
                    );


                /*
                 * Rebuild ONLY the sidebar.
                 */

                buildSidebar(
                    profile,
                    hotel
                );

            }

        } catch (error) {

            console.warn(
                "Sidebar initialization warning:",
                error
            );

            /*
             * IMPORTANT:
             * Existing page remains untouched.
             *
             * We do NOT blank the page.
             * We do NOT reload the page.
             * We do NOT remove the sidebar.
             */
        }
    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    window.EDUTECH_SIDEBAR = {

        modules: MODULES,

        permissions: ROLE_PERMISSIONS,

        getSidebar: getSidebar,

        getCurrentPage: getCurrentPage,

        loadProfile: loadProfile,

        loadHotel: loadHotel,

        buildSidebar: buildSidebar,

        logout: logoutUser
    };


    /* =====================================================
       START
       ===================================================== */

    initialize();

})();