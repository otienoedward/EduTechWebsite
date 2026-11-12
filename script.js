/* =========================================================
   EDU TECH HOTEL MANAGEMENT SYSTEM
   GLOBAL SYSTEM SCRIPT
   ---------------------------------------------------------
   PURPOSE:
   - Central role management
   - Sidebar permissions
   - Active module highlighting
   - Hotel context
   - Logout
   ========================================================= */

(function () {
    "use strict";

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
            "bank_accounts",
            "financial_transactions",
            "payments",
            "expenses",
            "employees",
            "housekeeping",
            "maintenance",
            "reports",
            "hotels",
            "users",
            "settings"
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
            "bank_accounts",
            "financial_transactions",
            "payments",
            "expenses",
            "employees",
            "housekeeping",
            "maintenance",
            "reports",
            "users",
            "settings"
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
            "bank_accounts",
            "financial_transactions",
            "payments",
            "expenses",
            "employees",
            "housekeeping",
            "maintenance",
            "reports",
            "users",
            "settings"
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
            "settings"
        ]

    };


    /* =====================================================
       STORAGE HELPERS
       ===================================================== */

    function getStoredValue(key) {

        return (
            sessionStorage.getItem(key) ||
            localStorage.getItem(key) ||
            ""
        );

    }


    function setStoredValue(key, value) {

        if (value === null || value === undefined) {
            sessionStorage.removeItem(key);
            localStorage.removeItem(key);
            return;
        }

        sessionStorage.setItem(key, String(value));
        localStorage.setItem(key, String(value));

    }


    function removeStoredValue(key) {

        sessionStorage.removeItem(key);
        localStorage.removeItem(key);

    }


    /* =====================================================
       ROLE
       ===================================================== */

    function getUserRole() {

        return (
            getStoredValue("userRole") ||
            getStoredValue("role") ||
            getStoredValue("user_role") ||
            ""
        ).toLowerCase();

    }


    /* =====================================================
       USER NAME
       ===================================================== */

    function getUserName() {

        return (
            getStoredValue("userName") ||
            getStoredValue("full_name") ||
            getStoredValue("user_name") ||
            "System User"
        );

    }


    /* =====================================================
       HOTEL CONTEXT
       ===================================================== */

    function getActiveHotelId() {

        return (
            getStoredValue("eduTechActiveHotelId") ||
            getStoredValue("activeHotelId") ||
            getStoredValue("selectedHotelId") ||
            getStoredValue("hotelId") ||
            getStoredValue("hotel_id") ||
            ""
        );

    }


    function getActiveHotelName() {

        return (
            getStoredValue("eduTechActiveHotelName") ||
            getStoredValue("activeHotelName") ||
            getStoredValue("selectedHotelName") ||
            getStoredValue("hotelName") ||
            ""
        );

    }


    function setActiveHotel(hotelId, hotelName) {

        if (
            hotelId === null ||
            hotelId === undefined ||
            hotelId === ""
        ) {
            clearActiveHotel();
            return;
        }

        setStoredValue(
            "eduTechActiveHotelId",
            hotelId
        );

        setStoredValue(
            "activeHotelId",
            hotelId
        );

        setStoredValue(
            "selectedHotelId",
            hotelId
        );

        setStoredValue(
            "hotelId",
            hotelId
        );

        setStoredValue(
            "hotel_id",
            hotelId
        );

        if (hotelName) {

            setStoredValue(
                "eduTechActiveHotelName",
                hotelName
            );

            setStoredValue(
                "activeHotelName",
                hotelName
            );

            setStoredValue(
                "selectedHotelName",
                hotelName
            );

            setStoredValue(
                "hotelName",
                hotelName
            );

        }

        window.dispatchEvent(
            new CustomEvent(
                "eduTechHotelChanged",
                {
                    detail: {
                        hotelId: String(hotelId),
                        hotelName: hotelName || ""
                    }
                }
            )
        );

    }


    function clearActiveHotel() {

        [
            "eduTechActiveHotelId",
            "activeHotelId",
            "selectedHotelId",
            "hotelId",
            "hotel_id",
            "eduTechActiveHotelName",
            "activeHotelName",
            "selectedHotelName",
            "hotelName"
        ].forEach(removeStoredValue);

        window.dispatchEvent(
            new CustomEvent(
                "eduTechHotelChanged",
                {
                    detail: {
                        hotelId: "",
                        hotelName: ""
                    }
                }
            )
        );

    }


    /* =====================================================
       MODULE FROM CURRENT PAGE
       ===================================================== */

    function getCurrentModule() {

        const fileName =
            window.location.pathname
                .split("/")
                .pop()
                .toLowerCase();

        const modules = {

            "index.html": "dashboard",
            "rooms.html": "rooms",
            "guests.html": "guests",
            "reservations.html": "reservations",
            "checkin.html": "checkin",
            "checkout.html": "checkout",
            "restaurant.html": "restaurant",
            "inventory.html": "inventory",
            "bank_accounts.html": "bank_accounts",
            "financial_transactions.html":
                "financial_transactions",
            "payments.html": "payments",
            "expenses.html": "expenses",
            "employees.html": "employees",
            "housekeeping.html": "housekeeping",
            "maintenance.html": "maintenance",
            "reports.html": "reports",
            "hotels.html": "hotels",
            "users.html": "users",
            "settings.html": "settings"

        };

        return modules[fileName] || "";

    }


    /* =====================================================
       APPLY ROLE PERMISSIONS
       ===================================================== */

    function applyRolePermissions() {

        const role = getUserRole();

        const allowed =
            ROLE_PERMISSIONS[role] ||
            ROLE_PERMISSIONS.receptionist;

        const links =
            document.querySelectorAll(
                ".sidebar a[data-module]"
            );

        links.forEach(function (link) {

            const module =
                link.getAttribute("data-module");

            if (
                allowed.includes(module)
            ) {

                link.style.display = "";

            } else {

                link.style.display = "none";

            }

        });

        /*
         * Hotels must only be visible to System Owner.
         */

        const hotelLink =
            document.querySelector(
                '.sidebar a[data-module="hotels"]'
            );

        if (hotelLink) {

            hotelLink.style.display =
                role === "system_owner"
                    ? ""
                    : "none";

        }

    }


    /* =====================================================
       ACTIVE MODULE
       ===================================================== */

    function applyActiveModule() {

        const currentModule =
            getCurrentModule();

        const links =
            document.querySelectorAll(
                ".sidebar a[data-module]"
            );

        links.forEach(function (link) {

            link.classList.remove("active");

            const module =
                link.getAttribute("data-module");

            if (
                module === currentModule
            ) {

                link.classList.add("active");

            }

        });

    }


    /* =====================================================
       DISPLAY USER
       ===================================================== */

    function updateUserDisplay() {

        const userName =
            getUserName();

        const role =
            getUserRole();

        const userElements =
            document.querySelectorAll(
                "#userDisplay, #dashboardUserName"
            );

        userElements.forEach(function (element) {

            element.textContent =
                userName;

        });

        const roleElements =
            document.querySelectorAll(
                "#dashboardUserRole, #userRoleDisplay"
            );

        roleElements.forEach(function (element) {

            element.textContent =
                role || "User";

        });

    }


    /* =====================================================
       DISPLAY HOTEL
       ===================================================== */

    function updateHotelDisplay() {

        const hotelId =
            getActiveHotelId();

        const hotelName =
            getActiveHotelName();

        const elements =
            document.querySelectorAll(
                "#activeHotelInfo, #dashboardHotelName"
            );

        elements.forEach(function (element) {

            if (hotelName) {

                element.textContent =
                    hotelName;

            } else if (hotelId) {

                element.textContent =
                    "Hotel ID " + hotelId;

            } else {

                element.textContent =
                    "No hotel selected";

            }

        });

    }


    /* =====================================================
       LOGOUT
       ===================================================== */

    async function logout() {

        try {

            if (
                window.supabaseClient &&
                window.supabaseClient.auth
            ) {

                await window.supabaseClient.auth.signOut();

            }

        } catch (error) {

            console.error(
                "Logout error:",
                error
            );

        }

        [
            "userRole",
            "role",
            "user_role",
            "userName",
            "full_name",
            "user_name",
            "eduTechActiveHotelId",
            "activeHotelId",
            "selectedHotelId",
            "hotelId",
            "hotel_id",
            "eduTechActiveHotelName",
            "activeHotelName",
            "selectedHotelName",
            "hotelName"
        ].forEach(function (key) {

            sessionStorage.removeItem(key);
            localStorage.removeItem(key);

        });

        window.location.href =
            "./login.html";

    }


    /* =====================================================
       BIND LOGOUT
       ===================================================== */

    function bindLogout() {

        const logoutButton =
            document.getElementById(
                "sidebarLogoutButton"
            );

        if (!logoutButton) {
            return;
        }

        logoutButton.onclick =
            function () {

                logout();

            };

    }


    /* =====================================================
       INITIALIZE
       ===================================================== */

    function initialize() {

        applyRolePermissions();

        applyActiveModule();

        updateUserDisplay();

        updateHotelDisplay();

        bindLogout();

    }


    /* =====================================================
       SIDEBAR READY
       ===================================================== */

    document.addEventListener(
        "eduTechSidebarReady",
        function () {

            initialize();

        }
    );


    /* =====================================================
       HOTEL CHANGED
       ===================================================== */

    window.addEventListener(
        "eduTechHotelChanged",
        function () {

            updateHotelDisplay();

        }
    );


    /* =====================================================
       PAGE LOAD
       ===================================================== */

    if (
        document.readyState === "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            function () {

                initialize();

            }
        );

    } else {

        initialize();

    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    window.EDUTECH =
        window.EDUTECH || {};

    window.EDUTECH.getCurrentModule =
        getCurrentModule;

    window.EDUTECH.getUserRole =
        getUserRole;

    window.EDUTECH.getUserName =
        getUserName;

    window.EDUTECH.getActiveHotelId =
        getActiveHotelId;

    window.EDUTECH.getActiveHotelName =
        getActiveHotelName;

    window.EDUTECH.setActiveHotel =
        setActiveHotel;

    window.EDUTECH.clearActiveHotel =
        clearActiveHotel;

    window.EDUTECH.logout =
        logout;

    window.getCurrentModule =
        getCurrentModule;

    window.getUserRole =
        getUserRole;

    window.getUserName =
        getUserName;

    window.getActiveHotelId =
        getActiveHotelId;

    window.getActiveHotelName =
        getActiveHotelName;

    window.setActiveHotel =
        setActiveHotel;

    window.clearActiveHotel =
        clearActiveHotel;

})();