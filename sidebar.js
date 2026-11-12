/* =========================================================
   EDU TECH HOTEL MANAGEMENT SYSTEM
   UNIVERSAL RESPONSIVE SIDEBAR
   ---------------------------------------------------------
   ONE SIDEBAR
   ONE LOGOUT
   ONE NAVIGATION SYSTEM

   FEATURES
   ---------------------------------------------------------
   Desktop:
   - Fixed sidebar
   - All authorized modules visible
   - Stable navigation

   Mobile:
   - Hamburger menu
   - Slide-out sidebar
   - Dark overlay
   - Tap outside to close
   - Module click closes sidebar

   IMPORTANT
   ---------------------------------------------------------
   - This file controls ONLY the sidebar/navigation.
   - It NEVER replaces document.body.
   - It NEVER replaces page content.
   - It NEVER performs access denial.
   - Access control remains in access-control.js.
   ========================================================= */

(function () {

    "use strict";

    /* =====================================================
       PREVENT DUPLICATE INITIALIZATION
       ===================================================== */

    if (window.__EDUTECH_UNIVERSAL_SIDEBAR__) {
        return;
    }

    window.__EDUTECH_UNIVERSAL_SIDEBAR__ = true;


    /* =====================================================
       CONFIGURATION
       ===================================================== */

    const SIDEBAR_ID = "appSidebar";

    const PROFILE_CACHE_KEY =
        "EDUTECH_SIDEBAR_PROFILE";

    const MOBILE_HEADER_ID =
        "edutechMobileHeader";

    const MOBILE_OVERLAY_ID =
        "edutechMobileOverlay";

    const MOBILE_BUTTON_ID =
        "edutechMobileMenuButton";


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
            page: "bank_accounts.html"
        },

        {
            key: "financial_transactions",
            label: "Financial Transactions",
            icon: "📒",
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
            typeof window.supabase.from === "function"
        ) {
            return window.supabase;
        }

        if (
            window.supabaseClient &&
            typeof window.supabaseClient.from === "function"
        ) {
            return window.supabaseClient;
        }

        return null;
    }


    /* =====================================================
       GET OR CREATE SIDEBAR
       ===================================================== */

    function getSidebar() {

        let sidebar =
            document.getElementById(SIDEBAR_ID);

        if (sidebar) {
            return sidebar;
        }

        sidebar =
            document.createElement("aside");

        sidebar.id = SIDEBAR_ID;

        sidebar.className =
            "edutech-universal-sidebar";

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
       FORMAT ROLE
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
       SAVE PROFILE
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


    /* =====================================================
       GET CACHED PROFILE
       ===================================================== */

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
       MOBILE SIDEBAR HELPERS
       ===================================================== */

    function getMobileOverlay() {

        return document.getElementById(
            MOBILE_OVERLAY_ID
        );
    }


    function getMobileButton() {

        return document.getElementById(
            MOBILE_BUTTON_ID
        );
    }


    function openMobileSidebar() {

        const sidebar =
            getSidebar();

        const overlay =
            getMobileOverlay();

        if (sidebar) {

            sidebar.classList.add(
                "mobile-open"
            );
        }

        if (overlay) {

            overlay.classList.add(
                "active"
            );
        }

        document.body.classList.add(
            "edutech-mobile-sidebar-open"
        );
    }


    function closeMobileSidebar() {

        const sidebar =
            document.getElementById(
                SIDEBAR_ID
            );

        const overlay =
            getMobileOverlay();

        if (sidebar) {

            sidebar.classList.remove(
                "mobile-open"
            );
        }

        if (overlay) {

            overlay.classList.remove(
                "active"
            );
        }

        document.body.classList.remove(
            "edutech-mobile-sidebar-open"
        );
    }


    function toggleMobileSidebar() {

        const sidebar =
            getSidebar();

        if (!sidebar) {
            return;
        }

        if (
            sidebar.classList.contains(
                "mobile-open"
            )
        ) {

            closeMobileSidebar();

        } else {

            openMobileSidebar();
        }
    }


    /* =====================================================
       CREATE MOBILE HEADER
       ===================================================== */

    function createMobileHeader() {

        if (
            document.getElementById(
                MOBILE_HEADER_ID
            )
        ) {
            return;
        }

        if (!document.body) {
            return;
        }

        const header =
            document.createElement("header");

        header.id =
            MOBILE_HEADER_ID;

        header.className =
            "edutech-mobile-header";

        header.innerHTML = `

            <button
                type="button"
                id="${MOBILE_BUTTON_ID}"
                class="edutech-mobile-menu-button"
                aria-label="Open hotel menu"
                aria-expanded="false"
            >
                ☰
            </button>

            <div class="edutech-mobile-title">
                EDU TECH HMS
            </div>

        `;

        document.body.insertBefore(
            header,
            document.body.firstChild
        );

        const button =
            document.getElementById(
                MOBILE_BUTTON_ID
            );

        if (button) {

            button.addEventListener(
                "click",
                function () {

                    toggleMobileSidebar();

                    const sidebar =
                        getSidebar();

                    button.setAttribute(
                        "aria-expanded",
                        sidebar &&
                        sidebar.classList.contains(
                            "mobile-open"
                        )
                            ? "true"
                            : "false"
                    );
                }
            );
        }
    }


    /* =====================================================
       CREATE MOBILE OVERLAY
       ===================================================== */

    function createMobileOverlay() {

        if (
            document.getElementById(
                MOBILE_OVERLAY_ID
            )
        ) {
            return;
        }

        if (!document.body) {
            return;
        }

        const overlay =
            document.createElement("div");

        overlay.id =
            MOBILE_OVERLAY_ID;

        overlay.className =
            "edutech-mobile-overlay";

        overlay.setAttribute(
            "aria-hidden",
            "true"
        );

        document.body.appendChild(
            overlay
        );

        overlay.addEventListener(
            "click",
            function () {

                closeMobileSidebar();

                const button =
                    getMobileButton();

                if (button) {

                    button.setAttribute(
                        "aria-expanded",
                        "false"
                    );
                }
            }
        );
    }


    /* =====================================================
       MOBILE RESPONSIVE ELEMENTS
       ===================================================== */

    function setupMobileInterface() {

        createMobileHeader();

        createMobileOverlay();

        window.addEventListener(
            "resize",
            function () {

                if (
                    window.innerWidth >= 1000
                ) {

                    closeMobileSidebar();

                    const button =
                        getMobileButton();

                    if (button) {

                        button.setAttribute(
                            "aria-expanded",
                            "false"
                        );
                    }
                }
            }
        );

        document.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key === "Escape"
                ) {

                    closeMobileSidebar();

                    const button =
                        getMobileButton();

                    if (button) {

                        button.setAttribute(
                            "aria-expanded",
                            "false"
                        );
                    }
                }
            }
        );
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
               DESKTOP SIDEBAR
               ================================================= */

            #appSidebar {

                position: fixed !important;

                left: 0 !important;
                top: 0 !important;
                bottom: 0 !important;

                width: 180px !important;
                min-width: 180px !important;
                max-width: 180px !important;

                height: 100vh !important;
                height: 100dvh !important;

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

                transition:
                    left 0.25s ease !important;
            }


            /* =================================================
               BRAND
               ================================================= */

            #appSidebar .edutech-brand {

                flex-shrink: 0 !important;

                min-height: 66px !important;

                height: 66px !important;

                display: flex !important;

                align-items: center !important;

                padding:
                    0 12px !important;

                box-sizing: border-box !important;

                border-bottom:
                    1px solid
                    rgba(255,255,255,.10) !important;
            }


            #appSidebar .edutech-brand-title {

                font-size: 17px !important;

                font-weight: 800 !important;

                line-height: 1.1 !important;

                color: #ffffff !important;
            }


            #appSidebar .edutech-brand-subtitle {

                font-size: 9px !important;

                color: #9ca3af !important;

                margin-top: 3px !important;

                line-height: 1.2 !important;
            }


            /* =================================================
               HOTEL
               ================================================= */

            #appSidebar .edutech-hotel {

                flex-shrink: 0 !important;

                padding:
                    10px 12px !important;

                border-bottom:
                    1px solid
                    rgba(255,255,255,.10) !important;
            }


            #appSidebar .edutech-hotel-name {

                color: #ffffff !important;

                font-size: 12px !important;

                font-weight: 700 !important;

                line-height: 1.3 !important;

                overflow-wrap: anywhere !important;
            }


            #appSidebar .edutech-hotel-location {

                color: #9ca3af !important;

                font-size: 9px !important;

                margin-top: 3px !important;

                line-height: 1.3 !important;

                overflow-wrap: anywhere !important;
            }


            /* =================================================
               USER
               ================================================= */

            #appSidebar .edutech-user {

                flex-shrink: 0 !important;

                padding:
                    9px 12px !important;

                border-bottom:
                    1px solid
                    rgba(255,255,255,.10) !important;
            }


            #appSidebar .edutech-user-name {

                color: #ffffff !important;

                font-size: 11px !important;

                font-weight: 700 !important;

                overflow-wrap: anywhere !important;
            }


            #appSidebar .edutech-user-role {

                color: #9ca3af !important;

                font-size: 9px !important;

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
                    6px 5px !important;

                box-sizing: border-box !important;
            }


            #appSidebar .edutech-nav::-webkit-scrollbar {

                width: 5px !important;
            }


            #appSidebar .edutech-nav::-webkit-scrollbar-track {

                background: transparent !important;
            }


            #appSidebar .edutech-nav::-webkit-scrollbar-thumb {

                background:
                    rgba(255,255,255,.22) !important;

                border-radius: 10px !important;
            }


            #appSidebar .edutech-nav a {

                display: flex !important;

                align-items: center !important;

                width: 100% !important;

                min-height: 32px !important;

                margin:
                    1px 0 !important;

                padding:
                    6px 6px !important;

                box-sizing: border-box !important;

                border-radius: 6px !important;

                text-decoration: none !important;

                color: #d1d5db !important;

                background: transparent !important;

                font-size: 10px !important;

                font-weight: 600 !important;

                line-height: 1.2 !important;

                transition:
                    background .15s ease,
                    color .15s ease !important;

                touch-action: manipulation !important;
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

                width: 22px !important;

                min-width: 22px !important;

                margin-right: 4px !important;

                text-align: center !important;

                font-size: 13px !important;
            }


            #appSidebar .edutech-nav-text {

                flex: 1 !important;

                min-width: 0 !important;

                white-space: normal !important;

                overflow-wrap: anywhere !important;
            }


            /* =================================================
               LOGOUT
               ================================================= */

            #appSidebar .edutech-logout-area {

                flex-shrink: 0 !important;

                padding:
                    7px 6px !important;

                border-top:
                    1px solid
                    rgba(255,255,255,.10) !important;
            }


            #appSidebar .edutech-logout {

                width: 100% !important;

                min-height: 34px !important;

                border: none !important;

                border-radius: 6px !important;

                background:
                    #b91c1c !important;

                color: #ffffff !important;

                cursor: pointer !important;

                font-size: 10px !important;

                font-weight: 700 !important;

                touch-action: manipulation !important;
            }


            #appSidebar .edutech-logout:hover {

                background:
                    #dc2626 !important;
            }


            /* =================================================
               MOBILE HEADER
               ================================================= */

            .edutech-mobile-header {

                display: none !important;

                position: sticky !important;

                top: 0 !important;

                width: 100% !important;

                min-height: 54px !important;

                align-items: center !important;

                gap: 10px !important;

                padding:
                    5px 9px !important;

                background:
                    #0d47a1 !important;

                color: #ffffff !important;

                z-index: 99998 !important;

                box-sizing: border-box !important;

                box-shadow:
                    0 2px 8px
                    rgba(0,0,0,.20) !important;
            }


            .edutech-mobile-menu-button {

                width: 44px !important;

                height: 44px !important;

                min-width: 44px !important;

                border: none !important;

                border-radius: 8px !important;

                background:
                    rgba(255,255,255,.16) !important;

                color: #ffffff !important;

                font-size: 24px !important;

                display: flex !important;

                align-items: center !important;

                justify-content: center !important;

                cursor: pointer !important;

                touch-action: manipulation !important;
            }


            .edutech-mobile-title {

                flex: 1 !important;

                min-width: 0 !important;

                color: #ffffff !important;

                font-size: 15px !important;

                font-weight: 700 !important;

                white-space: nowrap !important;

                overflow: hidden !important;

                text-overflow: ellipsis !important;
            }


            /* =================================================
               MOBILE OVERLAY
               ================================================= */

            .edutech-mobile-overlay {

                position: fixed !important;

                inset: 0 !important;

                width: 100vw !important;

                height: 100vh !important;

                height: 100dvh !important;

                background:
                    rgba(0,0,0,.45) !important;

                z-index: 99998 !important;

                display: none !important;
            }


            .edutech-mobile-overlay.active {

                display: block !important;
            }


            /* =================================================
               MOBILE SIDEBAR
               ================================================= */

            @media (max-width: 999px) {

                #appSidebar {

                    left: -285px !important;

                    width: 270px !important;

                    min-width: 270px !important;

                    max-width: 270px !important;

                    height: 100vh !important;

                    height: 100dvh !important;

                    z-index: 999999 !important;

                    box-shadow:
                        4px 0 20px
                        rgba(0,0,0,.35) !important;
                }


                #appSidebar.mobile-open {

                    left: 0 !important;
                }


                .edutech-mobile-header {

                    display: flex !important;
                }


                #appSidebar .edutech-brand {

                    min-height: 70px !important;

                    height: 70px !important;

                    padding:
                        0 14px !important;
                }


                #appSidebar .edutech-brand-title {

                    font-size: 18px !important;
                }


                #appSidebar .edutech-brand-subtitle {

                    font-size: 10px !important;
                }


                #appSidebar .edutech-hotel {

                    padding:
                        12px 14px !important;
                }


                #appSidebar .edutech-hotel-name {

                    font-size: 14px !important;
                }


                #appSidebar .edutech-hotel-location {

                    font-size: 11px !important;
                }


                #appSidebar .edutech-user {

                    padding:
                        11px 14px !important;
                }


                #appSidebar .edutech-user-name {

                    font-size: 13px !important;
                }


                #appSidebar .edutech-user-role {

                    font-size: 11px !important;
                }


                #appSidebar .edutech-nav {

                    padding:
                        8px 7px !important;
                }


                #appSidebar .edutech-nav a {

                    min-height: 46px !important;

                    margin:
                        2px 0 !important;

                    padding:
                        10px 10px !important;

                    border-radius: 7px !important;

                    font-size: 14px !important;
                }


                #appSidebar .edutech-nav-icon {

                    width: 30px !important;

                    min-width: 30px !important;

                    margin-right: 7px !important;

                    font-size: 18px !important;
                }


                #appSidebar .edutech-nav-text {

                    font-size: 14px !important;

                    line-height: 1.25 !important;
                }


                #appSidebar .edutech-logout-area {

                    padding:
                        9px 8px !important;
                }


                #appSidebar .edutech-logout {

                    min-height: 44px !important;

                    font-size: 13px !important;
                }
            }


            /* =================================================
               SMALL PHONES
               ================================================= */

            @media (max-width: 480px) {

                #appSidebar {

                    left: -275px !important;

                    width: 260px !important;

                    min-width: 260px !important;

                    max-width: 260px !important;
                }


                #appSidebar.mobile-open {

                    left: 0 !important;
                }


                .edutech-mobile-header {

                    min-height: 52px !important;

                    padding:
                        4px 8px !important;
                }


                .edutech-mobile-menu-button {

                    width: 42px !important;

                    height: 42px !important;

                    min-width: 42px !important;

                    font-size: 23px !important;
                }


                .edutech-mobile-title {

                    font-size: 14px !important;
                }
            }

        `;

        document.head.appendChild(style);
    }


    /* =====================================================
       CLOSE SIDEBAR WHEN MODULE IS CLICKED
       ===================================================== */

    function installNavigationHandlers() {

        const sidebar =
            document.getElementById(
                SIDEBAR_ID
            );

        if (!sidebar) {
            return;
        }

        const links =
            sidebar.querySelectorAll(
                ".edutech-nav a"
            );

        links.forEach(function (link) {

            link.addEventListener(
                "click",
                function () {

                    closeMobileSidebar();

                    const button =
                        getMobileButton();

                    if (button) {

                        button.setAttribute(
                            "aria-expanded",
                            "false"
                        );
                    }
                }
            );

        });
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


        /* =================================================
           BUILD NAVIGATION
           ================================================= */

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


        /* =================================================
           SIDEBAR HTML
           ================================================= */

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


        /* =================================================
           LOGOUT
           ================================================= */

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


        /* =================================================
           MOBILE NAVIGATION
           ================================================= */

        installNavigationHandlers();
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

                /* Ignore storage errors */
            }


            window.location.href =
                "login.html";
        }
    }


    /* =====================================================
       INITIALIZE
       ===================================================== */

    async function initialize() {

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


        /* =================================================
           INSTALL CSS
           ================================================= */

        installCSS();


        /* =================================================
           CREATE MOBILE CONTROLS
           ================================================= */

        setupMobileInterface();


        /* =================================================
           GET CACHED PROFILE
           ================================================= */

        let profile =
            getCachedProfile();


        /* =================================================
           CREATE SIDEBAR IMMEDIATELY
           ================================================= */

        buildSidebar(
            profile,
            null
        );


        /* =================================================
           LOAD FRESH PROFILE
           ================================================= */

        try {

            const freshProfile =
                await loadProfile();

            if (freshProfile) {

                profile =
                    freshProfile;


                /* =========================================
                   LOAD HOTEL
                   ========================================= */

                const hotel =
                    await loadHotel(
                        profile.hotel_id
                    );


                /* =========================================
                   REBUILD SIDEBAR ONLY
                   ========================================= */

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
             * IMPORTANT
             * ---------------------------------------------
             * Never blank the page.
             * Never replace document.body.
             * Never reload the page.
             */
        }
    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    window.EDUTECH_SIDEBAR = {

        modules:
            MODULES,

        permissions:
            ROLE_PERMISSIONS,

        getSidebar:
            getSidebar,

        getCurrentPage:
            getCurrentPage,

        loadProfile:
            loadProfile,

        loadHotel:
            loadHotel,

        buildSidebar:
            buildSidebar,

        logout:
            logoutUser,

        openMobileSidebar:
            openMobileSidebar,

        closeMobileSidebar:
            closeMobileSidebar,

        toggleMobileSidebar:
            toggleMobileSidebar
    };


    /* =====================================================
       START
       ===================================================== */

    initialize();

})();