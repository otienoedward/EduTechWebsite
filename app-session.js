"use strict";

/*
=========================================================
 EDU TECH HOTEL MANAGEMENT SYSTEM
 CENTRAL SESSION MANAGER
=========================================================

 This file controls:

 - Logged-in user
 - User role
 - Active hotel
 - System Owner hotel selection
 - Hotel name
 - SessionStorage values

 IMPORTANT:
 User role and active hotel are SEPARATE.

 System Owner:
    role = system_owner
    hotelId = selected hotel

 Hotel Owner:
    role = hotel_owner
    hotelId = assigned hotel

 Manager:
    role = manager
    hotelId = assigned hotel

 Receptionist:
    role = receptionist
    hotelId = assigned hotel
=========================================================
*/

(function () {

    const db = window.supabaseClient;

    if (!db) {
        console.error(
            "EDU TECH: Supabase client was not found. Make sure supabase.js is loaded first."
        );
        return;
    }


    /* =====================================================
       ROLE NORMALIZATION
    ===================================================== */

    function normalizeRole(role) {

        if (!role) {
            return "";
        }

        const value = String(role)
            .trim()
            .toLowerCase()
            .replace(/-/g, "_")
            .replace(/\s+/g, "_");

        if (value === "systemowner") {
            return "system_owner";
        }

        if (value === "system_owner") {
            return "system_owner";
        }

        if (value === "system_owner_role") {
            return "system_owner";
        }

        if (value === "hotelowner") {
            return "hotel_owner";
        }

        if (value === "hotel_owner") {
            return "hotel_owner";
        }

        if (value === "manager") {
            return "manager";
        }

        if (value === "receptionist") {
            return "receptionist";
        }

        return value;
    }


    /* =====================================================
       GET CURRENT AUTHENTICATED USER
    ===================================================== */

    async function getCurrentUser() {

        const {
            data,
            error
        } = await db.auth.getSession();

        if (error) {

            console.error(
                "EDU TECH: Unable to read login session.",
                error
            );

            return null;
        }

        return data?.session?.user || null;
    }


    /* =====================================================
       GET CURRENT PROFILE
    ===================================================== */

    async function getCurrentProfile() {

        const user = await getCurrentUser();

        if (!user) {
            return null;
        }

        const {
            data,
            error
        } = await db
            .from("profiles")
            .select("id, full_name, role, hotel_id")
            .eq("id", user.id)
            .maybeSingle();

        if (error) {

            console.error(
                "EDU TECH: Unable to load user profile.",
                error
            );

            return null;
        }

        if (!data) {
            return null;
        }

        return {
            id: data.id,
            full_name: data.full_name || "User",
            role: normalizeRole(data.role),
            hotel_id: data.hotel_id
        };
    }


    /* =====================================================
       LOAD HOTEL
    ===================================================== */

    async function getHotel(hotelId) {

        if (!hotelId) {
            return null;
        }

        const {
            data,
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
                subscription_status,
                warning_type,
                warning_message,
                warning_active
            `)
            .eq("id", hotelId)
            .maybeSingle();

        if (error) {

            console.error(
                "EDU TECH: Unable to load hotel.",
                error
            );

            return null;
        }

        return data || null;
    }


    /* =====================================================
       SAVE SESSION
    ===================================================== */

    function saveSession(profile, hotel) {

        sessionStorage.setItem(
            "userId",
            profile.id
        );

        sessionStorage.setItem(
            "userName",
            profile.full_name
        );

        sessionStorage.setItem(
            "userRole",
            profile.role
        );


        /*
        -----------------------------------------------------
        HOTEL SELECTION
        -----------------------------------------------------

        For System Owner, hotel is the ACTIVE hotel.

        For other users, hotel is their ASSIGNED hotel.
        -----------------------------------------------------
        */

        if (hotel) {

            sessionStorage.setItem(
                "hotelId",
                String(hotel.id)
            );

            sessionStorage.setItem(
                "hotelName",
                hotel.hotel_name || ""
            );

            sessionStorage.setItem(
                "activeHotelId",
                String(hotel.id)
            );

            sessionStorage.setItem(
                "activeHotelName",
                hotel.hotel_name || ""
            );

        } else {

            sessionStorage.removeItem("hotelId");
            sessionStorage.removeItem("hotelName");
            sessionStorage.removeItem("activeHotelId");
            sessionStorage.removeItem("activeHotelName");

        }
    }


    /* =====================================================
       INITIALIZE USER SESSION
    ===================================================== */

    async function initialize() {

        const profile = await getCurrentProfile();

        if (!profile) {

            console.warn(
                "EDU TECH: No authenticated profile found."
            );

            return null;
        }


        /*
        =====================================================
        SYSTEM OWNER
        =====================================================

        System Owner is NOT permanently assigned to one hotel.

        The currently selected hotel is stored separately.
        =====================================================
        */

        if (profile.role === "system_owner") {

            let activeHotelId =
                sessionStorage.getItem("activeHotelId");

            let hotel = null;


            if (activeHotelId) {

                hotel = await getHotel(activeHotelId);

            }


            saveSession(
                profile,
                hotel
            );


            window.EDUTechSession = {

                userId: profile.id,

                userName: profile.full_name,

                role: profile.role,

                hotelId: hotel
                    ? hotel.id
                    : null,

                hotelName: hotel
                    ? hotel.hotel_name
                    : "",

                isSystemOwner: true,

                hotel: hotel

            };


            return window.EDUTechSession;
        }


        /*
        =====================================================
        HOTEL USER
        =====================================================
        */

        if (!profile.hotel_id) {

            console.error(
                "EDU TECH: This user has no hotel assigned."
            );

            return null;
        }


        const hotel =
            await getHotel(profile.hotel_id);


        if (!hotel) {

            console.error(
                "EDU TECH: Assigned hotel could not be found."
            );

            return null;
        }


        saveSession(
            profile,
            hotel
        );


        window.EDUTechSession = {

            userId: profile.id,

            userName: profile.full_name,

            role: profile.role,

            hotelId: hotel.id,

            hotelName: hotel.hotel_name,

            isSystemOwner: false,

            hotel: hotel

        };


        return window.EDUTechSession;
    }


    /* =====================================================
       SELECT ACTIVE HOTEL
       SYSTEM OWNER ONLY
    ===================================================== */

    async function selectHotel(hotelId) {

        const session =
            window.EDUTechSession ||
            await initialize();


        if (!session) {

            throw new Error(
                "User session could not be loaded."
            );
        }


        if (session.role !== "system_owner") {

            throw new Error(
                "Only the System Owner can change the active hotel."
            );
        }


        if (!hotelId) {

            throw new Error(
                "Please select a hotel."
            );
        }


        const hotel =
            await getHotel(hotelId);


        if (!hotel) {

            throw new Error(
                "The selected hotel could not be found."
            );
        }


        if (
            hotel.status &&
            String(hotel.status).toLowerCase() !== "active"
        ) {

            throw new Error(
                "This hotel is not active."
            );
        }


        /*
        -----------------------------------------------------
        SAVE ACTIVE HOTEL
        -----------------------------------------------------
        */

        sessionStorage.setItem(
            "activeHotelId",
            String(hotel.id)
        );

        sessionStorage.setItem(
            "activeHotelName",
            hotel.hotel_name || ""
        );

        sessionStorage.setItem(
            "hotelId",
            String(hotel.id)
        );

        sessionStorage.setItem(
            "hotelName",
            hotel.hotel_name || ""
        );


        /*
        -----------------------------------------------------
        UPDATE GLOBAL SESSION
        -----------------------------------------------------
        */

        window.EDUTechSession = {

            ...session,

            hotelId: hotel.id,

            hotelName: hotel.hotel_name,

            hotel: hotel,

            isSystemOwner: true

        };


        return window.EDUTechSession;
    }


    /* =====================================================
       CLEAR ACTIVE HOTEL
       ===================================================== */

    function clearActiveHotel() {

        sessionStorage.removeItem(
            "activeHotelId"
        );

        sessionStorage.removeItem(
            "activeHotelName"
        );

        sessionStorage.removeItem(
            "hotelId"
        );

        sessionStorage.removeItem(
            "hotelName"
        );


        if (
            window.EDUTechSession &&
            window.EDUTechSession.role === "system_owner"
        ) {

            window.EDUTechSession.hotelId = null;

            window.EDUTechSession.hotelName = "";

            window.EDUTechSession.hotel = null;
        }
    }


    /* =====================================================
       GET ACTIVE HOTEL ID
    ===================================================== */

    function getActiveHotelId() {

        if (
            window.EDUTechSession &&
            window.EDUTechSession.hotelId
        ) {

            return Number(
                window.EDUTechSession.hotelId
            );
        }


        const value =
            sessionStorage.getItem(
                "activeHotelId"
            ) ||
            sessionStorage.getItem(
                "hotelId"
            );


        if (!value) {
            return null;
        }


        const number =
            Number(value);


        return Number.isFinite(number)
            ? number
            : null;
    }


    /* =====================================================
       GET ACTIVE HOTEL NAME
    ===================================================== */

    function getActiveHotelName() {

        if (
            window.EDUTechSession &&
            window.EDUTechSession.hotelName
        ) {

            return window.EDUTechSession.hotelName;
        }


        return (
            sessionStorage.getItem(
                "activeHotelName"
            ) ||
            sessionStorage.getItem(
                "hotelName"
            ) ||
            ""
        );
    }


    /* =====================================================
       GET CURRENT ROLE
    ===================================================== */

    function getRole() {

        if (
            window.EDUTechSession &&
            window.EDUTechSession.role
        ) {

            return window.EDUTechSession.role;
        }


        return normalizeRole(
            sessionStorage.getItem(
                "userRole"
            )
        );
    }


    /* =====================================================
       GET CURRENT USER NAME
    ===================================================== */

    function getUserName() {

        if (
            window.EDUTechSession &&
            window.EDUTechSession.userName
        ) {

            return window.EDUTechSession.userName;
        }


        return (
            sessionStorage.getItem(
                "userName"
            ) ||
            "User"
        );
    }


    /* =====================================================
       GET HOTEL
    ===================================================== */

    function getActiveHotel() {

        if (
            window.EDUTechSession &&
            window.EDUTechSession.hotel
        ) {

            return window.EDUTechSession.hotel;
        }

        return null;
    }


    /* =====================================================
       LOGOUT
    ===================================================== */

    async function logout() {

        try {

            await db.auth.signOut();

        } catch (error) {

            console.error(
                "EDU TECH logout error:",
                error
            );

        }


        sessionStorage.clear();


        window.location.href =
            "./login.html";
    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.EDUTechSessionManager = {

        initialize,

        getCurrentUser,

        getCurrentProfile,

        getHotel,

        selectHotel,

        clearActiveHotel,

        getActiveHotelId,

        getActiveHotelName,

        getRole,

        getUserName,

        getActiveHotel,

        logout,

        normalizeRole

    };


    /*
    =========================================================
    AUTOMATIC INITIALIZATION
    =========================================================
    */

    document.addEventListener(
        "DOMContentLoaded",
        async function () {

            try {

                await initialize();

            } catch (error) {

                console.error(
                    "EDU TECH session initialization failed:",
                    error
                );

            }

        }
    );


})();