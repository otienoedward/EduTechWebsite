/* ============================================================
   EDU TECH HOTEL MANAGEMENT SYSTEM
   CENTRAL ROLE SIDEBAR CONTROL
   ============================================================

   Roles:

   SYSTEM OWNER
   - Everything

   HOTEL OWNER
   - All hotel modules except Hotels

   MANAGER
   - All hotel operational modules except Hotels

   RECEPTIONIST
   - Dashboard
   - Rooms
   - Guests
   - Reservations
   - Check-in
   - Check-out
   - Payments
   - Reports

   This file controls the sidebar on every page.
   ============================================================ */

(function () {

    "use strict";


    /* ============================================================
       ROLE PERMISSIONS
       ============================================================ */

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


    /* ============================================================
       GET CURRENT ROLE
       ============================================================ */

    function getCurrentRole() {

        let role =
            sessionStorage.getItem("userRole");


        if (!role) {

            role =
                localStorage.getItem("userRole");

        }


        if (!role) {

            return "";

        }


        return String(role)
            .toLowerCase()
            .trim();

    }


    /* ============================================================
       GET MODULE NAME FROM LINK
       ============================================================ */

    function getModuleFromLink(link) {

        if (!link) {

            return null;

        }


        const href =
            String(
                link.getAttribute("href") || ""
            )
            .toLowerCase()
            .split("?")[0]
            .split("#")[0]
            .trim();


        if (
            href === "./" ||
            href === "/" ||
            href === "index.html" ||
            href === "./index.html" ||
            href.endsWith("/index.html")
        ) {

            return "dashboard";

        }


        if (href.includes("rooms.html")) {

            return "rooms";

        }


        if (href.includes("guests.html")) {

            return "guests";

        }


        if (href.includes("reservations.html")) {

            return "reservations";

        }


        if (href.includes("checkin.html")) {

            return "checkin";

        }


        if (href.includes("checkout.html")) {

            return "checkout";

        }


        if (href.includes("restaurant.html")) {

            return "restaurant";

        }


        if (href.includes("inventory.html")) {

            return "inventory";

        }


        if (href.includes("payments.html")) {

            return "payments";

        }


        if (href.includes("expenses.html")) {

            return "expenses";

        }


        if (href.includes("employees.html")) {

            return "employees";

        }


        if (href.includes("housekeeping.html")) {

            return "housekeeping";

        }


        if (href.includes("maintenance.html")) {

            return "maintenance";

        }


        if (href.includes("reports.html")) {

            return "reports";

        }


        if (href.includes("settings.html")) {

            return "settings";

        }


        if (href.includes("hotels.html")) {

            return "hotels";

        }


        return null;

    }


    /* ============================================================
       APPLY SIDEBAR PERMISSIONS
       ============================================================ */

    function applyRoleSidebar() {

        const role =
            getCurrentRole();


        /*
         * If there is no role yet,
         * don't modify the page.
         */

        if (!role) {

            return;

        }


        const allowedModules =
            ROLE_PERMISSIONS[role];


        /*
         * If the role is unknown,
         * hide protected modules.
         */

        if (!allowedModules) {

            document
                .querySelectorAll(".sidebar nav a")
                .forEach(function (link) {

                    const module =
                        getModuleFromLink(link);


                    if (
                        module &&
                        module !== "dashboard"
                    ) {

                        link.style.display = "none";

                    }

                });


            return;

        }


        /*
         * Find every sidebar link.
         */

        const links =
            document.querySelectorAll(
                ".sidebar nav a"
            );


        links.forEach(function (link) {

            const module =
                getModuleFromLink(link);


            /*
             * Ignore links that are not
             * hotel-system module links.
             */

            if (!module) {

                return;

            }


            /*
             * Dashboard is always visible.
             */

            if (
                module === "dashboard"
            ) {

                if (
                    link.style.display !== ""
                ) {

                    link.style.display = "";

                }

                return;

            }


            /*
             * Check permission.
             */

            const shouldShow =
                allowedModules.includes(module);


            const desiredDisplay =
                shouldShow
                    ? ""
                    : "none";


            /*
             * Only change the style when
             * necessary.
             */

            if (
                link.style.display !==
                desiredDisplay
            ) {

                link.style.display =
                    desiredDisplay;

            }

        });

    }


    /* ============================================================
       RUN CONTROL
       ============================================================ */

    let observerStarted = false;

    let applying = false;

    let timer = null;


    function safeApply() {

        if (applying) {

            return;

        }


        applying = true;


        try {

            applyRoleSidebar();

        }

        catch (error) {

            console.error(
                "Role sidebar error:",
                error
            );

        }


        applying = false;

    }


    /* ============================================================
       DEBOUNCED APPLY
       ============================================================ */

    function scheduleApply() {

        if (timer) {

            clearTimeout(timer);

        }


        timer =
            setTimeout(
                function () {

                    timer = null;

                    safeApply();

                },
                50
            );

    }


    /* ============================================================
       START MUTATION OBSERVER
       ============================================================ */

    function startObserver() {

        if (observerStarted) {

            return;

        }


        if (!document.body) {

            return;

        }


        observerStarted = true;


        const observer =
            new MutationObserver(
                function (mutations) {

                    let relevantChange =
                        false;


                    for (
                        let i = 0;
                        i < mutations.length;
                        i++
                    ) {

                        const mutation =
                            mutations[i];


                        /*
                         * New sidebar links/elements.
                         */

                        if (
                            mutation.type ===
                            "childList"
                        ) {

                            relevantChange =
                                true;

                            break;

                        }


                        /*
                         * A page script may change
                         * the display/style.
                         */

                        if (
                            mutation.type ===
                            "attributes"
                        ) {

                            const target =
                                mutation.target;


                            if (
                                target &&
                                target.closest &&
                                target.closest(
                                    ".sidebar nav"
                                )
                            ) {

                                relevantChange =
                                    true;

                                break;

                            }

                        }

                    }


                    if (relevantChange) {

                        scheduleApply();

                    }

                }
            );


        observer.observe(
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

    }


    /* ============================================================
       INITIAL START
       ============================================================ */

    function initialize() {

        safeApply();

        startObserver();


        /*
         * Apply again after other page scripts
         * have finished their initialization.
         */

        setTimeout(
            safeApply,
            100
        );


        setTimeout(
            safeApply,
            500
        );


        setTimeout(
            safeApply,
            1000
        );


        setTimeout(
            safeApply,
            2000
        );


        setTimeout(
            safeApply,
            5000
        );

    }


    /* ============================================================
       START WHEN DOM IS READY
       ============================================================ */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialize
        );

    }

    else {

        initialize();

    }


    /* ============================================================
       EXPOSE FUNCTION FOR DEBUGGING
       ============================================================ */

    window.applyRoleSidebar =
        applyRoleSidebar;


})();