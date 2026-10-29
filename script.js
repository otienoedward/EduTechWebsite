"use strict";

/* =========================================================
   EDU TECH HOTEL MANAGEMENT SYSTEM
   GLOBAL ROLE-BASED SIDEBAR CONTROL
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
   MODULES CONTROLLED BY ROLE
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
   GET CURRENT ROLE
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
   GET MODULE FROM LINK
   ========================================================= */

function getModuleFromLink(link) {

    if (!link) {

        return "";

    }


    /* First use data-module */

    const dataModule =
        link.getAttribute("data-module");


    if (dataModule) {

        return String(
            dataModule
        )
        .toLowerCase()
        .trim();

    }


    /* Otherwise determine module from href */

    const href =
        link.getAttribute("href") ||
        "";


    const cleanHref =
        href
            .split("?")[0]
            .split("#")[0]
            .toLowerCase();


    const fileName =
        cleanHref
            .substring(
                cleanHref.lastIndexOf("/") + 1
            );


    const moduleName =
        fileName
            .replace(
                ".html",
                ""
            )
            .trim();


    return moduleName;

}


/* =========================================================
   DASHBOARD LINK
   ========================================================= */

function isDashboardLink(link) {

    if (!link) {

        return false;

    }


    const moduleName =
        getModuleFromLink(link);


    const href =
        (
            link.getAttribute("href") ||
            ""
        )
        .toLowerCase();


    return (
        moduleName === "dashboard" ||
        moduleName === "index" ||
        href.endsWith("index.html") ||
        href === "./" ||
        href === "/"
    );

}


/* =========================================================
   IMPROVED LOGOUT DETECTION
   ========================================================= */

function isLogoutLink(link) {

    if (!link) {

        return false;

    }


    const dataAction =
        String(
            link.getAttribute("data-action") ||
            ""
        )
        .toLowerCase()
        .trim();


    const dataModule =
        String(
            link.getAttribute("data-module") ||
            ""
        )
        .toLowerCase()
        .trim();


    const href =
        String(
            link.getAttribute("href") ||
            ""
        )
        .toLowerCase()
        .trim();


    const id =
        String(
            link.id ||
            ""
        )
        .toLowerCase()
        .trim();


    const className =
        String(
            link.className ||
            ""
        )
        .toLowerCase()
        .trim();


    const text =
        String(
            link.textContent ||
            ""
        )
        .toLowerCase()
        .replace(
            /\s+/g,
            " "
        )
        .trim();


    /*
       IMPORTANT:
       Check all possible ways the Logout
       link/button may be identified.
    */

    return (

        dataAction === "logout" ||

        dataModule === "logout" ||

        dataModule === "signout" ||

        href.includes("logout") ||

        href.includes("signout") ||

        id.includes("logout") ||

        id.includes("signout") ||

        className.includes("logout") ||

        className.includes("signout") ||

        text === "logout" ||

        text === "log out" ||

        text === "sign out" ||

        text === "signout"

    );

}


/* =========================================================
   CHECK IF LINK IS A PROTECTED MODULE
   ========================================================= */

function isProtectedModuleLink(link) {

    if (!link) {

        return false;

    }


    const moduleName =
        getModuleFromLink(link);


    return PROTECTED_MODULES.includes(
        moduleName
    );

}


/* =========================================================
   SET MODULE VISIBILITY
   ========================================================= */

