
/* =========================================================
   EDU TECH HOTEL MANAGEMENT SYSTEM
   CENTRAL AUTHENTICATION & PAGE SECURITY
   ========================================================= */

(function () {

    "use strict";

    const db = window.supabaseClient;

    let accountCheckInProgress = false;
    let accountCheckTimer = null;

    /* =====================================================
       PAGE PERMISSIONS
       ===================================================== */

    const PAGE_PERMISSIONS = {

        system_owner: [
            "index.html",
            "rooms.html",
            "guests.html",
            "reservations.html",
            "checkin.html",
            "checkout.html",
            "restaurant.html",
            "payments.html",
            "housekeeping.html",
            "inventory.html",
            "expenses.html",
            "employees.html",
            "maintenance.html",
            "reports.html",
            "settings.html",
            "users.html",
            "hotels.html"
        ],

        hotel_owner: [
            "index.html",
            "rooms.html",
            "guests.html",
            "reservations.html",
            "checkin.html",
            "checkout.html",
            "restaurant.html",
            "payments.html",
            "housekeeping.html",
            "inventory.html",
            "expenses.html",
            "employees.html",
            "maintenance.html",
            "reports.html",
            "settings.html",
            "users.html"
        ],

        manager: [
            "index.html",
            "rooms.html",
            "guests.html",
            "reservations.html",
            "checkin.html",
            "checkout.html",
            "restaurant.html",
            "payments.html",
            "housekeeping.html",
            "inventory.html",
            "expenses.html",
            "employees.html",
            "maintenance.html",
            "reports.html"
        ],

        receptionist: [
            "index.html",
            "rooms.html",
            "guests.html",
            "reservations.html",
            "checkin.html",
            "checkout.html",
            "restaurant.html",
            "payments.html",
            "housekeeping.html"
        ]

    };


    const MODULE_FILES = new Set([

        "index.html",
        "rooms.html",
        "guests.html",
        "reservations.html",
        "checkin.html",
        "checkout.html",
        "restaurant.html",
        "payments.html",
        "housekeeping.html",
        "inventory.html",
        "expenses.html",
        "employees.html",
        "maintenance.html",
        "reports.html",
        "settings.html",
        "users.html",
        "hotels.html"

    ]);


    /* =====================================================
       NORMALIZE ROLE
       ===================================================== */

    function normalizeRole(role) {

        return String(role || "")
            .toLowerCase()
            .trim()
            .replace(/\s+/g, "_");

    }


    /* =====================================================
       CURRENT PAGE
       ===================================================== */

    function getCurrentPage() {

        let file = window.location.pathname
            .split("/")
            .pop()
            .toLowerCase();

        if (!file) {
            file = "index.html";
        }

        return file;

    }


    /* =====================================================
       CLEAR USER SESSION DATA
       ===================================================== */

    function clearUserSessionData() {

        const keys = [

            "authenticatedUserId",
            "authenticatedUserRole",
            "userName",
            "userId",
            "hotelId",
            "hotel_id",
            "hotelName",
            "activeHotelId",
            "active_hotel_id",
            "selectedHotelId",
            "selectedHotelID"

        ];

        keys.forEach(function (key) {

            try {
                sessionStorage.removeItem(key);
            } catch (error) {
                console.error(error);
            }

        });

    }


    /* =====================================================
       REDIRECT LOGIN
       ===================================================== */

    function redirectToLogin() {

        if (accountCheckTimer) {
            clearInterval(accountCheckTimer);
            accountCheckTimer = null;
        }

        window.location.replace("./login.html");

    }


    /* =====================================================
       REJECT DEACTIVATED ACCOUNT
       ===================================================== */

    async function rejectInactiveAccount() {

        console.warn(
            "EDU TECH: Account is inactive. Access denied."
        );

        clearUserSessionData();

        try {

            await db.auth.signOut();

        } catch (error) {

            console.error(
                "Sign-out error:",
                error
            );

        }

        redirectToLogin();

    }


    /* =====================================================
       SHOW ACCESS DENIED
       ===================================================== */

    function showAccessDenied(role, page) {

        const render = function () {

            document.documentElement.style.visibility =
                "visible";

            document.body.innerHTML = `

                <div style="
                    min-height:100vh;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    background:#f1f5f9;
                    font-family:Arial,Helvetica,sans-serif;
                    padding:20px;
                    box-sizing:border-box;
                ">

                    <div style="
                        width:100%;
                        max-width:520px;
                        background:white;
                        border-radius:16px;
                        padding:35px;
                        text-align:center;
                        box-shadow:0 10px 35px rgba(0,0,0,.12);
                    ">

                        <div style="
                            font-size:55px;
                            margin-bottom:15px;
                        ">
                            🔒
                        </div>

                        <h1 style="
                            margin:0 0 12px;
                            color:#111827;
                        ">
                            Access Restricted
                        </h1>

                        <p style="
                            color:#4b5563;
                            line-height:1.6;
                            margin-bottom:10px;
                        ">
                            You do not have permission to access
                            this section of the EDU TECH Hotel
                            Management System.
                        </p>

                        <p style="
                            color:#6b7280;
                            font-size:14px;
                            margin-bottom:25px;
                        ">
                            Your current role:
                            <strong>
                                ${role || "Unknown"}
                            </strong>
                        </p>

                        <button
                            onclick="window.location.href='./index.html'"
                            style="
                                border:0;
                                background:#2563eb;
                                color:white;
                                padding:12px 22px;
                                border-radius:8px;
                                cursor:pointer;
                                font-size:15px;
                            "
                        >
                            Return to Dashboard
                        </button>

                    </div>

                </div>

            `;

        };

        if (document.body) {
            render();
        } else {
            document.addEventListener(
                "DOMContentLoaded",
                render,
                { once: true }
            );
        }

    }


    /* =====================================================
       HIDE UNAUTHORIZED NAVIGATION
       ===================================================== */

    function applyNavigationPermissions(role) {

        const allowedPages =
            PAGE_PERMISSIONS[role] || [];

        const processLinks = function () {

            document
                .querySelectorAll("a[href]")
                .forEach(function (link) {

                    const rawHref =
                        link.getAttribute("href");

                    if (!rawHref) {
                        return;
                    }

                    if (
                        rawHref.startsWith("#") ||
                        rawHref.startsWith("http") ||
                        rawHref.startsWith("mailto:") ||
                        rawHref.startsWith("tel:")
                    ) {
                        return;
                    }

                    let file = "";

                    try {

                        file = new URL(
                            rawHref,
                            window.location.href
                        )
                            .pathname
                            .split("/")
                            .pop()
                            .toLowerCase();

                    } catch (error) {
                        return;
                    }

                    if (!MODULE_FILES.has(file)) {
                        return;
                    }

                    if (!allowedPages.includes(file)) {

                        link.style.setProperty(
                            "display",
                            "none",
                            "important"
                        );

                        link.addEventListener(
                            "click",
                            function (event) {
                                event.preventDefault();
                            }
                        );

                    }

                });

        };

        if (document.body) {
            processLinks();
        } else {
            document.addEventListener(
                "DOMContentLoaded",
                processLinks,
                { once: true }
            );
        }

    }


    /* =====================================================
       VALIDATE HOTEL
       ===================================================== */

    async function validateAssignedHotel(hotelId) {

        if (!hotelId) {
            return {
                valid: false,
                hotel: null
            };
        }

        const {
            data: hotel,
            error
        } = await db
            .from("hotels")
            .select(`
                id,
                hotel_name,
                location,
                phone,
                email,
                status,
                subscription_start,
                subscription_end,
                subscription_status
            `)
            .eq("id", Number(hotelId))
            .maybeSingle();

        if (error) {

            console.error(
                "Hotel validation error:",
                error
            );

            return {
                valid: false,
                hotel: null
            };

        }

        if (!hotel) {
            return {
                valid: false,
                hotel: null
            };
        }

        const hotelStatus = String(
            hotel.status || ""
        )
            .toLowerCase()
            .trim();

        if (
            hotelStatus === "inactive" ||
            hotelStatus === "suspended" ||
            hotelStatus === "deactivated" ||
            hotelStatus === "cancelled" ||
            hotelStatus === "canceled"
        ) {
            return {
                valid: false,
                hotel
            };
        }

        const subscriptionStatus = String(
            hotel.subscription_status || ""
        )
            .toLowerCase()
            .trim();

        if (
            subscriptionStatus === "expired" ||
            subscriptionStatus === "cancelled" ||
            subscriptionStatus === "canceled" ||
            subscriptionStatus === "suspended"
        ) {
            return {
                valid: false,
                hotel
            };
        }

        if (hotel.subscription_end) {

            const today = new Date();

            today.setHours(0, 0, 0, 0);

            const expiry = new Date(
                hotel.subscription_end + "T23:59:59"
            );

            if (
                !isNaN(expiry.getTime()) &&
                expiry < today
            ) {
                return {
                    valid: false,
                    hotel
                };
            }

        }

        return {
            valid: true,
            hotel
        };

    }


    /* =====================================================
       RECHECK ACCOUNT STATUS
       ===================================================== */

    async function checkAccountStatus() {

        if (accountCheckInProgress) {
            return;
        }

        if (!window.EDUTECH_AUTH?.user?.id) {
            return;
        }

        accountCheckInProgress = true;

        try {

            const userId =
                window.EDUTECH_AUTH.user.id;

            const {
                data: profile,
                error
            } = await db
                .from("profiles")
                .select("id, is_active")
                .eq("id", userId)
                .maybeSingle();

            if (error) {

                console.error(
                    "Account status check failed:",
                    error
                );

                /*
                 * Do not sign out based on a temporary
                 * network error. The next check will retry.
                 */

                return;
            }

            if (
                !profile ||
                profile.is_active !== true
            ) {

                await rejectInactiveAccount();

            }

        } catch (error) {

            console.error(
                "Account status monitoring error:",
                error
            );

        } finally {

            accountCheckInProgress = false;

        }

    }


    /* =====================================================
       START ACCOUNT MONITORING
       ===================================================== */

    function startAccountMonitoring() {

        if (accountCheckTimer) {
            clearInterval(accountCheckTimer);
        }

        /*
         * Recheck every 30 seconds.
         */

        accountCheckTimer = setInterval(
            checkAccountStatus,
            30000
        );

        /*
         * Check again when the user returns to the tab.
         */

        document.addEventListener(
            "visibilitychange",
            function () {

                if (
                    document.visibilityState === "visible"
                ) {
                    checkAccountStatus();
                }

            }
        );

        /*
         * Check when the browser restores the page.
         */

        window.addEventListener(
            "pageshow",
            function () {
                checkAccountStatus();
            }
        );

    }


    /* =====================================================
       LOAD AUTHENTICATION CONTEXT
       ===================================================== */

    async function loadAuthenticationContext() {

        document.documentElement.style.visibility =
            "hidden";

        if (!db) {

            console.error(
                "Supabase client was not loaded."
            );

            redirectToLogin();

            return null;

        }

        try {

            /*
             * STEP 1: GET AUTH USER
             */

            const {
                data: { user },
                error: authError
            } = await db.auth.getUser();

            if (authError || !user) {

                redirectToLogin();

                return null;

            }

            /*
             * STEP 2: GET USER PROFILE
             *
             * is_active is now included.
             */

            const {
                data: profile,
                error: profileError
            } = await db
                .from("profiles")
                .select(`
                    id,
                    full_name,
                    role,
                    hotel_id,
                    is_active
                `)
                .eq("id", user.id)
                .maybeSingle();

            if (profileError || !profile) {

                console.error(
                    "Profile error:",
                    profileError
                );

                await db.auth.signOut();

                redirectToLogin();

                return null;

            }

            /*
             * STEP 3: CHECK ACCOUNT STATUS
             */

            if (profile.is_active !== true) {

                console.warn(
                    "Inactive account blocked:",
                    user.id
                );

                await rejectInactiveAccount();

                return null;

            }

            /*
             * STEP 4: VALIDATE ROLE
             */

            const role = normalizeRole(
                profile.role
            );

            const validRoles = [
                "system_owner",
                "hotel_owner",
                "manager",
                "receptionist"
            ];

            if (!validRoles.includes(role)) {

                console.error(
                    "Invalid user role:",
                    profile.role
                );

                await db.auth.signOut();

                redirectToLogin();

                return null;

            }

            /*
             * STEP 5: VALIDATE HOTEL
             */

            let hotel = null;
            let hotelId = null;

            if (role === "system_owner") {

                /*
                 * System Owner has no permanently assigned hotel.
                 * Selected hotel is separate from the role.
                 */

                const selectedHotelId =
                    sessionStorage.getItem("activeHotelId") ||
                    sessionStorage.getItem("active_hotel_id") ||
                    sessionStorage.getItem("selectedHotelId") ||
                    sessionStorage.getItem("selectedHotelID");

                if (
                    selectedHotelId &&
                    Number(selectedHotelId) > 0
                ) {

                    hotelId = Number(selectedHotelId);

                    const validation =
                        await validateAssignedHotel(hotelId);

                    if (validation.valid) {

                        hotel = validation.hotel;

                    } else {

                        hotelId = null;
                        hotel = null;

                    }

                }

            } else {

                /*
                 * Hotel users must use their database-assigned hotel.
                 */

                if (
                    profile.hotel_id === null ||
                    profile.hotel_id === undefined ||
                    Number(profile.hotel_id) <= 0
                ) {

                    console.error(
                        "User has no assigned hotel."
                    );

                    await db.auth.signOut();

                    redirectToLogin();

                    return null;

                }

                hotelId = Number(profile.hotel_id);

                const validation =
                    await validateAssignedHotel(hotelId);

                if (!validation.valid) {

                    console.error(
                        "Assigned hotel is not available."
                    );

                    await db.auth.signOut();

                    redirectToLogin();

                    return null;

                }

                hotel = validation.hotel;

                sessionStorage.setItem(
                    "hotelId",
                    String(hotelId)
                );

                sessionStorage.setItem(
                    "hotel_id",
                    String(hotelId)
                );

                sessionStorage.setItem(
                    "hotelName",
                    hotel.hotel_name || ""
                );

            }

            /*
             * STEP 6: CHECK CURRENT PAGE PERMISSION
             */

            const currentPage = getCurrentPage();

            const allowedPages =
                PAGE_PERMISSIONS[role] || [];

            const allowed =
                !MODULE_FILES.has(currentPage) ||
                allowedPages.includes(currentPage);

            if (!allowed) {

                showAccessDenied(
                    role,
                    currentPage
                );

                return {

                    allowed: false,
                    user,
                    profile,
                    role,
                    hotel,
                    hotelId,
                    page: currentPage

                };

            }

            /*
             * STEP 7: APPLY NAVIGATION PERMISSIONS
             */

            applyNavigationPermissions(role);

            /*
             * STEP 8: PUBLISH AUTHENTICATION CONTEXT
             */

            const context = {

                allowed: true,
                user,
                profile,
                role,
                hotel,
                hotelId,
                page: currentPage

            };

            window.EDUTECH_AUTH = context;

            document.documentElement.style.visibility =
                "visible";

            /*
             * STEP 9: START ACCOUNT STATUS MONITORING
             */

            startAccountMonitoring();

            return context;

        } catch (error) {

            console.error(
                "Central authentication error:",
                error
            );

            try {

                await db.auth.signOut();

            } catch (signOutError) {

                console.error(
                    "Sign-out error:",
                    signOutError
                );

            }

            redirectToLogin();

            return null;

        }

    }


    /* =====================================================
       START
       ===================================================== */

    window.EDUTECH_AUTH_READY =
        loadAuthenticationContext();

})();
