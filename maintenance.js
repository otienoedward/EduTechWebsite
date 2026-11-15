/* =========================================================
   EDU TECH HOTEL MANAGEMENT SYSTEM
   MAINTENANCE MODULE
   VERSION: 2026.11.15.01

   CORRECTED:
   - Hotel display IDs
   - Maintenance form IDs
   - Add button ID
   - Current hotel detection
   - Financial engine loading
   - Financial engine uses postPayment()
   - Prevents Maintenance from waiting for
     nonexistent postMaintenanceCost()
   ========================================================= */

(function () {

    "use strict";

    const VERSION = "2026.11.15.01";

    const ENGINE_PATH =
        "./financial-engine.js";

    let state = {

        hotelId: null,

        hotel: null,

        maintenance: [],

        rooms: [],

        editingId: null,

        loading: false

    };


    /* =====================================================
       BASIC HELPERS
       ===================================================== */

    function log() {

        console.log(
            "[EDU TECH Maintenance]",
            ...arguments
        );

    }


    function errorLog() {

        console.error(
            "[EDU TECH Maintenance]",
            ...arguments
        );

    }


    function escapeHtml(value) {

        if (
            value === null ||
            value === undefined
        ) {

            return "";

        }

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }


    function money(value) {

        const amount =
            Number(value) || 0;

        return new Intl.NumberFormat(
            "en-KE",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        ).format(amount);

    }


    function getSupabase() {

        if (
            window.supabaseClient &&
            typeof window.supabaseClient.from ===
            "function"
        ) {

            return window.supabaseClient;

        }


        if (
            window.supabase &&
            typeof window.supabase.from ===
            "function"
        ) {

            return window.supabase;

        }


        throw new Error(
            "Supabase client is not available. Make sure supabase.js is loaded."
        );

    }


    /* =====================================================
       FINANCIAL ENGINE
       IMPORTANT:
       The current EDU TECH financial engine uses
       postPayment(), not postMaintenanceCost().
       ===================================================== */

    function getFinancialEngine() {

        const engine =
            window.EDUTECH_FINANCIAL_ENGINE ||
            window.FinancialEngine ||
            null;


        if (
            engine &&
            typeof engine.postPayment ===
            "function"
        ) {

            return engine;

        }


        return null;

    }


    let financialEngineLoadPromise =
        null;


    async function ensureFinancialEngine() {

        const existing =
            getFinancialEngine();


        if (existing) {

            log(
                "Financial engine already available."
            );

            return existing;

        }


        if (
            financialEngineLoadPromise
        ) {

            return financialEngineLoadPromise;

        }


        financialEngineLoadPromise =
            new Promise(
                function (resolve, reject) {

                    let finished =
                        false;

                    let timeout =
                        null;

                    let checkTimer =
                        null;

                    function cleanup() {

                        if (timeout) {

                            clearTimeout(
                                timeout
                            );

                        }


                        if (checkTimer) {

                            clearInterval(
                                checkTimer
                            );

                        }


                        window.removeEventListener(
                            "edutech-financial-engine-ready",
                            readyHandler
                        );

                        window.removeEventListener(
                            "edutech:financial-engine-ready",
                            readyHandler
                        );

                    }


                    function succeed() {

                        if (finished) {

                            return;

                        }


                        const engine =
                            getFinancialEngine();


                        if (!engine) {

                            return;

                        }


                        finished =
                            true;

                        cleanup();

                        log(
                            "Financial engine is READY."
                        );

                        resolve(
                            engine
                        );

                    }


                    function fail(
                        message
                    ) {

                        if (finished) {

                            return;

                        }


                        finished =
                            true;

                        cleanup();

                        reject(
                            new Error(
                                message
                            )
                        );

                    }


                    function readyHandler() {

                        succeed();

                    }


                    /* -------------------------------------
                       Check one more time
                    ------------------------------------- */

                    const immediate =
                        getFinancialEngine();


                    if (immediate) {

                        resolve(
                            immediate
                        );

                        return;

                    }


                    window.addEventListener(
                        "edutech-financial-engine-ready",
                        readyHandler
                    );


                    window.addEventListener(
                        "edutech:financial-engine-ready",
                        readyHandler
                    );


                    /* -------------------------------------
                       Check existing scripts
                    ------------------------------------- */

                    const scripts =
                        Array.from(
                            document.scripts
                        );


                    let engineScript =
                        scripts.find(
                            function (script) {

                                return (
                                    script.src &&
                                    script.src.includes(
                                        "financial-engine.js"
                                    )
                                );

                            }
                        );


                    /* -------------------------------------
                       If the script is not already on page,
                       load it once.
                    ------------------------------------- */

                    if (!engineScript) {

                        engineScript =
                            document.createElement(
                                "script"
                            );

                        engineScript.src =
                            ENGINE_PATH;

                        engineScript.type =
                            "text/javascript";

                        engineScript.async =
                            false;

                        engineScript.dataset.edutechFinancialEngine =
                            "true";


                        engineScript.onload =
                            function () {

                                log(
                                    "financial-engine.js loaded."
                                );

                                succeed();

                            };


                        engineScript.onerror =
                            function () {

                                fail(
                                    "Could not load financial-engine.js. Check that financial-engine.js exists in the same folder as maintenance.js."
                                );

                            };


                        document.head.appendChild(
                            engineScript
                        );

                    }


                    /* -------------------------------------
                       Continue checking because the engine
                       may initialize after script load.
                    ------------------------------------- */

                    checkTimer =
                        setInterval(
                            function () {

                                if (
                                    getFinancialEngine()
                                ) {

                                    succeed();

                                }

                            },
                            100
                        );


                    /* -------------------------------------
                       Maximum wait: 15 seconds
                    ------------------------------------- */

                    timeout =
                        setTimeout(
                            function () {

                                if (
                                    getFinancialEngine()
                                ) {

                                    succeed();

                                    return;

                                }


                                fail(
                                    "Financial engine did not become ready. The current financial-engine.js does not appear to be available. Check the browser Console for the original financial-engine.js error."
                                );

                            },
                            15000
                        );

                }
            );


        try {

            return await financialEngineLoadPromise;

        }

        catch (error) {

            financialEngineLoadPromise =
                null;

            throw error;

        }

    }


    /* =====================================================
       HOTEL ID
       ===================================================== */

    async function getHotelId() {

        if (
            state.hotelId !== null &&
            Number.isFinite(
                Number(state.hotelId)
            )
        ) {

            return Number(
                state.hotelId
            );

        }


        /* -----------------------------------------
           Current hotel global
        ----------------------------------------- */

        if (
            window.currentHotel &&
            window.currentHotel.id
        ) {

            const id =
                Number(
                    window.currentHotel.id
                );


            if (
                Number.isFinite(id)
            ) {

                state.hotelId =
                    id;

                return id;

            }

        }


        /* -----------------------------------------
           Common storage keys
        ----------------------------------------- */

        const possibleKeys = [

            "hotelId",

            "hotel_id",

            "selectedHotelId",

            "selected_hotel_id",

            "currentHotelId",

            "current_hotel_id"

        ];


        /* -----------------------------------------
           Session storage
        ----------------------------------------- */

        for (
            let i = 0;
            i < possibleKeys.length;
            i++
        ) {

            const value =
                sessionStorage.getItem(
                    possibleKeys[i]
                );


            if (
                value !== null &&
                value !== ""
            ) {

                const id =
                    Number(value);


                if (
                    Number.isFinite(id) &&
                    id > 0
                ) {

                    state.hotelId =
                        id;

                    return id;

                }

            }

        }


        /* -----------------------------------------
           Local storage
        ----------------------------------------- */

        for (
            let i = 0;
            i < possibleKeys.length;
            i++
        ) {

            const value =
                localStorage.getItem(
                    possibleKeys[i]
                );


            if (
                value !== null &&
                value !== ""
            ) {

                const id =
                    Number(value);


                if (
                    Number.isFinite(id) &&
                    id > 0
                ) {

                    state.hotelId =
                        id;

                    return id;

                }

            }

        }


        /* -----------------------------------------
           Global hotelId
        ----------------------------------------- */

        if (
            window.hotelId !== undefined &&
            window.hotelId !== null
        ) {

            const id =
                Number(
                    window.hotelId
                );


            if (
                Number.isFinite(id) &&
                id > 0
            ) {

                state.hotelId =
                    id;

                return id;

            }

        }


        throw new Error(
            "Hotel ID could not be determined. Please make sure the current hotel is selected."
        );

    }


    /* =====================================================
       LOAD HOTEL
       ===================================================== */

    async function loadHotel() {

        const supabase =
            getSupabase();


        const hotelId =
            await getHotelId();


        const {
            data,
            error
        } = await supabase
            .from("hotels")
            .select("*")
            .eq(
                "id",
                hotelId
            )
            .maybeSingle();


        if (error) {

            throw new Error(
                "Unable to load hotel: " +
                error.message
            );

        }


        if (!data) {

            throw new Error(
                "The selected hotel could not be found."
            );

        }


        state.hotel =
            data;


        /* -----------------------------------------
           Actual hotel fields used by your system
        ----------------------------------------- */

        const hotelName =
            data.hotel_name ||
            data.name ||
            "Hotel";


        const hotelLocation =
            data.location ||
            "";


        /* -----------------------------------------
           Maintenance page IDs
        ----------------------------------------- */

        const nameElement =
            document.getElementById(
                "maintenanceHotelName"
            );


        if (nameElement) {

            nameElement.textContent =
                hotelName;

        }


        const locationElement =
            document.getElementById(
                "maintenanceHotelLocation"
            );


        if (locationElement) {

            locationElement.textContent =
                hotelLocation;

        }


        /* -----------------------------------------
           Backward-compatible IDs
        ----------------------------------------- */

        const oldHotelName =
            document.getElementById(
                "hotelName"
            );


        if (oldHotelName) {

            oldHotelName.textContent =
                hotelName;

        }


        const oldHotelTitle =
            document.getElementById(
                "hotelTitle"
            );


        if (oldHotelTitle) {

            oldHotelTitle.textContent =
                hotelName;

        }


        log(
            "Hotel loaded:",
            {
                id:
                    hotelId,

                name:
                    hotelName,

                location:
                    hotelLocation
            }
        );


        return state.hotel;

    }


    /* =====================================================
       LOAD ROOMS
       ===================================================== */

    async function loadRooms() {

        const supabase =
            getSupabase();


        const hotelId =
            await getHotelId();


        const {
            data,
            error
        } = await supabase
            .from("rooms")
            .select(
                "id, room_number, room_type, status, hotel_id"
            )
            .eq(
                "hotel_id",
                hotelId
            )
            .order(
                "room_number",
                {
                    ascending: true
                }
            );


        if (error) {

            throw new Error(
                "Unable to load rooms: " +
                error.message
            );

        }


        state.rooms =
            data || [];


        populateRoomSelect();


        return state.rooms;

    }


    /* =====================================================
       ROOM SELECT
       ===================================================== */

    function populateRoomSelect() {

        const select =
            document.getElementById(
                "maintenanceRoom"
            );


        if (!select) {

            return;

        }


        const currentValue =
            select.value;


        select.innerHTML =
            '<option value="">Select Room</option>';


        state.rooms.forEach(
            function (room) {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    room.id;


                option.textContent =
                    "Room " +
                    (
                        room.room_number ||
                        ""
                    );


                select.appendChild(
                    option
                );

            }
        );


        if (currentValue) {

            select.value =
                currentValue;

        }

    }


    /* =====================================================
       LOAD MAINTENANCE
       ===================================================== */

    async function loadMaintenance() {

        const supabase =
            getSupabase();


        const hotelId =
            await getHotelId();


        const {
            data,
            error
        } = await supabase
            .from("maintenance")
            .select("*")
            .eq(
                "hotel_id",
                hotelId
            )
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


        if (error) {

            throw new Error(
                "Unable to load maintenance records: " +
                error.message
            );

        }


        state.maintenance =
            data || [];


        updateSummary();


        renderMaintenance();


        return state.maintenance;

    }


    /* =====================================================
       ROOM NUMBER
       ===================================================== */

    function getRoomNumber(
        row
    ) {

        if (
            row &&
            row.room_number
        ) {

            return row.room_number;

        }


        if (
            row &&
            row.room_id
        ) {

            const room =
                state.rooms.find(
                    function (item) {

                        return (
                            Number(item.id) ===
                            Number(row.room_id)
                        );

                    }
                );


            if (room) {

                return (
                    room.room_number ||
                    ""
                );

            }

        }


        return "";

    }


    /* =====================================================
       DATE
       ===================================================== */

    function formatDate(
        value
    ) {

        if (!value) {

            return "-";

        }


        const date =
            new Date(value);


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return String(value);

        }


        return date.toLocaleDateString(
            "en-GB"
        );

    }


    /* =====================================================
       STATUS CLASS
       ===================================================== */

    function getStatusClass(
        status
    ) {

        const value =
            String(
                status ||
                ""
            ).toLowerCase();


        if (
            value ===
            "in progress"
        ) {

            return "status-progress";

        }


        if (
            value ===
            "completed"
        ) {

            return "status-completed";

        }


        if (
            value ===
            "cancelled"
        ) {

            return "status-cancelled";

        }


        return "status-pending";

    }


    /* =====================================================
       SUMMARY
       ===================================================== */

    function updateSummary() {

        const records =
            state.maintenance || [];


        const total =
            records.length;


        const pending =
            records.filter(
                function (row) {

                    return (
                        String(
                            row.status ||
                            "Pending"
                        ).toLowerCase() ===
                        "pending"
                    );

                }
            ).length;


        const progress =
            records.filter(
                function (row) {

                    return (
                        String(
                            row.status ||
                            ""
                        ).toLowerCase() ===
                        "in progress"
                    );

                }
            ).length;


        const completed =
            records.filter(
                function (row) {

                    return (
                        String(
                            row.status ||
                            ""
                        ).toLowerCase() ===
                        "completed"
                    );

                }
            ).length;


        const totalElement =
            document.getElementById(
                "totalMaintenanceTasks"
            );


        const pendingElement =
            document.getElementById(
                "pendingMaintenanceTasks"
            );


        const progressElement =
            document.getElementById(
                "progressMaintenanceTasks"
            );


        const completedElement =
            document.getElementById(
                "completedMaintenanceTasks"
            );


        if (totalElement) {

            totalElement.textContent =
                total;

        }


        if (pendingElement) {

            pendingElement.textContent =
                pending;

        }


        if (progressElement) {

            progressElement.textContent =
                progress;

        }


        if (completedElement) {

            completedElement.textContent =
                completed;

        }

    }


    /* =====================================================
       RENDER TABLE
       ===================================================== */

    function renderMaintenance() {

        const tbody =
            document.getElementById(
                "maintenanceTableBody"
            );


        if (!tbody) {

            return;

        }


        const searchElement =
            document.getElementById(
                "maintenanceSearch"
            );


        const filterElement =
            document.getElementById(
                "maintenanceStatusFilter"
            );


        const search =
            (
                searchElement?.value ||
                ""
            )
                .trim()
                .toLowerCase();


        const statusFilter =
            filterElement?.value ||
            "";


        const filtered =
            state.maintenance.filter(
                function (row) {

                    const room =
                        getRoomNumber(
                            row
                        );


                    const technician =
                        row.assigned_to ||
                        row.technician ||
                        "";


                    const issue =
                        row.issue ||
                        "";


                    const searchable =
                        [
                            row.id,
                            room,
                            technician,
                            issue,
                            row.status
                        ]
                            .join(" ")
                            .toLowerCase();


                    const matchesSearch =
                        !search ||
                        searchable.includes(
                            search
                        );


                    const matchesStatus =
                        !statusFilter ||
                        (
                            String(
                                row.status ||
                                "Pending"
                            ) ===
                            statusFilter
                        );


                    return (
                        matchesSearch &&
                        matchesStatus
                    );

                }
            );


        if (!filtered.length) {

            tbody.innerHTML = `
                <tr>
                    <td
                        colspan="8"
                        class="empty-state"
                    >
                        No maintenance records found.
                    </td>
                </tr>
            `;

            return;

        }


        tbody.innerHTML =
            filtered
                .map(
                    function (row) {

                        const roomNumber =
                            getRoomNumber(
                                row
                            );


                        const technician =
                            row.assigned_to ||
                            row.technician ||
                            "-";


                        const issue =
                            row.issue ||
                            "-";


                        const status =
                            row.status ||
                            "Pending";


                        const cost =
                            Number(
                                row.cost ||
                                0
                            );


                        const statusClass =
                            getStatusClass(
                                status
                            );


                        return `

                            <tr>

                                <td>
                                    <span class="task-id">
                                        ${escapeHtml(
                                            row.id
                                        )}
                                    </span>
                                </td>


                                <td>
                                    ${escapeHtml(
                                        roomNumber ||
                                        "-"
                                    )}
                                </td>


                                <td>
                                    ${escapeHtml(
                                        issue
                                    )}
                                </td>


                                <td>
                                    ${escapeHtml(
                                        technician
                                    )}
                                </td>


                                <td>
                                    ${escapeHtml(
                                        formatDate(
                                            row.created_at
                                        )
                                    )}
                                </td>


                                <td>
                                    <span class="cost">
                                        KSh ${money(cost)}
                                    </span>
                                </td>


                                <td>
                                    <span
                                        class="status-badge ${statusClass}"
                                    >
                                        ${escapeHtml(
                                            status
                                        )}
                                    </span>
                                </td>


                                <td>

                                    <div class="action-buttons">

                                        <button
                                            type="button"
                                            class="small-btn btn-light"
                                            onclick="EDUTECH_MAINTENANCE.view(${Number(row.id)})"
                                        >
                                            View
                                        </button>


                                        <button
                                            type="button"
                                            class="small-btn btn-primary"
                                            onclick="EDUTECH_MAINTENANCE.edit(${Number(row.id)})"
                                        >
                                            Edit
                                        </button>


                                        <button
                                            type="button"
                                            class="small-btn btn-success"
                                            onclick="EDUTECH_MAINTENANCE.post(${Number(row.id)})"
                                        >
                                            Post Cost
                                        </button>


                                        <button
                                            type="button"
                                            class="small-btn btn-danger"
                                            onclick="EDUTECH_MAINTENANCE.remove(${Number(row.id)})"
                                        >
                                            Delete
                                        </button>

                                    </div>

                                </td>

                            </tr>

                        `;

                    }
                )
                .join("");

    }


    /* =====================================================
       FORM VALUES
       ===================================================== */

    function getFormValues() {

        const roomElement =
            document.getElementById(
                "maintenanceRoom"
            );


        const technicianElement =
            document.getElementById(
                "maintenanceTechnician"
            );


        const issueElement =
            document.getElementById(
                "maintenanceIssue"
            );


        const statusElement =
            document.getElementById(
                "maintenanceStatus"
            );


        const costElement =
            document.getElementById(
                "maintenanceCost"
            );


        const notesElement =
            document.getElementById(
                "maintenanceNotes"
            );


        const roomId =
            roomElement?.value ||
            "";


        const technician =
            technicianElement?.value.trim() ||
            "";


        const issue =
            issueElement?.value.trim() ||
            "";


        const status =
            statusElement?.value ||
            "Pending";


        const cost =
            Number(
                costElement?.value ||
                0
            );


        const notes =
            notesElement?.value.trim() ||
            "";


        let roomNumber =
            "";


        const room =
            state.rooms.find(
                function (item) {

                    return (
                        Number(item.id) ===
                        Number(roomId)
                    );

                }
            );


        if (room) {

            roomNumber =
                room.room_number ||
                "";

        }


        return {

            roomId:
                roomId
                    ? Number(roomId)
                    : null,

            roomNumber,

            technician,

            issue,

            status,

            cost,

            notes

        };

    }


    /* =====================================================
       CLEAR FORM
       ===================================================== */

    function clearForm() {

        const form =
            document.getElementById(
                "maintenanceForm"
            );


        if (form) {

            form.reset();

        }


        const status =
            document.getElementById(
                "maintenanceStatus"
            );


        if (status) {

            status.value =
                "Pending";

        }


        const cost =
            document.getElementById(
                "maintenanceCost"
            );


        if (cost) {

            cost.value =
                "0";

        }


        const id =
            document.getElementById(
                "maintenanceId"
            );


        if (id) {

            id.value =
                "";

        }


        state.editingId =
            null;


        const title =
            document.getElementById(
                "maintenanceModalTitle"
            );


        if (title) {

            title.textContent =
                "Add Maintenance Task";

        }

    }


    /* =====================================================
       OPEN MODAL
       ===================================================== */

    function open() {

        clearForm();


        const modal =
            document.getElementById(
                "maintenanceModal"
            );


        if (modal) {

            modal.classList.add(
                "show"
            );

        }

    }


    /* =====================================================
       CLOSE MODAL
       ===================================================== */

    function close() {

        const modal =
            document.getElementById(
                "maintenanceModal"
            );


        if (modal) {

            modal.classList.remove(
                "show"
            );

        }

    }


    /* =====================================================
       EDIT
       ===================================================== */

    function edit(
        id
    ) {

        const row =
            state.maintenance.find(
                function (item) {

                    return (
                        Number(item.id) ===
                        Number(id)
                    );

                }
            );


        if (!row) {

            alert(
                "Maintenance record not found."
            );

            return;

        }


        state.editingId =
            Number(id);


        const hiddenId =
            document.getElementById(
                "maintenanceId"
            );


        if (hiddenId) {

            hiddenId.value =
                id;

        }


        const room =
            document.getElementById(
                "maintenanceRoom"
            );


        if (room) {

            room.value =
                row.room_id ||
                "";

        }


        const technician =
            document.getElementById(
                "maintenanceTechnician"
            );


        if (technician) {

            technician.value =
                row.assigned_to ||
                row.technician ||
                "";

        }


        const issue =
            document.getElementById(
                "maintenanceIssue"
            );


        if (issue) {

            issue.value =
                row.issue ||
                "";

        }


        const status =
            document.getElementById(
                "maintenanceStatus"
            );


        if (status) {

            status.value =
                row.status ||
                "Pending";

        }


        const cost =
            document.getElementById(
                "maintenanceCost"
            );


        if (cost) {

            cost.value =
                row.cost ||
                0;

        }


        const notes =
            document.getElementById(
                "maintenanceNotes"
            );


        if (notes) {

            notes.value =
                row.notes ||
                "";

        }


        const title =
            document.getElementById(
                "maintenanceModalTitle"
            );


        if (title) {

            title.textContent =
                "Edit Maintenance Task";

        }


        const modal =
            document.getElementById(
                "maintenanceModal"
            );


        if (modal) {

            modal.classList.add(
                "show"
            );

        }

    }


    /* =====================================================
       SAVE
       ===================================================== */

    async function save(
        event
    ) {

        if (event) {

            event.preventDefault();

        }


        if (state.loading) {

            return;

        }


        state.loading =
            true;


        try {

            const supabase =
                getSupabase();


            const hotelId =
                await getHotelId();


            const values =
                getFormValues();


            if (!values.issue) {

                throw new Error(
                    "Please enter the maintenance issue."
                );

            }


            if (
                !Number.isFinite(
                    values.cost
                ) ||
                values.cost < 0
            ) {

                throw new Error(
                    "Please enter a valid maintenance cost."
                );

            }


            const record = {

                hotel_id:
                    hotelId,

                room_id:
                    values.roomId,

                room_number:
                    values.roomNumber,

                issue:
                    values.issue,

                assigned_to:
                    values.technician,

                status:
                    values.status,

                cost:
                    values.cost,

                notes:
                    values.notes

            };


            if (state.editingId) {

                const {
                    data,
                    error
                } = await supabase
                    .from("maintenance")
                    .update(record)
                    .eq(
                        "id",
                        state.editingId
                    )
                    .eq(
                        "hotel_id",
                        hotelId
                    )
                    .select("*")
                    .maybeSingle();


                if (error) {

                    throw new Error(
                        "Unable to update maintenance: " +
                        error.message
                    );

                }


                if (!data) {

                    throw new Error(
                        "Maintenance record was not returned after updating."
                    );

                }


                alert(
                    "Maintenance task updated successfully."
                );

            }

            else {

                const {
                    data,
                    error
                } = await supabase
                    .from("maintenance")
                    .insert(record)
                    .select("*")
                    .maybeSingle();


                if (error) {

                    throw new Error(
                        "Unable to save maintenance: " +
                        error.message
                    );

                }


                if (!data) {

                    throw new Error(
                        "Maintenance record was not returned after saving."
                    );

                }


                alert(
                    "Maintenance task saved successfully."
                );

            }


            state.editingId =
                null;


            close();


            await loadMaintenance();

        }

        catch (error) {

            errorLog(
                "Maintenance save failed:",
                error
            );


            alert(
                "MAINTENANCE SAVE FAILED:\n\n" +
                (
                    error.message ||
                    error
                )
            );

        }

        finally {

            state.loading =
                false;

        }

    }


    /* =====================================================
       VIEW
       ===================================================== */

    function view(
        id
    ) {

        const row =
            state.maintenance.find(
                function (item) {

                    return (
                        Number(item.id) ===
                        Number(id)
                    );

                }
            );


        if (!row) {

            alert(
                "Maintenance record not found."
            );

            return;

        }


        const room =
            getRoomNumber(
                row
            );


        const technician =
            row.assigned_to ||
            row.technician ||
            "-";


        const status =
            row.status ||
            "Pending";


        const cost =
            Number(
                row.cost ||
                0
            );


        const content =
            document.getElementById(
                "maintenanceViewContent"
            );


        if (!content) {

            return;

        }


        content.innerHTML = `

            <div class="view-item">

                <div class="view-label">
                    Task ID
                </div>

                <div class="view-value">
                    ${escapeHtml(row.id)}
                </div>

            </div>


            <div class="view-item">

                <div class="view-label">
                    Room
                </div>

                <div class="view-value">
                    ${escapeHtml(room || "-")}
                </div>

            </div>


            <div class="view-item">

                <div class="view-label">
                    Technician
                </div>

                <div class="view-value">
                    ${escapeHtml(technician)}
                </div>

            </div>


            <div class="view-item">

                <div class="view-label">
                    Status
                </div>

                <div class="view-value">
                    ${escapeHtml(status)}
                </div>

            </div>


            <div class="view-item">

                <div class="view-label">
                    Cost
                </div>

                <div class="view-value">
                    KSh ${money(cost)}
                </div>

            </div>


            <div class="view-item">

                <div class="view-label">
                    Date
                </div>

                <div class="view-value">
                    ${escapeHtml(
                        formatDate(
                            row.created_at
                        )
                    )}
                </div>

            </div>


            <div class="view-item full">

                <div class="view-label">
                    Issue
                </div>

                <div class="view-value">
                    ${escapeHtml(
                        row.issue ||
                        "-"
                    )}
                </div>

            </div>


            <div class="view-item full">

                <div class="view-label">
                    Notes
                </div>

                <div class="view-value">
                    ${escapeHtml(
                        row.notes ||
                        "-"
                    )}
                </div>

            </div>

        `;


        const modal =
            document.getElementById(
                "viewMaintenanceModal"
            );


        if (modal) {

            modal.classList.add(
                "show"
            );

        }

    }


    /* =====================================================
       CLOSE VIEW
       ===================================================== */

    function closeView() {

        const modal =
            document.getElementById(
                "viewMaintenanceModal"
            );


        if (modal) {

            modal.classList.remove(
                "show"
            );

        }

    }


    /* =====================================================
       POST MAINTENANCE COST
       ===================================================== */

    async function post(
        id
    ) {

        if (state.loading) {

            return;

        }


        try {

            const row =
                state.maintenance.find(
                    function (item) {

                        return (
                            Number(item.id) ===
                            Number(id)
                        );

                    }
                );


            if (!row) {

                throw new Error(
                    "Maintenance record could not be found."
                );

            }


            const amount =
                Number(
                    row.cost ||
                    0
                );


            if (
                !Number.isFinite(amount) ||
                amount <= 0
            ) {

                throw new Error(
                    "This maintenance task has no valid cost to post."
                );

            }


            const confirmed =
                window.confirm(
                    "Post maintenance cost of KSh " +
                    money(amount) +
                    " to the financial ledger?"
                );


            if (!confirmed) {

                return;

            }


            state.loading =
                true;


            /* -----------------------------------------
               HOTEL
            ----------------------------------------- */

            const hotelId =
                await getHotelId();


            /* -----------------------------------------
               ENGINE
            ----------------------------------------- */

            const engine =
                await ensureFinancialEngine();


            if (
                !engine ||
                typeof engine.postPayment !==
                "function"
            ) {

                throw new Error(
                    "The EDU TECH Financial Engine is not available. The engine must expose postPayment()."
                );

            }


            const roomNumber =
                getRoomNumber(
                    row
                );


            const description =
                "Maintenance cost" +
                (
                    roomNumber
                        ? " - Room " +
                          roomNumber
                        : ""
                ) +
                (
                    row.issue
                        ? " - " +
                          row.issue
                        : ""
                );


            /* -----------------------------------------
               IMPORTANT

               The current financial engine uses the
               existing postPayment() interface.

               We create a payment-style financial
               record for the engine without inserting
               a fake record into the payments table.
            ----------------------------------------- */

            const financialRecord = {

                id:
                    "MAINT-" +
                    row.id,

                payment_id:
                    null,

                hotel_id:
                    hotelId,

                amount:
                    amount,

                payment_method:
                    "Cash",

                payment_date:
                    row.created_at
                        ? new Date(
                            row.created_at
                          )
                            .toISOString()
                            .slice(0, 10)
                        : new Date()
                            .toISOString()
                            .slice(0, 10),

                reference_number:
                    "MAINT-" +
                    row.id,

                transaction_number:
                    "MAINT-" +
                    row.id,

                description:
                    description,

                source:
                    "Maintenance",

                source_type:
                    "Maintenance",

                maintenance_id:
                    row.id,

                room_id:
                    row.room_id ||
                    null,

                room_number:
                    roomNumber,

                issue:
                    row.issue ||
                    "",

                is_maintenance:
                    true

            };


            log(
                "Posting maintenance cost through Financial Engine:",
                financialRecord
            );


            const result =
                await engine.postPayment(
                    financialRecord
                );


            log(
                "Financial engine maintenance result:",
                result
            );


            /* -----------------------------------------
               VERIFY LEDGER
            ----------------------------------------- */

            const supabase =
                getSupabase();


            let ledgerRows =
                [];


            try {

                const firstCheck =
                    await supabase
                        .from(
                            "financial_transactions"
                        )
                        .select("*")
                        .eq(
                            "hotel_id",
                            hotelId
                        )
                        .eq(
                            "payment_id",
                            "MAINT-" +
                            row.id
                        );


                if (
                    !firstCheck.error &&
                    firstCheck.data
                ) {

                    ledgerRows =
                        firstCheck.data;

                }

            }

            catch (verificationError) {

                console.warn(
                    "Maintenance ledger verification could not use payment_id:",
                    verificationError
                );

            }


            /* -----------------------------------------
               Second verification by reference
            ----------------------------------------- */

            if (
                !ledgerRows.length
            ) {

                try {

                    const secondCheck =
                        await supabase
                            .from(
                                "financial_transactions"
                            )
                            .select("*")
                            .eq(
                                "hotel_id",
                                hotelId
                            )
                            .eq(
                                "reference_number",
                                "MAINT-" +
                                row.id
                            );


                    if (
                        !secondCheck.error &&
                        secondCheck.data
                    ) {

                        ledgerRows =
                            secondCheck.data;

                    }

                }

                catch (
                    referenceVerificationError
                ) {

                    console.warn(
                        "Maintenance reference verification failed:",
                        referenceVerificationError
                    );

                }

            }


            /* -----------------------------------------
               Engine returned success
            ----------------------------------------- */

            if (
                result &&
                (
                    result.success === true ||
                    result.alreadyPosted === true
                )
            ) {

                alert(
                    result.alreadyPosted
                        ? "This maintenance cost is already posted to the financial ledger."
                        : "Maintenance cost posted successfully to the financial ledger."
                );

                return;

            }


            /* -----------------------------------------
               Ledger entry exists
            ----------------------------------------- */

            if (
                ledgerRows.length
            ) {

                alert(
                    "Maintenance cost posted successfully to the financial ledger."
                );

                return;

            }


            /* -----------------------------------------
               If engine returned a result without an
               explicit success flag, do not call it
               a failure automatically.
            ----------------------------------------- */

            if (
                result !== undefined &&
                result !== null
            ) {

                alert(
                    "Maintenance cost was sent to the financial engine successfully."
                );

                return;

            }


            throw new Error(
                "Financial engine did not confirm the maintenance posting."
            );

        }

        catch (error) {

            errorLog(
                "MAINTENANCE LEDGER POSTING FAILED:",
                error
            );


            alert(
                "MAINTENANCE LEDGER POSTING FAILED:\n\n" +
                (
                    error.message ||
                    error
                )
            );

        }

        finally {

            state.loading =
                false;

        }

    }


    /* =====================================================
       DELETE
       ===================================================== */

    async function remove(
        id
    ) {

        try {

            const confirmed =
                window.confirm(
                    "Delete this maintenance record?"
                );


            if (!confirmed) {

                return;

            }


            const supabase =
                getSupabase();


            const hotelId =
                await getHotelId();


            const {
                error
            } = await supabase
                .from("maintenance")
                .delete()
                .eq(
                    "id",
                    id
                )
                .eq(
                    "hotel_id",
                    hotelId
                );


            if (error) {

                throw new Error(
                    "Unable to delete maintenance record: " +
                    error.message
                );

            }


            await loadMaintenance();


            alert(
                "Maintenance record deleted successfully."
            );

        }

        catch (error) {

            errorLog(
                "Maintenance delete failed:",
                error
            );


            alert(
                "DELETE FAILED:\n\n" +
                (
                    error.message ||
                    error
                )
            );

        }

    }


    /* =====================================================
       PRINT
       ===================================================== */

    function printReport() {

        window.print();

    }


    /* =====================================================
       SEARCH
       ===================================================== */

    function setupSearch() {

        const search =
            document.getElementById(
                "maintenanceSearch"
            );


        const status =
            document.getElementById(
                "maintenanceStatusFilter"
            );


        if (search) {

            search.addEventListener(
                "input",
                function () {

                    renderMaintenance();

                }
            );

        }


        if (status) {

            status.addEventListener(
                "change",
                function () {

                    renderMaintenance();

                }
            );

        }

    }


    /* =====================================================
       EVENT SETUP
       ===================================================== */

    function setupEvents() {

        /* -----------------------------------------
           Add
        ----------------------------------------- */

        const addButton =
            document.getElementById(
                "addMaintenanceButton"
            );


        if (addButton) {

            addButton.addEventListener(
                "click",
                open
            );

        }


        /* -----------------------------------------
           Form
        ----------------------------------------- */

        const form =
            document.getElementById(
                "maintenanceForm"
            );


        if (form) {

            form.addEventListener(
                "submit",
                save
            );

        }


        /* -----------------------------------------
           Close edit modal
        ----------------------------------------- */

        const closeButton =
            document.getElementById(
                "closeMaintenanceModal"
            );


        if (closeButton) {

            closeButton.addEventListener(
                "click",
                close
            );

        }


        const cancelButton =
            document.getElementById(
                "cancelMaintenanceButton"
            );


        if (cancelButton) {

            cancelButton.addEventListener(
                "click",
                close
            );

        }


        /* -----------------------------------------
           Close view modal
        ----------------------------------------- */

        const closeViewButton =
            document.getElementById(
                "closeViewMaintenanceModal"
            );


        if (closeViewButton) {

            closeViewButton.addEventListener(
                "click",
                closeView
            );

        }


        const closeViewButton2 =
            document.getElementById(
                "closeViewMaintenanceButton"
            );


        if (closeViewButton2) {

            closeViewButton2.addEventListener(
                "click",
                closeView
            );

        }


        /* -----------------------------------------
           Refresh
        ----------------------------------------- */

        const refreshButton =
            document.getElementById(
                "refreshMaintenanceButton"
            );


        if (refreshButton) {

            refreshButton.addEventListener(
                "click",
                reload
            );

        }


        /* -----------------------------------------
           Print
        ----------------------------------------- */

        const printButton =
            document.getElementById(
                "printMaintenanceButton"
            );


        if (printButton) {

            printButton.addEventListener(
                "click",
                printReport
            );

        }


        /* -----------------------------------------
           Search/filter
        ----------------------------------------- */

        setupSearch();


        /* -----------------------------------------
           Modal background click
        ----------------------------------------- */

        const modal =
            document.getElementById(
                "maintenanceModal"
            );


        if (modal) {

            modal.addEventListener(
                "click",
                function (event) {

                    if (
                        event.target ===
                        modal
                    ) {

                        close();

                    }

                }
            );

        }


        const viewModal =
            document.getElementById(
                "viewMaintenanceModal"
            );


        if (viewModal) {

            viewModal.addEventListener(
                "click",
                function (event) {

                    if (
                        event.target ===
                        viewModal
                    ) {

                        closeView();

                    }

                }
            );

        }

    }


    /* =====================================================
       RELOAD
       ===================================================== */

    async function reload() {

        try {

            await loadHotel();

            await loadRooms();

            await loadMaintenance();

        }

        catch (error) {

            errorLog(
                "Maintenance reload failed:",
                error
            );


            alert(
                "Unable to reload Maintenance:\n\n" +
                (
                    error.message ||
                    error
                )
            );

        }

    }


    /* =====================================================
       INITIALIZE
       ===================================================== */

    async function init() {

        try {

            log(
                "Initializing Maintenance Module:",
                VERSION
            );


            /* -----------------------------------------
               Get current hotel
            ----------------------------------------- */

            await getHotelId();


            /* -----------------------------------------
               Load hotel
            ----------------------------------------- */

            await loadHotel();


            /* -----------------------------------------
               Load rooms
            ----------------------------------------- */

            await loadRooms();


            /* -----------------------------------------
               Load maintenance
            ----------------------------------------- */

            await loadMaintenance();


            /* -----------------------------------------
               Setup events
            ----------------------------------------- */

            setupEvents();


            /*
             * Do NOT make Maintenance startup depend
             * on the financial engine.
             *
             * The engine is loaded only when Post Cost
             * is actually clicked.
             */

            log(
                "Maintenance module loaded successfully."
            );

        }

        catch (error) {

            errorLog(
                "Maintenance initialization failed:",
                error
            );


            const nameElement =
                document.getElementById(
                    "maintenanceHotelName"
                );


            const locationElement =
                document.getElementById(
                    "maintenanceHotelLocation"
                );


            if (nameElement) {

                nameElement.textContent =
                    "Hotel could not be loaded";

            }


            if (locationElement) {

                locationElement.textContent =
                    error.message ||
                    "Unable to load hotel information.";

            }


            alert(
                "MAINTENANCE MODULE FAILED TO LOAD:\n\n" +
                (
                    error.message ||
                    error
                )
            );

        }

    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    window.EDUTECH_MAINTENANCE = {

        version:
            VERSION,

        open,

        close,

        save,

        edit,

        view,

        post,

        postCost:
            post,

        remove,

        delete:
            remove,

        reload,

        printReport,

        loadMaintenance,

        ensureFinancialEngine

    };


    /* =====================================================
       START
       ===================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            init
        );

    }

    else {

        init();

    }

})();