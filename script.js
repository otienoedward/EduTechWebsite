"use strict";

/* =========================================================
   EDU TECH HOTEL MANAGEMENT SYSTEM
   GLOBAL ROLE CONTROL
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
   GET MODULE FROM LINK
   ========================================================= */

function getModuleFromLink(link) {

    if (!link) {
        return "";
    }


    /* -----------------------------------------------------
       First check data-module
       ----------------------------------------------------- */

    const dataModule =
        link.getAttribute("data-module");


    if (dataModule) {

        return String(dataModule)
            .toLowerCase()
            .trim();

    }


    /* -----------------------------------------------------
       Then check href
       ----------------------------------------------------- */

    const href =
        link.getAttribute("href") || "";


    const cleanHref =
        href
            .split("?")[0]
            .split("#")[0]
            .toLowerCase();


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


    /* -----------------------------------------------------
       Check explicit attributes
       ----------------------------------------------------- */

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


    /* -----------------------------------------------------
       Check ID
       ----------------------------------------------------- */

    if (
        id.includes("logout") ||
        id.includes("log-out") ||
        id.includes("signout") ||
        id.includes("sign-out")
    ) {

        return true;

    }


    /* -----------------------------------------------------
       Check class
       ----------------------------------------------------- */

    if (
        className.includes("logout") ||
        className.includes("log-out") ||
        className.includes("signout") ||
        className.includes("sign-out")
    ) {

        return true;

    }


    /* -----------------------------------------------------
       Check href
       ----------------------------------------------------- */

    if (
        href.includes("logout") ||
        href.includes("signout") ||
        href.includes("sign-out")
    ) {

        return true;

    }


    /* -----------------------------------------------------
       Check visible text
       ----------------------------------------------------- */

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
   FORCE LOGOUT VISIBLE
   ========================================================= */

function forceLogoutVisible() {

    const sidebar =
        document.querySelector(".sidebar");


    if (!sidebar) {
        return;
    }


    /*
       Check links and buttons.
    */

    const elements =
        sidebar.querySelectorAll(
            "a, button"
        );


    elements.forEach(
        function(element) {

            if (
                !isLogoutElement(element)
            ) {

                return;

            }


            /*
               Remove every role-based hiding
               mechanism from Logout.
            */

            element.classList.remove(
                "role-hidden"
            );


            element.classList.remove(
                "hidden"
            );


            element.classList.remove(
                "d-none"
            );


            element.removeAttribute(
                "aria-hidden"
            );


            /*
               Remove inline hiding.
            */

            element.style.removeProperty(
                "display"
            );


            element.style.removeProperty(
                "visibility"
            );


            element.style.removeProperty(
                "opacity"
            );


            /*
               Force visibility in case another
               page has an inline display:none.
            */

            element.style.setProperty(
                "display",
                "flex",
                "important"
            );


            element.style.setProperty(
                "visibility",
                "visible",
                "important"
            );


            element.style.setProperty(
                "opacity",
                "1",
                "important"
            );

        }
    );

}


/* =========================================================
   CHECK PROTECTED MODULE
   ========================================================= */

function isProtectedModuleLink(element) {

    if (!element) {
        return false;
    }


    const moduleName =
        getModuleFromLink(element);


    return PROTECTED_MODULES.includes(
        moduleName
    );

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
   APPLY GLOBAL ROLE CONTROL
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
       Always protect Logout first.
    */

    forceLogoutVisible();


    /*
       If the role has not loaded yet,
       do not make role decisions.
    */

    if (!role) {

        forceLogoutVisible();

        return;

    }


    const allowedModules =
        ROLE_PERMISSIONS[role] || [];


    const links =
        sidebar.querySelectorAll(
            "a"
        );


    links.forEach(
        function(link) {

            /*
               NEVER process Logout as a
               normal module.
            */

            if (
                isLogoutElement(link)
            ) {

                forceLogoutVisible();

                return;

            }


            /*
               Dashboard must always remain visible.
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
               Ignore links that are not part
               of the protected module list.
            */

            if (
                !isProtectedModuleLink(link)
            ) {

                return;

            }


            const moduleName =
                getModuleFromLink(link);


            /*
               System Owner has access to
               everything.
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
               Other roles follow permissions.
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


    /*
       FINAL LOGOUT CHECK.
       This is deliberately done after
       all module processing.
    */

    forceLogoutVisible();


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
   EXPOSE GLOBAL FUNCTION
   ========================================================= */

window.applyGlobalRoleSidebar =
    applyGlobalRoleSidebar;


/* =========================================================
   RUN ROLE CONTROL
   ========================================================= */

function runGlobalRoleControl() {

    applyGlobalRoleSidebar();

}


/* =========================================================
   INITIALIZE AFTER DOM LOAD
   ========================================================= */

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        runGlobalRoleControl
    );

} else {

    runGlobalRoleControl();

}


/* =========================================================
   SIDEBAR OBSERVER
   ========================================================= */

let sidebarObserverStarted =
    false;


function startSidebarObserver() {

    if (
        sidebarObserverStarted
    ) {

        return;

    }


    sidebarObserverStarted =
        true;


    const observer =
        new MutationObserver(
            function(mutations) {

                let relevantChange =
                    false;


                mutations.forEach(
                    function(mutation) {

                        /*
                           Detect changes to classes,
                           style, attributes or newly
                           created sidebar elements.
                        */

                        if (
                            mutation.type ===
                            "childList"
                        ) {

                            if (
                                mutation.target.closest &&
                                mutation.target.closest(
                                    ".sidebar"
                                )
                            ) {

                                relevantChange =
                                    true;

                            }

                        }


                        if (
                            mutation.type ===
                            "attributes"
                        ) {

                            if (
                                mutation.target.closest &&
                                mutation.target.closest(
                                    ".sidebar"
                                )
                            ) {

                                /*
                                   Only react immediately
                                   if the affected element
                                   is Logout or a module.
                                */

                                if (
                                    isLogoutElement(
                                        mutation.target
                                    ) ||
                                    isProtectedModuleLink(
                                        mutation.target
                                    )
                                ) {

                                    relevantChange =
                                        true;

                                }

                            }

                        }

                    }
                );


                if (
                    relevantChange
                ) {

                    applyGlobalRoleSidebar();

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
                "class",
                "style",
                "aria-hidden",
                "data-module",
                "data-action",
                "href"
            ]
        }
    );

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
   BACKUP ROLE CHECK
   ========================================================= */

setInterval(
    function() {

        applyGlobalRoleSidebar();

    },
    1000
);


/* =========================================================
   EXTRA LOGOUT PROTECTION
   ========================================================= */

setInterval(
    function() {

        forceLogoutVisible();

    },
    300
);


/* =========================================================
   END OF GLOBAL SCRIPT
   ========================================================= */