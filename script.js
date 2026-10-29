"use strict";

/* =========================================================
   EDU TECH HOTEL MANAGEMENT SYSTEM
   SAFE GLOBAL ROLE CONTROL + LOGOUT
   ========================================================= */


/* =========================================================
   ROLE PERMISSIONS
   ========================================================= */

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
        "hotels"
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
        "payments",
        "expenses",
        "employees",
        "housekeeping",
        "maintenance",
        "reports",
        "settings"
    ],

    receptionist: [
        "dashboard",
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
   PROTECTED MODULES
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

    return String(
        sessionRole ||
        localRole ||
        ""
    )
        .toLowerCase()
        .trim();

}


/* =========================================================
   GET MODULE NAME FROM LINK
   ========================================================= */

function getModuleFromLink(element) {

    if (!element) {
        return "";
    }

    const dataModule =
        element.getAttribute("data-module");

    if (dataModule) {

        return String(dataModule)
            .toLowerCase()
            .trim();

    }

    const href =
        element.getAttribute("href") || "";

    const cleanHref =
        href
            .split("?")[0]
            .split("#")[0]
            .toLowerCase()
            .trim();

    const fileName =
        cleanHref.substring(
            cleanHref.lastIndexOf("/") + 1
        );

    return fileName
        .replace(".html", "")
        .trim();

}


/* =========================================================
   CHECK DASHBOARD
   ========================================================= */

function isDashboardLink(element) {

    if (!element) {
        return false;
    }

    const moduleName =
        getModuleFromLink(element);

    const href =
        String(
            element.getAttribute("href") || ""
        )
            .toLowerCase()
            .trim();

    return (
        moduleName === "dashboard" ||
        moduleName === "index" ||
        href === "./" ||
        href === "/" ||
        href.endsWith("index.html")
    );

}


/* =========================================================
   CHECK LOGOUT
   ========================================================= */

function isLogoutElement(element) {

    if (!element) {
        return false;
    }

    const dataAction =
        String(
            element.getAttribute("data-action") || ""
        )
            .toLowerCase()
            .trim();

    const dataModule =
        String(
            element.getAttribute("data-module") || ""
        )
            .toLowerCase()
            .trim();

    const id =
        String(
            element.id || ""
        )
            .toLowerCase()
            .trim();

    const className =
        String(
            typeof element.className === "string"
                ? element.className
                : ""
        )
            .toLowerCase()
            .trim();

    const href =
        String(
            element.getAttribute("href") || ""
        )
            .toLowerCase()
            .trim();

    const text =
        String(
            element.textContent || ""
        )
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();

    if (
        dataAction === "logout" ||
        dataAction === "log-out" ||
        dataAction === "signout" ||
        dataAction === "sign-out"
    ) {
        return true;
    }

    if (
        dataModule === "logout" ||
        dataModule === "log-out" ||
        dataModule === "signout" ||
        dataModule === "sign-out"
    ) {
        return true;
    }

    if (
        id.includes("logout") ||
        id.includes("log-out") ||
        id.includes("signout") ||
        id.includes("sign-out")
    ) {
        return true;
    }

    if (
        className.includes("logout") ||
        className.includes("log-out") ||
        className.includes("signout") ||
        className.includes("sign-out")
    ) {
        return true;
    }

    if (
        href.includes("logout") ||
        href.includes("signout") ||
        href.includes("sign-out")
    ) {
        return true;
    }

    if (
        text === "logout" ||
        text === "log out" ||
        text === "signout" ||
        text === "sign out"
    ) {
        return true;
    }

    return false;

}


/* =========================================================
   LOGOUT FUNCTION
   ========================================================= */

async function logoutUser(event) {

    if (event) {
        event.preventDefault();
    }

    try {

        if (
            typeof supabaseClient !== "undefined" &&
            supabaseClient &&
            supabaseClient.auth
        ) {

            await supabaseClient.auth.signOut();

        }

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );

    }


    /*
       Remove only login/session information.
       Do not clear the entire browser storage.
    */

    sessionStorage.removeItem("userRole");
    sessionStorage.removeItem("userName");
    sessionStorage.removeItem("hotelId");

    localStorage.removeItem("userRole");
    localStorage.removeItem("userName");
    localStorage.removeItem("hotelId");


    /*
       Return to login.
    */

    window.location.href =
        "./login.html";

}


window.logoutUser =
    logoutUser;


/* =========================================================
   FIND EXISTING LOGOUT
   ========================================================= */

function findLogoutElement(sidebar) {

    if (!sidebar) {
        return null;
    }


    /*
       First look for explicit Logout.
    */

    const explicitLogout =
        sidebar.querySelector(
            '[data-action="logout"]'
        );

    if (explicitLogout) {
        return explicitLogout;
    }


    /*
       Then inspect existing links/buttons.
    */

    const elements =
        sidebar.querySelectorAll(
            "a, button"
        );

    for (
        let i = 0;
        i < elements.length;
        i++
    ) {

        if (
            isLogoutElement(
                elements[i]
            )
        ) {

            return elements[i];

        }

    }


    return null;

}


