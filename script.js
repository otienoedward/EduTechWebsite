```javascript
/* ============================================================
   GLOBAL ROLE-BASED SIDEBAR CONTROL
   EDU TECH HOTEL MANAGEMENT SYSTEM
   ============================================================

   This version continuously enforces the user's role
   on EVERY page that loads script.js.

   Receptionist:
   Dashboard
   Rooms
   Guests
   Reservations
   Check-in
   Check-out
   Payments
   Reports

   Manager:
   All hotel operational modules except Hotels

   Hotel Owner:
   All hotel operational modules except Hotels

   System Owner:
   All modules including Hotels
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
       GET CURRENT ROLE
       ========================================================= */

    function getCurrentUserRole() {

        let role =
            sessionStorage.getItem("userRole") ||
            localStorage.getItem("userRole") ||
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
       APPLY SIDEBAR PERMISSIONS
       ========================================================= */

    function applyGlobalRoleSidebar() {

        const role =
            getCurrentUserRole();


        /*
         If the role has not loaded yet,
         do nothing.
        */

        if (!role) {
            return;
        }


        const allowedModules =
            ROLE_PERMISSIONS[role];


        const sidebarLinks =
            document.querySelectorAll(
                ".sidebar nav a"
            );


        /*
         If there is no sidebar on the page,
         stop safely.
        */

        if (!sidebarLinks.length) {
            return;
        }


        /*
         Unknown role:
         hide all protected modules.
        */

        if (!allowedModules) {

            sidebarLinks.forEach(
                function (link) {

                    const module =
                        getModuleFromLink(link);


                    if (module) {

                        link.style.setProperty(
                            "display",
                            "none",
                            "important"
                        );

                    }

                }
            );

            return;
        }


        /*
         Apply permissions.
        */

        sidebarLinks.forEach(
            function (link) {

                /*
                 Dashboard is ALWAYS visible.
                */

                if (
                    isDashboardLink(link)
                ) {

                    link.style.setProperty(
                        "display",
                        "",
                        "important"
                    );

                    return;
                }


                const module =
                    getModuleFromLink(link);


                /*
                 Unknown/unprotected link.
                 Leave it alone.
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

                    link.style.setProperty(
                        "display",
                        "",
                        "important"
                    );

                }


                /*
                 NOT allowed.
                */

                else {

                    link.style.setProperty(
                        "display",
                        "none",
                        "important"
                    );

                }

            }
        );


        console.log(
            "EDU TECH role sidebar applied:",
            role
        );

    }


    /* =========================================================
       INITIAL CHECK
       ========================================================= */

    applyGlobalRoleSidebar();


    /* =========================================================
       DOM READY CHECK
       ========================================================= */

    if (
        document.readyState === "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            function () {

                applyGlobalRoleSidebar();

            }
        );

    } else {

        applyGlobalRoleSidebar();

    }


    /* =========================================================
       CONTINUOUS SIDEBAR MONITOR
       =========================================================

       Some pages may rebuild or modify their sidebar after
       the page loads.

       MutationObserver detects that change and immediately
       reapplies the correct role permissions.
       ========================================================= */

    const sidebarObserver =
        new MutationObserver(
            function () {

                applyGlobalRoleSidebar();

            }
        );


    function startSidebarObserver() {

        if (!document.body) {
            return;
        }


        sidebarObserver.observe(
            document.body,
            {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: [
                    "style",
                    "class",
                    "href"
                ]
            }
        );


        applyGlobalRoleSidebar();

    }


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
       EXTRA PERIODIC SECURITY CHECK
       =========================================================

       This also checks continuously in case another script
       changes the sidebar without triggering the observer.
       ========================================================= */

    setInterval(
        function () {

            applyGlobalRoleSidebar();

        },
        1000
    );


})();
```