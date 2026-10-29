"use strict";

/* =========================================================
   EDU TECH HOTEL MANAGEMENT SYSTEM
   GLOBAL ROLE CONTROL + GLOBAL LOGOUT
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
   CHECK DASHBOARD LINK
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
   CHECK LOGOUT ELEMENT
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

        /*
           Sign out from Supabase when available.
        */

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
       Remove only authentication/session
       information.

       DO NOT clear all storage because the
       application may contain payment,
       inventory or other local data.
    */

    sessionStorage.removeItem("userRole");
    sessionStorage.removeItem("userName");
    sessionStorage.removeItem("hotelId");

    localStorage.removeItem("userRole");
    localStorage.removeItem("userName");
    localStorage.removeItem("hotelId");


    /*
       Return to login page.
    */

    window.location.href =
        "./login.html";

}


/*
   Make logout function available globally.
*/

window.logoutUser =
    logoutUser;


/* =========================================================
   CREATE GLOBAL LOGOUT CONTROL
   ========================================================= */

function ensureGlobalLogoutControl() {

    const sidebars =
        document.querySelectorAll(
            ".sidebar"
        );

    sidebars.forEach(
        function(sidebar) {

            /*
               Look for an existing Logout control.
            */

            let logoutElement =
                sidebar.querySelector(
                    '[data-action="logout"]'
                );


            /*
               If not found, search all links
               and buttons for an existing Logout.
            */

            if (!logoutElement) {

                const possibleElements =
                    sidebar.querySelectorAll(
                        "a, button"
                    );

                possibleElements.forEach(
                    function(element) {

                        if (
                            !logoutElement &&
                            isLogoutElement(element)
                        ) {

                            logoutElement =
                                element;

                        }

                    }
                );

            }


            /*
               If Logout does not exist on this page,
               create it.
            */

            if (!logoutElement) {

                logoutElement =
                    document.createElement(
                        "button"
                    );

                logoutElement.type =
                    "button";

                logoutElement.className =
                    "logout-btn";

                logoutElement.setAttribute(
                    "data-action",
                    "logout"
                );

                logoutElement.textContent =
                    "Logout";

                sidebar.appendChild(
                    logoutElement
                );

            }


            /*
               Standardize the Logout control.
            */

            logoutElement.setAttribute(
                "data-action",
                "logout"
            );

            logoutElement.classList.add(
                "logout-btn"
            );


            /*
               Remove role hiding.
            */

            logoutElement.classList.remove(
                "role-hidden"
            );

            logoutElement.classList.remove(
                "hidden"
            );

            logoutElement.classList.remove(
                "d-none"
            );


            logoutElement.removeAttribute(
                "aria-hidden"
            );


            /*
               Force visibility.
            */

            logoutElement.style.setProperty(
                "display",
                "flex",
                "important"
            );

            logoutElement.style.setProperty(
                "visibility",
                "visible",
                "important"
            );

            logoutElement.style.setProperty(
                "opacity",
                "1",
                "important"
            );


            /*
               Make sure Logout has only one
               click handler.

               Clone and replace only if the
               element was originally created
               without our handler.
            */

            if (
                logoutElement.dataset.globalLogoutBound !== "true"
            ) {

                logoutElement.addEventListener(
                    "click",
                    logoutUser
                );

                logoutElement.dataset.globalLogoutBound =
                    "true";

            }

        }
    );

}


/* =========================================================
   FORCE LOGOUT VISIBLE
   ========================================================= */

function forceLogoutVisible() {

    const sidebars =
        document.querySelectorAll(
            ".sidebar"
        );

    sidebars.forEach(
        function(sidebar) {

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


    /*
       Never hide Logout.
    */

    if (
        isLogoutElement(element)
    ) {

        forceLogoutVisible();

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
   APPLY GLOBAL ROLE SIDEBAR
   ========================================================= */

function applyGlobalRoleSidebar() {

    /*
       First make sure every page has
       a Logout control.
    */

    ensureGlobalLogoutControl();


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
       If role has not loaded yet,
       do not hide any modules.
    */

    if (!role) {

        forceLogoutVisible();

        return;

    }


    const allowedModules =
        ROLE_PERMISSIONS[role] || [];


    sidebars.forEach(
        function(sidebar) {

            const links =
                sidebar.querySelectorAll(
                    "a"
                );


            links.forEach(
                function(link) {

                    /*
                       Logout is NEVER a module.
                    */

                    if (
                        isLogoutElement(link)
                    ) {

                        forceLogoutVisible();

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
                       Only process protected
                       hotel modules.
                    */

                    if (
                        !isProtectedModuleLink(link)
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
                       Check role permission.
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
       Final protection for Logout.
    */

    ensureGlobalLogoutControl();
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
   EXPOSE GLOBAL ROLE FUNCTION
   ========================================================= */

window.applyGlobalRoleSidebar =
    applyGlobalRoleSidebar;


/* =========================================================
   RUN GLOBAL ROLE CONTROL
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

                let sidebarChanged =
                    false;


                mutations.forEach(
                    function(mutation) {

                        /*
                           Only watch newly added or
                           removed sidebar elements.

                           IMPORTANT:
                           We intentionally do NOT watch
                           class/style changes because our
                           own role-control code changes
                           those attributes.
                        */

                        if (
                            mutation.type ===
                            "childList"
                        ) {

                            const target =
                                mutation.target;


                            if (
                                target &&
                                target.closest &&
                                target.closest(
                                    ".sidebar"
                                )
                            ) {

                                sidebarChanged =
                                    true;

                            }


                            if (
                                mutation.addedNodes &&
                                mutation.addedNodes.length
                            ) {

                                mutation.addedNodes.forEach(
                                    function(node) {

                                        if (
                                            node.nodeType === 1 &&
                                            node.closest &&
                                            node.closest(
                                                ".sidebar"
                                            )
                                        ) {

                                            sidebarChanged =
                                                true;

                                        }

                                    }
                                );

                            }

                        }

                    }
                );


                if (
                    sidebarChanged
                ) {

                    /*
                       Small delay allows the
                       page to finish inserting
                       sidebar content.
                    */

                    setTimeout(
                        function() {

                            applyGlobalRoleSidebar();

                        },
                        20
                    );

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


/* =========================================================
   START SIDEBAR OBSERVER
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
    2000
);


/* =========================================================
   END OF GLOBAL SCRIPT
   ========================================================= */