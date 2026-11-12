
"use strict";

/* =========================================================
   EDU TECH HOTEL MANAGEMENT SYSTEM
   RESERVATIONS MODULE
========================================================= */

const RESERVATION_GUEST_COLUMN = "guest   id";
const RESERVATION_ROOM_COLUMN = "room id";

let reservationsData = [];
let guestsData = [];
let roomsData = [];
let hotelsData = [];
let editingReservationId = null;
let reservationsInitializing = false;
let currentInvoiceReservationId = null;
let currentConfirmationReservationId = null;


/* =========================================================
   DATABASE AND SESSION
========================================================= */

function getDatabase() {
    return window.supabaseClient;
}

function getUserRole() {
    return String(
        sessionStorage.getItem("userRole") ||
        localStorage.getItem("userRole") ||
        ""
    ).toLowerCase().trim();
}

function getSelectedHotelId() {
    const role = getUserRole();

    if (role === "system_owner") {
        return (
            sessionStorage.getItem("activeHotelId") ||
            sessionStorage.getItem("hotelId") ||
            document.getElementById("hotelSelector")?.value ||
            null
        );
    }

    return (
        sessionStorage.getItem("hotelId") ||
        sessionStorage.getItem("activeHotelId") ||
        localStorage.getItem("hotelId") ||
        null
    );
}

function getSelectedHotelName() {
    return (
        sessionStorage.getItem("activeHotelName") ||
        sessionStorage.getItem("hotelName") ||
        localStorage.getItem("hotelName") ||
        ""
    );
}

function syncSelectedHotel() {
    const hotelId = getSelectedHotelId();
    const hotelName = getSelectedHotelName();

    if (hotelId) {
        sessionStorage.setItem("hotelId", String(hotelId));
        sessionStorage.setItem("activeHotelId", String(hotelId));
    }

    if (hotelName) {
        sessionStorage.setItem("hotelName", hotelName);
        sessionStorage.setItem("activeHotelName", hotelName);
    }

    return hotelId;
}


/* =========================================================
   PERMISSIONS
========================================================= */

function canAddReservation() {
    return [
        "system_owner",
        "hotel_owner",
        "manager",
        "receptionist"
    ].includes(getUserRole());
}

function canEditReservation() {
    return [
        "system_owner",
        "hotel_owner",
        "manager"
    ].includes(getUserRole());
}

function canDeleteReservation() {
    return getUserRole() === "system_owner";
}


/* =========================================================
   GENERAL HELPERS
========================================================= */

function getErrorText(error) {
    if (!error) return "An unknown error occurred.";

    return [
        error.message,
        error.details,
        error.hint,
        error.code ? "Code: " + error.code : ""
    ].filter(Boolean).join("\n");
}

function showMessage(message, type = "info") {
    const box = document.getElementById("message");

    if (!box) {
        console.log(message);
        return;
    }

    box.textContent = message;
    box.className = "message " + type;

    clearTimeout(showMessage.timer);

    if (type !== "error") {
        showMessage.timer = setTimeout(() => {
            box.textContent = "";
            box.className = "message";
        }, 6000);
    }
}