function setModuleVisibility(
    link,
    shouldShow
) {

    if (!link) {

        return;

    }


    if (shouldShow) {

        link.classList.remove(
            "role-hidden"
        );

        link.setAttribute(
            "aria-hidden",
            "false"
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
   APPLY GLOBAL ROLE SIDEBAR
   ========================================================= */

function applyGlobalRoleSidebar() {

    const sidebar =
        document.querySelector(
            ".sidebar"
        );


    if (!sidebar) {

        return;

    }


    const role =
        getCurrentUserRole();


    /*
       If role has not been loaded yet,
       DO NOT hide anything.
       This prevents the global script
       from breaking the sidebar.
    */

    if (!role) {

        return;

    }


    const allowedModules =
        ROLE_PERMISSIONS[role] ||
        [];


    const links =
        sidebar.querySelectorAll(
            "a"
        );


    links.forEach(
        function(link) {

            /*
               NEVER hide Logout.
            */

            if (
                isLogoutLink(link)
            ) {

                link.classList.remove(
                    "role-hidden"
                );

                link.removeAttribute(
                    "aria-hidden"
                );

                link.style.removeProperty(
                    "display"
                );

                return;

            }


            /*
               NEVER hide Dashboard.
            */

            if (
                isDashboardLink(link)
            ) {

                link.classList.remove(
                    "role-hidden"
                );

                link.removeAttribute(
                    "aria-hidden"
                );

                link.style.removeProperty(
                    "display"
                );

                return;

            }


            /*
               Only process recognized
               protected modules.
            */

            if (
                !isProtectedModuleLink(link)
            ) {

                return;

            }


            /*
               System Owner can access
               every module.
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
               Check role permission.
            */

            const moduleName =
                getModuleFromLink(link);


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


    /*
       Make sure the Logout button
       is always visible even if another
       page has accidentally added
       role-hidden to it.
    */

    sidebar
        .querySelectorAll(
            "a, button"
        )
        .forEach(
            function(element) {

                if (
                    isLogoutLink(element)
                ) {

                    element.classList.remove(
                        "role-hidden"
                    );

                    element.removeAttribute(
                        "aria-hidden"
                    );

                    element.style.removeProperty(
                        "display"
                    );

                }

            }
        );


    /*
       Tell the page that role control
       has finished.
    */

    document.documentElement.classList.add(
        "role-control-ready"
    );

    document.documentElement.classList.remove(
        "role-control-pending"
    );

}


/* =========================================================
   EXPOSE GLOBAL FUNCTION
   ========================================================= */

window.applyGlobalRoleSidebar =
    applyGlobalRoleSidebar;


/* =========================================================
   INITIAL LOAD
   ========================================================= */

function initializeGlobalRoleControl() {

    applyGlobalRoleSidebar();

}


/* =========================================================
   DOM CONTENT LOADED
   ========================================================= */

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeGlobalRoleControl
    );

} else {

    initializeGlobalRoleControl();

}


/* =========================================================
   OBSERVE SIDEBAR STRUCTURE ONLY
   ========================================================= */

let roleObserverStarted =
    false;


function startRoleObserver() {

    if (
        roleObserverStarted
    ) {

        return;

    }


    roleObserverStarted =
        true;


    const observer =
        new MutationObserver(
            function(mutations) {

                let sidebarChanged =
                    false;


                mutations.forEach(
                    function(mutation) {

                        if (
                            mutation.type ===
                            "childList"
                        ) {

                            if (
                                mutation.target.closest(
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


    observer.observe(
        document.body,
        {
            childList: true,
            subtree: true
        }
    );

}


if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        startRoleObserver
    );

} else {

    startRoleObserver();

}


/* =========================================================
   BACKUP CHECK
   ========================================================= */

setInterval(
    function() {

        applyGlobalRoleSidebar();

    },
    2000
);


/* =========================================================
   EXTRA LOGOUT PROTECTION
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function() {

        const sidebar =
            document.querySelector(
                ".sidebar"
            );


        if (!sidebar) {

            return;

        }


        sidebar
            .querySelectorAll(
                "a, button"
            )
            .forEach(
                function(element) {

                    if (
                        isLogoutLink(element)
                    ) {

                        element.classList.remove(
                            "role-hidden"
                        );

                        element.removeAttribute(
                            "aria-hidden"
                        );

                    }

                }
            );

    }
);


/* =========================================================
   END OF GLOBAL ROLE CONTROL
   ========================================================= */