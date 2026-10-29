/* ============================================================
   GLOBAL ROLE-BASED SIDEBAR CONTROL
   EDU TECH HOTEL MANAGEMENT SYSTEM
   ============================================================

   SYSTEM OWNER
   - Full access to all modules

   HOTEL OWNER
   - All hotel operational modules
   - No Hotels management

   MANAGER
   - All hotel operational modules
   - No Hotels management

   RECEPTIONIST
   - Dashboard
   - Rooms
   - Guests
   - Reservations
   - Check-in
   - Check-out
   - Payments
   - Reports

   IMPORTANT:
   - Dashboard is always visible.
   - Logout is always visible.
   - Unknown/non-module sidebar links are never hidden.
   - Only protected module links are controlled.
   ============================================================ */

(function () {

    "use strict";


    /* =========================================================
       ROLE PERMISSIONS
       ========================================================= */

    const ROLE_PERMISSIONS = {

        system_owner: [
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
            "hotels"
        ],

        hotel_owner: [
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
            "settings"
        ],

        manager: [
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
            "settings"
        ],

        receptionist: [
            "rooms",
            "guests",
            "reservations",
            "checkin",
            "checkout",
            "payments",
            "reports"
        ]

    };


    /* =========================================================
       PROTECTED MODULE NAMES
       ========================================================= */

    const PROTECTED_MODULES = [
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
        "hotels"
    ];


    /* =========================================================
       GET CURRENT USER ROLE
       ========================================================= */

    function getCurrentUserRole() {

        const sessionRole =
            sessionStorage.getItem("userRole");

        const localRole =
            localStorage.getItem("userRole");

        const role =
            sessionRole ||
            localRole ||
            "";

        return String(role)
            .toLowerCase()
            .trim();

    }


    /* =========================================================
       IDENTIFY MODULE FROM SIDEBAR LINK
       ========================================================= */

    function getModuleFromLink(link) {

        if (!link) {
            return null;
        }


        /* -----------------------------------------------------
           First check data-module if available
           ----------------------------------------------------- */

        const dataModule =
            link.getAttribute("data-module");


        if (
            dataModule &&
            PROTECTED_MODULES.includes(
                dataModule.toLowerCase().trim()
            )
        ) {

            return dataModule
                .toLowerCase()
                .trim();

        }


        /* -----------------------------------------------------
           Otherwise identify module from href
           ----------------------------------------------------- */

        const href =
            link.getAttribute("href") || "";


        const cleanHref =
            href
                .split("?")[0]
                .split("#")[0]
                .toLowerCase()
                .trim();


        if (cleanHref.includes("rooms.html")) {
            return "rooms";
        }

        if (cleanHref.includes("guests.html")) {
            return "guests";
        }

        if (cleanHref.includes("reservations.html")) {
            return "reservations";
        }

        if (cleanHref.includes("checkin.html")) {
            return "checkin";
        }

        if (cleanHref.includes("checkout.html")) {
            return "checkout";
        }

        if (cleanHref.includes("restaurant.html")) {
            return "restaurant";
        }

        if (cleanHref.includes("inventory.html")) {
            return "inventory";
        }

        if (cleanHref.includes("payments.html")) {
            return "payments";
        }

        if (cleanHref.includes("expenses.html")) {
            return "expenses";
        }

        if (cleanHref.includes("employees.html")) {
            return "employees";
        }

        if (cleanHref.includes("housekeeping.html")) {
            return "housekeeping";
        }

        if (cleanHref.includes("maintenance.html")) {
            return "maintenance";
        }

        if (cleanHref.includes("reports.html")) {
            return "reports";
        }

        if (cleanHref.includes("settings.html")) {
            return "settings";
        }

        if (cleanHref.includes("hotels.html")) {
            return "hotels";
        }


        return null;

    }


    /* =========================================================
       CHECK WHETHER LINK IS DASHBOARD
       ========================================================= */

    function isDashboardLink(link) {

        if (!link) {
            return false;
        }


        const dataModule =
            link.getAttribute("data-module");


        if (
            dataModule &&
            dataModule.toLowerCase().trim() ===
            "dashboard"
        ) {

            return true;

        }


        const href =
            link.getAttribute("href") || "";


        const cleanHref =
            href
                .split("?")[0]
                .split("#")[0]
                .toLowerCase()
                .trim();


        return (
            cleanHref === "./" ||
            cleanHref === "/" ||
            cleanHref === "index.html" ||
            cleanHref === "./index.html" ||
            cleanHref.endsWith("/index.html")
        );

    }


    /* =========================================================
       CHECK WHETHER LINK IS LOGOUT
       ========================================================= */

    function isLogoutLink(link) {

        if (!link) {
            return false;
        }


        /* -----------------------------------------------------
           Data attributes
           ----------------------------------------------------- */

        const action =
            (
                link.getAttribute("data-action") ||
                ""
            )
            .toLowerCase()
            .trim();


        if (action === "logout") {
            return true;
        }


        const module =
            (
                link.getAttribute("data-module") ||
                ""
            )
            .toLowerCase()
            .trim();


        if (
            module === "logout" ||
            module === "signout"
        ) {

            return true;

        }


        /* -----------------------------------------------------
           Classes
           ----------------------------------------------------- */

        const className =
            (
                link.className ||
                ""
            )
            .toString()
            .toLowerCase();


        if (
            className.includes("logout") ||
            className.includes("signout")
        ) {

            return true;

        }


        /* -----------------------------------------------------
           ID
           ----------------------------------------------------- */

        const id =
            (
                link.id ||
                ""
            )
            .toLowerCase();


        if (
            id.includes("logout") ||
            id.includes("signout")
        ) {

            return true;

        }


        /* -----------------------------------------------------
           Text
           ----------------------------------------------------- */

        const text =
            (
                link.textContent ||
                ""
            )
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();


        if (
            text === "logout" ||
            text === "log out" ||
            text.includes("logout") ||
            text.includes("log out") ||
            text.includes("sign out")
        ) {

            return true;

        }


        return false;

    }


    /* =========================================================
       SHOW / HIDE MODULE
       ========================================================= */

    function setModuleVisibility(
        link,
        shouldShow
    ) {

        if (!link) {
            return;
        }


        /*
         Use a dedicated class instead of continuously
         changing the style attribute.

         This prevents MutationObserver loops.
        */

        if (shouldShow) {

            link.classList.remove(
                "role-hidden"
            );

            link.removeAttribute(
                "aria-hidden"
            );

        } else {

            link.classList.add(
                "role-hidden"
            );

            link.setAttribute(
                "aria-hidden",
                "true"
            );

        }

    }


    /* =========================================================
       APPLY ROLE SIDEBAR CONTROL
       ========================================================= */

    function applyGlobalRoleSidebar() {

        const role =
            getCurrentUserRole();


        const sidebarLinks =
            document.querySelectorAll(
                ".sidebar nav a"
            );


        /*
         No sidebar on this page.
        */

        if (!sidebarLinks.length) {
            return;
        }


        /*
         -------------------------------------------------------
         IMPORTANT
         -------------------------------------------------------
         If the role has not loaded yet, do not destroy the
         sidebar. Leave it alone until the role becomes available.
         */

        if (!role) {

            console.log(
                "EDU TECH: Waiting for user role..."
            );

            return;

        }


        const allowedModules =
            ROLE_PERMISSIONS[role];


        /*
         Unknown role:
         hide only recognized protected modules.
         Never hide Dashboard or Logout.
        */

        if (!allowedModules) {

            sidebarLinks.forEach(
                function (link) {

                    if (
                        isDashboardLink(link) ||
                        isLogoutLink(link)
                    ) {

                        setModuleVisibility(
                            link,
                            true
                        );

                        return;

                    }


                    const module =
                        getModuleFromLink(link);


                    if (module) {

                        setModuleVisibility(
                            link,
                            false
                        );

                    }

                }
            );


            return;

        }


        /* -----------------------------------------------------
           Apply permissions
           ----------------------------------------------------- */

        sidebarLinks.forEach(
            function (link) {

                /*
                 Dashboard is ALWAYS visible.
                */

                if (
                    isDashboardLink(link)
                ) {

                    setModuleVisibility(
                        link,
                        true
                    );

                    return;

                }


                /*
                 Logout is ALWAYS visible.
                */

                if (
                    isLogoutLink(link)
                ) {

                    setModuleVisibility(
                        link,
                        true
                    );

                    return;

                }


                const module =
                    getModuleFromLink(link);


                /*
                 Unknown/unprotected link.

                 Do NOT hide it.
                */

                if (!module) {

                    return;

                }


                /*
                 Allowed module.
                */

                if (
                    allowedModules.includes(
                        module
                    )
                ) {

                    setModuleVisibility(
                        link,
                        true
                    );

                }


                /*
                 Unauthorized module.
                */

                else {

                    setModuleVisibility(
                        link,
                        false
                    );

                }

            }
        );


        /*
         Mark sidebar as ready.
         */

        const sidebars =
            document.querySelectorAll(
                ".sidebar"
            );


        sidebars.forEach(
            function (sidebar) {

                sidebar.classList.add(
                    "role-control-ready"
                );

                sidebar.classList.remove(
                    "role-control-pending"
                );

            }
        );


        console.log(
            "EDU TECH role sidebar applied:",
            role
        );

    }


    /* =========================================================
       MAKE SIDEBAR CONTROL AVAILABLE GLOBALLY
       ========================================================= */

    window.applyGlobalRoleSidebar =
        applyGlobalRoleSidebar;


    /* =========================================================
       INITIAL SIDEBAR CONTROL
       ========================================================= */

    function initializeRoleControl() {

        applyGlobalRoleSidebar();

    }


    /* =========================================================
       DOM READY
       ========================================================= */

    if (
        document.readyState === "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initializeRoleControl
        );

    } else {

        initializeRoleControl();

    }


    /* =========================================================
       MUTATION OBSERVER
       =========================================================

       IMPORTANT:
       We deliberately DO NOT observe "style".

       The old version observed:

           style
           class
           href

       But the role-control function itself changed the style
       attribute, which could cause repeated executions.

       We now only watch structural changes to the sidebar.
       ========================================================= */

    let observerStarted = false;


    function startSidebarObserver() {

        if (
            observerStarted ||
            !document.body
        ) {

            return;

        }


        observerStarted = true;


        const sidebarObserver =
            new MutationObserver(
                function (mutations) {

                    let sidebarChanged = false;


                    mutations.forEach(
                        function (mutation) {

                            /*
                             New sidebar links/elements
                             added or removed.
                            */

                            if (
                                mutation.type ===
                                "childList"
                            ) {

                                const target =
                                    mutation.target;


                                if (
                                    target.closest &&
                                    target.closest(
                                        ".sidebar"
                                    )
                                ) {

                                    sidebarChanged =
                                        true;

                                }


                                if (
                                    target.querySelector &&
                                    target.querySelector(
                                        ".sidebar"
                                    )
                                ) {

                                    sidebarChanged =
                                        true;

                                }

                            }

                        }
                    );


                    if (
                        sidebarChanged
                    ) {

                        applyGlobalRoleSidebar();

                    }

                }
            );


        sidebarObserver.observe(
            document.body,
            {
                childList: true,
                subtree: true
            }
        );


        applyGlobalRoleSidebar();

    }


    /* =========================================================
       START OBSERVER
       ========================================================= */

    if (
        document.readyState === "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            startSidebarObserver
        );

    } else {

        startSidebarObserver();

    }


    /* =========================================================
       PERIODIC SECURITY CHECK
       =========================================================

       2 seconds is enough.

       We do NOT need to run this every 1 second because
       the MutationObserver handles sidebar rebuilding.
       ========================================================= */

    setInterval(
        function () {

            applyGlobalRoleSidebar();

        },
        2000
    );


})();