/* =========================================================
   EDU TECH HOTEL MANAGEMENT SYSTEM
   PAYMENTS.JS
   VERSION: 2026.11.17.05

   PURPOSE
   ---------------------------------------------------------
   - Load hotel payments
   - Record guest payments
   - Calculate reservation balances
   - VAT @ 16%
   - Post payment to financial ledger
   - Verify ledger posting correctly
   - PREVENT DUPLICATE LEDGER POSTING
   - Ledger button NEVER blindly posts twice
   - Prevent simultaneous posting of same payment
   - Retry only when payment is genuinely unposted
   - Payment receipt
   - Print receipt
   - Hotel-specific filtering
   ========================================================= */

(function () {

    "use strict";

    const VAT_RATE = 0.16;
    const LOAD_TIMEOUT = 15000;

    /*
     * CRITICAL DUPLICATE-POSTING PROTECTION
     *
     * A payment ID is placed here while its financial posting
     * operation is running.
     *
     * This prevents:
     *
     * - double clicking Ledger
     * - clicking Ledger twice very quickly
     * - two event handlers posting the same payment
     * - save/retry actions posting the same payment at once
     *
     * The database verification remains the primary protection.
     * This lock is the front-end concurrency protection.
     */
    const postingLocks = new Set();

    const state = {
        payments: [],
        reservations: [],
        guests: [],
        rooms: [],
        hotel: null,
        hotelId: null,
        currentPayment: null,
        loading: false,
        initialized: false
    };


    /* =========================================================
       DOM
    ========================================================= */

    function $(selector) {
        return document.querySelector(selector);
    }


    /* =========================================================
       MONEY
    ========================================================= */

    function money(value) {

        const number = Number(value || 0);

        return "KSh " + number.toLocaleString("en-KE", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

    }


    /* =========================================================
       ESCAPE HTML
    ========================================================= */

    function escapeHtml(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }


    /* =========================================================
       NORMALIZE
    ========================================================= */

    function normalize(value) {

        return String(value ?? "")
            .trim()
            .toLowerCase();

    }


    /* =========================================================
       SUPABASE
    ========================================================= */

    function getSupabase() {

        if (
            window.supabaseClient &&
            typeof window.supabaseClient.from === "function"
        ) {
            return window.supabaseClient;
        }

        throw new Error(
            "Supabase client is not available."
        );

    }


    /* =========================================================
       TIMEOUT
    ========================================================= */

    function withTimeout(
        promise,
        milliseconds = LOAD_TIMEOUT
    ) {

        return Promise.race([

            promise,

            new Promise(function (_, reject) {

                setTimeout(function () {

                    reject(
                        new Error(
                            "The database request timed out."
                        )
                    );

                }, milliseconds);

            })

        ]);

    }


    /* =========================================================
       STORAGE
    ========================================================= */

    function getStoredValue(keys) {

        for (const key of keys) {

            try {

                const sessionValue =
                    sessionStorage.getItem(key);

                if (
                    sessionValue !== null &&
                    sessionValue !== ""
                ) {
                    return sessionValue;
                }

            } catch (_) {}

            try {

                const localValue =
                    localStorage.getItem(key);

                if (
                    localValue !== null &&
                    localValue !== ""
                ) {
                    return localValue;
                }

            } catch (_) {}

        }

        return null;

    }


    /* =========================================================
       HOTEL ID
    ========================================================= */

    async function resolveHotelId() {

        const storedHotelId = getStoredValue([

            "activeHotelId",
            "active_hotel_id",
            "selectedHotelId",
            "selectedHotelID",
            "hotelId",
            "hotel_id",
            "currentHotelId",
            "current_hotel_id"

        ]);

        if (storedHotelId) {

            const id = Number(storedHotelId);

            if (
                Number.isFinite(id) &&
                id > 0
            ) {

                state.hotelId = id;

                return id;

            }

        }


        const userId = getStoredValue([

            "authenticatedUserId",
            "userId",
            "user_id",
            "currentUserId"

        ]);

        if (!userId) {
            return null;
        }


        const supabase = getSupabase();

        const result = await withTimeout(

            supabase
                .from("profiles")
                .select("hotel_id")
                .eq("id", userId)
                .maybeSingle()

        );

        if (result.error) {
            throw result.error;
        }


        if (
            result.data &&
            result.data.hotel_id
        ) {

            const hotelId =
                Number(result.data.hotel_id);

            state.hotelId = hotelId;

            try {

                sessionStorage.setItem(
                    "hotelId",
                    String(hotelId)
                );

                sessionStorage.setItem(
                    "hotel_id",
                    String(hotelId)
                );

                sessionStorage.setItem(
                    "activeHotelId",
                    String(hotelId)
                );

            } catch (_) {}

            return hotelId;

        }

        return null;

    }


    /* =========================================================
       LOAD HOTEL
    ========================================================= */

    async function loadHotel() {

        if (!state.hotelId) {
            return null;
        }

        try {

            const supabase = getSupabase();

            const result = await withTimeout(

                supabase
                    .from("hotels")
                    .select("*")
                    .eq("id", state.hotelId)
                    .maybeSingle()

            );

            if (result.error) {

                console.warn(
                    "Hotel loading error:",
                    result.error
                );

                return null;

            }

            state.hotel = result.data || null;

            return state.hotel;

        } catch (error) {

            console.warn(
                "Hotel loading failed:",
                error
            );

            return null;

        }

    }


    /* =========================================================
       LOAD TABLE
    ========================================================= */

    async function loadTable(
        tableName,
        hotelId
    ) {

        const supabase = getSupabase();

        let query =
            supabase
                .from(tableName)
                .select("*");

        if (hotelId) {

            query = query.eq(
                "hotel_id",
                hotelId
            );

        }

        const result =
            await withTimeout(query);

        if (result.error) {
            throw result.error;
        }

        return result.data || [];

    }


    /* =========================================================
       LOAD PAYMENTS
    ========================================================= */

    async function loadPayments() {

        const tableBody =
            $("#paymentsTableBody");

        state.loading = true;

        if (tableBody) {

            tableBody.innerHTML = `
                <tr>
                    <td colspan="10" class="loading-row">
                        Loading payments...
                    </td>
                </tr>
            `;

        }

        try {

            const hotelId =
                await resolveHotelId();

            if (!hotelId) {

                throw new Error(
                    "Hotel session was not found. Please log out and log in again."
                );

            }

            const supabase =
                getSupabase();


            /* -------------------------------------------------
               PAYMENTS
            ------------------------------------------------- */

            const paymentResult =
                await withTimeout(

                    supabase
                        .from("payments")
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
                        )

                );


            if (paymentResult.error) {
                throw paymentResult.error;
            }

            state.payments =
                paymentResult.data || [];


            /* -------------------------------------------------
               RESERVATIONS
            ------------------------------------------------- */

            try {

                state.reservations =
                    await loadTable(
                        "reservations",
                        hotelId
                    );

            } catch (error) {

                console.warn(
                    "Reservation loading failed:",
                    error
                );

                state.reservations = [];

            }


            /* -------------------------------------------------
               GUESTS
            ------------------------------------------------- */

            try {

                state.guests =
                    await loadTable(
                        "guests",
                        hotelId
                    );

            } catch (error) {

                console.warn(
                    "Guest loading failed:",
                    error
                );

                state.guests = [];

            }


            /* -------------------------------------------------
               ROOMS
            ------------------------------------------------- */

            try {

                state.rooms =
                    await loadTable(
                        "rooms",
                        hotelId
                    );

            } catch (error) {

                console.warn(
                    "Room loading failed:",
                    error
                );

                state.rooms = [];

            }


            await recoverPaymentRelationships();

            await loadHotel();

            updateSummary();

            renderPayments(
                $("#paymentSearch")?.value || ""
            );

            populateReservationSelector();

            updatePaymentBalance();

        } catch (error) {

            console.error(
                "PAYMENTS LOAD ERROR:",
                error
            );

            state.payments = [];

            updateSummary();

            if (tableBody) {

                tableBody.innerHTML = `
                    <tr>
                        <td
                            colspan="10"
                            class="error-row"
                        >
                            <strong>
                                Unable to load payments.
                            </strong>

                            <br><br>

                            ${escapeHtml(
                                error.message ||
                                "Unknown database error."
                            )}
                        </td>
                    </tr>
                `;

            }

        } finally {

            state.loading = false;

        }

    }


    /* =========================================================
       COLUMN HELPERS
    ========================================================= */

    function findColumn(
        row,
        candidates
    ) {

        if (!row) {
            return null;
        }

        const keys =
            Object.keys(row);

        for (const candidate of candidates) {

            if (keys.includes(candidate)) {
                return candidate;
            }

        }

        const clean = value =>
            String(value || "")
                .toLowerCase()
                .replace(/[\s_-]/g, "");

        for (const candidate of candidates) {

            const found =
                keys.find(function (key) {

                    return (
                        clean(key) ===
                        clean(candidate)
                    );

                });

            if (found) {
                return found;
            }

        }

        return null;

    }


    /* =========================================================
       RESERVATION GUEST ID
    ========================================================= */

    function getReservationGuestId(
        reservation
    ) {

        if (!reservation) {
            return null;
        }

        const column =
            findColumn(
                reservation,
                [
                    "guest_id",
                    "guest id",
                    "guest   id",
                    "guestId"
                ]
            );

        if (column) {
            return reservation[column];
        }

        return (
            reservation.guest_id ??
            reservation.guestId ??
            reservation["guest id"] ??
            reservation.customer_id ??
            reservation.customerId ??
            null
        );

    }


    /* =========================================================
       RESERVATION ROOM ID
    ========================================================= */

    function getReservationRoomId(
        reservation
    ) {

        if (!reservation) {
            return null;
        }

        const column =
            findColumn(
                reservation,
                [
                    "room_id",
                    "room id",
                    "room   id",
                    "roomId"
                ]
            );

        if (column) {
            return reservation[column];
        }

        return (
            reservation.room_id ??
            reservation.roomId ??
            reservation["room id"] ??
            null
        );

    }


    /* =========================================================
       FIND RESERVATION
    ========================================================= */

    function getReservation(
        reservationId
    ) {

        if (
            reservationId === null ||
            reservationId === undefined ||
            reservationId === ""
        ) {
            return null;
        }

        return state.reservations.find(
            reservation =>
                Number(reservation.id) ===
                Number(reservationId)
        ) || null;

    }


    /* =========================================================
       FIND GUEST
    ========================================================= */

    function getGuest(
        guestId
    ) {

        if (
            guestId === null ||
            guestId === undefined ||
            guestId === ""
        ) {
            return null;
        }

        return state.guests.find(
            guest =>
                Number(guest.id) ===
                Number(guestId)
        ) || null;

    }


    /* =========================================================
       FIND ROOM
    ========================================================= */

    function getRoom(
        roomId
    ) {

        if (
            roomId === null ||
            roomId === undefined ||
            roomId === ""
        ) {
            return null;
        }

        return state.rooms.find(
            room =>
                Number(room.id) ===
                Number(roomId)
        ) || null;

    }


    /* =========================================================
       RELATIONSHIPS
    ========================================================= */

    function getGuestFromReservation(
        reservation
    ) {

        if (!reservation) {
            return null;
        }

        return getGuest(
            getReservationGuestId(
                reservation
            )
        );

    }


    function getRoomFromReservation(
        reservation
    ) {

        if (!reservation) {
            return null;
        }

        return getRoom(
            getReservationRoomId(
                reservation
            )
        );

    }


    /* =========================================================
       HISTORICAL RECOVERY
    ========================================================= */

    async function recoverPaymentRelationships() {

        if (!state.payments.length) {
            return;
        }

        const supabase =
            getSupabase();

        const reservationIds =
            [
                ...new Set(
                    state.payments
                        .map(payment =>
                            Number(
                                payment.reservation_id
                            )
                        )
                        .filter(
                            id =>
                                Number.isFinite(id) &&
                                id > 0
                        )
                )
            ];

        if (!reservationIds.length) {
            return;
        }


        const missingReservations =
            reservationIds.filter(
                id =>
                    !getReservation(id)
            );


        if (missingReservations.length) {

            try {

                const result =
                    await withTimeout(

                        supabase
                            .from("reservations")
                            .select("*")
                            .eq(
                                "hotel_id",
                                state.hotelId
                            )
                            .in(
                                "id",
                                missingReservations
                            )

                    );

                if (
                    !result.error &&
                    result.data
                ) {

                    state.reservations =
                        state.reservations.concat(
                            result.data
                        );

                }

            } catch (error) {

                console.warn(
                    "Historical reservation recovery failed:",
                    error
                );

            }

        }


        const guestIds =
            [
                ...new Set(
                    state.reservations
                        .filter(
                            reservation =>
                                reservationIds.includes(
                                    Number(
                                        reservation.id
                                    )
                                )
                        )
                        .map(
                            reservation =>
                                Number(
                                    getReservationGuestId(
                                        reservation
                                    )
                                )
                        )
                        .filter(
                            id =>
                                Number.isFinite(id) &&
                                id > 0
                        )
                )
            ];


        const missingGuests =
            guestIds.filter(
                id =>
                    !getGuest(id)
            );


        if (missingGuests.length) {

            try {

                const result =
                    await withTimeout(

                        supabase
                            .from("guests")
                            .select("*")
                            .eq(
                                "hotel_id",
                                state.hotelId
                            )
                            .in(
                                "id",
                                missingGuests
                            )

                    );

                if (
                    !result.error &&
                    result.data
                ) {

                    state.guests =
                        state.guests.concat(
                            result.data
                        );

                }

            } catch (error) {

                console.warn(
                    "Historical guest recovery failed:",
                    error
                );

            }

        }


        const roomIds =
            [
                ...new Set(
                    state.reservations
                        .filter(
                            reservation =>
                                reservationIds.includes(
                                    Number(
                                        reservation.id
                                    )
                                )
                        )
                        .map(
                            reservation =>
                                Number(
                                    getReservationRoomId(
                                        reservation
                                    )
                                )
                        )
                        .filter(
                            id =>
                                Number.isFinite(id) &&
                                id > 0
                        )
                )
            ];


        const missingRooms =
            roomIds.filter(
                id =>
                    !getRoom(id)
            );


        if (missingRooms.length) {

            try {

                const result =
                    await withTimeout(

                        supabase
                            .from("rooms")
                            .select("*")
                            .eq(
                                "hotel_id",
                                state.hotelId
                            )
                            .in(
                                "id",
                                missingRooms
                            )

                    );

                if (
                    !result.error &&
                    result.data
                ) {

                    state.rooms =
                        state.rooms.concat(
                            result.data
                        );

                }

            } catch (error) {

                console.warn(
                    "Historical room recovery failed:",
                    error
                );

            }

        }

    }


    /* =========================================================
       DISPLAY HELPERS
    ========================================================= */

    function getGuestName(
        guest
    ) {

        if (!guest) {
            return "Guest record not found";
        }

        return (
            guest["full name"] ||
            guest.full_name ||
            guest.name ||
            guest.guest_name ||
            [
                guest.first_name,
                guest.middle_name,
                guest.last_name
            ]
                .filter(Boolean)
                .join(" ") ||
            (
                guest.id
                    ? "Guest #" + guest.id
                    : "Guest"
            )
        );

    }


    function getGuestIdPassport(
        guest
    ) {

        if (!guest) {
            return "—";
        }

        return (
            guest.id_passport_number ||
            guest["id/passport"] ||
            guest.id_number ||
            guest.passport_number ||
            guest.identification_number ||
            "—"
        );

    }


    function getRoomName(
        room
    ) {

        if (!room) {
            return "Room record not found";
        }

        return (
            room.room_number ||
            room["room number"] ||
            room.number ||
            room.name ||
            (
                room.id
                    ? "Room #" + room.id
                    : "Room"
            )
        );

    }


    function getPaymentNumber(
        payment
    ) {

        if (!payment) {
            return "—";
        }

        if (payment.payment_number) {
            return payment.payment_number;
        }

        if (payment.receipt_number) {
            return payment.receipt_number;
        }

        if (payment.reference_number) {
            return payment.reference_number;
        }

        if (payment.id) {

            const year =
                new Date(
                    payment.created_at ||
                    Date.now()
                ).getFullYear();

            return (
                "PAY-" +
                year +
                "-" +
                String(
                    payment.id
                ).padStart(6, "0")
            );

        }

        return "PAYMENT";

    }


    /* =========================================================
       FINANCIAL REFERENCE
       ---------------------------------------------------------
       THIS MUST MATCH financial-engine.js

       financial-engine.js creates:

           PAY-{payment.id}

       Example:

           payment id = 123
           ledger reference = PAY-123
    ========================================================= */

    function getFinancialPaymentReference(
        payment
    ) {

        if (
            !payment ||
            payment.id === null ||
            payment.id === undefined ||
            payment.id === ""
        ) {
            return null;
        }

        return "PAY-" + String(payment.id);

    }


    function getAlternativeFinancialReference(
        payment
    ) {

        if (
            !payment ||
            payment.id === null ||
            payment.id === undefined ||
            payment.id === ""
        ) {
            return null;
        }

        return "PAYMENT-" + String(payment.id);

    }


    function formatDate(
        value
    ) {

        if (!value) {
            return "—";
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
            "en-KE",
            {
                year: "numeric",
                month: "short",
                day: "2-digit"
            }
        );

    }


    /* =========================================================
       RESERVATION TOTAL
    ========================================================= */

    function getReservationTotal(
        reservation
    ) {

        if (!reservation) {
            return 0;
        }

        const values = [

            reservation.grand_total,
            reservation.grandTotal,
            reservation.total_amount,
            reservation.totalAmount,
            reservation.total,
            reservation.amount,
            reservation.booking_total,
            reservation.bookingTotal

        ];

        for (const value of values) {

            const number =
                Number(value);

            if (
                Number.isFinite(number) &&
                number >= 0
            ) {
                return number;
            }

        }

        return 0;

    }


    /* =========================================================
       PREVIOUS PAYMENTS
    ========================================================= */

    function getPreviousPayments(
        reservationId,
        excludePaymentId = null
    ) {

        return state.payments.reduce(
            (
                total,
                payment
            ) => {

                if (
                    Number(
                        payment.reservation_id
                    ) !==
                    Number(
                        reservationId
                    )
                ) {
                    return total;
                }

                if (
                    excludePaymentId !== null &&
                    Number(payment.id) ===
                    Number(excludePaymentId)
                ) {
                    return total;
                }

                return (
                    total +
                    Number(
                        payment.amount || 0
                    )
                );

            },
            0
        );

    }


    function getReservationBalance(
        reservation
    ) {

        if (!reservation) {
            return 0;
        }

        return Math.max(
            0,
            getReservationTotal(
                reservation
            ) -
            getPreviousPayments(
                reservation.id
            )
        );

    }


    function getBalanceForPayment(
        payment
    ) {

        const reservation =
            getReservation(
                payment.reservation_id
            );

        if (!reservation) {
            return 0;
        }

        return Math.max(
            0,
            getReservationTotal(
                reservation
            ) -
            getPreviousPayments(
                payment.reservation_id,
                payment.id
            ) -
            Number(payment.amount || 0)
        );

    }


    function getPaymentStatus(
        payment
    ) {

        const reservation =
            getReservation(
                payment.reservation_id
            );

        if (!reservation) {
            return "Paid";
        }

        const total =
            getReservationTotal(
                reservation
            );

        const paid =
            getPreviousPayments(
                payment.reservation_id
            );

        if (total <= 0) {
            return "Paid";
        }

        if (paid >= total) {
            return "Paid";
        }

        if (paid > 0) {
            return "Part Paid";
        }

        return "Pending";

    }


    function getStatusHtml(
        status
    ) {

        const value =
            normalize(status);

        if (value === "paid") {

            return `
                <span class="status-badge status-paid">
                    Paid
                </span>
            `;

        }

        if (value === "part paid") {

            return `
                <span class="status-badge status-part">
                    Part Paid
                </span>
            `;

        }

        return `
            <span class="status-badge status-pending">
                ${escapeHtml(status)}
            </span>
        `;

    }


    /* =========================================================
       RENDER
    ========================================================= */

    function renderPayments(
        searchTerm = ""
    ) {

        const tableBody =
            $("#paymentsTableBody");

        if (!tableBody) {
            return;
        }

        const search =
            normalize(searchTerm);

        let rows =
            [...state.payments];


        if (search) {

            rows =
                rows.filter(
                    payment => {

                        const reservation =
                            getReservation(
                                payment.reservation_id
                            );

                        const guest =
                            getGuestFromReservation(
                                reservation
                            );

                        const room =
                            getRoomFromReservation(
                                reservation
                            );

                        const text = [

                            getPaymentNumber(payment),
                            payment.id,
                            payment.reservation_id,
                            getGuestName(guest),
                            getGuestIdPassport(guest),
                            getRoomName(room),
                            payment.payment_method,
                            payment.payment_date,
                            payment.created_at,
                            payment.amount,
                            getPaymentStatus(payment)

                        ]
                            .filter(
                                value =>
                                    value !== null &&
                                    value !== undefined
                            )
                            .join(" ");

                        return normalize(
                            text
                        ).includes(search);

                    }
                );

        }


        const info =
            $("#searchResultInfo");

        if (info) {

            info.textContent =
                search
                    ? `${rows.length} result(s)`
                    : `${rows.length} payment(s)`;

        }


        if (!rows.length) {

            tableBody.innerHTML = `
                <tr>
                    <td
                        colspan="10"
                        class="empty-row"
                    >
                        ${
                            search
                                ? "No payments match your search."
                                : "No payments have been recorded yet."
                        }
                    </td>
                </tr>
            `;

            return;

        }


        tableBody.innerHTML =
            rows
                .map(renderPaymentRow)
                .join("");

    }


    function renderPaymentRow(
        payment
    ) {

        const reservation =
            getReservation(
                payment.reservation_id
            );

        let guest =
            getGuestFromReservation(
                reservation
            );

        const room =
            getRoomFromReservation(
                reservation
            );

        if (!guest) {

            const guestId =
                payment.guest_id ??
                payment.guestId ??
                null;

            if (guestId) {
                guest = getGuest(guestId);
            }

        }

        const reservationTotal =
            getReservationTotal(
                reservation
            );

        const amount =
            Number(
                payment.amount || 0
            );

        const balance =
            getBalanceForPayment(
                payment
            );

        const status =
            getPaymentStatus(
                payment
            );

        const isPosting =
            postingLocks.has(
                String(payment.id)
            );

        return `
            <tr>

                <td>
                    <strong>
                        ${escapeHtml(
                            getPaymentNumber(payment)
                        )}
                    </strong>
                </td>

                <td>

                    <strong>
                        ${escapeHtml(
                            getGuestName(guest)
                        )}
                    </strong>

                    ${
                        reservation
                            ? `
                                <br>
                                <small>
                                    Reservation #${escapeHtml(
                                        reservation.id
                                    )}
                                </small>
                            `
                            : `
                                <br>
                                <small style="color:#b42318;">
                                    Reservation record not found
                                </small>
                            `
                    }

                </td>

                <td>
                    ${escapeHtml(
                        getRoomName(room)
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        formatDate(
                            payment.payment_date ||
                            payment.created_at
                        )
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        String(
                            payment.payment_method ||
                            "—"
                        ).toUpperCase()
                    )}
                </td>

                <td>
                    ${money(reservationTotal)}
                </td>

                <td>
                    <strong>
                        ${money(amount)}
                    </strong>
                </td>

                <td>
                    ${money(balance)}
                </td>

                <td>
                    ${getStatusHtml(status)}
                </td>

                <td>

                    <div class="action-buttons">

                        <button
                            type="button"
                            class="btn-primary"
                            data-action="receipt"
                            data-payment-id="${escapeHtml(
                                payment.id
                            )}"
                        >
                            Receipt
                        </button>

                        <button
                            type="button"
                            class="btn-warning"
                            data-action="ledger"
                            data-payment-id="${escapeHtml(
                                payment.id
                            )}"
                            ${isPosting ? "disabled" : ""}
                        >
                            ${
                                isPosting
                                    ? "Posting..."
                                    : "Ledger"
                            }
                        </button>

                    </div>

                </td>

            </tr>
        `;

    }


    /* =========================================================
       SUMMARY
    ========================================================= */

    function updateSummary() {

        const total =
            state.payments.reduce(
                (
                    sum,
                    payment
                ) =>
                    sum +
                    Number(
                        payment.amount || 0
                    ),
                0
            );

        const outstanding =
            state.reservations.reduce(
                (
                    sum,
                    reservation
                ) =>
                    sum +
                    getReservationBalance(
                        reservation
                    ),
                0
            );

        const totalElement =
            $("#totalPayments");

        const countElement =
            $("#paymentCount");

        const outstandingElement =
            $("#totalOutstanding");

        if (totalElement) {
            totalElement.textContent =
                money(total);
        }

        if (countElement) {
            countElement.textContent =
                String(
                    state.payments.length
                );
        }

        if (outstandingElement) {
            outstandingElement.textContent =
                money(outstanding);
        }

    }


    /* =========================================================
       VAT
    ========================================================= */

    function calculateVAT(
        grossAmount
    ) {

        const gross =
            Number(grossAmount || 0);

        const subtotal =
            gross / (1 + VAT_RATE);

        const vat =
            gross - subtotal;

        return {

            gross:
                Number(
                    gross.toFixed(2)
                ),

            subtotal:
                Number(
                    subtotal.toFixed(2)
                ),

            vat:
                Number(
                    vat.toFixed(2)
                )

        };

    }


    /* =========================================================
       FINANCIAL ENGINE READY
    ========================================================= */

    async function waitForFinancialEngine(
        timeout = 10000
    ) {

        if (
            window.EDUTECH_FINANCIAL_ENGINE &&
            typeof
                window.EDUTECH_FINANCIAL_ENGINE.postPayment ===
                "function"
        ) {
            return true;
        }

        return new Promise(
            function (
                resolve,
                reject
            ) {

                let finished = false;

                function cleanup() {

                    window.removeEventListener(
                        "edutech:financial-engine-ready",
                        onReady
                    );

                }

                function onReady() {

                    if (finished) {
                        return;
                    }

                    finished = true;

                    cleanup();

                    resolve(true);

                }

                window.addEventListener(
                    "edutech:financial-engine-ready",
                    onReady
                );


                setTimeout(
                    function () {

                        if (finished) {
                            return;
                        }

                        finished = true;

                        cleanup();

                        if (
                            window.EDUTECH_FINANCIAL_ENGINE &&
                            typeof
                                window.EDUTECH_FINANCIAL_ENGINE.postPayment ===
                                "function"
                        ) {

                            resolve(true);

                        } else {

                            reject(
                                new Error(
                                    "Financial engine did not become ready."
                                )
                            );

                        }

                    },
                    timeout
                );

            }
        );

    }


    /* =========================================================
       LEDGER SEARCH TEXT
    ========================================================= */

    function ledgerText(
        row
    ) {

        return normalize([

            row?.transaction_number,
            row?.reference_number,
            row?.description,
            row?.transaction_type,
            row?.id

        ].join(" "));

    }


    /* =========================================================
       LEDGER AMOUNT
    ========================================================= */

    function ledgerAmount(
        row
    ) {

        const values = [

            row?.amount,
            row?.money_in,
            row?.moneyIn,
            row?.credit_amount,
            row?.debit_amount

        ];

        for (const value of values) {

            const number =
                Number(value);

            if (
                Number.isFinite(number) &&
                number > 0
            ) {
                return number;
            }

        }

        return 0;

    }


    /* =========================================================
       DATE DIFFERENCE
    ========================================================= */

    function dateDifferenceHours(
        first,
        second
    ) {

        if (!first || !second) {
            return Infinity;
        }

        const a = new Date(first);
        const b = new Date(second);

        if (
            Number.isNaN(a.getTime()) ||
            Number.isNaN(b.getTime())
        ) {
            return Infinity;
        }

        return Math.abs(
            a.getTime() -
            b.getTime()
        ) / 3600000;

    }


    /* =========================================================
       VERIFY PAYMENT LEDGER
       ---------------------------------------------------------
       CRITICAL DUPLICATE PROTECTION

       PRIMARY SOURCE OF TRUTH:

           PAY-{payment.id}

       The financial engine creates this exact reference.

       Verification order:

       1. Exact PAY-{payment.id}
       2. Legacy PAYMENT-{payment.id}
       3. payment_id when available
       4. Controlled legacy fallback

       IMPORTANT:

       Amount + date alone can NEVER prove that a payment
       has been posted.

       This function ONLY READS the financial ledger.

       It NEVER calls postPayment().
       ========================================================= */

    async function verifyPaymentLedger(
        payment
    ) {

        if (
            !payment ||
            payment.id === null ||
            payment.id === undefined ||
            payment.id === ""
        ) {
            return [];
        }


        const supabase =
            getSupabase();


        const hotelId =
            Number(
                state.hotelId ||
                await resolveHotelId()
            );


        if (!hotelId) {

            throw new Error(
                "Hotel ID is not available."
            );

        }


        const financialReference =
            getFinancialPaymentReference(
                payment
            );


        const alternativeReference =
            getAlternativeFinancialReference(
                payment
            );


        const paymentIdText =
            String(
                payment.id
            );


        /* -----------------------------------------------------
           1. EXACT FINANCIAL REFERENCE

           PRIMARY CHECK.

           financial-engine.js uses:

               PAY-{payment.id}

           If this exists, POSTING MUST STOP.
        ----------------------------------------------------- */

        if (financialReference) {

            const exactResult =
                await withTimeout(

                    supabase
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
                            financialReference
                        )
                        .eq(
                            "is_reversal",
                            false
                        )
                        .order(
                            "id",
                            {
                                ascending: true
                            }
                        )

                );


            if (exactResult.error) {

                throw exactResult.error;

            }


            if (
                exactResult.data &&
                exactResult.data.length > 0
            ) {

                return exactResult.data;

            }

        }


        /* -----------------------------------------------------
           2. LEGACY PAYMENT REFERENCE
        ----------------------------------------------------- */

        if (
            alternativeReference &&
            alternativeReference !==
                financialReference
        ) {

            const alternativeResult =
                await withTimeout(

                    supabase
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
                            alternativeReference
                        )
                        .eq(
                            "is_reversal",
                            false
                        )
                        .order(
                            "id",
                            {
                                ascending: true
                            }
                        )

                );


            if (alternativeResult.error) {

                throw alternativeResult.error;

            }


            if (
                alternativeResult.data &&
                alternativeResult.data.length > 0
            ) {

                return alternativeResult.data;

            }

        }


        /* -----------------------------------------------------
           3. OPTIONAL payment_id COLUMN

           Some installations have payment_id in the ledger.

           If the column does not exist, ignore that query
           and continue safely.
        ----------------------------------------------------- */

        try {

            const paymentIdResult =
                await withTimeout(

                    supabase
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
                            payment.id
                        )
                        .eq(
                            "is_reversal",
                            false
                        )
                        .order(
                            "id",
                            {
                                ascending: true
                            }
                        )

                );


            if (
                !paymentIdResult.error &&
                paymentIdResult.data &&
                paymentIdResult.data.length > 0
            ) {

                return paymentIdResult.data;

            }

        } catch (error) {

            console.warn(
                "payment_id ledger verification skipped:",
                error
            );

        }


        /* -----------------------------------------------------
           4. CONTROLLED LEGACY FALLBACK

           This is NOT allowed to use amount/date alone.

           The amount must match AND a payment/reservation
           identifier must appear in the ledger text.
        ----------------------------------------------------- */

        const reservationIdText =
            payment.reservation_id !== null &&
            payment.reservation_id !== undefined
                ? String(
                    payment.reservation_id
                ).trim()
                : "";


        const paymentNumber =
            normalize(
                getPaymentNumber(
                    payment
                )
            );


        const amount =
            Number(
                payment.amount || 0
            );


        const paymentDate =
            payment.payment_date ||
            payment.created_at;


        if (
            !Number.isFinite(amount) ||
            amount <= 0
        ) {

            return [];

        }


        const recentResult =
            await withTimeout(

                supabase
                    .from(
                        "financial_transactions"
                    )
                    .select("*")
                    .eq(
                        "hotel_id",
                        hotelId
                    )
                    .eq(
                        "is_reversal",
                        false
                    )
                    .order(
                        "id",
                        {
                            ascending: false
                        }
                    )
                    .limit(200)

            );


        if (recentResult.error) {

            throw recentResult.error;

        }


        const fallback =
            (recentResult.data || [])
                .filter(
                    function (row) {

                        const rowAmount =
                            ledgerAmount(row);


                        if (
                            Math.abs(
                                rowAmount -
                                amount
                            ) > 0.01
                        ) {

                            return false;

                        }


                        const hours =
                            dateDifferenceHours(
                                row.created_at,
                                paymentDate
                            );


                        if (
                            hours >
                            72
                        ) {

                            return false;

                        }


                        const reference =
                            normalize(
                                row.reference_number
                            );


                        const transactionNumber =
                            normalize(
                                row.transaction_number
                            );


                        const description =
                            normalize(
                                row.description
                            );


                        /* -------------------------------------
                           Payment number match
                        ------------------------------------- */

                        if (
                            paymentNumber &&
                            (
                                reference ===
                                    paymentNumber ||
                                transactionNumber ===
                                    paymentNumber ||
                                description.includes(
                                    paymentNumber
                                )
                            )
                        ) {

                            return true;

                        }


                        /* -------------------------------------
                           Payment ID match

                           Only exact token-style matches are
                           accepted to avoid treating payment
                           ID 12 as payment ID 112.
                        ------------------------------------- */

                        if (
                            paymentIdText &&
                            (
                                reference ===
                                    "pay-" +
                                    paymentIdText ||
                                reference ===
                                    "payment-" +
                                    paymentIdText ||
                                transactionNumber ===
                                    "pay-" +
                                    paymentIdText ||
                                transactionNumber ===
                                    "payment-" +
                                    paymentIdText ||
                                description.includes(
                                    "pay-" +
                                    paymentIdText
                                ) ||
                                description.includes(
                                    "payment-" +
                                    paymentIdText
                                )
                            )
                        ) {

                            return true;

                        }


                        /* -------------------------------------
                           Reservation match

                           Amount + date + reservation reference
                           is accepted for legacy postings.
                        ------------------------------------- */

                        if (
                            reservationIdText &&
                            (
                                reference ===
                                    reservationIdText ||
                                transactionNumber ===
                                    reservationIdText ||
                                description.includes(
                                    "reservation #" +
                                    reservationIdText
                                ) ||
                                description.includes(
                                    "reservation " +
                                    reservationIdText
                                )
                            )
                        ) {

                            return true;

                        }


                        return false;

                    }
                );


        return fallback;

    }


    /* =========================================================
       VERIFY WITH RETRY
       ---------------------------------------------------------
       IMPORTANT:

       This function ONLY verifies.

       It NEVER calls postPayment().
    ========================================================= */

    async function verifyPaymentLedgerWithRetry(
        payment,
        attempts = 5,
        delay = 500
    ) {

        let result = [];

        for (
            let attempt = 1;
            attempt <= attempts;
            attempt++
        ) {

            result =
                await verifyPaymentLedger(
                    payment
                );

            if (result.length) {
                return result;
            }

            if (attempt < attempts) {

                await new Promise(
                    resolve =>
                        setTimeout(
                            resolve,
                            delay
                        )
                );

            }

        }

        return result;

    }


    /* =========================================================
       SAVE PAYMENT
       ---------------------------------------------------------
       DUPLICATE PROTECTION

       A payment is inserted once.

       Then the financial ledger is checked.

       If already posted:
           STOP.

       If not posted:
           POST ONCE.

       After posting:
           VERIFY ONLY.

       There is NO automatic second post.
    ========================================================= */

    async function savePayment(
        event
    ) {

        event.preventDefault();


        const reservationId =
            $("#paymentReservation")?.value;

        const amount =
            Number(
                $("#paymentAmount")?.value || 0
            );

        const paymentMethod =
            $("#paymentMethod")?.value;

        const paymentDate =
            $("#paymentDate")?.value;


        if (!reservationId) {

            alert(
                "Please select a reservation."
            );

            return;

        }


        if (
            !Number.isFinite(amount) ||
            amount <= 0
        ) {

            alert(
                "Please enter a valid payment amount."
            );

            return;

        }


        if (!paymentMethod) {

            alert(
                "Please select a payment method."
            );

            return;

        }


        if (!paymentDate) {

            alert(
                "Please select the payment date."
            );

            return;

        }


        const reservation =
            getReservation(
                reservationId
            );


        if (!reservation) {

            alert(
                "The selected reservation could not be found."
            );

            return;

        }


        const balance =
            getReservationBalance(
                reservation
            );


        if (amount > balance + 0.01) {

            alert(
                "Payment cannot exceed the remaining reservation balance.\n\n" +
                "Remaining balance: " +
                money(balance)
            );

            return;

        }


        const supabase =
            getSupabase();


        const hotelId =
            await resolveHotelId();


        if (!hotelId) {

            alert(
                "Hotel session was not found."
            );

            return;

        }


        const paymentData = {

            hotel_id:
                hotelId,

            reservation_id:
                Number(
                    reservationId
                ),

            amount:
                Number(
                    amount.toFixed(2)
                ),

            payment_method:
                paymentMethod,

            payment_date:
                paymentDate

        };


        try {

            /* -------------------------------------------------
               SAVE PAYMENT
            ------------------------------------------------- */

            const insertResult =
                await withTimeout(

                    supabase
                        .from("payments")
                        .insert(
                            paymentData
                        )
                        .select("*")
                        .single()

                );


            if (insertResult.error) {
                throw insertResult.error;
            }


            const savedPayment =
                insertResult.data;


            if (!savedPayment?.id) {

                throw new Error(
                    "Payment was saved but no payment ID was returned."
                );

            }


            const lockKey =
                String(
                    savedPayment.id
                );


            /* -------------------------------------------------
               LOCK THIS PAYMENT

               Prevent another action from posting this same
               payment while the current posting is running.
            ------------------------------------------------- */

            if (postingLocks.has(lockKey)) {

                alert(
                    "This payment is already being posted.\n\n" +
                    "Please wait. No additional posting was made."
                );

                return;

            }


            postingLocks.add(lockKey);

            renderPayments(
                $("#paymentSearch")?.value || ""
            );


            try {

                /* -------------------------------------------------
                   FINANCIAL ENGINE
                ------------------------------------------------- */

                await waitForFinancialEngine();


                const engine =
                    window.EDUTECH_FINANCIAL_ENGINE;


                if (
                    !engine ||
                    typeof engine.postPayment !==
                    "function"
                ) {

                    throw new Error(
                        "Financial engine is not available."
                    );

                }


                /* -------------------------------------------------
                   CHECK BEFORE POSTING

                   If another process already posted this payment,
                   STOP HERE.
                ------------------------------------------------- */

                let existingLedger =
                    await verifyPaymentLedger(
                        savedPayment
                    );


                if (
                    existingLedger &&
                    existingLedger.length
                ) {

                    alert(
                        "Payment was saved and an existing financial ledger posting was found.\n\n" +

                        "Payment: " +
                        getPaymentNumber(
                            savedPayment
                        ) +

                        "\nAmount: " +
                        money(
                            savedPayment.amount
                        ) +

                        "\nLedger entries found: " +
                        existingLedger.length +

                        "\n\nNo duplicate posting was created."
                    );

                    closePaymentModal();

                    await loadPayments();

                    return;

                }


                /* -------------------------------------------------
                   ONE NORMAL POSTING ONLY
                ------------------------------------------------- */

                await engine.postPayment(
                    savedPayment
                );


                /* -------------------------------------------------
                   VERIFY ONLY

                   DO NOT CALL ENGINE AGAIN.
                ------------------------------------------------- */

                const ledgerEntries =
                    await verifyPaymentLedgerWithRetry(
                        savedPayment
                    );


                if (!ledgerEntries.length) {

                    alert(
                        "Payment was saved successfully.\n\n" +
                        "Payment ID: " +
                        savedPayment.id +
                        "\n\n" +
                        "The Financial Engine was called, but the ledger entry could not yet be verified.\n\n" +
                        "DO NOT ENTER THIS PAYMENT AGAIN.\n" +
                        "Use the Ledger button to verify/reconcile it."
                    );

                } else {

                    alert(
                        "Payment recorded successfully.\n\n" +
                        "Payment: " +
                        getPaymentNumber(
                            savedPayment
                        ) +
                        "\nAmount: " +
                        money(
                            savedPayment.amount
                        ) +
                        "\n\n" +
                        "Financial ledger posting verified."
                    );

                }


                closePaymentModal();

                await loadPayments();

            } finally {

                /*
                 * Always release the lock when this posting
                 * operation finishes.
                 */
                postingLocks.delete(lockKey);

                renderPayments(
                    $("#paymentSearch")?.value || ""
                );

            }


        } catch (error) {

            console.error(
                "PAYMENT SAVE ERROR:",
                error
            );


            alert(
                "Payment was saved or partially processed, but the financial posting could not be confirmed.\n\n" +
                (
                    error.message ||
                    "Unknown error."
                ) +
                "\n\n" +
                "DO NOT ENTER THIS PAYMENT AGAIN.\n" +
                "Use the Ledger button to verify it."
            );

        }

    }


    /* =========================================================
       LEDGER BUTTON
       ---------------------------------------------------------
       CRITICAL DUPLICATE PROTECTION

       FLOW:

       CLICK LEDGER
            |
            v
       IS THIS PAYMENT ALREADY BEING PROCESSED?
            |
          YES --> STOP
            |
           NO
            |
            v
       LOCK PAYMENT
            |
            v
       LOAD PAYMENT
            |
            v
       CHECK PAY-{payment.id}
            |
          FOUND --> STOP
            |
         NOT FOUND
            |
            v
       CHECK LEGACY REFERENCES
            |
          FOUND --> STOP
            |
         NOT FOUND
            |
            v
       CALL ENGINE ONCE
            |
            v
       VERIFY LEDGER
            |
            v
       UNLOCK

       IMPORTANT:
       This function NEVER calls postPayment() more than once.
    ========================================================= */

    async function retryLedger(
        paymentId
    ) {

        const lockKey =
            String(
                paymentId
            );


        /* -----------------------------------------------------
           FRONT-END CONCURRENCY LOCK

           This is checked BEFORE any database request.
        ----------------------------------------------------- */

        if (postingLocks.has(lockKey)) {

            alert(
                "This payment is already being posted.\n\n" +
                "Please wait. No additional transaction was created."
            );

            return;

        }


        postingLocks.add(lockKey);


        /*
         * Disable/relabel the button immediately so the user
         * cannot repeatedly click it while the operation runs.
         */
        renderPayments(
            $("#paymentSearch")?.value || ""
        );


        try {

            const hotelId =
                await resolveHotelId();

            if (!hotelId) {

                throw new Error(
                    "Hotel session was not found."
                );

            }


            const supabase =
                getSupabase();


            const result =
                await withTimeout(

                    supabase
                        .from("payments")
                        .select("*")
                        .eq(
                            "id",
                            paymentId
                        )
                        .eq(
                            "hotel_id",
                            hotelId
                        )
                        .maybeSingle()

                );


            if (result.error) {
                throw result.error;
            }


            if (!result.data) {

                throw new Error(
                    "Payment record was not found."
                );

            }


            const payment =
                result.data;


            /* -------------------------------------------------
               FIRST AND MOST IMPORTANT CHECK

               DO NOT POST IF ALREADY POSTED.
            ------------------------------------------------- */

            let existing =
                await verifyPaymentLedger(
                    payment
                );


            if (
                existing &&
                existing.length
            ) {

                alert(
                    "This payment is already posted to the financial ledger.\n\n" +

                    "Payment: " +
                    getPaymentNumber(
                        payment
                    ) +

                    "\nAmount: " +
                    money(
                        payment.amount
                    ) +

                    "\nLedger entries found: " +
                    existing.length +

                    "\n\nNo new transaction was created."
                );

                return;

            }


            /* -------------------------------------------------
               FINANCIAL ENGINE
            ------------------------------------------------- */

            await waitForFinancialEngine();


            const engine =
                window.EDUTECH_FINANCIAL_ENGINE;


            if (
                !engine ||
                typeof engine.postPayment !==
                "function"
            ) {

                throw new Error(
                    "Financial engine is not available."
                );

            }


            /* -------------------------------------------------
               FINAL PRE-POST VERIFICATION

               This second verification is intentional.

               It protects against a posting that may have
               appeared between the first verification and the
               engine call.
            ------------------------------------------------- */

            existing =
                await verifyPaymentLedger(
                    payment
                );


            if (
                existing &&
                existing.length
            ) {

                alert(
                    "This payment has already been posted to the financial ledger.\n\n" +
                    "No new transaction was created."
                );

                return;

            }


            /* -------------------------------------------------
               ONE RETRY ONLY

               There is exactly ONE call to postPayment().
            ------------------------------------------------- */

            await engine.postPayment(
                payment
            );


            /* -------------------------------------------------
               VERIFY AFTER POST

               NEVER call postPayment() again if verification
               is delayed.
            ------------------------------------------------- */

            existing =
                await verifyPaymentLedgerWithRetry(
                    payment
                );


            if (!existing.length) {

                throw new Error(
                    "The Financial Engine completed, but the payment could not be verified in the ledger. No additional automatic posting was made."
                );

            }


            alert(
                "Payment successfully verified in the financial ledger.\n\n" +

                "Payment: " +
                getPaymentNumber(
                    payment
                ) +

                "\nAmount: " +
                money(
                    payment.amount
                ) +

                "\nLedger entries found: " +
                existing.length +

                "\n\nPosting verified successfully."
            );


        } catch (error) {

            console.error(
                "PAYMENT LEDGER ACTION ERROR:",
                error
            );


            alert(
                "The payment ledger could not be verified.\n\n" +

                (
                    error.message ||
                    "Unknown error."
                ) +

                "\n\n" +

                "No additional automatic posting was made."
            );

        } finally {

            /*
             * ALWAYS release the lock.
             *
             * This means a failed/finished operation cannot
             * permanently block the Ledger button.
             */
            postingLocks.delete(lockKey);

            renderPayments(
                $("#paymentSearch")?.value || ""
            );

        }

    }


    /* =========================================================
       RESERVATION SELECTOR
    ========================================================= */

    function populateReservationSelector() {

        const select =
            $("#paymentReservation");

        if (!select) {
            return;
        }


        const previousValue =
            select.value;


        select.innerHTML = `
            <option value="">
                Select reservation
            </option>
        `;


        state.reservations
            .filter(
                reservation =>
                    getReservationBalance(
                        reservation
                    ) > 0
            )
            .forEach(
                reservation => {

                    const guest =
                        getGuestFromReservation(
                            reservation
                        );

                    const room =
                        getRoomFromReservation(
                            reservation
                        );

                    const balance =
                        getReservationBalance(
                            reservation
                        );


                    const option =
                        document.createElement(
                            "option"
                        );


                    option.value =
                        reservation.id;


                    option.textContent =
                        "Reservation #" +
                        reservation.id +
                        " - " +
                        getGuestName(guest) +
                        " - Room " +
                        getRoomName(room) +
                        " - Balance " +
                        money(balance);


                    select.appendChild(
                        option
                    );

                }
            );


        if (
            previousValue &&
            [...select.options]
                .some(
                    option =>
                        option.value ===
                        String(previousValue)
                )
        ) {

            select.value =
                previousValue;

        }

    }


    /* =========================================================
       PAYMENT BALANCE
    ========================================================= */

    function updatePaymentBalance() {

        const reservation =
            getReservation(
                $("#paymentReservation")?.value
            );

        const amountInput =
            $("#paymentAmount");

        if (!reservation) {

            if (amountInput) {
                amountInput.max = "";
            }

            return;

        }


        const balance =
            getReservationBalance(
                reservation
            );


        if (amountInput) {

            amountInput.max =
                balance.toFixed(2);

        }


        const possibleElements = [

            "#paymentBalance",
            "#remainingBalance",
            "#paymentRemainingBalance"

        ];


        for (const selector of possibleElements) {

            const element =
                $(selector);

            if (element) {

                element.textContent =
                    money(balance);

            }

        }

    }


    /* =========================================================
       PAYMENT MODAL
    ========================================================= */

    function openPaymentModal() {

        const modal =
            $("#paymentModal");

        if (!modal) {
            return;
        }


        populateReservationSelector();


        const form =
            $("#paymentForm");

        if (form) {
            form.reset();
        }


        const dateInput =
            $("#paymentDate");

        if (dateInput) {

            const now =
                new Date();

            dateInput.value =
                now.toISOString()
                    .split("T")[0];

        }


        updatePaymentBalance();


        modal.classList.add(
            "show"
        );

    }


    function closePaymentModal() {

        const modal =
            $("#paymentModal");

        if (modal) {

            modal.classList.remove(
                "show"
            );

        }

    }


    /* =========================================================
       RECEIPT
    ========================================================= */

    async function showReceipt(
        payment
    ) {

        if (!payment) {
            return;
        }


        state.currentPayment =
            payment;


        const modal =
            $("#receiptModal");

        const body =
            $("#receiptBody");


        if (!modal || !body) {
            return;
        }


        if (!state.hotel) {
            await loadHotel();
        }


        const reservation =
            getReservation(
                payment.reservation_id
            );


        if (!reservation) {
            await recoverPaymentRelationships();
        }


        const finalReservation =
            getReservation(
                payment.reservation_id
            );


        const guest =
            getGuestFromReservation(
                finalReservation
            );


        const room =
            getRoomFromReservation(
                finalReservation
            );


        const hotel =
            state.hotel || {};


        const hotelName =
            hotel.hotel_name ||
            hotel.name ||
            hotel.business_name ||
            "EDU TECH HOTEL";


        const hotelPhone =
            hotel.phone ||
            hotel.phone_number ||
            "—";


        const hotelLocation =
            hotel.location ||
            hotel.address ||
            "—";


        const total =
            getReservationTotal(
                finalReservation
            );


        const paidBefore =
            getPreviousPayments(
                payment.reservation_id,
                payment.id
            );


        const currentPayment =
            Number(
                payment.amount || 0
            );


        const balance =
            Math.max(
                0,
                total -
                paidBefore -
                currentPayment
            );


        const vat =
            calculateVAT(
                currentPayment
            );


        body.innerHTML = `

            <div class="payment-receipt">

                <div style="text-align:center;">

                    <h2>
                        ${escapeHtml(
                            hotelName
                        )}
                    </h2>

                    <div>
                        ${escapeHtml(
                            hotelLocation
                        )}
                    </div>

                    <div>
                        Tel:
                        ${escapeHtml(
                            hotelPhone
                        )}
                    </div>

                    <hr>

                    <h3>
                        PAYMENT RECEIPT
                    </h3>

                </div>


                <table style="width:100%;">

                    <tr>
                        <td>
                            Receipt
                        </td>

                        <td>
                            <strong>
                                ${escapeHtml(
                                    getPaymentNumber(
                                        payment
                                    )
                                )}
                            </strong>
                        </td>
                    </tr>


                    <tr>
                        <td>
                            Date
                        </td>

                        <td>
                            ${escapeHtml(
                                formatDate(
                                    payment.payment_date ||
                                    payment.created_at
                                )
                            )}
                        </td>
                    </tr>


                    <tr>
                        <td>
                            Guest
                        </td>

                        <td>
                            ${escapeHtml(
                                getGuestName(
                                    guest
                                )
                            )}
                        </td>
                    </tr>


                    <tr>
                        <td>
                            ID / Passport
                        </td>

                        <td>
                            ${escapeHtml(
                                getGuestIdPassport(
                                    guest
                                )
                            )}
                        </td>
                    </tr>


                    <tr>
                        <td>
                            Room
                        </td>

                        <td>
                            ${escapeHtml(
                                getRoomName(
                                    room
                                )
                            )}
                        </td>
                    </tr>


                    <tr>
                        <td>
                            Payment Method
                        </td>

                        <td>
                            ${escapeHtml(
                                String(
                                    payment.payment_method ||
                                    "—"
                                ).toUpperCase()
                            )}
                        </td>
                    </tr>


                    <tr>
                        <td>
                            Reservation Total
                        </td>

                        <td>
                            ${money(total)}
                        </td>
                    </tr>


                    <tr>
                        <td>
                            Previous Payments
                        </td>

                        <td>
                            ${money(paidBefore)}
                        </td>
                    </tr>


                    <tr>
                        <td>
                            Amount Before VAT
                        </td>

                        <td>
                            ${money(vat.subtotal)}
                        </td>
                    </tr>


                    <tr>
                        <td>
                            VAT @ 16%
                        </td>

                        <td>
                            ${money(vat.vat)}
                        </td>
                    </tr>


                    <tr>
                        <td>
                            Current Payment
                        </td>

                        <td>
                            <strong>
                                ${money(
                                    currentPayment
                                )}
                            </strong>
                        </td>
                    </tr>


                    <tr>
                        <td>
                            Remaining Balance
                        </td>

                        <td>
                            <strong>
                                ${money(balance)}
                            </strong>
                        </td>
                    </tr>

                </table>


                <hr>


                <p style="text-align:center;">
                    Thank you for your payment.
                </p>

            </div>

        `;


        modal.classList.add(
            "show"
        );

    }


    function closeReceipt() {

        const modal =
            $("#receiptModal");

        if (modal) {

            modal.classList.remove(
                "show"
            );

        }

    }


    function printReceipt() {

        window.print();

    }


    /* =========================================================
       EVENTS
    ========================================================= */

    function setupEvents() {


        $("#refreshPayments")
            ?.addEventListener(
                "click",
                loadPayments
            );


        $("#openPaymentModal")
            ?.addEventListener(
                "click",
                openPaymentModal
            );


        $("#closePaymentModal")
            ?.addEventListener(
                "click",
                closePaymentModal
            );


        $("#cancelPaymentModal")
            ?.addEventListener(
                "click",
                closePaymentModal
            );


        $("#paymentForm")
            ?.addEventListener(
                "submit",
                savePayment
            );


        $("#paymentReservation")
            ?.addEventListener(
                "change",
                function () {

                    updatePaymentBalance();

                }
            );


        $("#paymentAmount")
            ?.addEventListener(
                "input",
                function () {

                    const reservation =
                        getReservation(
                            $("#paymentReservation")
                                ?.value
                        );

                    if (!reservation) {
                        return;
                    }

                    const remaining =
                        getReservationBalance(
                            reservation
                        );

                    const amount =
                        Number(
                            this.value || 0
                        );

                    this.setCustomValidity(

                        amount >
                        remaining + 0.01

                            ? "Payment cannot exceed the remaining balance."

                            : ""

                    );

                }
            );


        $("#paymentSearch")
            ?.addEventListener(
                "input",
                function () {

                    renderPayments(
                        this.value
                    );

                }
            );


        $("#closeReceiptModal")
            ?.addEventListener(
                "click",
                closeReceipt
            );


        $("#closeReceiptButton")
            ?.addEventListener(
                "click",
                closeReceipt
            );


        $("#printReceipt")
            ?.addEventListener(
                "click",
                printReceipt
            );


        $("#paymentsTableBody")
            ?.addEventListener(
                "click",
                function (event) {

                    const button =
                        event.target.closest(
                            "button[data-action]"
                        );

                    if (!button) {
                        return;
                    }


                    const action =
                        button.dataset.action;

                    const paymentId =
                        button.dataset.paymentId;


                    if (
                        action ===
                        "receipt"
                    ) {

                        const payment =
                            state.payments.find(
                                item =>
                                    Number(item.id) ===
                                    Number(paymentId)
                            );

                        if (payment) {

                            showReceipt(
                                payment
                            );

                        }

                        return;

                    }


                    if (
                        action ===
                        "ledger"
                    ) {

                        /*
                         * EXTRA FRONT-END CHECK.
                         *
                         * If the button is already disabled,
                         * do nothing.
                         */
                        if (
                            button.disabled ||
                            postingLocks.has(
                                String(paymentId)
                            )
                        ) {

                            return;

                        }


                        retryLedger(
                            paymentId
                        );

                    }

                }
            );


        $("#paymentModal")
            ?.addEventListener(
                "click",
                function (event) {

                    if (
                        event.target ===
                        this
                    ) {

                        closePaymentModal();

                    }

                }
            );


        $("#receiptModal")
            ?.addEventListener(
                "click",
                function (event) {

                    if (
                        event.target ===
                        this
                    ) {

                        closeReceipt();

                    }

                }
            );

    }


    /* =========================================================
       INITIALIZE
    ========================================================= */

    async function initialize() {

        if (state.initialized) {
            return;
        }

        state.initialized = true;

        setupEvents();

        await loadPayments();

    }


    /* =========================================================
       PUBLIC API
    ========================================================= */

    window.EDUTECH_PAYMENTS = {

        loadPayments,

        refresh:
            loadPayments,

        renderPayments,

        showReceipt,

        retryLedger,

        getPaymentNumber,

        getReservationBalance,

        calculateVAT,

        verifyPaymentLedger,

        getFinancialPaymentReference,

        state

    };


    /* =========================================================
       DOM READY
    ========================================================= */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            {
                once: true
            }
        );

    } else {

        initialize();

    }


})();