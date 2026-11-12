/* =========================================================
   EDU TECH HOTEL MANAGEMENT SYSTEM
   PAYMENTS.JS
   VERSION: 2026.11.12.06

   PURPOSE
   ---------------------------------------------------------
   - Load hotel payments
   - Record guest payments
   - Calculate reservation balances
   - VAT @ 16%
   - Post payment to financial ledger
   - Verify ledger posting
   - Prevent duplicate ledger posting
   - Retry failed ledger posting
   - Payment receipt
   - Print receipt
   - Hotel-specific filtering
   - Strong hotel ID resolution
   - Robust ledger verification
   ========================================================= */

(function () {

    "use strict";

    const VAT_RATE = 0.16;
    const LOAD_TIMEOUT = 15000;

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

    /* =====================================================
       DOM
    ===================================================== */

    function $(selector) {
        return document.querySelector(selector);
    }

    function money(value) {

        const number = Number(value || 0);

        return "KSh " + number.toLocaleString(
            "en-KE",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        );

    }

    function escapeHtml(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }

    function normalize(value) {

        return String(value ?? "")
            .trim()
            .toLowerCase();

    }

    /* =====================================================
       SUPABASE
    ===================================================== */

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

    /* =====================================================
       TIMEOUT
    ===================================================== */

    function withTimeout(
        promise,
        milliseconds = LOAD_TIMEOUT
    ) {

        return Promise.race([

            promise,

            new Promise((_, reject) => {

                setTimeout(() => {

                    reject(
                        new Error(
                            "The database request timed out."
                        )
                    );

                }, milliseconds);

            })

        ]);

    }

    /* =====================================================
       STORAGE
    ===================================================== */

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

            } catch (error) {

                console.warn(
                    "Session storage read failed:",
                    error
                );

            }

            try {

                const localValue =
                    localStorage.getItem(key);

                if (
                    localValue !== null &&
                    localValue !== ""
                ) {

                    return localValue;

                }

            } catch (error) {

                console.warn(
                    "Local storage read failed:",
                    error
                );

            }

        }

        return null;

    }

    /* =====================================================
       HOTEL ID
    ===================================================== */

    function normalizeHotelId(value) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {

            return null;

        }

        const number =
            Number(value);

        if (
            !Number.isFinite(number) ||
            number <= 0
        ) {

            return null;

        }

        return number;

    }

    function persistHotelId(hotelId) {

        const id =
            normalizeHotelId(
                hotelId
            );

        if (!id) {

            return;

        }

        try {

            sessionStorage.setItem(
                "hotelId",
                String(id)
            );

            sessionStorage.setItem(
                "hotel_id",
                String(id)
            );

            sessionStorage.setItem(
                "currentHotelId",
                String(id)
            );

        } catch (error) {

            console.warn(
                "Unable to save hotel ID:",
                error
            );

        }

    }

    async function resolveHotelId(
        suppliedHotelId = null
    ) {

        const explicitId =
            normalizeHotelId(
                suppliedHotelId
            );

        if (explicitId) {

            state.hotelId =
                explicitId;

            persistHotelId(
                explicitId
            );

            return explicitId;

        }

        const stateId =
            normalizeHotelId(
                state.hotelId
            );

        if (stateId) {

            persistHotelId(
                stateId
            );

            return stateId;

        }

        const storedHotelId =
            getStoredValue([

                "hotelId",
                "hotel_id",
                "currentHotelId",
                "current_hotel_id",
                "selectedHotelId",
                "selected_hotel_id",
                "authenticatedHotelId",
                "authenticated_hotel_id"

            ]);

        const storedId =
            normalizeHotelId(
                storedHotelId
            );

        if (storedId) {

            state.hotelId =
                storedId;

            persistHotelId(
                storedId
            );

            return storedId;

        }

        try {

            const supabase =
                getSupabase();

            if (
                supabase.auth &&
                typeof supabase.auth.getUser ===
                "function"
            ) {

                const authResult =
                    await withTimeout(
                        supabase.auth.getUser()
                    );

                const user =
                    authResult?.data?.user;

                if (user?.id) {

                    const profileResult =
                        await withTimeout(

                            supabase
                                .from("profiles")
                                .select("hotel_id")
                                .eq(
                                    "id",
                                    user.id
                                )
                                .maybeSingle()

                        );

                    if (
                        !profileResult.error &&
                        profileResult.data
                    ) {

                        const profileHotelId =
                            normalizeHotelId(
                                profileResult
                                    .data
                                    .hotel_id
                            );

                        if (profileHotelId) {

                            state.hotelId =
                                profileHotelId;

                            persistHotelId(
                                profileHotelId
                            );

                            return profileHotelId;

                        }

                    }

                }

            }

        } catch (error) {

            console.warn(
                "Authenticated hotel lookup failed:",
                error
            );

        }

        const userId =
            getStoredValue([

                "authenticatedUserId",
                "userId",
                "user_id",
                "currentUserId",
                "current_user_id"

            ]);

        if (userId) {

            try {

                const supabase =
                    getSupabase();

                const result =
                    await withTimeout(

                        supabase
                            .from("profiles")
                            .select("hotel_id")
                            .eq(
                                "id",
                                userId
                            )
                            .maybeSingle()

                    );

                if (
                    !result.error &&
                    result.data
                ) {

                    const profileHotelId =
                        normalizeHotelId(
                            result.data.hotel_id
                        );

                    if (profileHotelId) {

                        state.hotelId =
                            profileHotelId;

                        persistHotelId(
                            profileHotelId
                        );

                        return profileHotelId;

                    }

                }

            } catch (error) {

                console.warn(
                    "Legacy hotel lookup failed:",
                    error
                );

            }

        }

        return null;

    }

    /* =====================================================
       LOAD HOTEL
    ===================================================== */

    async function loadHotel() {

        if (!state.hotelId) {

            return null;

        }

        try {

            const supabase =
                getSupabase();

            const result =
                await withTimeout(

                    supabase
                        .from("hotels")
                        .select("*")
                        .eq(
                            "id",
                            state.hotelId
                        )
                        .maybeSingle()

                );

            if (result.error) {

                console.warn(
                    "Hotel loading error:",
                    result.error
                );

                return null;

            }

            state.hotel =
                result.data || null;

            return state.hotel;

        } catch (error) {

            console.warn(
                "Hotel loading failed:",
                error
            );

            return null;

        }

    }

    /* =====================================================
       SAFE TABLE LOAD
    ===================================================== */

    async function safeLoadTable(
        tableName,
        hotelId
    ) {

        try {

            const supabase =
                getSupabase();

            let query =
                supabase
                    .from(tableName)
                    .select("*");

            if (hotelId) {

                query =
                    query.eq(
                        "hotel_id",
                        hotelId
                    );

            }

            const result =
                await withTimeout(
                    query
                );

            if (result.error) {

                console.warn(
                    `Unable to load ${tableName}:`,
                    result.error
                );

                return [];

            }

            return result.data || [];

        } catch (error) {

            console.warn(
                `Failed loading ${tableName}:`,
                error
            );

            return [];

        }

    }

    /* =====================================================
       LOAD PAYMENTS
    ===================================================== */

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

            const [
                reservations,
                guests,
                rooms
            ] = await Promise.all([

                safeLoadTable(
                    "reservations",
                    hotelId
                ),

                safeLoadTable(
                    "guests",
                    hotelId
                ),

                safeLoadTable(
                    "rooms",
                    hotelId
                )

            ]);

            state.reservations =
                reservations;

            state.guests =
                guests;

            state.rooms =
                rooms;

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
                        <td colspan="10" class="error-row">

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

    /* =====================================================
       RECORD FINDERS
    ===================================================== */

    function getReservation(id) {

        return state.reservations.find(
            item =>
                Number(item.id) ===
                Number(id)
        ) || null;

    }

    function getReservationGuestId(
        reservation
    ) {

        if (!reservation) {

            return null;

        }

        return (

            reservation.guest_id ??

            reservation["guest id"] ??

            reservation["guest_id"] ??

            reservation["guest   id"] ??

            reservation.guestId ??

            reservation.guest ??

            null

        );

    }

    function getReservationRoomId(
        reservation
    ) {

        if (!reservation) {

            return null;

        }

        return (

            reservation.room_id ??

            reservation["room id"] ??

            reservation["room_id"] ??

            reservation["room   id"] ??

            reservation.roomId ??

            reservation.room ??

            null

        );

    }

    function getGuest(id) {

        if (
            id === null ||
            id === undefined ||
            id === ""
        ) {

            return null;

        }

        return state.guests.find(
            item =>
                Number(item.id) ===
                Number(id)
        ) || null;

    }

    function getRoom(id) {

        if (
            id === null ||
            id === undefined ||
            id === ""
        ) {

            return null;

        }

        return state.rooms.find(
            item =>
                Number(item.id) ===
                Number(id)
        ) || null;

    }

    function getGuestFromReservation(
        reservation
    ) {

        return getGuest(
            getReservationGuestId(
                reservation
            )
        );

    }

    function getRoomFromReservation(
        reservation
    ) {

        return getRoom(
            getReservationRoomId(
                reservation
            )
        );

    }

    /* =====================================================
       DISPLAY HELPERS
    ===================================================== */

    function getGuestName(guest) {

        if (!guest) {

            return "Walk-in / Unknown Guest";

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

            `Guest #${guest.id}`

        );

    }

    function getGuestIdPassport(guest) {

        if (!guest) {

            return "—";

        }

        return (

            guest.id_passport_number ||

            guest["id_passport_number"] ||

            guest["id/passport"] ||

            guest.id_number ||

            guest.passport_number ||

            "—"

        );

    }

    function getRoomName(room) {

        if (!room) {

            return "—";

        }

        return (

            room.room_number ||

            room["room number"] ||

            room.number ||

            room.name ||

            `Room #${room.id}`

        );

    }

    function getPaymentNumber(payment) {

        if (!payment) {

            return "—";

        }

        return (

            payment.payment_number ||

            payment.receipt_number ||

            payment.reference_number ||

            (
                payment.id
                    ? "PAY-" +
                      new Date(
                          payment.created_at ||
                          Date.now()
                      )
                          .getFullYear() +
                      "-" +
                      String(payment.id)
                          .padStart(6, "0")
                    : "PAYMENT"
            )

        );

    }

    function formatDate(value) {

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

    /* =====================================================
       RESERVATION TOTAL
    ===================================================== */

    function getReservationTotal(
        reservation
    ) {

        if (!reservation) {

            return 0;

        }

        const possibleValues = [

            reservation.grand_total,

            reservation.total_amount,

            reservation.total,

            reservation.amount

        ];

        for (
            const value of possibleValues
        ) {

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

    /* =====================================================
       PREVIOUS PAYMENTS
    ===================================================== */

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
                    Number(reservationId)
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

    /* =====================================================
       BALANCE
    ===================================================== */

    function getReservationBalance(
        reservation
    ) {

        if (!reservation) {

            return 0;

        }

        const total =
            getReservationTotal(
                reservation
            );

        const paid =
            getPreviousPayments(
                reservation.id
            );

        return Math.max(
            0,
            total - paid
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

        const total =
            getReservationTotal(
                reservation
            );

        const paidBefore =
            getPreviousPayments(
                payment.reservation_id,
                payment.id
            );

        const current =
            Number(
                payment.amount || 0
            );

        return Math.max(
            0,
            total -
            paidBefore -
            current
        );

    }

    /* =====================================================
       PAYMENT STATUS
    ===================================================== */

    function getPaymentStatus(payment) {

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

            return "No Charge";

        }

        if (paid >= total) {

            return "Paid";

        }

        if (paid > 0) {

            return "Part Paid";

        }

        return "Pending";

    }

    function getStatusHtml(status) {

        const normalized =
            normalize(status);

        if (
            normalized === "paid"
        ) {

            return `
                <span class="status-badge status-paid">
                    Paid
                </span>
            `;

        }

        if (
            normalized === "part paid"
        ) {

            return `
                <span class="status-badge status-part">
                    Part Paid
                </span>
            `;

        }

        if (
            normalized === "no charge"
        ) {

            return `
                <span class="status-badge status-nocharge">
                    No Charge
                </span>
            `;

        }

        return `
            <span class="status-badge status-pending">
                ${escapeHtml(status)}
            </span>
        `;

    }

    /* =====================================================
       RENDER
    ===================================================== */

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

                        const searchableText = [

                            getPaymentNumber(
                                payment
                            ),

                            payment.id,

                            payment.reservation_id,

                            getGuestName(
                                guest
                            ),

                            getGuestIdPassport(
                                guest
                            ),

                            getRoomName(
                                room
                            ),

                            payment.payment_method,

                            payment.payment_date,

                            payment.created_at,

                            payment.amount,

                            getReservationTotal(
                                reservation
                            ),

                            getPaymentStatus(
                                payment
                            )

                        ]
                            .filter(
                                value =>
                                    value !== null &&
                                    value !== undefined
                            )
                            .join(" ");

                        return normalize(
                            searchableText
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
                    <td colspan="10" class="empty-row">
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
                .map(
                    renderPaymentRow
                )
                .join("");

    }

    function renderPaymentRow(
        payment
    ) {

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

        const reservationTotal =
            getReservationTotal(
                reservation
            );

        const paymentAmount =
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

        return `
            <tr>

                <td>
                    <strong>
                        ${escapeHtml(
                            getPaymentNumber(
                                payment
                            )
                        )}
                    </strong>
                </td>

                <td>
                    ${escapeHtml(
                        getGuestName(
                            guest
                        )
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        getRoomName(
                            room
                        )
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
                    ${money(
                        reservationTotal
                    )}
                </td>

                <td>
                    <strong>
                        ${money(
                            paymentAmount
                        )}
                    </strong>
                </td>

                <td>
                    ${money(
                        balance
                    )}
                </td>

                <td>
                    ${getStatusHtml(
                        status
                    )}
                </td>

                <td>

                    <div class="action-buttons">

                        <button
                            type="button"
                            class="btn-primary"
                            data-action="receipt"
                            data-payment-id="${payment.id}">
                            Receipt
                        </button>

                        <button
                            type="button"
                            class="btn-warning"
                            data-action="ledger"
                            data-payment-id="${payment.id}">
                            Ledger
                        </button>

                    </div>

                </td>

            </tr>
        `;

    }

    /* =====================================================
       SUMMARY
    ===================================================== */

    function updateSummary() {

        const totalPayments =
            state.payments.reduce(
                (
                    total,
                    payment
                ) =>
                    total +
                    Number(
                        payment.amount || 0
                    ),
                0
            );

        const outstanding =
            state.reservations.reduce(
                (
                    total,
                    reservation
                ) =>
                    total +
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
                money(
                    totalPayments
                );

        }

        if (countElement) {

            countElement.textContent =
                String(
                    state.payments.length
                );

        }

        if (outstandingElement) {

            outstandingElement.textContent =
                money(
                    outstanding
                );

        }

    }

    /* =====================================================
       VAT
    ===================================================== */

    function calculateVAT(
        grossAmount
    ) {

        const gross =
            Number(
                grossAmount || 0
            );

        const subtotal =
            gross /
            (1 + VAT_RATE);

        const vat =
            gross -
            subtotal;

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

    /* =====================================================
       FINANCIAL ENGINE
    ===================================================== */

    async function waitForFinancialEngine(
        timeout = 10000
    ) {

        if (
            window.EDUTECH_FINANCIAL_ENGINE &&
            typeof
                window.EDUTECH_FINANCIAL_ENGINE
                    .postPayment ===
                "function"
        ) {

            return true;

        }

        return new Promise(
            (
                resolve,
                reject
            ) => {

                let finished = false;

                const cleanup = () => {

                    window.removeEventListener(
                        "edutech:financial-engine-ready",
                        onReady
                    );

                };

                const onReady = () => {

                    if (finished) {

                        return;

                    }

                    finished = true;

                    cleanup();

                    resolve(true);

                };

                window.addEventListener(
                    "edutech:financial-engine-ready",
                    onReady
                );

                setTimeout(
                    () => {

                        if (finished) {

                            return;

                        }

                        finished = true;

                        cleanup();

                        if (
                            window.EDUTECH_FINANCIAL_ENGINE &&
                            typeof
                                window.EDUTECH_FINANCIAL_ENGINE
                                    .postPayment ===
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

    /* =====================================================
       PREPARE PAYMENT FOR ENGINE
    ===================================================== */

    async function preparePaymentForLedger(
        payment,
        suppliedHotelId = null
    ) {

        if (!payment) {

            throw new Error(
                "A valid payment record is required."
            );

        }

        const paymentHotelId =
            normalizeHotelId(
                payment.hotelId
            ) ||
            normalizeHotelId(
                payment.hotel_id
            ) ||
            normalizeHotelId(
                suppliedHotelId
            );

        const hotelId =
            await resolveHotelId(
                paymentHotelId
            );

        if (!hotelId) {

            throw new Error(
                "A valid hotel id is required."
            );

        }

        return {

            payment: {

                ...payment,

                hotelId:
                    Number(
                        hotelId
                    ),

                hotel_id:
                    Number(
                        hotelId
                    ),

                paymentId:
                    Number(
                        payment.id
                    ),

                payment_id:
                    Number(
                        payment.id
                    )

            },

            hotelId:
                Number(
                    hotelId
                )

        };

    }

    /* =====================================================
       VERIFY PAYMENT LEDGER
       -----------------------------------------------------
       IMPORTANT:
       We now verify using BOTH payment_id AND the
       transaction-number references generated by the
       financial engine.

       This prevents a false failure when the engine has
       posted successfully but the payment_id field is not
       returned exactly as expected by the client.
       ===================================================== */

    async function verifyPaymentLedger(
        payment
    ) {

        if (!payment?.id) {

            return [];

        }

        const hotelId =
            await resolveHotelId(
                payment.hotelId ||
                payment.hotel_id
            );

        if (!hotelId) {

            throw new Error(
                "A valid hotel id is required to verify the payment ledger."
            );

        }

        const supabase =
            getSupabase();

        /* -------------------------------------------------
           METHOD 1
           payment_id
           ------------------------------------------------- */

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
            paymentIdResult.data?.length
        ) {

            return paymentIdResult.data;

        }

        /* -------------------------------------------------
           METHOD 2
           transaction_number references
           ------------------------------------------------- */

        const paymentId =
            Number(
                payment.id
            );

        const referenceRevenue =
            `PAY-${paymentId}-REV`;

        const referenceVAT =
            `PAY-${paymentId}-VAT`;

        const referenceResult =
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
                    .in(
                        "transaction_number",
                        [
                            referenceRevenue,
                            referenceVAT
                        ]
                    )
                    .order(
                        "id",
                        {
                            ascending: true
                        }
                    )

            );

        if (
            !referenceResult.error &&
            referenceResult.data?.length
        ) {

            return referenceResult.data;

        }

        /* -------------------------------------------------
           METHOD 3
           reference_number fallback
           ------------------------------------------------- */

        const referenceNumberResult =
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
                    .in(
                        "reference_number",
                        [
                            referenceRevenue,
                            referenceVAT
                        ]
                    )
                    .order(
                        "id",
                        {
                            ascending: true
                        }
                    )

            );

        if (
            !referenceNumberResult.error &&
            referenceNumberResult.data?.length
        ) {

            return referenceNumberResult.data;

        }

        /*
         * Return the original payment_id query result
         * if nothing was found.
         */

        return (
            paymentIdResult.data ||
            []
        );

    }

    /* =====================================================
       POST PAYMENT THROUGH ENGINE
       ===================================================== */

    async function postPaymentToLedger(
        payment,
        hotelId
    ) {

        await waitForFinancialEngine();

        const engine =
            window
                .EDUTECH_FINANCIAL_ENGINE;

        if (
            !engine ||
            typeof engine.postPayment !==
            "function"
        ) {

            throw new Error(
                "Financial engine is not available."
            );

        }

        const prepared =
            await preparePaymentForLedger(
                payment,
                hotelId
            );

        console.log(
            "EDU TECH PAYMENT LEDGER POST:",
            {
                paymentId:
                    prepared.payment.paymentId,

                payment_id:
                    prepared.payment.payment_id,

                hotelId:
                    prepared.payment.hotelId,

                hotel_id:
                    prepared.payment.hotel_id,

                amount:
                    prepared.payment.amount,

                paymentMethod:
                    prepared.payment.payment_method
            }
        );

        await engine.postPayment(
            prepared.payment
        );

        return prepared;

    }

    /* =====================================================
       SAVE PAYMENT
    ===================================================== */

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

        const reservationTotal =
            getReservationTotal(
                reservation
            );

        const previousPaid =
            getPreviousPayments(
                reservation.id
            );

        const remaining =
            Math.max(
                0,
                reservationTotal -
                previousPaid
            );

        if (remaining <= 0) {

            alert(
                "This reservation is already fully paid."
            );

            return;

        }

        if (
            amount >
            remaining + 0.01
        ) {

            alert(
                "Payment cannot be greater than the remaining reservation balance.\n\n" +
                "Remaining balance: " +
                money(remaining) +
                "\nEntered payment: " +
                money(amount)
            );

            return;

        }

        const saveButton =
            $("#savePayment");

        if (saveButton) {

            saveButton.disabled = true;

            saveButton.textContent =
                "Saving...";

        }

        try {

            const supabase =
                getSupabase();

            const hotelId =
                await resolveHotelId();

            if (!hotelId) {

                throw new Error(
                    "A valid hotel id is required."
                );

            }

            const paymentData = {

                reservation_id:
                    Number(
                        reservation.id
                    ),

                amount:
                    Number(
                        amount.toFixed(2)
                    ),

                payment_method:
                    paymentMethod,

                payment_date:
                    paymentDate,

                hotel_id:
                    Number(
                        hotelId
                    )

            };

            const result =
                await withTimeout(

                    supabase
                        .from("payments")
                        .insert(
                            paymentData
                        )
                        .select("*")
                        .single()

                );

            if (result.error) {

                throw result.error;

            }

            const savedPayment =
                result.data;

            state.payments.unshift(
                savedPayment
            );

            let ledgerEntries = [];

            try {

                await postPaymentToLedger(
                    savedPayment,
                    hotelId
                );

                ledgerEntries =
                    await verifyPaymentLedger(
                        savedPayment
                    );

                if (!ledgerEntries.length) {

                    throw new Error(
                        "Payment was saved, but no financial ledger entry was found."
                    );

                }

            } catch (ledgerError) {

                console.error(
                    "PAYMENT LEDGER ERROR:",
                    ledgerError
                );

                closePaymentModal();

                $("#paymentForm")?.reset();

                updateSummary();

                renderPayments(
                    $("#paymentSearch")?.value || ""
                );

                populateReservationSelector();

                alert(
                    "Payment was saved successfully, but financial posting failed.\n\n" +
                    "Payment ID: " +
                    savedPayment.id +
                    "\n\nReason:\n" +
                    (
                        ledgerError.message ||
                        "Unknown ledger error."
                    ) +
                    "\n\n" +
                    "DO NOT enter this payment again.\n" +
                    "Use the Ledger button to retry."
                );

                return;

            }

            closePaymentModal();

            $("#paymentForm")?.reset();

            updateSummary();

            renderPayments(
                $("#paymentSearch")?.value || ""
            );

            populateReservationSelector();

            updatePaymentBalance();

            alert(
                "Payment saved and posted successfully.\n\n" +
                "Payment: " +
                getPaymentNumber(
                    savedPayment
                ) +
                "\nAmount: " +
                money(amount) +
                "\n\n" +
                "Financial ledger entries created: " +
                ledgerEntries.length
            );

            await showReceipt(
                savedPayment
            );

        } catch (error) {

            console.error(
                "SAVE PAYMENT ERROR:",
                error
            );

            alert(
                "Payment could not be saved.\n\n" +
                (
                    error.message ||
                    "Unknown error."
                )
            );

        } finally {

            if (saveButton) {

                saveButton.disabled = false;

                saveButton.textContent =
                    "Save Payment";

            }

        }

    }

    /* =====================================================
       RETRY LEDGER
       ===================================================== */

    async function retryLedger(
        paymentId
    ) {

        try {

            const resolvedHotelId =
                await resolveHotelId();

            if (!resolvedHotelId) {

                throw new Error(
                    "A valid hotel id is required."
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
                            resolvedHotelId
                        )
                        .maybeSingle()

                );

            if (result.error) {

                throw result.error;

            }

            if (!result.data) {

                throw new Error(
                    "Payment record was not found for the current hotel."
                );

            }

            const payment =
                result.data;

            const paymentHotelId =
                normalizeHotelId(
                    payment.hotel_id
                );

            if (!paymentHotelId) {

                throw new Error(
                    "This payment does not contain a valid hotel id."
                );

            }

            if (
                Number(paymentHotelId) !==
                Number(resolvedHotelId)
            ) {

                throw new Error(
                    "The payment belongs to a different hotel."
                );

            }

            /* ---------------------------------------------
               Check existing ledger first
               --------------------------------------------- */

            const existing =
                await verifyPaymentLedger(
                    payment
                );

            if (existing.length) {

                alert(
                    "This payment is already posted to the financial ledger.\n\n" +
                    "Ledger entries found: " +
                    existing.length
                );

                return;

            }

            /* ---------------------------------------------
               Post to financial engine
               --------------------------------------------- */

            const prepared =
                await postPaymentToLedger(
                    payment,
                    paymentHotelId
                );

            /* ---------------------------------------------
               Verify using all supported identifiers
               --------------------------------------------- */

            const verified =
                await verifyPaymentLedger(
                    prepared.payment
                );

            if (!verified.length) {

                /*
                 * One final diagnostic query.
                 * This does not create anything.
                 * It simply checks the most recent transactions
                 * for this hotel so we can detect whether the
                 * engine posted something under another reference.
                 */

                const diagnosticResult =
                    await withTimeout(

                        supabase
                            .from(
                                "financial_transactions"
                            )
                            .select(
                                "id,hotel_id,transaction_number,reference_number,transaction_type,amount,payment_id,is_reversal,description,created_at"
                            )
                            .eq(
                                "hotel_id",
                                paymentHotelId
                            )
                            .order(
                                "id",
                                {
                                    ascending: false
                                }
                            )
                            .limit(10)

                    );

                console.error(
                    "PAYMENT LEDGER DIAGNOSTIC:",
                    {
                        payment,
                        preparedPayment:
                            prepared.payment,
                        recentTransactions:
                            diagnosticResult.data || [],
                        diagnosticError:
                            diagnosticResult.error || null
                    }
                );

                throw new Error(
                    "The financial engine returned, but no payment ledger entry was found for Payment ID " +
                    payment.id +
                    "."
                );

            }

            alert(
                "Payment successfully posted to the financial ledger.\n\n" +
                "Payment: " +
                getPaymentNumber(
                    payment
                ) +
                "\nHotel ID: " +
                paymentHotelId +
                "\nLedger entries: " +
                verified.length
            );

            await loadPayments();

        } catch (error) {

            console.error(
                "PAYMENT LEDGER RETRY ERROR:",
                error
            );

            alert(
                "The payment could not be posted.\n\n" +
                (
                    error.message ||
                    "Unknown error."
                )
            );

        }

    }

    /* =====================================================
       RESERVATION SELECTOR
    ===================================================== */

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

        const available =
            state.reservations.filter(
                reservation =>
                    getReservationBalance(
                        reservation
                    ) > 0
            );

        available.forEach(
            reservation => {

                const guest =
                    getGuestFromReservation(
                        reservation
                    );

                const room =
                    getRoomFromReservation(
                        reservation
                    );

                const total =
                    getReservationTotal(
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
                    String(
                        reservation.id
                    );

                option.textContent =
                    `Reservation #${reservation.id} - ` +
                    `${getGuestName(guest)} - ` +
                    `${getRoomName(room)} - ` +
                    `Total ${money(total)} - ` +
                    `Balance ${money(balance)}`;

                select.appendChild(
                    option
                );

            }
        );

        if (
            previousValue &&
            available.some(
                reservation =>
                    String(
                        reservation.id
                    ) ===
                    previousValue
            )
        ) {

            select.value =
                previousValue;

        }

    }

    /* =====================================================
       BALANCE DISPLAY
    ===================================================== */

    function updatePaymentBalance() {

        const select =
            $("#paymentReservation");

        const balanceBox =
            $("#paymentBalance");

        if (
            !select ||
            !balanceBox
        ) {

            return;

        }

        const reservation =
            getReservation(
                select.value
            );

        if (!reservation) {

            balanceBox.innerHTML = `
                Remaining balance:
                <strong>KSh 0.00</strong>
            `;

            return;

        }

        const total =
            getReservationTotal(
                reservation
            );

        const paid =
            getPreviousPayments(
                reservation.id
            );

        const balance =
            Math.max(
                0,
                total - paid
            );

        balanceBox.innerHTML = `
            Reservation Total:
            <strong>${money(total)}</strong>

            <br>

            Already Paid:
            <strong>${money(paid)}</strong>

            <br>

            Remaining Balance:
            <strong>${money(balance)}</strong>
        `;

    }

    /* =====================================================
       PAYMENT MODAL
    ===================================================== */

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

            dateInput.value =
                new Date()
                    .toISOString()
                    .split("T")[0];

        }

        const amountInput =
            $("#paymentAmount");

        if (amountInput) {

            amountInput.setCustomValidity(
                ""
            );

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

    /* =====================================================
       RECEIPT
    ===================================================== */

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

        if (
            !modal ||
            !body
        ) {

            return;

        }

        if (!state.hotel) {

            await loadHotel();

        }

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

        const total =
            getReservationTotal(
                reservation
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

        const totalPaid =
            paidBefore +
            currentPayment;

        const balance =
            Math.max(
                0,
                total -
                totalPaid
            );

        const vat =
            calculateVAT(
                currentPayment
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

        const hotelEmail =
            hotel.email ||
            hotel.email_address ||
            "";

        const guestName =
            getGuestName(
                guest
            );

        const guestIdPassport =
            getGuestIdPassport(
                guest
            );

        const roomNumber =
            getRoomName(
                room
            );

        body.innerHTML = `

            <div class="receipt">

                <div class="receipt-header">

                    <h2>
                        ${escapeHtml(
                            hotelName
                        )}
                    </h2>

                    <p>
                        ${escapeHtml(
                            hotelLocation
                        )}
                    </p>

                    <p>
                        Tel:
                        ${escapeHtml(
                            hotelPhone
                        )}
                    </p>

                    ${
                        hotelEmail
                            ? `
                                <p>
                                    ${escapeHtml(
                                        hotelEmail
                                    )}
                                </p>
                            `
                            : ""
                    }

                    <hr>

                    <h3>
                        PAYMENT RECEIPT
                    </h3>

                    <p>
                        Receipt No:
                        <strong>
                            ${escapeHtml(
                                getPaymentNumber(
                                    payment
                                )
                            )}
                        </strong>
                    </p>

                    <p>
                        Date:
                        ${escapeHtml(
                            formatDate(
                                payment.payment_date ||
                                payment.created_at
                            )
                        )}
                    </p>

                </div>

                <table class="receipt-table">

                    <tr>
                        <td>Guest</td>
                        <td>
                            ${escapeHtml(
                                guestName
                            )}
                        </td>
                    </tr>

                    <tr>
                        <td>ID / Passport</td>
                        <td>
                            ${escapeHtml(
                                guestIdPassport
                            )}
                        </td>
                    </tr>

                    <tr>
                        <td>Room Number</td>
                        <td>
                            ${escapeHtml(
                                roomNumber
                            )}
                        </td>
                    </tr>

                    <tr>
                        <td>Reservation</td>
                        <td>
                            #${escapeHtml(
                                payment.reservation_id
                            )}
                        </td>
                    </tr>

                    <tr>
                        <td>Payment Method</td>
                        <td>
                            ${escapeHtml(
                                String(
                                    payment.payment_method ||
                                    ""
                                ).toUpperCase()
                            )}
                        </td>
                    </tr>

                    <tr>
                        <td>Reservation Total</td>
                        <td>
                            ${money(total)}
                        </td>
                    </tr>

                    <tr>
                        <td>Previous Payments</td>
                        <td>
                            ${money(paidBefore)}
                        </td>
                    </tr>

                    <tr>
                        <td>Current Payment</td>
                        <td>
                            ${money(currentPayment)}
                        </td>
                    </tr>

                    <tr>
                        <td>Amount Before VAT</td>
                        <td>
                            ${money(
                                vat.subtotal
                            )}
                        </td>
                    </tr>

                    <tr>
                        <td>VAT @ 16%</td>
                        <td>
                            ${money(
                                vat.vat
                            )}
                        </td>
                    </tr>

                    <tr class="receipt-total">
                        <td>Current Payment Total</td>
                        <td>
                            ${money(
                                vat.gross
                            )}
                        </td>
                    </tr>

                    <tr class="receipt-total">
                        <td>Total Paid To Date</td>
                        <td>
                            ${money(
                                totalPaid
                            )}
                        </td>
                    </tr>

                    <tr>
                        <td>Outstanding Balance</td>
                        <td>
                            ${money(
                                balance
                            )}
                        </td>
                    </tr>

                </table>

                <br>

                <p style="text-align:center;">
                    Thank you for your payment.
                </p>

                <p style="text-align:center;font-size:12px;">
                    Generated by EDU TECH Hotel Management System
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

    /* =====================================================
       EVENTS
    ===================================================== */

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

                    const amountInput =
                        $("#paymentAmount");

                    if (amountInput) {

                        amountInput.setCustomValidity(
                            ""
                        );

                    }

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

                        this.setCustomValidity(
                            ""
                        );

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
                        amount > remaining
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

                    }

                    if (
                        action ===
                        "ledger"
                    ) {

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
                        event.target === this
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
                        event.target === this
                    ) {

                        closeReceipt();

                    }

                }
            );

    }

    /* =====================================================
       INITIALIZE
    ===================================================== */

    async function initialize() {

        if (state.initialized) {

            return;

        }

        state.initialized = true;

        setupEvents();

        let attempts = 0;

        while (
            attempts < 50 &&
            !window.supabaseClient
        ) {

            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        100
                    )
            );

            attempts++;

        }

        await loadPayments();

    }

    /* =====================================================
       PUBLIC API
    ===================================================== */

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

        resolveHotelId,

        preparePaymentForLedger,

        postPaymentToLedger,

        state

    };

    /* =====================================================
       DOM READY
    ===================================================== */

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