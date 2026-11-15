/* =========================================================
   EDU TECH HOTEL MANAGEMENT SYSTEM
   PAYMENTS.JS
   VERSION: 2026.11.15.02

   PURPOSE
   ---------------------------------------------------------
   - Load hotel payments
   - Trace payment -> reservation -> guest
   - Trace payment -> reservation -> room
   - Preserve historical checked-out payments
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

        const number =
            Number(value || 0);

        return "KSh " +
            number.toLocaleString(
                "en-KE",
                {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }
            );

    }


    /* =========================================================
       HTML ESCAPE
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
       COLUMN NORMALIZE
    ========================================================= */

    function normalizeColumnName(value) {

        return String(value || "")
            .toLowerCase()
            .replace(
                /[\s_-]/g,
                ""
            );

    }


    /* =========================================================
       FIND COLUMN
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

        for (
            const candidate of candidates
        ) {

            const exact =
                keys.find(
                    function (key) {

                        return key === candidate;

                    }
                );

            if (exact) {

                return exact;

            }

        }

        const normalizedKeys =
            keys.map(
                function (key) {

                    return {

                        key: key,

                        normalized:
                            normalizeColumnName(
                                key
                            )

                    };

                }
            );

        for (
            const candidate of candidates
        ) {

            const normalizedCandidate =
                normalizeColumnName(
                    candidate
                );

            const found =
                normalizedKeys.find(
                    function (item) {

                        return (
                            item.normalized ===
                            normalizedCandidate
                        );

                    }
                );

            if (found) {

                return found.key;

            }

        }

        return null;

    }


    /* =========================================================
       SUPABASE
    ========================================================= */

    function getSupabase() {

        if (
            window.supabaseClient &&
            typeof window.supabaseClient.from ===
            "function"
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

            new Promise(
                function (_, reject) {

                    setTimeout(
                        function () {

                            reject(
                                new Error(
                                    "The database request timed out."
                                )
                            );

                        },
                        milliseconds
                    );

                }
            )

        ]);

    }


    /* =========================================================
       STORAGE
    ========================================================= */

    function getStoredValue(keys) {

        for (
            const key of keys
        ) {

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


    /* =========================================================
       HOTEL ID
    ========================================================= */

    async function resolveHotelId() {

        const storedHotelId =
            getStoredValue([

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

            const id =
                Number(storedHotelId);

            if (
                Number.isFinite(id) &&
                id > 0
            ) {

                state.hotelId =
                    id;

                return id;

            }

        }

        const userId =
            getStoredValue([

                "authenticatedUserId",
                "userId",
                "user_id",
                "currentUserId"

            ]);

        if (!userId) {

            return null;

        }

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

        if (result.error) {

            throw result.error;

        }

        if (
            result.data &&
            result.data.hotel_id
        ) {

            const hotelId =
                Number(
                    result.data.hotel_id
                );

            state.hotelId =
                hotelId;

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


    /* =========================================================
       LOAD TABLE
    ========================================================= */

    async function loadTable(
        tableName,
        hotelId
    ) {

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
            await withTimeout(query);

        if (result.error) {

            console.error(
                "Unable to load " +
                tableName +
                ":",
                result.error
            );

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


            /* =================================================
               PAYMENTS
            ================================================= */

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


            /* =================================================
               RESERVATIONS

               NO STATUS FILTER.

               Checked-out reservations must remain available
               for historical payment tracing.
            ================================================= */

            let reservations = [];

            try {

                reservations =
                    await loadTable(
                        "reservations",
                        hotelId
                    );

            } catch (reservationError) {

                console.warn(
                    "Bulk reservation loading failed. " +
                    "Specific payment reservations will be loaded.",
                    reservationError
                );

                reservations = [];

            }


            /* =================================================
               GUESTS
            ================================================= */

            let guests = [];

            try {

                guests =
                    await loadTable(
                        "guests",
                        hotelId
                    );

            } catch (guestError) {

                console.warn(
                    "Bulk guest loading failed. " +
                    "Specific guests will be loaded.",
                    guestError
                );

                guests = [];

            }


            /* =================================================
               ROOMS
            ================================================= */

            let rooms = [];

            try {

                rooms =
                    await loadTable(
                        "rooms",
                        hotelId
                    );

            } catch (roomError) {

                console.warn(
                    "Room loading failed.",
                    roomError
                );

                rooms = [];

            }


            state.reservations =
                reservations;

            state.guests =
                guests;

            state.rooms =
                rooms;


            /* =================================================
               HISTORICAL RECOVERY
            ================================================= */

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
            reservation["guest   id"] ??
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
            reservation["room   id"] ??
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
            function (reservation) {

                return Number(
                    reservation.id
                ) === Number(
                    reservationId
                );

            }
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
            function (guest) {

                return Number(
                    guest.id
                ) === Number(
                    guestId
                );

            }
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
            function (room) {

                return Number(
                    room.id
                ) === Number(
                    roomId
                );

            }
        ) || null;

    }


    /* =========================================================
       GUEST FROM RESERVATION
    ========================================================= */

    function getGuestFromReservation(
        reservation
    ) {

        if (!reservation) {

            return null;

        }

        const guestId =
            getReservationGuestId(
                reservation
            );

        return getGuest(
            guestId
        );

    }


    /* =========================================================
       ROOM FROM RESERVATION
    ========================================================= */

    function getRoomFromReservation(
        reservation
    ) {

        if (!reservation) {

            return null;

        }

        const roomId =
            getReservationRoomId(
                reservation
            );

        return getRoom(
            roomId
        );

    }


    /* =========================================================
       HISTORICAL RELATIONSHIP RECOVERY
    ========================================================= */

    async function recoverPaymentRelationships() {

        const supabase =
            getSupabase();

        if (!state.payments.length) {

            return;

        }


        /* =====================================================
           RESERVATION IDS
        ===================================================== */

        const reservationIds =
            Array.from(

                new Set(

                    state.payments
                        .map(
                            function (payment) {

                                return Number(
                                    payment.reservation_id
                                );

                            }
                        )
                        .filter(
                            function (id) {

                                return (
                                    Number.isFinite(id) &&
                                    id > 0
                                );

                            }
                        )

                )

            );


        if (!reservationIds.length) {

            return;

        }


        /* =====================================================
           MISSING RESERVATIONS
        ===================================================== */

        const missingReservationIds =
            reservationIds.filter(
                function (reservationId) {

                    return !getReservation(
                        reservationId
                    );

                }
            );


        if (
            missingReservationIds.length
        ) {

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
                                missingReservationIds
                            )

                    );

                if (
                    !result.error &&
                    Array.isArray(result.data)
                ) {

                    state.reservations =
                        state.reservations.concat(
                            result.data
                        );

                } else if (result.error) {

                    console.warn(
                        "Historical reservation recovery failed:",
                        result.error
                    );

                }

            } catch (error) {

                console.warn(
                    "Historical reservation recovery failed:",
                    error
                );

            }

        }


        /* =====================================================
           GUEST IDS
        ===================================================== */

        const guestIds =
            Array.from(

                new Set(

                    state.reservations

                        .filter(
                            function (reservation) {

                                return reservationIds.includes(
                                    Number(
                                        reservation.id
                                    )
                                );

                            }
                        )

                        .map(
                            function (reservation) {

                                return Number(
                                    getReservationGuestId(
                                        reservation
                                    )
                                );

                            }
                        )

                        .filter(
                            function (id) {

                                return (
                                    Number.isFinite(id) &&
                                    id > 0
                                );

                            }
                        )

                )

            );


        /* =====================================================
           MISSING GUESTS
        ===================================================== */

        const missingGuestIds =
            guestIds.filter(
                function (guestId) {

                    return !getGuest(
                        guestId
                    );

                }
            );


        if (
            missingGuestIds.length
        ) {

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
                                missingGuestIds
                            )

                    );

                if (
                    !result.error &&
                    Array.isArray(result.data)
                ) {

                    state.guests =
                        state.guests.concat(
                            result.data
                        );

                } else if (result.error) {

                    console.warn(
                        "Historical guest recovery failed:",
                        result.error
                    );

                }

            } catch (error) {

                console.warn(
                    "Historical guest recovery failed:",
                    error
                );

            }

        }


        /* =====================================================
           ROOM IDS
        ===================================================== */

        const roomIds =
            Array.from(

                new Set(

                    state.reservations

                        .filter(
                            function (reservation) {

                                return reservationIds.includes(
                                    Number(
                                        reservation.id
                                    )
                                );

                            }
                        )

                        .map(
                            function (reservation) {

                                return Number(
                                    getReservationRoomId(
                                        reservation
                                    )
                                );

                            }
                        )

                        .filter(
                            function (id) {

                                return (
                                    Number.isFinite(id) &&
                                    id > 0
                                );

                            }
                        )

                )

            );


        /* =====================================================
           MISSING ROOMS
        ===================================================== */

        const missingRoomIds =
            roomIds.filter(
                function (roomId) {

                    return !getRoom(
                        roomId
                    );

                }
            );


        if (
            missingRoomIds.length
        ) {

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
                                missingRoomIds
                            )

                    );

                if (
                    !result.error &&
                    Array.isArray(result.data)
                ) {

                    state.rooms =
                        state.rooms.concat(
                            result.data
                        );

                } else if (result.error) {

                    console.warn(
                        "Historical room recovery failed:",
                        result.error
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
       GUEST NAME
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
                    ? "Guest #" +
                      guest.id
                    : "Guest"
            )
        );

    }


    /* =========================================================
       GUEST ID / PASSPORT
    ========================================================= */

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


    /* =========================================================
       ROOM NAME
    ========================================================= */

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
                    ? "Room #" +
                      room.id
                    : "Room"
            )
        );

    }


    /* =========================================================
       PAYMENT NUMBER
    ========================================================= */

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
                ).padStart(
                    6,
                    "0"
                )
            );

        }

        return "PAYMENT";

    }


    /* =========================================================
       FORMAT DATE
    ========================================================= */

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

        const possibleValues = [

            reservation.grand_total,

            reservation.grandTotal,

            reservation.total_amount,

            reservation.totalAmount,

            reservation.total,

            reservation.amount,

            reservation.booking_total,

            reservation.bookingTotal

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


    /* =========================================================
       PREVIOUS PAYMENTS
    ========================================================= */

    function getPreviousPayments(
        reservationId,
        excludePaymentId = null
    ) {

        return state.payments.reduce(
            function (
                total,
                payment
            ) {

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
                    Number(
                        payment.id
                    ) ===
                    Number(
                        excludePaymentId
                    )
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


    /* =========================================================
       RESERVATION BALANCE
    ========================================================= */

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


    /* =========================================================
       BALANCE FOR PAYMENT
    ========================================================= */

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


    /* =========================================================
       PAYMENT STATUS
    ========================================================= */

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


    /* =========================================================
       STATUS HTML
    ========================================================= */

    function getStatusHtml(
        status
    ) {

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


    /* =========================================================
       RENDER PAYMENTS
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
            normalize(
                searchTerm
            );

        let rows =
            [
                ...state.payments
            ];

        if (search) {

            rows =
                rows.filter(
                    function (payment) {

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
                                function (value) {

                                    return (
                                        value !== null &&
                                        value !== undefined
                                    );

                                }
                            )
                            .join(" ");

                        return normalize(
                            searchableText
                        ).includes(
                            search
                        );

                    }
                );

        }

        const info =
            $("#searchResultInfo");

        if (info) {

            info.textContent =
                search
                    ? (
                        rows.length +
                        " result(s)"
                    )
                    : (
                        rows.length +
                        " payment(s)"
                    );

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
                .map(
                    renderPaymentRow
                )
                .join("");

    }


    /* =========================================================
       PAYMENT ROW
    ========================================================= */

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


        /*
         * Direct payment-level guest fallback.
         */

        if (!guest) {

            const directGuestId =
                payment.guest_id ??
                payment.guestId ??
                payment["guest id"] ??
                payment["guest   id"] ??
                null;

            if (directGuestId) {

                guest =
                    getGuest(
                        directGuestId
                    );

            }

        }


        let guestDisplay =
            getGuestName(
                guest
            );

        if (
            guestDisplay ===
            "Guest record not found"
        ) {

            const directGuestId =
                payment.guest_id ??
                payment.guestId ??
                null;

            if (directGuestId) {

                guestDisplay =
                    "Guest #" +
                    directGuestId;

            }

        }


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

                    <strong>
                        ${escapeHtml(
                            guestDisplay
                        )}
                    </strong>

                    ${
                        reservation
                            ? `
                                <br>
                                <small
                                    style="
                                        color:#666;
                                    "
                                >
                                    Reservation #${escapeHtml(
                                        reservation.id
                                    )}
                                </small>
                            `
                            : `
                                <br>
                                <small
                                    style="
                                        color:#b42318;
                                    "
                                >
                                    Reservation record not found
                                </small>
                            `
                    }

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

                    <div
                        class="action-buttons"
                    >

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
                        >
                            Ledger
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

        const totalPayments =
            state.payments.reduce(
                function (
                    total,
                    payment
                ) {

                    return (
                        total +
                        Number(
                            payment.amount || 0
                        )
                    );

                },
                0
            );

        const outstanding =
            state.reservations.reduce(
                function (
                    total,
                    reservation
                ) {

                    return (
                        total +
                        getReservationBalance(
                            reservation
                        )
                    );

                },
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


    /* =========================================================
       VAT
    ========================================================= */

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


    /* =========================================================
       FINANCIAL ENGINE
    ========================================================= */

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
            function (
                resolve,
                reject
            ) {

                let finished =
                    false;

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


    /* =========================================================
       FINANCIAL LEDGER AMOUNT
    ========================================================= */

    function getLedgerAmount(
        ledger
    ) {

        if (!ledger) {

            return 0;

        }

        const values = [

            ledger.money_in,

            ledger.amount,

            ledger.moneyIn,

            ledger.credit_amount

        ];

        for (
            const value of values
        ) {

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
       LEDGER TEXT
    ========================================================= */

    function getLedgerSearchText(
        ledger
    ) {

        if (!ledger) {

            return "";

        }

        return [

            ledger.transaction_number,

            ledger.reference_number,

            ledger.description,

            ledger.transaction_type,

            ledger.id

        ]
            .filter(
                function (value) {

                    return (
                        value !== null &&
                        value !== undefined
                    );

                }
            )
            .join(" ");

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

        const firstDate =
            new Date(first);

        const secondDate =
            new Date(second);

        if (
            Number.isNaN(
                firstDate.getTime()
            ) ||
            Number.isNaN(
                secondDate.getTime()
            )
        ) {

            return Infinity;

        }

        return Math.abs(
            firstDate.getTime() -
            secondDate.getTime()
        ) /
        (1000 * 60 * 60);

    }


    /* =========================================================
       VERIFY PAYMENT LEDGER
       ---------------------------------------------------------
       IMPORTANT FIX

       The financial_transactions table does NOT use
       payment_id as the payment relationship.

       Therefore this function DOES NOT do:

           .eq("payment_id", payment.id)

       Instead it checks the actual financial ledger using:

       1. payment number
       2. receipt number
       3. reference number
       4. payment ID
       5. reservation ID
       6. amount
       7. transaction date

       This prevents the false error:

       "financial engine returned, but no payment ledger
        was found"
    ========================================================= */

    async function verifyPaymentLedger(
        payment
    ) {

        if (!payment) {

            return [];

        }

        const supabase =
            getSupabase();

        if (!state.hotelId) {

            await resolveHotelId();

        }

        if (!state.hotelId) {

            return [];

        }


        /* =====================================================
           LOAD RECENT LEDGER RECORDS

           We deliberately do NOT filter by payment_id because
           that column is not part of the financial ledger
           structure.
        ===================================================== */

        const result =
            await withTimeout(

                supabase
                    .from(
                        "financial_transactions"
                    )
                    .select("*")
                    .eq(
                        "hotel_id",
                        state.hotelId
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
                    .limit(500)

            );


        if (result.error) {

            throw result.error;

        }


        const rows =
            result.data || [];


        if (!rows.length) {

            return [];

        }


        const paymentNumber =
            normalize(
                getPaymentNumber(
                    payment
                )
            );


        const paymentId =
            normalize(
                payment.id
            );


        const reservationId =
            normalize(
                payment.reservation_id
            );


        const referenceNumber =
            normalize(
                payment.reference_number ||
                payment.receipt_number ||
                payment.payment_number ||
                paymentNumber
            );


        const paymentAmount =
            Number(
                payment.amount || 0
            );


        const paymentDate =
            payment.payment_date ||
            payment.created_at;


        /* =====================================================
           FIRST PASS

           Strong identifier matching.
        ===================================================== */

        const strongMatches =
            rows.filter(
                function (ledger) {

                    const reference =
                        normalize(
                            ledger.reference_number
                        );

                    const transactionNumber =
                        normalize(
                            ledger.transaction_number
                        );

                    const description =
                        normalize(
                            ledger.description
                        );

                    const ledgerText =
                        normalize(
                            getLedgerSearchText(
                                ledger
                            )
                        );


                    if (
                        paymentNumber &&
                        (
                            reference ===
                                paymentNumber ||
                            transactionNumber ===
                                paymentNumber ||
                            description.includes(
                                paymentNumber
                            ) ||
                            ledgerText.includes(
                                paymentNumber
                            )
                        )
                    ) {

                        return true;

                    }


                    if (
                        referenceNumber &&
                        (
                            reference ===
                                referenceNumber ||
                            transactionNumber ===
                                referenceNumber ||
                            description.includes(
                                referenceNumber
                            )
                        )
                    ) {

                        return true;

                    }


                    /*
                     * Some older financial entries may store
                     * the payment ID rather than the generated
                     * payment number.
                     */

                    if (
                        paymentId &&
                        (
                            reference ===
                                paymentId ||
                            transactionNumber ===
                                paymentId ||
                            description.includes(
                                "payment " +
                                paymentId
                            ) ||
                            description.includes(
                                "payment#" +
                                paymentId
                            )
                        )
                    ) {

                        return true;

                    }


                    return false;

                }
            );


        if (strongMatches.length) {

            return strongMatches;

        }


        /* =====================================================
           SECOND PASS

           Amount + reservation + date matching.

           This is a fallback only.
        ===================================================== */

        const amountMatches =
            rows.filter(
                function (ledger) {

                    const ledgerAmount =
                        getLedgerAmount(
                            ledger
                        );


                    if (
                        Math.abs(
                            ledgerAmount -
                            paymentAmount
                        ) > 0.01
                    ) {

                        return false;

                    }


                    const ledgerText =
                        normalize(
                            getLedgerSearchText(
                                ledger
                            )
                        );


                    const hours =
                        dateDifferenceHours(
                            ledger.created_at,
                            paymentDate
                        );


                    /*
                     * Stronger fallback:
                     * amount + reservation reference.
                     */

                    if (
                        reservationId &&
                        ledgerText.includes(
                            reservationId
                        ) &&
                        hours <= 72
                    ) {

                        return true;

                    }


                    /*
                     * Final fallback:
                     * exact amount and close posting date.
                     */

                    if (
                        hours <= 24
                    ) {

                        return true;

                    }


                    return false;

                }
            );


        return amountMatches;

    }


    /* =========================================================
       VERIFY WITH RETRY
       ---------------------------------------------------------
       Supabase may take a short moment to expose the newly
       inserted financial transaction after the financial
       engine returns.
    ========================================================= */

    async function verifyPaymentLedgerWithRetry(
        payment,
        attempts = 5,
        delay = 500
    ) {

        let lastResult = [];

        for (
            let attempt = 1;
            attempt <= attempts;
            attempt++
        ) {

            lastResult =
                await verifyPaymentLedger(
                    payment
                );

            if (
                lastResult.length
            ) {

                return lastResult;

            }

            if (
                attempt < attempts
            ) {

                await new Promise(
                    function (resolve) {

                        setTimeout(
                            resolve,
                            delay
                        );

                    }
                );

            }

        }

        return lastResult;

    }


    /* =========================================================
       SAVE PAYMENT
    ========================================================= */

    async function savePayment(
        event
    ) {

        event.preventDefault();


        const reservationId =
            $("#paymentReservation")
                ?.value;


        const amount =
            Number(
                $("#paymentAmount")
                    ?.value || 0
            );


        const paymentMethod =
            $("#paymentMethod")
                ?.value;


        const paymentDate =
            $("#paymentDate")
                ?.value;


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

            saveButton.disabled =
                true;

            saveButton.textContent =
                "Saving...";

        }


        let paymentSaved =
            false;


        try {

            const supabase =
                getSupabase();


            const hotelId =
                await resolveHotelId();


            if (!hotelId) {

                throw new Error(
                    "Hotel session was not found."
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


            /* =================================================
               SAVE PAYMENT ONCE
            ================================================= */

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


            paymentSaved = true;


            state.payments.unshift(
                savedPayment
            );


            let ledgerEntries = [];


            /* =================================================
               FINANCIAL POSTING
            ================================================= */

            try {

                await waitForFinancialEngine();


                const engine =
                    window
                        .EDUTECH_FINANCIAL_ENGINE;


                if (
                    !engine ||
                    typeof
                        engine.postPayment !==
                        "function"
                ) {

                    throw new Error(
                        "Financial engine is not available."
                    );

                }


                /*
                 * IMPORTANT:
                 *
                 * Keep the existing financial-engine API.
                 *
                 * The engine receives the actual saved
                 * payment record.
                 */

                const engineResult =
                    await engine.postPayment(
                        savedPayment
                    );


                /*
                 * Some financial-engine versions return
                 * the created ledger row directly.
                 *
                 * If so, accept it immediately.
                 */

                if (
                    Array.isArray(
                        engineResult
                    ) &&
                    engineResult.length
                ) {

                    ledgerEntries =
                        engineResult;

                } else if (
                    engineResult &&
                    typeof engineResult ===
                    "object" &&
                    (
                        engineResult.id ||
                        engineResult.transaction_number ||
                        engineResult.reference_number
                    )
                ) {

                    ledgerEntries =
                        [engineResult];

                }


                /*
                 * Otherwise verify against the actual
                 * financial_transactions table.
                 */

                if (
                    !ledgerEntries.length
                ) {

                    ledgerEntries =
                        await verifyPaymentLedgerWithRetry(
                            savedPayment
                        );

                }


                if (
                    !ledgerEntries.length
                ) {

                    throw new Error(
                        "The payment was saved, but the financial ledger could not be verified."
                    );

                }


            } catch (
                ledgerError
            ) {

                console.error(
                    "PAYMENT LEDGER ERROR:",
                    ledgerError
                );


                closePaymentModal();


                $("#paymentForm")
                    ?.reset();


                updateSummary();


                renderPayments(
                    $("#paymentSearch")
                        ?.value || ""
                );


                populateReservationSelector();


                /*
                 * VERY IMPORTANT:
                 *
                 * Do not delete the payment.
                 *
                 * Do not tell the user to enter the payment
                 * again.
                 */

                alert(
                    "Payment was saved successfully, but financial posting could not be confirmed.\n\n" +

                    "Payment ID: " +
                    savedPayment.id +

                    "\nPayment: " +
                    getPaymentNumber(
                        savedPayment
                    ) +

                    "\n\nReason:\n" +

                    (
                        ledgerError.message ||
                        "Unknown financial ledger error."
                    ) +

                    "\n\n" +

                    "DO NOT enter this payment again.\n" +
                    "Use the Ledger button on this payment to retry the financial posting."
                );


                return;

            }


            /* =================================================
               SUCCESS
            ================================================= */

            closePaymentModal();


            $("#paymentForm")
                ?.reset();


            updateSummary();


            renderPayments(
                $("#paymentSearch")
                    ?.value || ""
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

                "VAT included in receipt calculation.\n\n" +

                "Financial ledger entries confirmed: " +
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


            if (paymentSaved) {

                alert(
                    "The payment was saved, but another step failed.\n\n" +
                    (
                        error.message ||
                        "Unknown error."
                    ) +
                    "\n\nDo not enter the payment again."
                );

            } else {

                alert(
                    "Payment could not be saved.\n\n" +
                    (
                        error.message ||
                        "Unknown error."
                    )
                );

            }


        } finally {

            if (saveButton) {

                saveButton.disabled =
                    false;

                saveButton.textContent =
                    "Save Payment";

            }

        }

    }


    /* =========================================================
       RETRY LEDGER
    ========================================================= */

    async function retryLedger(
        paymentId
    ) {

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


            /* =================================================
               FIRST CHECK

               Never post twice if the ledger already contains
               the payment.
            ================================================= */

            const existing =
                await verifyPaymentLedger(
                    payment
                );


            if (existing.length) {

                alert(
                    "This payment is already posted to the financial ledger.\n\n" +
                    "Payment: " +
                    getPaymentNumber(
                        payment
                    ) +
                    "\nLedger entries found: " +
                    existing.length
                );

                return;

            }


            await waitForFinancialEngine();


            const engine =
                window
                    .EDUTECH_FINANCIAL_ENGINE;


            if (
                !engine ||
                typeof
                    engine.postPayment !==
                    "function"
            ) {

                throw new Error(
                    "Financial engine is not available."
                );

            }


            /*
             * Use the same API used when the payment was
             * originally saved.
             */

            const engineResult =
                await engine.postPayment(
                    payment
                );


            let verified = [];


            /*
             * Accept a directly returned ledger entry.
             */

            if (
                Array.isArray(
                    engineResult
                ) &&
                engineResult.length
            ) {

                verified =
                    engineResult;

            } else if (
                engineResult &&
                typeof engineResult ===
                "object" &&
                (
                    engineResult.id ||
                    engineResult.transaction_number ||
                    engineResult.reference_number
                )
            ) {

                verified =
                    [engineResult];

            }


            /*
             * Otherwise check the real ledger.
             */

            if (!verified.length) {

                verified =
                    await verifyPaymentLedgerWithRetry(
                        payment
                    );

            }


            if (!verified.length) {

                throw new Error(
                    "The financial engine returned, but the payment ledger could not be verified."
                );

            }


            alert(
                "Payment successfully posted to the financial ledger.\n\n" +

                "Payment: " +
                getPaymentNumber(
                    payment
                ) +

                "\nLedger entries confirmed: " +
                verified.length
            );


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
                ) +

                "\n\n" +

                "The payment record has NOT been deleted."
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


        const available =
            state.reservations.filter(
                function (reservation) {

                    return (
                        getReservationBalance(
                            reservation
                        ) > 0
                    );

                }
            );


        available.forEach(
            function (reservation) {

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
                    "Reservation #" +
                    reservation.id +
                    " - " +
                    getGuestName(
                        guest
                    ) +
                    " - " +
                    getRoomName(
                        room
                    ) +
                    " - Total " +
                    money(total) +
                    " - Balance " +
                    money(balance);

                select.appendChild(
                    option
                );

            }
        );


        if (
            previousValue &&
            available.some(
                function (reservation) {

                    return (
                        String(
                            reservation.id
                        ) ===
                        previousValue
                    );

                }
            )
        ) {

            select.value =
                previousValue;

        }

    }


    /* =========================================================
       BALANCE DISPLAY
    ========================================================= */

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
                <strong>
                    KSh 0.00
                </strong>

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
            <strong>
                ${money(total)}
            </strong>

            <br>

            Already Paid:
            <strong>
                ${money(paid)}
            </strong>

            <br>

            Remaining Balance:
            <strong>
                ${money(balance)}
            </strong>

        `;

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

            dateInput.value =
                new Date()
                    .toISOString()
                    .split("T")[0];

        }

        const amountInput =
            $("#paymentAmount");

        if (amountInput) {

            amountInput.setCustomValidity("");

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

        if (
            !modal ||
            !body
        ) {

            return;

        }

        if (!state.hotel) {

            await loadHotel();

        }

        if (
            !getReservation(
                payment.reservation_id
            )
        ) {

            await recoverPaymentRelationships();

        }

        const reservation =
            getReservation(
                payment.reservation_id
            );

        let guest =
            getGuestFromReservation(
                reservation
            );


        /*
         * Direct guest fallback.
         */

        if (!guest) {

            const directGuestId =
                payment.guest_id ??
                payment.guestId ??
                null;

            if (directGuestId) {

                guest =
                    getGuest(
                        directGuestId
                    );

            }

        }

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

                        <td>
                            Guest
                        </td>

                        <td>
                            ${escapeHtml(
                                guestName
                            )}
                        </td>

                    </tr>


                    <tr>

                        <td>
                            ID / Passport
                        </td>

                        <td>
                            ${escapeHtml(
                                guestIdPassport
                            )}
                        </td>

                    </tr>


                    <tr>

                        <td>
                            Room Number
                        </td>

                        <td>
                            ${escapeHtml(
                                roomNumber
                            )}
                        </td>

                    </tr>


                    <tr>

                        <td>
                            Reservation
                        </td>

                        <td>
                            #${escapeHtml(
                                payment.reservation_id
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
                                    ""
                                ).toUpperCase()
                            )}
                        </td>

                    </tr>


                    <tr>

                        <td>
                            Reservation Total
                        </td>

                        <td>
                            ${money(
                                total
                            )}
                        </td>

                    </tr>


                    <tr>

                        <td>
                            Previous Payments
                        </td>

                        <td>
                            ${money(
                                paidBefore
                            )}
                        </td>

                    </tr>


                    <tr>

                        <td>
                            Current Payment
                        </td>

                        <td>
                            ${money(
                                currentPayment
                            )}
                        </td>

                    </tr>


                    <tr>

                        <td>
                            Amount Before VAT
                        </td>

                        <td>
                            ${money(
                                vat.subtotal
                            )}
                        </td>

                    </tr>


                    <tr>

                        <td>
                            VAT @ 16%
                        </td>

                        <td>
                            ${money(
                                vat.vat
                            )}
                        </td>

                    </tr>


                    <tr
                        class="receipt-total"
                    >

                        <td>
                            Current Payment Total
                        </td>

                        <td>
                            ${money(
                                vat.gross
                            )}
                        </td>

                    </tr>


                    <tr
                        class="receipt-total"
                    >

                        <td>
                            Total Paid To Date
                        </td>

                        <td>
                            ${money(
                                totalPaid
                            )}
                        </td>

                    </tr>


                    <tr>

                        <td>
                            Outstanding Balance
                        </td>

                        <td>
                            ${money(
                                balance
                            )}
                        </td>

                    </tr>

                </table>


                <br>


                <p
                    style="
                        text-align:center;
                    "
                >
                    Thank you for your payment.
                </p>


                <p
                    style="
                        text-align:center;
                        font-size:12px;
                    "
                >
                    Generated by EDU TECH Hotel Management System
                </p>

            </div>

        `;


        modal.classList.add(
            "show"
        );

    }


    /* =========================================================
       CLOSE RECEIPT
    ========================================================= */

    function closeReceipt() {

        const modal =
            $("#receiptModal");

        if (modal) {

            modal.classList.remove(
                "show"
            );

        }

    }


    /* =========================================================
       PRINT RECEIPT
    ========================================================= */

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

                    const amountInput =
                        $("#paymentAmount");

                    if (amountInput) {

                        amountInput.setCustomValidity("");

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

                        this.setCustomValidity("");

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
                        remaining

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
                                function (item) {

                                    return (
                                        Number(
                                            item.id
                                        ) ===
                                        Number(
                                            paymentId
                                        )
                                    );

                                }
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

        if (
            state.initialized
        ) {

            return;

        }

        state.initialized =
            true;

        setupEvents();

        let attempts =
            0;

        while (
            attempts < 50 &&
            !window.supabaseClient
        ) {

            await new Promise(
                function (resolve) {

                    setTimeout(
                        resolve,
                        100
                    );

                }
            );

            attempts++;

        }

        await loadPayments();

    }


    /* =========================================================
       PUBLIC API
    ========================================================= */

    window.EDUTECH_PAYMENTS = {

        loadPayments:
            loadPayments,

        refresh:
            loadPayments,

        renderPayments:
            renderPayments,

        showReceipt:
            showReceipt,

        retryLedger:
            retryLedger,

        getPaymentNumber:
            getPaymentNumber,

        getReservationBalance:
            getReservationBalance,

        calculateVAT:
            calculateVAT,

        verifyPaymentLedger:
            verifyPaymentLedger,

        state:
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