/* =========================================================
   CREATE LOGOUT IF MISSING
   ========================================================= */

function ensureLogout(sidebar) {

    if (!sidebar) {
        return null;
    }


    let logout =
        findLogoutElement(sidebar);


    /*
       If Logout already exists,
       use it.
    */

    if (!logout) {

        logout =
            document.createElement(
                "button"
            );

        logout.type =
            "button";

        logout.className =
            "logout-btn";

        logout.textContent =
            "Logout";

        logout.setAttribute(
            "data-action",
            "logout"
        );


        sidebar.appendChild(
            logout
        );

    }


    /*
       Give the Logout control a standard
       identifier.
    */

    logout.setAttribute(
        "data-action",
        "logout"
    );


    logout.classList.add(
        "logout-btn"
    );


    /*
       Remove any role hiding.
    */

    logout.classList.remove(
        "role-hidden"
    );

    logout.classList.remove(
        "hidden"
    );

    logout.classList.remove(
        "d-none"
    );

    logout.removeAttribute(
        "aria-hidden"
    );


    /*
       Do NOT repeatedly force inline
       display styles.

       The CSS already controls the
       appearance of the Logout button.
    */


    /*
       Attach logout event only once.
    */

    if (
        logout.dataset.logoutBound !== "true"
    ) {

        logout.addEventListener(
            "click",
            logoutUser
        );

        logout.dataset.logoutBound =
            "true";

    }


    return logout;

}


/* =========================================================
   SET MODULE VISIBILITY
   ========================================================= */

function setModuleVisibility(
    element,
    visible
) {

    if (!element) {
        return;
    }


    /*
       Never hide Logout.
    */

    if (
        isLogoutElement(element)
    ) {

        element.classList.remove(
            "role-hidden"
        );

        element.removeAttribute(
            "aria-hidden"
        );

        return;

    }


    if (visible) {

        element.classList.remove(
            "role-hidden"
        );

        element.removeAttribute(
            "aria-hidden"
        );

    } else {

        element.classList.add(
            "role-hidden"
        );

        element.setAttribute(
            "aria-hidden",
            "true"
        );

    }

}


/* =========================================================
   APPLY ROLE CONTROL
   ========================================================= */

function applyGlobalRoleSidebar() {

    const sidebars =
        document.querySelectorAll(
            ".sidebar"
        );


    if (!sidebars.length) {
        return;
    }


    const role =
        getCurrentUserRole();


    /*
       If no role is available yet,
       don't hide anything.
    */

    if (!role) {

        sidebars.forEach(
            function(sidebar) {

                ensureLogout(sidebar);

            }
        );

        return;

    }


    const allowedModules =
        ROLE_PERMISSIONS[role] || [];


    sidebars.forEach(
        function(sidebar) {

            /*
               Make sure Logout exists
               on this page.
            */

            ensureLogout(sidebar);


            const links =
                sidebar.querySelectorAll(
                    "a"
                );


            links.forEach(
                function(link) {

                    /*
                       Never process Logout
                       as a module.
                    */

                    if (
                        isLogoutElement(link)
                    ) {

                        setModuleVisibility(
                            link,
                            true
                        );

                        return;

                    }


                    /*
                       Dashboard is always visible.
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
                       Ignore anything that is
                       not one of our protected
                       hotel modules.
                    */

                    if (
                        !PROTECTED_MODULES.includes(
                            getModuleFromLink(link)
                        )
                    ) {

                        return;

                    }


                    const moduleName =
                        getModuleFromLink(link);


                    /*
                       System Owner sees everything.
                    */

                    if (
                        role === "system_owner"
                    ) {

                        setModuleVisibility(
                            link,
                            true
                        );

                        return;

                    }


                    /*
                       Other roles use their
                       permission list.
                    */

                    const allowed =
                        allowedModules.includes(
                            moduleName
                        );


                    setModuleVisibility(
                        link,
                        allowed
                    );

                }
            );

        }
    );


    /*
       Mark role control as ready.
    */

    document.documentElement.classList.add(
        "role-control-ready"
    );

    document.documentElement.classList.remove(
        "role-control-pending"
    );

}


/* =========================================================
   EXPOSE GLOBAL ROLE FUNCTION
   ========================================================= */

window.applyGlobalRoleSidebar =
    applyGlobalRoleSidebar;


/* =========================================================
   INITIALIZE ONCE
   ========================================================= */

function initializeGlobalControls() {

    /*
       Run only once.
    */

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
        initializeGlobalControls,
        {
            once: true
        }
    );

} else {

    initializeGlobalControls();

}


/* =========================================================
   END OF SAFE GLOBAL SCRIPT
   ========================================================= */