/* =========================================================
   EDU TECH HOTEL MANAGEMENT SYSTEM
   SYSTEM CORE
   VERSION: 2026.11.15.02

   PURPOSE
   ---------------------------------------------------------
   CENTRAL STABILITY / CONTROL LAYER FOR THE ENTIRE HMS

   The System Core provides:

   1. Central application configuration
   2. Central hotel/session identification
   3. Currency and VAT configuration
   4. Module registration
   5. Module health monitoring
   6. Duplicate module initialization protection
   7. Global JavaScript error capture
   8. Promise rejection capture
   9. Safe Supabase access
   10. Database table health checks
   11. System diagnostics
   12. System event recording
   13. Controlled module startup
   14. Version information
   15. Central date/time handling
   16. Money calculation helpers
   17. System status reporting

   IMPORTANT
   ---------------------------------------------------------
   This file does NOT replace existing modules.

   Existing modules continue doing their own business work.

   The Core provides the central foundation around them.

   Do NOT put hotel business logic inside this file.

   ========================================================= */

(function () {

    "use strict";


    /* =========================================================
       1. PREVENT DUPLICATE CORE LOADING
    ========================================================= */

    if (
        window.EDUTECH_SYSTEM_CORE &&
        window.EDUTECH_SYSTEM_CORE.__loaded === true
    ) {

        console.warn(
            "EDU TECH System Core is already loaded. Duplicate initialization prevented."
        );

        return;
    }


    /* =========================================================
       2. APPLICATION IDENTITY
    ========================================================= */

    const APPLICATION_NAME =
        "EDU TECH Hotel Management System";

    const APPLICATION_SHORT_NAME =
        "EDU TECH HMS";

    const DEVELOPER_NAME =
        "EDU TECH & MEDIA SOLUTIONS";

    const SYSTEM_VERSION =
        "2026.11.15.02";

    const SCHEMA_VERSION =
        "1.0";

    const SYSTEM_TIMEZONE =
        "Africa/Nairobi";


    /* =========================================================
       3. CENTRAL BUSINESS CONFIGURATION
    ========================================================= */

    const CONFIG = {

        currency:
            "KES",

        currencySymbol:
            "KSh",

        vatRate:
            0.16,

        timezone:
            SYSTEM_TIMEZONE,

        dateFormat:
            "DD/MM/YYYY",

        applicationName:
            APPLICATION_NAME,

        applicationShortName:
            APPLICATION_SHORT_NAME,

        developer:
            DEVELOPER_NAME,

        systemVersion:
            SYSTEM_VERSION,

        schemaVersion:
            SCHEMA_VERSION

    };


    /* =========================================================
       4. STORAGE KEYS
    ========================================================= */

    const STORAGE_KEYS = {

        activeHotelId:
            "edutech_active_hotel_id",

        selectedHotelId:
            "selectedHotelId",

        hotelId:
            "hotelId",

        activeUserId:
            "edutech_active_user_id",

        activeRole:
            "edutech_active_role",

        systemInitialized:
            "edutech_system_initialized",

        systemVersion:
            "edutech_system_version"

    };


    /* =========================================================
       5. REQUIRED SYSTEM MODULES
    ========================================================= */

    const REQUIRED_MODULES = [

        "Dashboard",
        "Rooms",
        "Guests",
        "Reservations",
        "Check-In",
        "Check-Out",
        "Restaurant",
        "Inventory",
        "Payments",
        "Expenses",
        "Employees",
        "Housekeeping",
        "Maintenance",
        "Cashier",
        "Financial Transactions",
        "Reports",
        "Settings"

    ];


    /* =========================================================
       6. MODULE REGISTRY
    ========================================================= */

    const moduleRegistry = {};


    /* =========================================================
       7. SYSTEM EVENT REGISTRY
    ========================================================= */

    const systemEvents = [];

    const MAX_MEMORY_EVENTS = 500;


    /* =========================================================
       8. ERROR REGISTRY
    ========================================================= */

    const systemErrors = [];

    const MAX_MEMORY_ERRORS = 300;


    /* =========================================================
       9. INTERNAL STATE
    ========================================================= */

    const state = {

        initialized:
            false,

        initializing:
            false,

        healthy:
            true,

        activeHotelId:
            null,

        activeUserId:
            null,

        activeRole:
            null,

        supabaseAvailable:
            false,

        lastInitialization:
            null

    };


    /* =========================================================
       10. INTERNAL UTILITY
    ========================================================= */

    function nowISO() {

        return new Date().toISOString();

    }


    function safeString(value) {

        if (
            value === null ||
            value === undefined
        ) {

            return "";

        }

        return String(value);

    }


    function normalizeId(value) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {

            return null;

        }

        return String(value);

    }


    function pushLimited(array, value, limit) {

        array.push(value);

        if (array.length > limit) {

            array.splice(
                0,
                array.length - limit
            );

        }

    }


    /* =========================================================
       11. LOGGING
    ========================================================= */

    function log(message, data) {

        if (data !== undefined) {

            console.log(
                "[EDU TECH CORE]",
                message,
                data
            );

        } else {

            console.log(
                "[EDU TECH CORE]",
                message
            );

        }

    }


    function warn(message, data) {

        if (data !== undefined) {

            console.warn(
                "[EDU TECH CORE]",
                message,
                data
            );

        } else {

            console.warn(
                "[EDU TECH CORE]",
                message
            );

        }

    }


    function error(message, data) {

        if (data !== undefined) {

            console.error(
                "[EDU TECH CORE]",
                message,
                data
            );

        } else {

            console.error(
                "[EDU TECH CORE]",
                message
            );

        }

    }


    /* =========================================================
       12. SYSTEM EVENT
    ========================================================= */

    function recordEvent(
        type,
        message,
        data
    ) {

        const event = {

            id:
                "EVT-" +
                Date.now() +
                "-" +
                Math.random()
                    .toString(36)
                    .slice(2, 8),

            type:
                safeString(type),

            message:
                safeString(message),

            data:
                data ?? null,

            timestamp:
                nowISO()

        };

        pushLimited(
            systemEvents,
            event,
            MAX_MEMORY_EVENTS
        );

        return event;

    }


    /* =========================================================
       13. SYSTEM ERROR
    ========================================================= */

    function recordError(
        moduleName,
        message,
        details
    ) {

        const errorRecord = {

            id:
                "ERR-" +
                Date.now() +
                "-" +
                Math.random()
                    .toString(36)
                    .slice(2, 8),

            module:
                safeString(moduleName) ||
                "Unknown Module",

            message:
                safeString(message),

            details:
                details ?? null,

            timestamp:
                nowISO(),

            systemVersion:
                SYSTEM_VERSION

        };

        pushLimited(
            systemErrors,
            errorRecord,
            MAX_MEMORY_ERRORS
        );

        state.healthy = false;

        return errorRecord;

    }


    /* =========================================================
       14. ACTIVE HOTEL
    ========================================================= */

    function getActiveHotelId() {

        const candidates = [

            sessionStorage.getItem(
                STORAGE_KEYS.activeHotelId
            ),

            sessionStorage.getItem(
                STORAGE_KEYS.selectedHotelId
            ),

            sessionStorage.getItem(
                STORAGE_KEYS.hotelId
            ),

            localStorage.getItem(
                STORAGE_KEYS.activeHotelId
            ),

            localStorage.getItem(
                STORAGE_KEYS.selectedHotelId
            ),

            localStorage.getItem(
                STORAGE_KEYS.hotelId
            )

        ];

        for (
            let i = 0;
            i < candidates.length;
            i++
        ) {

            const id =
                normalizeId(candidates[i]);

            if (id) {

                state.activeHotelId = id;

                return id;

            }

        }

        return null;

    }


    function setActiveHotelId(hotelId) {

        const id =
            normalizeId(hotelId);

        if (!id) {

            return false;

        }

        try {

            sessionStorage.setItem(
                STORAGE_KEYS.activeHotelId,
                id
            );

            sessionStorage.setItem(
                STORAGE_KEYS.selectedHotelId,
                id
            );

            sessionStorage.setItem(
                STORAGE_KEYS.hotelId,
                id
            );

        } catch (err) {

            recordError(
                "System Core",
                "Unable to save active hotel session.",
                err?.message || err
            );

            return false;

        }

        state.activeHotelId = id;

        recordEvent(
            "HOTEL_CHANGED",
            "Active hotel changed.",
            {
                hotelId: id
            }
        );

        return true;

    }


    /* =========================================================
       15. ACTIVE USER
    ========================================================= */

    function getActiveUserId() {

        const candidates = [

            sessionStorage.getItem(
                STORAGE_KEYS.activeUserId
            ),

            localStorage.getItem(
                STORAGE_KEYS.activeUserId
            )

        ];

        for (
            let i = 0;
            i < candidates.length;
            i++
        ) {

            const id =
                normalizeId(candidates[i]);

            if (id) {

                state.activeUserId = id;

                return id;

            }

        }

        return null;

    }


    function getActiveRole() {

        const candidates = [

            sessionStorage.getItem(
                STORAGE_KEYS.activeRole
            ),

            localStorage.getItem(
                STORAGE_KEYS.activeRole
            )

        ];

        for (
            let i = 0;
            i < candidates.length;
            i++
        ) {

            const role =
                safeString(candidates[i]);

            if (role) {

                state.activeRole = role;

                return role;

            }

        }

        return null;

    }


    /* =========================================================
       16. SUPABASE ACCESS
    ========================================================= */

    function getSupabase() {

        if (
            window.supabaseClient
        ) {

            state.supabaseAvailable = true;

            return window.supabaseClient;

        }


        if (
            window.supabase &&
            typeof window.supabase
                .from === "function"
        ) {

            state.supabaseAvailable = true;

            return window.supabase;

        }


        state.supabaseAvailable = false;

        return null;

    }


    function hasSupabase() {

        return !!getSupabase();

    }


    /* =========================================================
       17. TIMEOUT PROTECTION
    ========================================================= */

    function withTimeout(
        promise,
        timeoutMs = 15000
    ) {

        return Promise.race([

            promise,

            new Promise(
                (_, reject) => {

                    setTimeout(
                        () => {

                            reject(
                                new Error(
                                    "Operation timed out after " +
                                    timeoutMs +
                                    "ms."
                                )
                            );

                        },
                        timeoutMs
                    );

                }
            )

        ]);

    }


    /* =========================================================
       18. MONEY HELPERS
    ========================================================= */

    function toNumber(value) {

        const number =
            Number(value);

        if (
            Number.isFinite(number)
        ) {

            return number;

        }

        return 0;

    }


    function roundMoney(value) {

        return Math.round(
            toNumber(value) * 100
        ) / 100;

    }


    function formatMoney(value) {

        const amount =
            roundMoney(value);

        return (
            CONFIG.currencySymbol +
            " " +
            amount.toLocaleString(
                "en-KE",
                {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }
            )
        );

    }


    function calculateVAT(grossAmount) {

        const gross =
            roundMoney(grossAmount);

        const vat =
            roundMoney(
                gross -
                (
                    gross /
                    (1 + CONFIG.vatRate)
                )
            );

        const net =
            roundMoney(
                gross - vat
            );

        return {

            gross,
            net,
            vat,
            rate:
                CONFIG.vatRate

        };

    }


    function calculateGrossFromNet(
        netAmount
    ) {

        const net =
            roundMoney(netAmount);

        const vat =
            roundMoney(
                net *
                CONFIG.vatRate
            );

        const gross =
            roundMoney(
                net + vat
            );

        return {

            net,
            vat,
            gross,
            rate:
                CONFIG.vatRate

        };

    }


    /* =========================================================
       19. DATE HELPERS
    ========================================================= */

    function todayISO() {

        const date =
            new Date();

        const year =
            date.getFullYear();

        const month =
            String(
                date.getMonth() + 1
            ).padStart(2, "0");

        const day =
            String(
                date.getDate()
            ).padStart(2, "0");

        return (
            year +
            "-" +
            month +
            "-" +
            day
        );

    }


    function formatDate(value) {

        if (!value) {

            return "";

        }

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return safeString(value);

        }

        return [

            String(
                date.getDate()
            ).padStart(2, "0"),

            String(
                date.getMonth() + 1
            ).padStart(2, "0"),

            date.getFullYear()

        ].join("/");

    }


    /* =========================================================
       20. MODULE REGISTRATION
       ========================================================= */

    function registerModule(
        name,
        options = {}
    ) {

        const moduleName =
            safeString(name).trim();

        if (!moduleName) {

            throw new Error(
                "Module name is required."
            );

        }


        const existing =
            moduleRegistry[moduleName];

        if (existing) {

            existing.lastSeen =
                nowISO();

            existing.duplicateAttempts =
                (
                    existing.duplicateAttempts ||
                    0
                ) + 1;

            warn(
                "Duplicate module registration prevented:",
                moduleName
            );

            return existing;

        }


        const record = {

            name:
                moduleName,

            version:
                options.version ||
                SYSTEM_VERSION,

            status:
                "registered",

            protected:
                options.protected !== false,

            initialized:
                false,

            initializing:
                false,

            duplicateAttempts:
                0,

            registeredAt:
                nowISO(),

            lastSeen:
                nowISO(),

            lastError:
                null,

            metadata:
                options.metadata || {}

        };


        moduleRegistry[moduleName] =
            record;


        recordEvent(
            "MODULE_REGISTERED",
            moduleName,
            {
                version:
                    record.version
            }
        );


        return record;

    }


    /* =========================================================
       21. MODULE INITIALIZATION
       ========================================================= */

    function beginModule(
        name,
        version
    ) {

        const moduleName =
            safeString(name).trim();

        let record =
            moduleRegistry[moduleName];

        if (!record) {

            record =
                registerModule(
                    moduleName,
                    {
                        version:
                            version ||
                            SYSTEM_VERSION
                    }
                );

        }


        if (record.initializing) {

            warn(
                "Module initialization already in progress:",
                moduleName
            );

            return false;

        }


        if (record.initialized) {

            warn(
                "Module already initialized. Duplicate initialization prevented:",
                moduleName
            );

            return false;

        }


        record.initializing =
            true;

        record.status =
            "initializing";

        record.lastSeen =
            nowISO();

        return true;

    }


    function completeModule(
        name,
        metadata = {}
    ) {

        const moduleName =
            safeString(name).trim();

        if (
            !moduleRegistry[moduleName]
        ) {

            registerModule(
                moduleName
            );

        }

        const record =
            moduleRegistry[moduleName];

        record.initializing =
            false;

        record.initialized =
            true;

        record.status =
            "healthy";

        record.lastSeen =
            nowISO();

        record.lastError =
            null;

        record.metadata =
            {
                ...record.metadata,
                ...metadata
            };

        recordEvent(
            "MODULE_READY",
            moduleName,
            metadata
        );

        return true;

    }


    function failModule(
        name,
        err
    ) {

        const moduleName =
            safeString(name).trim();

        if (
            !moduleRegistry[moduleName]
        ) {

            registerModule(
                moduleName
            );

        }

        const record =
            moduleRegistry[moduleName];

        record.initializing =
            false;

        record.initialized =
            false;

        record.status =
            "error";

        record.lastSeen =
            nowISO();

        record.lastError =
            safeString(
                err?.message ||
                err
            );

        recordError(
            moduleName,
            record.lastError,
            err
        );

        return false;

    }


    /* =========================================================
       22. MODULE HEALTH
       ========================================================= */

    function setModuleHealth(
        name,
        status,
        details = null
    ) {

        const moduleName =
            safeString(name).trim();

        if (
            !moduleRegistry[moduleName]
        ) {

            registerModule(
                moduleName
            );

        }

        const record =
            moduleRegistry[moduleName];

        record.status =
            status;

        record.lastSeen =
            nowISO();

        if (
            status === "healthy"
        ) {

            record.lastError =
                null;

        }

        if (
            status === "error"
        ) {

            record.lastError =
                details;
        }

        return record;

    }


    function getModuleHealth(
        name
    ) {

        return (
            moduleRegistry[
                safeString(name).trim()
            ] ||
            null
        );

    }


    function getAllModuleHealth() {

        return Object.values(
            moduleRegistry
        ).map(
            record => ({
                ...record
            })
        );

    }


    function isModuleProtected(
        name
    ) {

        const record =
            getModuleHealth(name);

        if (!record) {

            return false;

        }

        return (
            record.protected === true
        );

    }


    /* =========================================================
       23. REQUIRED MODULE REGISTRATION
       ========================================================= */

    function registerRequiredModules() {

        REQUIRED_MODULES.forEach(
            moduleName => {

                if (
                    !moduleRegistry[moduleName]
                ) {

                    registerModule(
                        moduleName,
                        {
                            version:
                                SYSTEM_VERSION,

                            protected:
                                true
                        }
                    );

                }

            }
        );

    }


    /* =========================================================
       24. DATABASE TABLE CHECK
       ========================================================= */

    async function tableExists(
        tableName
    ) {

        const supabase =
            getSupabase();

        if (!supabase) {

            return {

                exists: false,

                error:
                    "Supabase client is unavailable."

            };

        }


        try {

            const result =
                await withTimeout(

                    supabase
                        .from(tableName)
                        .select("*")
                        .limit(1),

                    10000

                );


            if (
                result.error
            ) {

                return {

                    exists: false,

                    error:
                        result.error.message ||
                        String(
                            result.error
                        )

                };

            }


            return {

                exists: true,

                error:
                    null

            };

        } catch (err) {

            return {

                exists: false,

                error:
                    err?.message ||
                    String(err)

            };

        }

    }


    /* =========================================================
       25. SAFE TABLE READ
    ========================================================= */

    async function readTable(
        tableName,
        columns = "*",
        filters = {}
    ) {

        const supabase =
            getSupabase();

        if (!supabase) {

            throw new Error(
                "Supabase client is unavailable."
            );

        }


        let query =
            supabase
                .from(tableName)
                .select(columns);


        Object.entries(filters)
            .forEach(
                ([key, value]) => {

                    if (
                        value !== null &&
                        value !== undefined
                    ) {

                        query =
                            query.eq(
                                key,
                                value
                            );

                    }

                }
            );


        const result =
            await withTimeout(
                query,
                15000
            );


        if (
            result.error
        ) {

            throw result.error;

        }


        return result.data || [];

    }


    /* =========================================================
       26. SYSTEM DIAGNOSTICS
       ========================================================= */

    async function healthCheck() {

        const result = {

            application:
                APPLICATION_NAME,

            version:
                SYSTEM_VERSION,

            schemaVersion:
                SCHEMA_VERSION,

            timezone:
                SYSTEM_TIMEZONE,

            hotelId:
                getActiveHotelId(),

            userId:
                getActiveUserId(),

            role:
                getActiveRole(),

            supabase:
                hasSupabase(),

            core:
                "healthy",

            modules:
                getAllModuleHealth(),

            errors:
                systemErrors.length,

            events:
                systemEvents.length,

            timestamp:
                nowISO()

        };


        const moduleErrors =
            result.modules.filter(
                module =>
                    module.status === "error"
            );


        if (
            moduleErrors.length > 0
        ) {

            result.core =
                "warning";

        }


        return result;

    }


    /* =========================================================
       27. SYSTEM STATUS
       ========================================================= */

    function getSystemStatus() {

        const modules =
            getAllModuleHealth();

        const failed =
            modules.filter(
                module =>
                    module.status === "error"
            );

        const initializing =
            modules.filter(
                module =>
                    module.status ===
                    "initializing"
            );

        const healthy =
            modules.filter(
                module =>
                    module.status ===
                    "healthy"
            );


        let status =
            "STABLE";


        if (
            failed.length > 0
        ) {

            status =
                "ATTENTION REQUIRED";

        } else if (
            initializing.length > 0
        ) {

            status =
                "INITIALIZING";

        }


        return {

            status,

            stable:
                status === "STABLE",

            totalModules:
                modules.length,

            healthyModules:
                healthy.length,

            failedModules:
                failed.length,

            initializingModules:
                initializing.length,

            activeHotelId:
                getActiveHotelId(),

            version:
                SYSTEM_VERSION,

            timestamp:
                nowISO()

        };

    }


    /* =========================================================
       28. CONFIGURATION ACCESS
       ========================================================= */

    function getConfig() {

        return {
            ...CONFIG
        };

    }


    function getVersion() {

        return SYSTEM_VERSION;

    }


    function getSchemaVersion() {

        return SCHEMA_VERSION;

    }


    function getApplicationName() {

        return APPLICATION_NAME;

    }


    /* =========================================================
       29. MEMORY DIAGNOSTICS
       ========================================================= */

    function getErrors() {

        return systemErrors.map(
            item => ({
                ...item
            })
        );

    }


    function getEvents() {

        return systemEvents.map(
            item => ({
                ...item
            })
        );

    }


    function clearErrors() {

        systemErrors.length = 0;

        state.healthy = true;

    }


    function clearEvents() {

        systemEvents.length = 0;

    }


    /* =========================================================
       30. GLOBAL JAVASCRIPT ERROR HANDLER
    ========================================================= */

    window.addEventListener(
        "error",
        function (event) {

            const message =
                event?.message ||
                "Unknown JavaScript error.";

            recordError(
                "Global",
                message,
                {
                    filename:
                        event?.filename ||
                        null,

                    line:
                        event?.lineno ||
                        null,

                    column:
                        event?.colno ||
                        null

                }
            );

            error(
                "Global JavaScript error:",
                message
            );

        }
    );


    /* =========================================================
       31. GLOBAL PROMISE ERROR HANDLER
    ========================================================= */

    window.addEventListener(
        "unhandledrejection",
        function (event) {

            const reason =
                event?.reason;

            const message =
                reason?.message ||
                safeString(reason) ||
                "Unhandled Promise rejection.";

            recordError(
                "Global Promise",
                message,
                reason
            );

            error(
                "Unhandled Promise rejection:",
                message
            );

        }
    );


    /* =========================================================
       32. SAFE MODULE EXECUTION
    ========================================================= */

    async function runModule(
        moduleName,
        callback
    ) {

        const started =
            beginModule(
                moduleName
            );


        if (!started) {

            return {

                success: false,

                skipped: true,

                reason:
                    "Module already initialized or initialization is in progress."

            };

        }


        try {

            const result =
                await callback();


            completeModule(
                moduleName
            );


            return {

                success: true,

                skipped: false,

                result

            };

        } catch (err) {

            failModule(
                moduleName,
                err
            );


            return {

                success: false,

                skipped: false,

                error:
                    err

            };

        }

    }


    /* =========================================================
       33. SYSTEM INITIALIZATION
    ========================================================= */

    async function initialize() {

        if (
            state.initialized
        ) {

            return getSystemStatus();

        }


        if (
            state.initializing
        ) {

            return {

                status:
                    "INITIALIZING"

            };

        }


        state.initializing =
            true;


        try {

            log(
                "Starting System Core..."
            );


            getActiveHotelId();

            getActiveUserId();

            getActiveRole();

            getSupabase();

            registerRequiredModules();


            try {

                sessionStorage.setItem(
                    STORAGE_KEYS.systemInitialized,
                    "true"
                );

                sessionStorage.setItem(
                    STORAGE_KEYS.systemVersion,
                    SYSTEM_VERSION
                );

            } catch (storageError) {

                warn(
                    "Browser storage could not be updated.",
                    storageError
                );

            }


            state.initialized =
                true;

            state.initializing =
                false;

            state.lastInitialization =
                nowISO();


            recordEvent(
                "SYSTEM_INITIALIZED",
                "EDU TECH HMS System Core initialized.",
                {
                    version:
                        SYSTEM_VERSION,

                    schemaVersion:
                        SCHEMA_VERSION,

                    hotelId:
                        state.activeHotelId
                }
            );


            log(
                "System Core initialized successfully."
            );


            return getSystemStatus();

        } catch (err) {

            state.initializing =
                false;

            state.healthy =
                false;

            recordError(
                "System Core",
                "System Core initialization failed.",
                err
            );

            error(
                "System Core initialization failed.",
                err
            );


            return {

                status:
                    "ERROR",

                error:
                    err?.message ||
                    String(err)

            };

        }

    }


    /* =========================================================
       34. PUBLIC CORE API
    ========================================================= */

    const CORE = {

        __loaded:
            true,

        __version:
            SYSTEM_VERSION,

        __schemaVersion:
            SCHEMA_VERSION,


        /* Identity */

        getApplicationName,

        getVersion,

        getSchemaVersion,

        getConfig,


        /* Hotel / Session */

        getActiveHotelId,

        setActiveHotelId,

        getActiveUserId,

        getActiveRole,


        /* Supabase */

        getSupabase,

        hasSupabase,

        withTimeout,


        /* Money */

        toNumber,

        roundMoney,

        formatMoney,

        calculateVAT,

        calculateGrossFromNet,


        /* Dates */

        todayISO,

        formatDate,


        /* Modules */

        registerModule,

        beginModule,

        completeModule,

        failModule,

        runModule,

        setModuleHealth,

        getModuleHealth,

        getAllModuleHealth,

        isModuleProtected,


        /* Database */

        tableExists,

        readTable,


        /* Diagnostics */

        healthCheck,

        getSystemStatus,

        getErrors,

        getEvents,

        clearErrors,

        clearEvents,


        /* Logging */

        recordEvent,

        recordError,


        /* State */

        state,

        moduleRegistry

    };


    /* =========================================================
       35. EXPOSE CORE
    ========================================================= */

    window.EDUTECH_SYSTEM_CORE =
        CORE;


    /* Compatibility alias */

    window.EDUTECH_CORE =
        CORE;


    /* =========================================================
       36. START CORE
    ========================================================= */

    initialize()
        .catch(
            err => {

                error(
                    "Unexpected System Core startup error:",
                    err
                );

            }
        );


})();