function formatMoney(value) {
    return "KSh " + Number(value || 0).toLocaleString("en-KE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function getLocalDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatDate(value) {
    if (!value) return "-";

    const date = new Date(String(value).slice(0, 10) + "T00:00:00");

    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleDateString("en-KE", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

function calculateNights(checkIn, checkOut) {
    if (!checkIn || !checkOut) return 0;

    const start = new Date(String(checkIn).slice(0, 10) + "T00:00:00");
    const end = new Date(String(checkOut).slice(0, 10) + "T00:00:00");

    return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function normalizeStatus(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");
}

function updateHotelDescription() {
    const description = document.getElementById("pageDescription");
    const hotelName = getSelectedHotelName();

    if (description && hotelName) {
        description.textContent = "Manage reservations for " + hotelName + ".";
    }
}


/* =========================================================
   LOAD HOTELS
========================================================= */

async function loadHotels() {
    if (getUserRole() !== "system_owner") return;

    const db = getDatabase();
    if (!db) throw new Error("Supabase client is unavailable.");

    const selector = document.getElementById("hotelSelector");
    if (!selector) return;

    const previousSelection =
        sessionStorage.getItem("activeHotelId") ||
        sessionStorage.getItem("selectedHotelId") ||
        "";

    const { data, error } = await db
        .from("hotels")
        .select("id, hotel_name, location, status")
        .order("hotel_name", { ascending: true });

    if (error) {
        throw new Error("Failed to load hotels: " + getErrorText(error));
    }

    hotelsData = data || [];

    selector.innerHTML = '<option value="">Select Hotel</option>';

    hotelsData.forEach(hotel => {
        const option = document.createElement("option");
        option.value = String(hotel.id);
        option.textContent = hotel.hotel_name || ("Hotel " + hotel.id);
        selector.appendChild(option);
    });

    const savedHotel = hotelsData.find(
        hotel => String(hotel.id) === String(previousSelection)
    );

    if (savedHotel) {
        selector.value = String(savedHotel.id);
        sessionStorage.setItem("activeHotelId", String(savedHotel.id));
        sessionStorage.setItem("hotelId", String(savedHotel.id));
        sessionStorage.setItem("activeHotelName", savedHotel.hotel_name || "");
        sessionStorage.setItem("hotelName", savedHotel.hotel_name || "");
        sessionStorage.setItem("selectedHotelId", String(savedHotel.id));
    } else {
        selector.value = "";
        sessionStorage.removeItem("activeHotelId");
        sessionStorage.removeItem("activeHotelName");
        sessionStorage.removeItem("hotelId");
        sessionStorage.removeItem("hotelName");
    }

    const container = document.getElementById("hotelSelectorContainer");
    if (container) container.style.display = "block";

    updateHotelDescription();
}


/* =========================================================
   LOAD GUESTS
========================================================= */

async function loadGuests() {
    const db = getDatabase();
    const hotelId = getSelectedHotelId();

    guestsData = [];

    if (!hotelId) {
        populateGuestDropdown();
        return;
    }

    const { data, error } = await db
        .from("guests")
        .select('id, "full name", phone, email, hotel_id')
        .eq("hotel_id", hotelId)
        .order("id", { ascending: true });

    if (error) {
        throw new Error("Failed to load guests: " + getErrorText(error));
    }

    guestsData = data || [];
    populateGuestDropdown();
}

function getGuestById(id) {
    return guestsData.find(guest => String(guest.id) === String(id));
}

function populateGuestDropdown(selectedId = "") {
    const select = document.getElementById("guestId");
    if (!select) return;

    select.innerHTML = '<option value="">Select Guest</option>';

    guestsData.forEach(guest => {
        const option = document.createElement("option");
        option.value = String(guest.id);
        option.textContent =
            (guest["full name"] || "Unnamed Guest") +
            (guest.phone ? " - " + guest.phone : "");
        select.appendChild(option);
    });

    if (selectedId !== "") {
        select.value = String(selectedId);
    }
}


/* =========================================================
   LOAD ROOMS
========================================================= */

async function loadRooms() {
    const db = getDatabase();
    const hotelId = getSelectedHotelId();

    roomsData = [];

    if (!hotelId) {
        populateRoomDropdown();
        return;
    }

    const { data, error } = await db
        .from("rooms")
        .select("id, room_number, room_type, price, status, hotel_id")
        .eq("hotel_id", hotelId)
        .order("room_number", { ascending: true });

    if (error) {
        throw new Error("Failed to load rooms: " + getErrorText(error));
    }

    roomsData = data || [];
    populateRoomDropdown();
}

function getRoomById(id) {
    return roomsData.find(room => String(room.id) === String(id));
}

function populateRoomDropdown(selectedId = "") {
    const select = document.getElementById("roomId");
    if (!select) return;

    select.innerHTML = '<option value="">Select Room</option>';

    roomsData.forEach(room => {
        const status = normalizeStatus(room.status);
        const isSelectedRoom = String(room.id) === String(selectedId);

        if (!isSelectedRoom && status && status !== "available") {
            return;
        }

        const option = document.createElement("option");
        option.value = String(room.id);
        option.textContent =
            "Room " + room.room_number +
            " - " + (room.room_type || "Room") +
            " - " + formatMoney(room.price) +
            " per night";

        select.appendChild(option);
    });

    if (selectedId !== "") {
        select.value = String(selectedId);
    }
}


/* =========================================================
   VERIFY ROOM
========================================================= */

async function getValidRoomFromDatabase(roomId, hotelId) {
    const db = getDatabase();

    if (!roomId) throw new Error("No room was selected.");

    const { data, error } = await db
        .from("rooms")
        .select("id, room_number, room_type, price, status, hotel_id")
        .eq("id", roomId)
        .eq("hotel_id", hotelId)
        .maybeSingle();

    if (error) {
        throw new Error("Could not verify selected room: " + getErrorText(error));
    }

    if (!data) {
        throw new Error("The selected room does not belong to this hotel.");
    }

    return data;
}


/* =========================================================
   LOAD RESERVATIONS
========================================================= */

async function loadReservations() {
    const db = getDatabase();
    const hotelId = getSelectedHotelId();

    reservationsData = [];

    if (!hotelId) {
        renderReservations();
        updateSummary();
        return;
    }

    const columns = [
        "id",
        "created_at",
        `"${RESERVATION_GUEST_COLUMN}"`,
        `"${RESERVATION_ROOM_COLUMN}"`,
        "check_in",
        "check_out",
        "status",
        "amount",
        "hotel_id"
    ].join(", ");

    const { data, error } = await db
        .from("reservations")
        .select(columns)
        .eq("hotel_id", hotelId)
        .order("check_in", { ascending: false });

    if (error) {
        throw new Error("Failed to load reservations: " + getErrorText(error));
    }

    reservationsData = data || [];

    renderReservations();
    updateSummary();
    updateHotelDescription();
}


/* =========================================================
   RENDER TABLE
========================================================= */

function getStatusClass(status) {
    return "status-" + normalizeStatus(status || "pending");
}

function renderReservations() {
    const tbody = document.getElementById("reservationsTableBody");
    if (!tbody) return;

    const search = (
        document.getElementById("searchInput")?.value || ""
    ).toLowerCase().trim();

    const filtered = reservationsData.filter(reservation => {
        const guest = getGuestById(reservation[RESERVATION_GUEST_COLUMN]);
        const room = getRoomById(reservation[RESERVATION_ROOM_COLUMN]);

        const values = [
            reservation.id,
            guest?.["full name"] || "",
            guest?.phone || "",
            room?.room_number || "",
            reservation.status || ""
        ];

        return values.join(" ").toLowerCase().includes(search);
    });

    if (!filtered.length) {
        tbody.innerHTML =
            '<tr><td colspan="10" class="empty-state">No reservations found.</td></tr>';
        return;
    }

    tbody.innerHTML = "";

    filtered.forEach(reservation => {
        const guest = getGuestById(reservation[RESERVATION_GUEST_COLUMN]);
        const room = getRoomById(reservation[RESERVATION_ROOM_COLUMN]);
        const nights = calculateNights(reservation.check_in, reservation.check_out);

        const row = document.createElement("tr");

        const editButton = canEditReservation()
            ? `<button type="button" class="btn btn-warning" data-action="edit" data-id="${escapeHtml(reservation.id)}">Edit</button>`
            : "";

        const deleteButton = canDeleteReservation()
            ? `<button type="button" class="btn btn-danger" data-action="delete" data-id="${escapeHtml(reservation.id)}">Delete</button>`
            : "";

        row.innerHTML = `
            <td>#${escapeHtml(reservation.id)}</td>
            <td>${escapeHtml(guest?.["full name"] || "Guest not found")}</td>
            <td>${escapeHtml(guest?.phone || "-")}</td>
            <td>${room ? "Room " + escapeHtml(room.room_number) : "Room not found"}</td>
            <td>${formatDate(reservation.check_in)}</td>
            <td>${formatDate(reservation.check_out)}</td>
            <td>${nights > 0 ? nights : "-"}</td>
            <td>${formatMoney(reservation.amount)}</td>
            <td>
                <span class="status-badge ${getStatusClass(reservation.status)}">
                    ${escapeHtml(String(reservation.status || "pending").replace(/_/g, " "))}
                </span>
            </td>
            <td>
                <div class="actions">
                    ${editButton}
                    ${deleteButton}
                    <button type="button" class="btn btn-invoice"
                        data-action="invoice" data-id="${escapeHtml(reservation.id)}">
                        Invoice
                    </button>
                    <button type="button" class="btn btn-confirmation"
                        data-action="confirmation" data-id="${escapeHtml(reservation.id)}">
                        Confirmation
                    </button>
                </div>
            </td>
        `;

        tbody.appendChild(row);
    });
}


/* =========================================================
   SUMMARY
========================================================= */

function updateSummary() {
    const total = reservationsData.length;

    // A guest who has checked in has a confirmed reservation.
    const confirmed = reservationsData.filter(item => {
        const status = normalizeStatus(item.status);
        return status === "confirmed" || status === "checked_in";
    }).length;

    const pending = reservationsData.filter(
        item => normalizeStatus(item.status) === "pending"
    ).length;

    const totalValue = reservationsData.reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
    );

    const totalElement = document.getElementById("totalReservations");
    const confirmedElement = document.getElementById("confirmedReservations");
    const pendingElement = document.getElementById("pendingReservations");
    const valueElement = document.getElementById("totalValue");

    if (totalElement) totalElement.textContent = total;
    if (confirmedElement) confirmedElement.textContent = confirmed;
    if (pendingElement) pendingElement.textContent = pending;
    if (valueElement) valueElement.textContent = formatMoney(totalValue);
}


/* =========================================================
   AMOUNT CALCULATION
========================================================= */

function updateAmountDisplay() {
    const roomId = document.getElementById("roomId")?.value;
    const checkIn = document.getElementById("checkIn")?.value;
    const checkOut = document.getElementById("checkOut")?.value;

    const display = document.getElementById("amountDisplay");
    const details = document.getElementById("amountDetails");

    const room = getRoomById(roomId);
    const nights = calculateNights(checkIn, checkOut);

    if (!room || nights <= 0) {
        if (display) display.textContent = formatMoney(0);
        if (details) {
            details.textContent =
                "Select a room and valid dates. Check-out must be after check-in.";
        }
        return 0;
    }

    const amount = Number(room.price || 0) * nights;

    if (display) display.textContent = formatMoney(amount);
    if (details) {
        details.textContent =
            formatMoney(room.price) + " × " + nights + " night(s)";
    }

    return amount;
}


/* =========================================================
   CHECK RESERVATION CONFLICT
========================================================= */

async function checkReservationConflict(
    roomId,
    checkIn,
    checkOut,
    excludeId = null
) {
    const db = getDatabase();
    const hotelId = getSelectedHotelId();

    if (!hotelId) throw new Error("No active hotel is selected.");

    let query = db
        .from("reservations")
        .select(`id, "${RESERVATION_ROOM_COLUMN}", check_in, check_out, status`)
        .eq("hotel_id", hotelId)
        .eq(RESERVATION_ROOM_COLUMN, roomId);

    if (excludeId !== null) {
        query = query.neq("id", excludeId);
    }

    const { data, error } = await query;

    if (error) {
        throw new Error("Could not check room availability: " + getErrorText(error));
    }

    const requestedStart = new Date(checkIn + "T00:00:00");
    const requestedEnd = new Date(checkOut + "T00:00:00");

    return (data || []).some(existing => {
        const status = normalizeStatus(existing.status);

        if (status === "cancelled" || status === "canceled") {
            return false;
        }

        const existingStart = new Date(
            String(existing.check_in).slice(0, 10) + "T00:00:00"
        );

        const existingEnd = new Date(
            String(existing.check_out).slice(0, 10) + "T00:00:00"
        );

        return requestedStart < existingEnd && requestedEnd > existingStart;
    });
}


/* =========================================================
   OPEN ADD MODAL
========================================================= */

function openAddModal() {
    if (!canAddReservation()) {
        showMessage("You do not have permission to add reservations.", "error");
        return;
    }

    if (!getSelectedHotelId()) {
        showMessage("Please select a hotel before adding a reservation.", "error");
        return;
    }

    editingReservationId = null;

    document.getElementById("reservationForm").reset();
    document.getElementById("reservationId").value = "";
    document.getElementById("modalTitle").textContent = "Add Reservation";
    document.getElementById("status").value = "pending";

    populateGuestDropdown();
    populateRoomDropdown();

    document.getElementById("reservationModal").classList.add("show");
    updateAmountDisplay();
}


/* =========================================================
   EDIT RESERVATION
========================================================= */

function editReservation(id) {
    if (!canEditReservation()) {
        showMessage("You do not have permission to edit reservations.", "error");
        return;
    }

    const reservation = reservationsData.find(
        item => String(item.id) === String(id)
    );

    if (!reservation) {
        showMessage("Reservation not found.", "error");
        return;
    }

    editingReservationId = reservation.id;

    document.getElementById("modalTitle").textContent = "Edit Reservation";
    document.getElementById("reservationId").value = reservation.id;

    populateGuestDropdown(reservation[RESERVATION_GUEST_COLUMN]);
    populateRoomDropdown(reservation[RESERVATION_ROOM_COLUMN]);

    document.getElementById("checkIn").value = reservation.check_in || "";
    document.getElementById("checkOut").value = reservation.check_out || "";
    document.getElementById("status").value =
        normalizeStatus(reservation.status || "pending");

    document.getElementById("reservationModal").classList.add("show");
    updateAmountDisplay();
}


/* =========================================================
   CLOSE RESERVATION MODAL
========================================================= */

function closeModal() {
    document.getElementById("reservationModal")?.classList.remove("show");
    editingReservationId = null;
}


/* =========================================================
   SAVE RESERVATION
========================================================= */

async function saveReservation(event) {
    event.preventDefault();

    const db = getDatabase();
    const hotelId = getSelectedHotelId();

    if (!canAddReservation() && !canEditReservation()) {
        showMessage("You do not have permission to save reservations.", "error");
        return;
    }

    if (!hotelId) {
        showMessage("Please select a hotel before saving.", "error");
        return;
    }

    const guestId = document.getElementById("guestId").value;
    const roomId = document.getElementById("roomId").value;
    const checkIn = document.getElementById("checkIn").value;
    const checkOut = document.getElementById("checkOut").value;
    const status = normalizeStatus(document.getElementById("status").value);

    if (!guestId || !roomId || !checkIn || !checkOut || !status) {
        showMessage("Please complete all required fields.", "error");
        return;
    }

    const nights = calculateNights(checkIn, checkOut);

    if (nights <= 0) {
        showMessage("Check-out date must be after check-in date.", "error");
        return;
    }

    const guest = getGuestById(guestId);

    if (!guest) {
        showMessage("The selected guest could not be found.", "error");
        return;
    }

    const saveButton = document.getElementById("saveBtn");
    const wasEditing = editingReservationId !== null;

    if (wasEditing && !canEditReservation()) {
        showMessage("You do not have permission to edit reservations.", "error");
        return;
    }

    if (!wasEditing && !canAddReservation()) {
        showMessage("You do not have permission to add reservations.", "error");
        return;
    }

    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = "Saving...";
    }

    try {
        const validRoom = await getValidRoomFromDatabase(roomId, hotelId);

        if (!wasEditing && normalizeStatus(validRoom.status) !== "available") {
            throw new Error("This room is not currently available.");
        }

        const amount = Number(validRoom.price || 0) * nights;

        const conflict = await checkReservationConflict(
            validRoom.id,
            checkIn,
            checkOut,
            editingReservationId
        );

        if (conflict) {
            throw new Error(
                "This room already has a reservation covering one or more of those dates."
            );
        }

        const reservationData = {
            [RESERVATION_GUEST_COLUMN]: guestId,
            [RESERVATION_ROOM_COLUMN]: validRoom.id,
            check_in: checkIn,
            check_out: checkOut,
            status: status,
            amount: amount,
            hotel_id: hotelId
        };

        let result;

        if (wasEditing) {
            result = await db
                .from("reservations")
                .update(reservationData)
                .eq("id", editingReservationId)
                .eq("hotel_id", hotelId);
        } else {
            result = await db
                .from("reservations")
                .insert(reservationData);
        }

        if (result.error) throw result.error;

        closeModal();
        await loadReservations();

        showMessage(
            wasEditing
                ? "Reservation updated successfully."
                : "Reservation saved successfully.",
            "success"
        );

    } catch (error) {
        console.error("Save reservation error:", error);
        showMessage("Failed to save reservation:\n" + getErrorText(error), "error");

    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = "Save Reservation";
        }
    }
}


/* =========================================================
   DELETE RESERVATION
========================================================= */

async function deleteReservation(id) {
    if (!canDeleteReservation()) {
        showMessage("Only the System Owner can delete reservations.", "error");
        return;
    }

    const reservation = reservationsData.find(
        item => String(item.id) === String(id)
    );

    if (!reservation) {
        showMessage("Reservation not found.", "error");
        return;
    }

    const guest = getGuestById(reservation[RESERVATION_GUEST_COLUMN]);
    const guestName = guest?.["full name"] || "this reservation";

    if (!confirm("Delete the reservation for " + guestName + "?")) {
        return;
    }

    try {
        const db = getDatabase();
        const hotelId = getSelectedHotelId();

        if (!hotelId) throw new Error("No active hotel is selected.");

        const { error } = await db
            .from("reservations")
            .delete()
            .eq("id", id)
            .eq("hotel_id", hotelId);

        if (error) throw error;

        await loadReservations();
        showMessage("Reservation deleted successfully.", "success");

    } catch (error) {
        console.error("Delete reservation error:", error);
        showMessage("Failed to delete reservation:\n" + getErrorText(error), "error");
    }
}


/* =========================================================
   LOAD RECORDS FOR DOCUMENTS
========================================================= */

async function getReservationDocumentData(reservationId) {
    const db = getDatabase();
    const hotelId = getSelectedHotelId();

    if (!db) throw new Error("Supabase is not available.");
    if (!hotelId) throw new Error("No active hotel is selected.");

    const { data: reservation, error: reservationError } = await db
        .from("reservations")
        .select("*")
        .eq("id", reservationId)
        .eq("hotel_id", hotelId)
        .maybeSingle();

    if (reservationError) throw reservationError;
    if (!reservation) throw new Error("Reservation was not found in the active hotel.");

    const guestId = reservation[RESERVATION_GUEST_COLUMN];
    const roomId = reservation[RESERVATION_ROOM_COLUMN];

    let guest = null;
    let room = null;

    if (guestId) {
        const result = await db
            .from("guests")
            .select("*")
            .eq("id", guestId)
            .eq("hotel_id", hotelId)
            .maybeSingle();

        if (result.error) throw result.error;
        guest = result.data;
    }

    if (roomId) {
        const result = await db
            .from("rooms")
            .select("*")
            .eq("id", roomId)
            .eq("hotel_id", hotelId)
            .maybeSingle();

        if (result.error) throw result.error;
        room = result.data;
    }

    const { data: hotel, error: hotelError } = await db
        .from("hotels")
        .select("id, hotel_name, location, phone, email")
        .eq("id", hotelId)
        .maybeSingle();

    if (hotelError) throw hotelError;

    return { reservation, guest, room, hotel, hotelId };
}


/* =========================================================
   INVOICE
========================================================= */

async function generateInvoice(reservationId) {
    const modal = document.getElementById("invoiceModal");
    const content = document.getElementById("invoiceContent");

    currentInvoiceReservationId = reservationId;
    modal.classList.add("show");
    content.innerHTML = '<div class="loading">Loading invoice...</div>';

    try {
        const db = getDatabase();

        const { reservation, guest, room, hotel, hotelId } =
            await getReservationDocumentData(reservationId);

        const { data: restaurantOrders, error: restaurantError } = await db
            .from("restaurant_orders")
            .select("id, item_name, quantity, unit_price, total, status, order_date")
            .eq("reservation_id", reservationId)
            .eq("hotel_id", hotelId)
            .order("order_date", { ascending: true });

        if (restaurantError) throw restaurantError;

        const validOrders = (restaurantOrders || []).filter(order => {
            const status = normalizeStatus(order.status);
            return status !== "cancelled" && status !== "canceled";
        });

        const restaurantTotal = validOrders.reduce((sum, order) => {
            const quantity = Number(order.quantity || 0);
            const unitPrice = Number(order.unit_price || 0);
            const total = Number(order.total);

            return sum + (
                Number.isFinite(total) && total > 0
                    ? total
                    : quantity * unitPrice
            );
        }, 0);

        const { data: payments, error: paymentsError } = await db
            .from("payments")
            .select("id, amount, payment_method, payment_date")
            .eq("reservation_id", reservationId)
            .eq("hotel_id", hotelId)
            .order("payment_date", { ascending: true });

        if (paymentsError) throw paymentsError;

        const paidTotal = (payments || []).reduce(
            (sum, payment) => sum + Number(payment.amount || 0),
            0
        );

        const nights = calculateNights(
            reservation.check_in,
            reservation.check_out
        );

        const roomRate = Number(room?.price || 0);
        const reservationAmount = Number(reservation.amount || 0);

        const accommodation = reservationAmount > 0
            ? reservationAmount
            : roomRate * nights;

        const grandTotal = accommodation + restaurantTotal;
        const balance = grandTotal - paidTotal;

        const invoiceNumber =
            "INV-" + new Date().getFullYear() + "-" +
            String(reservationId).padStart(6, "0");

        const restaurantRows = validOrders.map(order => {
            const quantity = Number(order.quantity || 0);
            const unitPrice = Number(order.unit_price || 0);
            const orderTotal = Number(order.total);

            const total = Number.isFinite(orderTotal) && orderTotal > 0
                ? orderTotal
                : quantity * unitPrice;

            return `
                <tr>
                    <td>Restaurant - ${escapeHtml(order.item_name || "-")}</td>
                    <td>${quantity}</td>
                    <td>${formatMoney(unitPrice)}</td>
                    <td>${formatMoney(total)}</td>
                </tr>
            `;
        }).join("");

        const paymentRows = (payments || []).length
            ? payments.map(payment => `
                <tr>
                    <td>${formatDate(payment.payment_date)}</td>
                    <td>${escapeHtml(payment.payment_method || "-")}</td>
                    <td>${formatMoney(payment.amount)}</td>
                </tr>
            `).join("")
            : '<tr><td colspan="3">No payments recorded.</td></tr>';

        content.innerHTML = `
            <div class="invoice-preview">

                <div class="invoice-header">
                    <div>
                        <h2>${escapeHtml(hotel?.hotel_name || "EDU TECH")}</h2>
                        <div>${escapeHtml(hotel?.location || "")}</div>
                        <div>Phone: ${escapeHtml(hotel?.phone || "-")}</div>
                        <div>Email: ${escapeHtml(hotel?.email || "-")}</div>
                    </div>

                    <div class="invoice-title">
                        <h1>INVOICE</h1>
                        <strong>${invoiceNumber}</strong>
                        <div>Date: ${formatDate(getLocalDateString())}</div>
                    </div>
                </div>

                <div class="invoice-info">
                    <div class="invoice-info-box">
                        <strong>BILL TO</strong>
                        <div>${escapeHtml(guest?.["full name"] || guest?.full_name || "-")}</div>
                        <div>Phone: ${escapeHtml(guest?.phone || "-")}</div>
                        <div>Email: ${escapeHtml(guest?.email || "-")}</div>
                    </div>

                    <div class="invoice-info-box">
                        <strong>RESERVATION</strong>
                        <div>Reservation #${escapeHtml(reservation.id)}</div>
                        <div>Room: ${escapeHtml(room?.room_number || "-")}</div>
                        <div>Type: ${escapeHtml(room?.room_type || "-")}</div>
                    </div>
                </div>

                <div class="invoice-info">
                    <div class="invoice-info-box">
                        <strong>STAY DETAILS</strong>
                        <div>Check-in: ${formatDate(reservation.check_in)}</div>
                        <div>Check-out: ${formatDate(reservation.check_out)}</div>
                        <div>Nights: ${nights}</div>
                        <div>Room Rate: ${formatMoney(roomRate)}</div>
                    </div>

                    <div class="invoice-info-box">
                        <strong>RESERVATION STATUS</strong>
                        <div>${escapeHtml(String(reservation.status || "-").replace(/_/g, " "))}</div>
                    </div>
                </div>

                <table class="invoice-table">
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th>Qty</th>
                            <th>Unit Price</th>
                            <th>Total</th>
                        </tr>
                    </thead>

                    <tbody>
                        <tr>
                            <td>Accommodation - Room ${escapeHtml(room?.room_number || "-")} (${escapeHtml(room?.room_type || "-")})</td>
                            <td>${nights}</td>
                            <td>${formatMoney(roomRate)}</td>
                            <td>${formatMoney(accommodation)}</td>
                        </tr>

                        ${restaurantRows}
                    </tbody>
                </table>

                <div class="invoice-total-box">

                    <div class="invoice-total-row">
                        <span>Accommodation</span>
                        <strong>${formatMoney(accommodation)}</strong>
                    </div>

                    <div class="invoice-total-row">
                        <span>Restaurant</span>
                        <strong>${formatMoney(restaurantTotal)}</strong>
                    </div>

                    <div class="invoice-total-row grand-total">
                        <span>TOTAL BILL</span>
                        <strong>${formatMoney(grandTotal)}</strong>
                    </div>

                    <div class="invoice-total-row paid-row">
                        <span>Amount Paid</span>
                        <strong>${formatMoney(paidTotal)}</strong>
                    </div>

                    <div class="invoice-total-row balance">
                        <span>OUTSTANDING BALANCE</span>
                        <strong>${formatMoney(balance)}</strong>
                    </div>

                </div>

                <div style="margin-top:30px;">
                    <h3>Payment History</h3>

                    <table class="invoice-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Method</th>
                                <th>Amount</th>
                            </tr>
                        </thead>
                        <tbody>${paymentRows}</tbody>
                    </table>
                </div>

                <div style="margin-top:30px;padding-top:15px;border-top:1px solid #ddd;text-align:center;color:#64748b;line-height:1.7;">
                    Thank you for staying with us.<br>
                    Generated by EDU TECH Hotel Management System
                </div>

            </div>
        `;

    } catch (error) {
        console.error("Invoice error:", error);

        content.innerHTML = `
            <div class="message error">
                Unable to generate invoice.<br><br>
                ${escapeHtml(getErrorText(error))}
            </div>
        `;
    }
}


/* =========================================================
   BOOKING CONFIRMATION
========================================================= */

async function generateBookingConfirmation(reservationId) {
    const modal = document.getElementById("bookingConfirmationModal");
    const content = document.getElementById("bookingConfirmationContent");

    currentConfirmationReservationId = reservationId;
    modal.classList.add("show");

    content.innerHTML =
        '<div class="loading">Loading booking confirmation...</div>';

    try {
        const { reservation, guest, room, hotel } =
            await getReservationDocumentData(reservationId);

        const nights = calculateNights(
            reservation.check_in,
            reservation.check_out
        );

        const roomRate = Number(room?.price || 0);
        const reservationAmount = Number(reservation.amount || 0);

        const accommodation = reservationAmount > 0
            ? reservationAmount
            : roomRate * nights;

        const confirmationNumber =
            "BOOK-" + new Date().getFullYear() + "-" +
            String(reservationId).padStart(6, "0");

        const guestName =
            guest?.["full name"] ||
            guest?.full_name ||
            "-";

        const status = String(reservation.status || "pending")
            .replace(/_/g, " ");

        content.innerHTML = `
            <div class="confirmation-preview">

                <div class="confirmation-header">
                    <div>
                        <h2>${escapeHtml(hotel?.hotel_name || "EDU TECH")}</h2>
                        <div>${escapeHtml(hotel?.location || "")}</div>
                        <div>Phone: ${escapeHtml(hotel?.phone || "-")}</div>
                        <div>Email: ${escapeHtml(hotel?.email || "-")}</div>
                    </div>

                    <div class="confirmation-title">
                        <h1>BOOKING CONFIRMATION</h1>
                        <strong>${confirmationNumber}</strong>
                        <div>Date: ${formatDate(getLocalDateString())}</div>
                    </div>
                </div>

                <div class="confirmation-grid">
                    <div class="confirmation-box">
                        <strong>GUEST DETAILS</strong>
                        <div>${escapeHtml(guestName)}</div>
                        <div>Phone: ${escapeHtml(guest?.phone || "-")}</div>
                        <div>Email: ${escapeHtml(guest?.email || "-")}</div>
                    </div>

                    <div class="confirmation-box">
                        <strong>RESERVATION</strong>
                        <div>Reservation #${escapeHtml(reservation.id)}</div>
                        <div>Confirmation: ${confirmationNumber}</div>
                        <div style="margin-top:8px;">
                            Status: <span class="confirmation-status">${escapeHtml(status)}</span>
                        </div>
                    </div>
                </div>

                <div class="confirmation-box">
                    <strong>STAY DETAILS</strong>
                    <div>Check-in: ${formatDate(reservation.check_in)}</div>
                    <div>Check-out: ${formatDate(reservation.check_out)}</div>
                    <div>Number of Nights: ${nights}</div>
                    <div>Room: ${escapeHtml(room?.room_number || "-")}</div>
                    <div>Room Type: ${escapeHtml(room?.room_type || "-")}</div>
                    <div>Room Rate: ${formatMoney(roomRate)} per night</div>
                </div>

                <div class="confirmation-box">
                    <strong>RESERVATION AMOUNT</strong>
                    <div class="confirmation-total">
                        Total Reservation Value: ${formatMoney(accommodation)}
                    </div>
                </div>

                <div style="margin-top:30px;padding-top:15px;border-top:1px solid #ddd;text-align:center;color:#64748b;line-height:1.7;">
                    Thank you for choosing ${escapeHtml(hotel?.hotel_name || "our hotel")}.<br>
                    We look forward to welcoming you.<br><br>
                    Generated by EDU TECH Hotel Management System
                </div>

            </div>
        `;

    } catch (error) {
        console.error("Booking confirmation error:", error);

        content.innerHTML = `
            <div class="message error">
                Unable to generate booking confirmation.<br><br>
                ${escapeHtml(getErrorText(error))}
            </div>
        `;
    }
}


/* =========================================================
   CLOSE DOCUMENT MODALS
========================================================= */

function closeInvoice() {
    document.getElementById("invoiceModal")?.classList.remove("show");
}

function closeBookingConfirmation() {
    document.getElementById("bookingConfirmationModal")?.classList.remove("show");
}

function printInvoice() {
    document.body.classList.remove("print-confirmation");
    document.body.classList.add("print-invoice");
    window.print();
}

function printBookingConfirmation() {
    document.body.classList.remove("print-invoice");
    document.body.classList.add("print-confirmation");
    window.print();
}


/* =========================================================
   INITIALIZE PAGE
========================================================= */

async function initializeReservationsPage() {
    if (reservationsInitializing) return;

    reservationsInitializing = true;

    const tbody = document.getElementById("reservationsTableBody");

    if (tbody) {
        tbody.innerHTML =
            '<tr><td colspan="10" class="loading">Loading reservations...</td></tr>';
    }

    try {
        const db = getDatabase();

        if (!db) {
            throw new Error("Supabase client is unavailable. Check supabase.js.");
        }

        if (window.reservationRoleReady) {
            await window.reservationRoleReady;
        }

        if (!getUserRole()) {
            throw new Error(
                "Your user role has not loaded. Refresh the page and try again."
            );
        }

        await loadHotels();

        const hotelId = getSelectedHotelId();

        if (!hotelId) {
            reservationsData = [];
            guestsData = [];
            roomsData = [];

            renderReservations();
            updateSummary();

            showMessage(
                getUserRole() === "system_owner"
                    ? "Please select a hotel using the hotel selector."
                    : "Your account is not linked to a hotel.",
                "info"
            );

            return;
        }

        await loadGuests();
        await loadRooms();
        await loadReservations();

    } catch (error) {
        console.error("Failed to initialize Reservations:", error);

        if (tbody) {
            tbody.innerHTML =
                '<tr><td colspan="10" class="empty-state">Reservations could not be loaded.</td></tr>';
        }

        showMessage(
            "Failed to initialize Reservations:\n" + getErrorText(error),
            "error"
        );

    } finally {
        reservationsInitializing = false;
    }
}


/* =========================================================
   EVENT LISTENERS
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("addReservationBtn")
        ?.addEventListener("click", openAddModal);

    document.getElementById("closeModal")
        ?.addEventListener("click", closeModal);

    document.getElementById("cancelModalBtn")
        ?.addEventListener("click", closeModal);

    document.getElementById("reservationForm")
        ?.addEventListener("submit", saveReservation);

    document.getElementById("searchInput")
        ?.addEventListener("input", renderReservations);

    document.getElementById("refreshBtn")
        ?.addEventListener("click", initializeReservationsPage);

    ["roomId", "checkIn", "checkOut"].forEach(id => {
        document.getElementById(id)
            ?.addEventListener("change", updateAmountDisplay);
    });

    document.getElementById("hotelSelector")
        ?.addEventListener("change", async event => {
            const selectedId = event.target.value;

            if (!selectedId) {
                sessionStorage.removeItem("activeHotelId");
                sessionStorage.removeItem("activeHotelName");
                sessionStorage.removeItem("hotelId");
                sessionStorage.removeItem("hotelName");
                sessionStorage.removeItem("selectedHotelId");

                await initializeReservationsPage();
                return;
            }

            const selectedHotel = hotelsData.find(
                hotel => String(hotel.id) === String(selectedId)
            );

            if (!selectedHotel) {
                showMessage("The selected hotel could not be found.", "error");
                return;
            }

            sessionStorage.setItem("activeHotelId", String(selectedHotel.id));
            sessionStorage.setItem("hotelId", String(selectedHotel.id));
            sessionStorage.setItem("selectedHotelId", String(selectedHotel.id));
            sessionStorage.setItem("activeHotelName", selectedHotel.hotel_name || "");
            sessionStorage.setItem("hotelName", selectedHotel.hotel_name || "");

            await initializeReservationsPage();
        });

    document.getElementById("reservationsTableBody")
        ?.addEventListener("click", event => {
            const button = event.target.closest("button[data-action]");
            if (!button) return;

            const id = button.dataset.id;
            const action = button.dataset.action;

            if (action === "edit") editReservation(id);
            if (action === "delete") deleteReservation(id);
            if (action === "invoice") generateInvoice(id);
            if (action === "confirmation") generateBookingConfirmation(id);
        });

    document.getElementById("reservationModal")
        ?.addEventListener("click", event => {
            if (event.target.id === "reservationModal") closeModal();
        });

    document.getElementById("invoiceModal")
        ?.addEventListener("click", event => {
            if (event.target.id === "invoiceModal") closeInvoice();
        });

    document.getElementById("bookingConfirmationModal")
        ?.addEventListener("click", event => {
            if (event.target.id === "bookingConfirmationModal") {
                closeBookingConfirmation();
            }
        });

    document.getElementById("closeInvoiceModal")
        ?.addEventListener("click", closeInvoice);

    document.getElementById("closeInvoiceBtn")
        ?.addEventListener("click", closeInvoice);

    document.getElementById("printInvoiceBtn")
        ?.addEventListener("click", printInvoice);

    document.getElementById("closeBookingConfirmationModal")
        ?.addEventListener("click", closeBookingConfirmation);

    document.getElementById("closeBookingConfirmationBtn")
        ?.addEventListener("click", closeBookingConfirmation);

    document.getElementById("printBookingConfirmationBtn")
        ?.addEventListener("click", printBookingConfirmation);

    window.addEventListener("afterprint", () => {
        document.body.classList.remove("print-invoice", "print-confirmation");
    });

    await initializeReservationsPage();
});


/* =========================================================
   GLOBAL FUNCTIONS
========================================================= */

window.generateGuestInvoice = generateInvoice;
window.generateBookingConfirmation = generateBookingConfirmation;
