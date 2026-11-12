/* =========================================================
   EDU TECH HOTEL MANAGEMENT SYSTEM
   MAINTENANCE.JS
   ---------------------------------------------------------
   VERSION: 2026.11.06.01
   ---------------------------------------------------------
   MATCHED EXACTLY TO CURRENT maintenance.html

   FEATURES:
   - Load current hotel
   - Load maintenance records
   - Load rooms
   - Load employees / technicians
   - Add maintenance task
   - Edit maintenance task
   - Delete maintenance task
   - View maintenance task
   - Search maintenance
   - Filter by status
   - Summary statistics
   - Print report
   - Save PDF
   - Hotel-specific records

   IMPORTANT:
   - Maintenance is NOT connected to the financial ledger.
   - Maintenance cost is stored as a record only.
   - No financial transaction is created.
   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       STATE
       ===================================================== */

    const state = {

        hotelId: null,

        hotel: null,

        maintenance: [],

        rooms: [],

        employees: [],

        editingId: null,

        loading: false

    };


    /* =====================================================
       BASIC HELPERS
       ===================================================== */

    function getSupabase() {

        return window.supabaseClient || null;

    }


    function getStorageValue(keys) {

        for (const key of keys) {

            const sessionValue =
                sessionStorage.getItem(key);

            if (
                sessionValue !== null &&
                sessionValue !== ""
            ) {

                return sessionValue;

            }


            const localValue =
                localStorage.getItem(key);

            if (
                localValue !== null &&
                localValue !== ""
            ) {

                return localValue;

            }

        }

        return null;

    }


    function getHotelId() {

        const value =
            getStorageValue([
                "hotelId",
                "hotel_id",
                "currentHotelId",
                "current_hotel_id"
            ]);


        if (!value) {

            return null;

        }


        const id =
            Number(value);


        return Number.isFinite(id)
            ? id
            : null;

    }


    function money(value) {

        return (
            Number(value) || 0
        ).toLocaleString(
            "en-KE",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
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


    function showToast(
        message,
        type = ""
    ) {

        const container =
            document.getElementById(
                "toastContainer"
            );


        if (!container) {

            alert(message);

            return;

        }


        const toast =
            document.createElement(
                "div"
            );


        toast.className =
            `toast ${type}`;


        toast.textContent =
            message;


        container.appendChild(
            toast
        );


        setTimeout(
            () => {

                toast.remove();

            },
            3500
        );

    }


    /* =====================================================
       HOTEL
       ===================================================== */

    async function loadHotel() {

        const supabase =
            getSupabase();


        if (
            !supabase ||
            !state.hotelId
        ) {

            return;

        }


        try {

            const {
                data,
                error
            } =
                await supabase
                    .from("hotels")
                    .select("*")
                    .eq(
                        "id",
                        state.hotelId
                    )
                    .single();


            if (error) {

                throw error;

            }


            state.hotel =
                data || null;


            const hotelName =
                document.getElementById(
                    "maintenanceHotelName"
                );


            const hotelLocation =
                document.getElementById(
                    "maintenanceHotelLocation"
                );


            if (hotelName) {

                hotelName.textContent =
                    data?.hotel_name ||
                    data?.name ||
                    "Current Hotel";

            }


            if (hotelLocation) {

                hotelLocation.textContent =
                    data?.location ||
                    "-";

            }

        } catch (error) {

            console.error(
                "Hotel loading error:",
                error
            );

            const hotelName =
                document.getElementById(
                    "maintenanceHotelName"
                );


            const hotelLocation =
                document.getElementById(
                    "maintenanceHotelLocation"
                );


            if (hotelName) {

                hotelName.textContent =
                    "Hotel information unavailable";

            }


            if (hotelLocation) {

                hotelLocation.textContent =
                    "";

            }

        }

    }


    /* =====================================================
       LOAD ROOMS
       ===================================================== */

    async function loadRooms() {

        const supabase =
            getSupabase();


        if (
            !supabase ||
            !state.hotelId
        ) {

            state.rooms = [];

            populateRooms();

            return;

        }


        try {

            const {
                data,
                error
            } =
                await supabase
                    .from("rooms")
                    .select("*")
                    .eq(
                        "hotel_id",
                        state.hotelId
                    )
                    .order(
                        "room_number",
                        {
                            ascending: true
                        }
                    );


            if (error) {

                throw error;

            }


            state.rooms =
                Array.isArray(data)
                    ? data
                    : [];


            populateRooms();

        } catch (error) {

            console.error(
                "Rooms loading error:",
                error
            );


            state.rooms = [];

            populateRooms();

        }

    }


    /* =====================================================
       LOAD EMPLOYEES
       ===================================================== */

    async function loadEmployees() {

        const supabase =
            getSupabase();


        if (
            !supabase ||
            !state.hotelId
        ) {

            state.employees = [];

            populateTechnicians();

            return;

        }


        try {

            const {
                data,
                error
            } =
                await supabase
                    .from("employees")
                    .select("*")
                    .eq(
                        "hotel_id",
                        state.hotelId
                    )
                    .order(
                        "full_name",
                        {
                            ascending: true
                        }
                    );


            if (error) {

                throw error;

            }


            state.employees =
                Array.isArray(data)
                    ? data
                    : [];


            populateTechnicians();

        } catch (error) {

            console.error(
                "Employees loading error:",
                error
            );


            state.employees = [];

            populateTechnicians();

        }

    }


    /* =====================================================
       LOAD MAINTENANCE
       ===================================================== */

    async function loadMaintenance() {

        const supabase =
            getSupabase();


        if (
            !supabase ||
            !state.hotelId
        ) {

            state.maintenance = [];

            renderMaintenance();

            updateSummary();

            return;

        }


        state.loading = true;


        renderLoading();


        try {

            const {
                data,
                error
            } =
                await supabase
                    .from("maintenance")
                    .select("*")
                    .eq(
                        "hotel_id",
                        state.hotelId
                    )
                    .order(
                        "created_at",
                        {
                            ascending: false
                        }
                    );


            if (error) {

                throw error;

            }


            state.maintenance =
                Array.isArray(data)
                    ? data
                    : [];


        } catch (error) {

            console.error(
                "Maintenance loading error:",
                error
            );


            state.maintenance = [];


            const tbody =
                document.getElementById(
                    "maintenanceTableBody"
                );


            if (tbody) {

                tbody.innerHTML = `

                    <tr>

                        <td
                            colspan="8"
                            class="error-state"
                        >

                            Unable to load maintenance records.

                            <br><br>

                            ${escapeHtml(
                                error.message
                            )}

                        </td>

                    </tr>

                `;

            }

        } finally {

            state.loading = false;

        }


        renderMaintenance();

        updateSummary();

    }


    function renderLoading() {

        const tbody =
            document.getElementById(
                "maintenanceTableBody"
            );


        if (!tbody) {

            return;

        }


        tbody.innerHTML = `

            <tr>

                <td
                    colspan="8"
                    class="loading-state"
                >

                    Loading maintenance tasks...

                </td>

            </tr>

        `;

    }


    /* =====================================================
       ROOM / EMPLOYEE HELPERS
       ===================================================== */

    function getRoomById(id) {

        if (
            id === null ||
            id === undefined ||
            id === ""
        ) {

            return null;

        }


        return state.rooms.find(
            room =>
                Number(room.id) ===
                Number(id)
        ) || null;

    }


    function getEmployeeById(id) {

        if (
            id === null ||
            id === undefined ||
            id === ""
        ) {

            return null;

        }


        return state.employees.find(
            employee =>
                Number(employee.id) ===
                Number(id)
        ) || null;

    }


    function getEmployeeName(employee) {

        if (!employee) {

            return "";

        }


        return (
            employee.full_name ||
            employee.name ||
            employee.employee_name ||
            employee.staff_name ||
            ""
        );

    }


    function getRoomNumber(record) {

        if (
            record.room_number !== null &&
            record.room_number !== undefined &&
            String(record.room_number).trim() !== ""
        ) {

            return record.room_number;

        }


        const room =
            getRoomById(
                record.room_id
            );


        return (
            room?.room_number ||
            "-"
        );

    }


    function getTechnicianName(record) {

        if (
            record.assigned_to !== null &&
            record.assigned_to !== undefined &&
            String(record.assigned_to).trim() !== ""
        ) {

            return record.assigned_to;

        }


        const employee =
            getEmployeeById(
                record.employee_id
            );


        return (
            getEmployeeName(employee) ||
            "-"
        );

    }


    /* =====================================================
       STATUS
       ===================================================== */

    function getStatusClass(status) {

        const value =
            String(
                status || ""
            )
            .trim()
            .toLowerCase();


        if (
            value === "completed"
        ) {

            return "status-badge status-completed";

        }


        if (
            value === "in progress"
        ) {

            return "status-badge status-progress";

        }


        if (
            value === "cancelled"
        ) {

            return "status-badge status-cancelled";

        }


        return "status-badge status-pending";

    }


    /* =====================================================
       RENDER MAINTENANCE
       ===================================================== */

    function renderMaintenance() {

        const tbody =
            document.getElementById(
                "maintenanceTableBody"
            );


        if (!tbody) {

            return;

        }


        const search =
            String(
                document.getElementById(
                    "maintenanceSearch"
                )?.value || ""
            )
            .trim()
            .toLowerCase();


        const statusFilter =
            String(
                document.getElementById(
                    "maintenanceStatusFilter"
                )?.value || ""
            )
            .trim()
            .toLowerCase();


        const filtered =
            state.maintenance.filter(
                record => {

                    const room =
                        getRoomNumber(
                            record
                        );


                    const technician =
                        getTechnicianName(
                            record
                        );


                    const searchable = [

                        record.id,

                        room,

                        record.issue,

                        technician,

                        record.status,

                        record.notes

                    ]
                    .filter(
                        value =>
                            value !== null &&
                            value !== undefined
                    )
                    .join(" ")
                    .toLowerCase();


                    const matchesSearch =
                        !search ||
                        searchable.includes(
                            search
                        );


                    const matchesStatus =
                        !statusFilter ||
                        String(
                            record.status || ""
                        )
                        .trim()
                        .toLowerCase() ===
                        statusFilter;


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
            filtered.map(
                record => {

                    const cost =
                        Number(
                            record.cost || 0
                        );


                    const date =
                        record.created_at
                            ? new Date(
                                record.created_at
                            ).toLocaleDateString(
                                "en-KE"
                            )
                            : "-";


                    const status =
                        record.status ||
                        "Pending";


                    return `

                        <tr>

                            <td>
                                <span class="task-id">
                                    #${escapeHtml(
                                        record.id
                                    )}
                                </span>
                            </td>

                            <td>
                                ${escapeHtml(
                                    getRoomNumber(
                                        record
                                    )
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    record.issue ||
                                    "-"
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    getTechnicianName(
                                        record
                                    )
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    date
                                )}
                            </td>

                            <td>
                                <span class="cost">
                                    KSh ${money(
                                        cost
                                    )}
                                </span>
                            </td>

                            <td>

                                <span
                                    class="${getStatusClass(
                                        status
                                    )}"
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
                                        class="small-btn btn-secondary"
                                        data-view-maintenance="${record.id}"
                                    >
                                        View
                                    </button>

                                    <button
                                        type="button"
                                        class="small-btn btn-warning"
                                        data-edit-maintenance="${record.id}"
                                    >
                                        Edit
                                    </button>

                                    <button
                                        type="button"
                                        class="small-btn btn-danger"
                                        data-delete-maintenance="${record.id}"
                                    >
                                        Delete
                                    </button>

                                </div>

                            </td>

                        </tr>

                    `;

                }
            ).join("");

    }


    /* =====================================================
       SUMMARY
       ===================================================== */

    function updateSummary() {

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


        const total =
            state.maintenance.length;


        const pending =
            state.maintenance.filter(
                record =>
                    String(
                        record.status || ""
                    )
                    .trim()
                    .toLowerCase() ===
                    "pending"
            ).length;


        const progress =
            state.maintenance.filter(
                record =>
                    String(
                        record.status || ""
                    )
                    .trim()
                    .toLowerCase() ===
                    "in progress"
            ).length;


        const completed =
            state.maintenance.filter(
                record =>
                    String(
                        record.status || ""
                    )
                    .trim()
                    .toLowerCase() ===
                    "completed"
            ).length;


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
       POPULATE ROOMS
       ===================================================== */

    function populateRooms() {

        const select =
            document.getElementById(
                "maintenanceRoom"
            );


        if (!select) {

            return;

        }


        const currentValue =
            select.value;


        select.innerHTML = `

            <option value="">
                Select Room
            </option>

        `;


        state.rooms.forEach(
            room => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    room.id;


                option.textContent =
                    room.room_number;


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
       POPULATE TECHNICIANS
       ===================================================== */

    function populateTechnicians() {

        const select =
            document.getElementById(
                "maintenanceTechnician"
            );


        if (!select) {

            return;

        }


        const currentValue =
            select.value;


        select.innerHTML = `

            <option value="">
                Select Technician
            </option>

        `;


        state.employees.forEach(
            employee => {

                const name =
                    getEmployeeName(
                        employee
                    );


                if (!name) {

                    return;

                }


                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    employee.id;


                option.textContent =
                    name;


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
       OPEN ADD / EDIT MODAL
       ===================================================== */

    function openMaintenanceModal(
        record = null
    ) {

        const modal =
            document.getElementById(
                "maintenanceModal"
            );


        if (!modal) {

            return;

        }


        state.editingId =
            record
                ? record.id
                : null;


        const title =
            document.getElementById(
                "maintenanceModalTitle"
            );


        if (title) {

            title.textContent =
                record
                    ? "Edit Maintenance Task"
                    : "Add Maintenance Task";

        }


        const idInput =
            document.getElementById(
                "maintenanceId"
            );


        if (idInput) {

            idInput.value =
                record?.id || "";

        }


        const room =
            document.getElementById(
                "maintenanceRoom"
            );


        if (room) {

            room.value =
                record?.room_id || "";

        }


        const technician =
            document.getElementById(
                "maintenanceTechnician"
            );


        if (technician) {

            technician.value =
                record?.employee_id || "";

        }


        const issue =
            document.getElementById(
                "maintenanceIssue"
            );


        if (issue) {

            issue.value =
                record?.issue || "";

        }


        const status =
            document.getElementById(
                "maintenanceStatus"
            );


        if (status) {

            status.value =
                record?.status ||
                "Pending";

        }


        const cost =
            document.getElementById(
                "maintenanceCost"
            );


        if (cost) {

            cost.value =
                record?.cost ?? 0;

        }


        const notes =
            document.getElementById(
                "maintenanceNotes"
            );


        if (notes) {

            notes.value =
                record?.notes || "";

        }


        modal.style.display =
            "flex";

    }


    /* =====================================================
       CLOSE ADD / EDIT MODAL
       ===================================================== */

    function closeMaintenanceModal() {

        const modal =
            document.getElementById(
                "maintenanceModal"
            );


        if (modal) {

            modal.style.display =
                "none";

        }


        state.editingId =
            null;


        const form =
            document.getElementById(
                "maintenanceForm"
            );


        if (form) {

            form.reset();

        }


        const idInput =
            document.getElementById(
                "maintenanceId"
            );


        if (idInput) {

            idInput.value =
                "";

        }

    }


    /* =====================================================
       VIEW MODAL
       ===================================================== */

    function viewMaintenance(id) {

        const record =
            state.maintenance.find(
                item =>
                    Number(item.id) ===
                    Number(id)
            );


        if (!record) {

            return;

        }


        const room =
            getRoomNumber(
                record
            );


        const technician =
            getTechnicianName(
                record
            );


        const date =
            record.created_at
                ? new Date(
                    record.created_at
                ).toLocaleString(
                    "en-KE"
                )
                : "-";


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
                    #${escapeHtml(
                        record.id
                    )}
                </div>

            </div>


            <div class="view-item">

                <div class="view-label">
                    Room
                </div>

                <div class="view-value">
                    ${escapeHtml(
                        room
                    )}
                </div>

            </div>


            <div class="view-item">

                <div class="view-label">
                    Technician
                </div>

                <div class="view-value">
                    ${escapeHtml(
                        technician
                    )}
                </div>

            </div>


            <div class="view-item">

                <div class="view-label">
                    Status
                </div>

                <div class="view-value">

                    <span
                        class="${getStatusClass(
                            record.status
                        )}"
                    >
                        ${escapeHtml(
                            record.status ||
                            "Pending"
                        )}
                    </span>

                </div>

            </div>


            <div class="view-item">

                <div class="view-label">
                    Cost
                </div>

                <div class="view-value">
                    KSh ${money(
                        record.cost
                    )}
                </div>

            </div>


            <div class="view-item">

                <div class="view-label">
                    Date
                </div>

                <div class="view-value">
                    ${escapeHtml(
                        date
                    )}
                </div>

            </div>


            <div class="view-item full">

                <div class="view-label">
                    Issue
                </div>

                <div class="view-value">
                    ${escapeHtml(
                        record.issue ||
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
                        record.notes ||
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

            modal.style.display =
                "flex";

        }

    }


    function closeViewMaintenanceModal() {

        const modal =
            document.getElementById(
                "viewMaintenanceModal"
            );


        if (modal) {

            modal.style.display =
                "none";

        }

    }


    /* =====================================================
       SAVE MAINTENANCE
       ===================================================== */

    async function saveMaintenance(
        event
    ) {

        event.preventDefault();


        const supabase =
            getSupabase();


        if (!supabase) {

            showToast(
                "Supabase connection is not available.",
                "error"
            );

            return;

        }


        if (!state.hotelId) {

            showToast(
                "No active hotel was found.",
                "error"
            );

            return;

        }


        const roomId =
            document.getElementById(
                "maintenanceRoom"
            )?.value || null;


        const technicianId =
            document.getElementById(
                "maintenanceTechnician"
            )?.value || null;


        const selectedRoom =
            getRoomById(
                roomId
            );


        const selectedEmployee =
            getEmployeeById(
                technicianId
            );


        const issue =
            String(
                document.getElementById(
                    "maintenanceIssue"
                )?.value || ""
            )
            .trim();


        const status =
            document.getElementById(
                "maintenanceStatus"
            )?.value ||
            "Pending";


        const costValue =
            document.getElementById(
                "maintenanceCost"
            )?.value || "0";


        const cost =
            Number(
                costValue
            );


        const notes =
            String(
                document.getElementById(
                    "maintenanceNotes"
                )?.value || ""
            )
            .trim() ||
            null;


        if (!issue) {

            showToast(
                "Please enter the maintenance issue.",
                "warning"
            );

            return;

        }


        if (
            !Number.isFinite(cost) ||
            cost < 0
        ) {

            showToast(
                "Please enter a valid maintenance cost.",
                "warning"
            );

            return;

        }


        const assignedTo =
            getEmployeeName(
                selectedEmployee
            ) || null;


        const payload = {

            room_number:
                selectedRoom?.room_number ||
                "",

            issue:
                issue,

            status:
                status,

            assigned_to:
                assignedTo,

            cost:
                cost,

            notes:
                notes,

            room_id:
                roomId
                    ? Number(roomId)
                    : null,

            employee_id:
                technicianId
                    ? Number(technicianId)
                    : null,

            hotel_id:
                state.hotelId

        };


        try {

            /* =================================================
               UPDATE
               ================================================= */

            if (state.editingId) {

                const {
                    error
                } =
                    await supabase
                        .from("maintenance")
                        .update(
                            payload
                        )
                        .eq(
                            "id",
                            state.editingId
                        )
                        .eq(
                            "hotel_id",
                            state.hotelId
                        );


                if (error) {

                    throw error;

                }


                closeMaintenanceModal();

                await loadMaintenance();

                showToast(
                    "Maintenance task updated successfully.",
                    "success"
                );

                return;

            }


            /* =================================================
               INSERT
               ================================================= */

            const {
                error
            } =
                await supabase
                    .from("maintenance")
                    .insert(
                        payload
                    );


            if (error) {

                throw error;

            }


            closeMaintenanceModal();

            await loadMaintenance();

            showToast(
                "Maintenance task saved successfully.",
                "success"
            );


        } catch (error) {

            console.error(
                "Maintenance save error:",
                error
            );


            showToast(
                `Unable to save maintenance task: ${error.message}`,
                "error"
            );

        }

    }


    /* =====================================================
       DELETE
       ===================================================== */

    async function deleteMaintenance(
        id
    ) {

        const supabase =
            getSupabase();


        if (!supabase) {

            showToast(
                "Supabase connection is not available.",
                "error"
            );

            return;

        }


        const record =
            state.maintenance.find(
                item =>
                    Number(item.id) ===
                    Number(id)
            );


        if (!record) {

            return;

        }


        const confirmed =
            window.confirm(
                `Delete maintenance task #${id}?\n\nThis action cannot be undone.`
            );


        if (!confirmed) {

            return;

        }


        try {

            const {
                error
            } =
                await supabase
                    .from("maintenance")
                    .delete()
                    .eq(
                        "id",
                        id
                    )
                    .eq(
                        "hotel_id",
                        state.hotelId
                    );


            if (error) {

                throw error;

            }


            await loadMaintenance();


            showToast(
                "Maintenance task deleted successfully.",
                "success"
            );


        } catch (error) {

            console.error(
                "Maintenance deletion error:",
                error
            );


            showToast(
                `Unable to delete maintenance task: ${error.message}`,
                "error"
            );

        }

    }


    /* =====================================================
       PRINT
       ===================================================== */

    function printMaintenance() {

        window.print();

    }


    /* =====================================================
       PDF
       ===================================================== */

    function downloadMaintenancePDF() {

        if (
            !window.jspdf ||
            !window.jspdf.jsPDF
        ) {

            showToast(
                "PDF library is not available.",
                "error"
            );

            return;

        }


        const jsPDF =
            window.jspdf.jsPDF;


        const doc =
            new jsPDF({
                orientation: "landscape",
                unit: "mm",
                format: "a4"
            });


        const hotelName =
            state.hotel?.hotel_name ||
            state.hotel?.name ||
            document.getElementById(
                "maintenanceHotelName"
            )?.textContent ||
            "Hotel";


        const hotelLocation =
            state.hotel?.location ||
            document.getElementById(
                "maintenanceHotelLocation"
            )?.textContent ||
            "";


        doc.setFontSize(18);

        doc.text(
            hotelName,
            14,
            15
        );


        doc.setFontSize(11);

        doc.text(
            "Maintenance Report",
            14,
            22
        );


        doc.setFontSize(9);

        doc.text(
            hotelLocation,
            14,
            28
        );


        doc.text(
            `Generated: ${new Date().toLocaleString("en-KE")}`,
            14,
            34
        );


        const search =
            String(
                document.getElementById(
                    "maintenanceSearch"
                )?.value || ""
            )
            .trim()
            .toLowerCase();


        const statusFilter =
            String(
                document.getElementById(
                    "maintenanceStatusFilter"
                )?.value || ""
            )
            .trim()
            .toLowerCase();


        const records =
            state.maintenance.filter(
                record => {

                    const room =
                        getRoomNumber(
                            record
                        );


                    const technician =
                        getTechnicianName(
                            record
                        );


                    const searchable = [

                        record.id,

                        room,

                        record.issue,

                        technician,

                        record.status,

                        record.notes

                    ]
                    .filter(
                        value =>
                            value !== null &&
                            value !== undefined
                    )
                    .join(" ")
                    .toLowerCase();


                    const matchesSearch =
                        !search ||
                        searchable.includes(
                            search
                        );


                    const matchesStatus =
                        !statusFilter ||
                        String(
                            record.status || ""
                        )
                        .trim()
                        .toLowerCase() ===
                        statusFilter;


                    return (
                        matchesSearch &&
                        matchesStatus
                    );

                }
            );


        let y =
            43;


        doc.setFontSize(8);

        doc.setFont(undefined, "bold");


        doc.text(
            "ID",
            14,
            y
        );


        doc.text(
            "Room",
            27,
            y
        );


        doc.text(
            "Issue",
            48,
            y
        );


        doc.text(
            "Technician",
            105,
            y
        );


        doc.text(
            "Date",
            150,
            y
        );


        doc.text(
            "Cost",
            178,
            y
        );


        doc.text(
            "Status",
            207,
            y
        );


        y += 5;


        doc.setFont(undefined, "normal");


        records.forEach(
            record => {

                if (y > 190) {

                    doc.addPage();

                    y = 15;

                }


                const room =
                    getRoomNumber(
                        record
                    );


                const technician =
                    getTechnicianName(
                        record
                    );


                const date =
                    record.created_at
                        ? new Date(
                            record.created_at
                        ).toLocaleDateString(
                            "en-KE"
                        )
                        : "-";


                const issue =
                    String(
                        record.issue ||
                        "-"
                    );


                doc.text(
                    `#${record.id}`,
                    14,
                    y
                );


                doc.text(
                    String(room),
                    27,
                    y
                );


                doc.text(
                    doc.splitTextToSize(
                        issue,
                        52
                    )[0],
                    48,
                    y
                );


                doc.text(
                    doc.splitTextToSize(
                        String(technician),
                        40
                    )[0],
                    105,
                    y
                );


                doc.text(
                    date,
                    150,
                    y
                );


                doc.text(
                    `KSh ${money(record.cost)}`,
                    178,
                    y
                );


                doc.text(
                    String(
                        record.status ||
                        "Pending"
                    ),
                    207,
                    y
                );


                y += 7;

            }
        );


        if (!records.length) {

            doc.text(
                "No maintenance records found.",
                14,
                y + 5
            );

        }


        doc.setFontSize(8);

        doc.text(
            `Total Tasks: ${records.length}`,
            14,
            200
        );


        const totalCost =
            records.reduce(
                (
                    total,
                    record
                ) =>
                    total +
                    Number(
                        record.cost || 0
                    ),
                0
            );


        doc.text(
            `Total Maintenance Cost: KSh ${money(totalCost)}`,
            75,
            200
        );


        doc.save(
            "maintenance-report.pdf"
        );


        showToast(
            "Maintenance PDF created successfully.",
            "success"
        );

    }


    /* =====================================================
       EVENT HANDLERS
       ===================================================== */

    function setupEvents() {

        /* ADD */

        document.getElementById(
            "addMaintenanceButton"
        )?.addEventListener(
            "click",
            function () {

                openMaintenanceModal();

            }
        );


        /* FORM */

        document.getElementById(
            "maintenanceForm"
        )?.addEventListener(
            "submit",
            saveMaintenance
        );


        /* CLOSE ADD / EDIT */

        document.getElementById(
            "closeMaintenanceModal"
        )?.addEventListener(
            "click",
            closeMaintenanceModal
        );


        document.getElementById(
            "cancelMaintenanceButton"
        )?.addEventListener(
            "click",
            closeMaintenanceModal
        );


        /* SEARCH */

        document.getElementById(
            "maintenanceSearch"
        )?.addEventListener(
            "input",
            renderMaintenance
        );


        /* FILTER */

        document.getElementById(
            "maintenanceStatusFilter"
        )?.addEventListener(
            "change",
            renderMaintenance
        );


        /* REFRESH */

        document.getElementById(
            "refreshMaintenanceButton"
        )?.addEventListener(
            "click",
            async function () {

                await loadRooms();

                await loadEmployees();

                await loadMaintenance();

                showToast(
                    "Maintenance records refreshed.",
                    "success"
                );

            }
        );


        /* PRINT */

        document.getElementById(
            "printMaintenanceButton"
        )?.addEventListener(
            "click",
            printMaintenance
        );


        /* PDF */

        document.getElementById(
            "downloadMaintenancePDFButton"
        )?.addEventListener(
            "click",
            downloadMaintenancePDF
        );


        /* TABLE ACTIONS */

        document.addEventListener(
            "click",
            function (event) {

                const editButton =
                    event.target.closest(
                        "[data-edit-maintenance]"
                    );


                if (editButton) {

                    const id =
                        Number(
                            editButton.dataset
                                .editMaintenance
                        );


                    const record =
                        state.maintenance.find(
                            item =>
                                Number(
                                    item.id
                                ) === id
                        );


                    if (record) {

                        openMaintenanceModal(
                            record
                        );

                    }

                    return;

                }


                const viewButton =
                    event.target.closest(
                        "[data-view-maintenance]"
                    );


                if (viewButton) {

                    const id =
                        Number(
                            viewButton.dataset
                                .viewMaintenance
                        );


                    viewMaintenance(
                        id
                    );

                    return;

                }


                const deleteButton =
                    event.target.closest(
                        "[data-delete-maintenance]"
                    );


                if (deleteButton) {

                    const id =
                        Number(
                            deleteButton.dataset
                                .deleteMaintenance
                        );


                    deleteMaintenance(
                        id
                    );

                }

            }
        );


        /* CLOSE VIEW */

        document.getElementById(
            "closeViewMaintenanceModal"
        )?.addEventListener(
            "click",
            closeViewMaintenanceModal
        );


        document.getElementById(
            "closeViewMaintenanceButton"
        )?.addEventListener(
            "click",
            closeViewMaintenanceModal
        );


        /* CLOSE MODALS WHEN CLICKING OUTSIDE */

        document.getElementById(
            "maintenanceModal"
        )?.addEventListener(
            "click",
            function (event) {

                if (
                    event.target.id ===
                    "maintenanceModal"
                ) {

                    closeMaintenanceModal();

                }

            }
        );


        document.getElementById(
            "viewMaintenanceModal"
        )?.addEventListener(
            "click",
            function (event) {

                if (
                    event.target.id ===
                    "viewMaintenanceModal"
                ) {

                    closeViewMaintenanceModal();

                }

            }
        );

    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    window.EDUTECH_MAINTENANCE = {

        reload:
            async function () {

                await loadHotel();

                await loadRooms();

                await loadEmployees();

                await loadMaintenance();

            },


        open:
            openMaintenanceModal,


        getState:
            function () {

                return {

                    hotelId:
                        state.hotelId,

                    maintenance:
                        [
                            ...state.maintenance
                        ]

                };

            }

    };


    /* =====================================================
       INITIALIZE
       ===================================================== */

    async function initialize() {

        setupEvents();


        state.hotelId =
            getHotelId();


        if (!state.hotelId) {

            const moduleContent =
                document.getElementById(
                    "maintenanceModuleContent"
                );


            const accessDenied =
                document.getElementById(
                    "accessDenied"
                );


            if (moduleContent) {

                moduleContent.style.display =
                    "none";

            }


            if (accessDenied) {

                accessDenied.style.display =
                    "block";

            }


            return;

        }


        await loadHotel();

        await loadRooms();

        await loadEmployees();

        await loadMaintenance();

    }


    /* =====================================================
       START
       ===================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialize
        );

    } else {

        initialize();

    }

})();