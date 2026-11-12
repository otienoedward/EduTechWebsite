/* =========================================================
   EDU TECH HOTEL MANAGEMENT SYSTEM
   EXPENSE MANAGEMENT MODULE
   VERSION: 2026.11.08.01

   EXPENSES + FINANCIAL LEDGER

   FEATURES:
   - Correct hotels.hotel_name column
   - Authenticated user -> profile -> hotel resolution
   - Storage fallback for hotel ID
   - Correct hotel display
   - Save / Update
   - Clear
   - Refresh
   - Search
   - Edit
   - Delete
   - Financial ledger posting
   - Ledger verification after posting
   - Supports expense_id linkage
   - Supports EXP-<expenseId> reference linkage
   - Prevents duplicate posting
   - Correct Posted/Pending status
   - Voucher
   - Ledger
   - Print
   - Reliable button binding
   - Saving overlay protection
   - Safer financial_transactions verification
========================================================= */

(function () {

    "use strict";

    let currentHotelId = null;
    let currentHotel = null;
    let currentEditingExpenseId = null;
    let currentVoucherExpense = null;
    let allExpenses = [];
    let pageStarted = false;

    const PAYMENT_STORAGE_PREFIX =
        "edutech_expense_payment_source_";


    /* =====================================================
       BASIC HELPERS
    ===================================================== */

    function $(id) {
        return document.getElementById(id);
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

        const number =
            Number(value || 0);

        return (
            "KSh " +
            number.toLocaleString(
                "en-KE",
                {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }
            )
        );
    }


    function formatDate(value) {

        if (!value) {
            return "";
        }

        const date =
            new Date(
                String(value).substring(0, 10) +
                "T00:00:00"
            );

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


    function today() {

        const d =
            new Date();

        return (
            d.getFullYear() +
            "-" +
            String(
                d.getMonth() + 1
            ).padStart(2, "0") +
            "-" +
            String(
                d.getDate()
            ).padStart(2, "0")
        );
    }


    /* =====================================================
       ALERT
    ===================================================== */

    function showAlert(
        message,
        type
    ) {

        const container =
            $("alertContainer");

        if (!container) {

            window.alert(message);

            return;
        }

        container.className =
            "alert alert-" +
            (type || "info");

        container.textContent =
            message;

        container.style.display =
            "block";

        clearTimeout(
            container._timer
        );

        container._timer =
            setTimeout(
                function () {

                    container.style.display =
                        "none";

                },
                5000
            );
    }


    /* =====================================================
       SUPABASE
    ===================================================== */

    function getSupabase() {

        if (
            typeof supabaseClient ===
            "undefined"
        ) {

            throw new Error(
                "Supabase client is not available."
            );
        }

        return supabaseClient;
    }


    /* =====================================================
       STORED HOTEL FALLBACK
    ===================================================== */

    function getStoredHotelId() {

        const keys = [
            "hotelId",
            "hotel_id",
            "currentHotelId",
            "selectedHotelId",
            "authenticatedHotelId"
        ];

        for (
            let i = 0;
            i < keys.length;
            i++
        ) {

            const key =
                keys[i];

            const sessionValue =
                sessionStorage.getItem(key);

            if (
                sessionValue &&
                Number(sessionValue) > 0
            ) {

                return Number(
                    sessionValue
                );
            }

            const localValue =
                localStorage.getItem(key);

            if (
                localValue &&
                Number(localValue) > 0
            ) {

                return Number(
                    localValue
                );
            }
        }

        return null;
    }


    /* =====================================================
       ACCESS CONTROL FALLBACK
    ===================================================== */

    function getAccessControlHotelId() {

        try {

            const access =
                window.EDUTECH_ACCESS_CONTROL;

            if (!access) {
                return null;
            }

            const candidates = [

                typeof access.getHotelId ===
                "function"
                    ? access.getHotelId()
                    : null,

                access.hotelId,

                access.currentHotelId,

                access.hotel?.id,

                access.currentHotel?.id

            ];

            for (
                let i = 0;
                i < candidates.length;
                i++
            ) {

                const id =
                    Number(
                        candidates[i]
                    );

                if (
                    Number.isFinite(id) &&
                    id > 0
                ) {

                    return id;
                }
            }

        } catch (error) {
            /* Optional fallback */
        }

        return null;
    }


    /* =====================================================
       LOAD HOTEL BY ID
    ===================================================== */

    async function loadHotelById(
        hotelId
    ) {

        const id =
            Number(hotelId);

        if (
            !Number.isFinite(id) ||
            id <= 0
        ) {

            throw new Error(
                "Invalid hotel ID."
            );
        }

        const result =
            await getSupabase()
                .from("hotels")
                .select(
                    "id,hotel_name,location,phone,status"
                )
                .eq(
                    "id",
                    id
                )
                .maybeSingle();

        if (result.error) {
            throw result.error;
        }

        if (!result.data) {

            throw new Error(
                "Hotel ID " +
                id +
                " could not be found."
            );
        }

        currentHotelId =
            Number(
                result.data.id
            );

        currentHotel =
            result.data;

        return result.data;
    }


    /* =====================================================
       CURRENT USER -> PROFILE -> HOTEL
    ===================================================== */

    async function getCurrentHotel() {

        const client =
            getSupabase();

        let user = null;

        try {

            const userResult =
                await client.auth.getUser();

            if (
                !userResult.error
            ) {

                user =
                    userResult.data?.user ||
                    null;
            }

        } catch (error) {

            user = null;
        }


        /* -------------------------------------------------
           AUTHENTICATED USER
        ------------------------------------------------- */

        if (user) {

            const profileResult =
                await client
                    .from("profiles")
                    .select(
                        "id,full_name,role,hotel_id,is_active"
                    )
                    .eq(
                        "id",
                        user.id
                    )
                    .maybeSingle();

            if (
                !profileResult.error &&
                profileResult.data
            ) {

                const profile =
                    profileResult.data;

                if (
                    profile.is_active === false
                ) {

                    throw new Error(
                        "Your user account is inactive."
                    );
                }

                if (
                    profile.hotel_id
                ) {

                    const hotel =
                        await loadHotelById(
                            profile.hotel_id
                        );

                    return {
                        user,
                        profile,
                        hotel
                    };
                }
            }
        }


        /* -------------------------------------------------
           ACCESS CONTROL FALLBACK
        ------------------------------------------------- */

        const accessHotelId =
            getAccessControlHotelId();

        if (accessHotelId) {

            const hotel =
                await loadHotelById(
                    accessHotelId
                );

            return {
                user,
                profile: null,
                hotel
            };
        }


        /* -------------------------------------------------
           STORAGE FALLBACK
        ------------------------------------------------- */

        const storedHotelId =
            getStoredHotelId();

        if (storedHotelId) {

            const hotel =
                await loadHotelById(
                    storedHotelId
                );

            return {
                user,
                profile: null,
                hotel
            };
        }

        throw new Error(
            "Your account is not linked to a hotel."
        );
    }


    /* =====================================================
       DISPLAY HOTEL
    ===================================================== */

    function displayHotel() {

        const hotelName =
            $("hotelName");

        const hotelLocation =
            $("hotelLocation");

        if (hotelName) {

            hotelName.textContent =
                currentHotel?.hotel_name ||
                "Hotel";
        }

        if (hotelLocation) {

            hotelLocation.textContent =
                currentHotel?.location ||
                "";
        }
    }


    /* =====================================================
       LOAD HOTEL INFORMATION
    ===================================================== */

    async function loadHotelInformation() {

        if ($("hotelName")) {

            $("hotelName").textContent =
                "Loading hotel...";
        }

        if ($("hotelLocation")) {

            $("hotelLocation").textContent =
                "Loading...";
        }

        try {

            await getCurrentHotel();

            displayHotel();

            return currentHotel;

        } catch (error) {

            if ($("hotelName")) {

                $("hotelName").textContent =
                    "Hotel unavailable";
            }

            if ($("hotelLocation")) {

                $("hotelLocation").textContent =
                    error?.message ||
                    "Please log in again";
            }

            throw error;
        }
    }


    /* =====================================================
       PAYMENT SOURCE
    ===================================================== */

    function paymentStorageKey(
        expenseId
    ) {

        return (
            PAYMENT_STORAGE_PREFIX +
            String(expenseId)
        );
    }


    function savePaymentSource(
        expenseId,
        source
    ) {

        if (!expenseId) {
            return;
        }

        try {

            localStorage.setItem(
                paymentStorageKey(
                    expenseId
                ),
                source || "Bank"
            );

        } catch (error) {
            /* Ignore storage failure */
        }
    }


    function getPaymentSource(
        expenseId
    ) {

        try {

            return (
                localStorage.getItem(
                    paymentStorageKey(
                        expenseId
                    )
                ) ||
                "Bank"
            );

        } catch (error) {

            return "Bank";
        }
    }


    /* =====================================================
       FORM
    ===================================================== */

    function clearExpenseForm() {

        currentEditingExpenseId =
            null;

        const title =
            $("expenseFormTitle");

        if (title) {

            title.textContent =
                "Record New Expense";
        }

        if ($("expenseDescription")) {

            $("expenseDescription").value =
                "";
        }

        if ($("expenseCategory")) {

            $("expenseCategory").value =
                "";
        }

        if ($("expenseDate")) {

            $("expenseDate").value =
                today();
        }

        if ($("expenseAmount")) {

            $("expenseAmount").value =
                "";
        }

        if ($("expensePaymentSource")) {

            $("expensePaymentSource").value =
                "Bank";
        }

        if ($("expenseNotes")) {

            $("expenseNotes").value =
                "";
        }

        const button =
            $("saveExpenseBtn");

        if (button) {

            button.disabled =
                false;

            button.textContent =
                "Save Expense";
        }
    }


    function getFormData() {

        return {

            description:
                $("expenseDescription")
                    ?.value
                    .trim() || "",

            category:
                $("expenseCategory")
                    ?.value
                    .trim() || "",

            expenseDate:
                $("expenseDate")
                    ?.value
                    .trim() || "",

            amount:
                Number(
                    $("expenseAmount")
                        ?.value || 0
                ),

            paymentSource:
                $("expensePaymentSource")
                    ?.value
                    .trim() || "Bank",

            notes:
                $("expenseNotes")
                    ?.value
                    .trim() || ""

        };
    }


    async function ensureHotel() {

        if (
            currentHotelId &&
            currentHotel
        ) {

            return true;
        }

        try {

            await loadHotelInformation();

            return Boolean(
                currentHotelId
            );

        } catch (error) {

            showAlert(
                error?.message ||
                "Unable to identify the hotel.",
                "danger"
            );

            return false;
        }
    }


    function validateForm(data) {

        if (!data.description) {

            showAlert(
                "Please enter the expense description.",
                "warning"
            );

            $("expenseDescription")?.focus();

            return false;
        }

        if (!data.category) {

            showAlert(
                "Please select an expense category.",
                "warning"
            );

            $("expenseCategory")?.focus();

            return false;
        }

        if (!data.expenseDate) {

            showAlert(
                "Please select the expense date.",
                "warning"
            );

            $("expenseDate")?.focus();

            return false;
        }

        if (
            !Number.isFinite(
                data.amount
            ) ||
            data.amount <= 0
        ) {

            showAlert(
                "Please enter a valid amount.",
                "warning"
            );

            $("expenseAmount")?.focus();

            return false;
        }

        if (!currentHotelId) {

            showAlert(
                "Hotel information is not available.",
                "danger"
            );

            return false;
        }

        return true;
    }


    /* =====================================================
       SAVING OVERLAY
    ===================================================== */

    function setSavingState(
        state
    ) {

        const overlay =
            $("savingOverlay");

        if (!overlay) {
            return;
        }

        if (state) {

            overlay.classList.add(
                "show"
            );

            overlay.style.display =
                "flex";

        } else {

            overlay.classList.remove(
                "show"
            );

            overlay.style.display =
                "none";
        }
    }


    /* =====================================================
       SAVE / UPDATE
    ===================================================== */

    async function saveExpense() {

        if (
            !(await ensureHotel())
        ) {

            return;
        }

        const data =
            getFormData();

        if (
            !validateForm(data)
        ) {

            return;
        }

        const button =
            $("saveExpenseBtn");

        try {

            setSavingState(true);

            if (button) {

                button.disabled =
                    true;

                button.textContent =
                    currentEditingExpenseId
                        ? "Updating..."
                        : "Saving...";
            }

            const client =
                getSupabase();


            /* -------------------------------------------------
               UPDATE
            ------------------------------------------------- */

            if (
                currentEditingExpenseId
            ) {

                const result =
                    await client
                        .from("expenses")
                        .update({

                            description:
                                data.description,

                            amount:
                                data.amount,

                            expense_date:
                                data.expenseDate,

                            category:
                                data.category

                        })
                        .eq(
                            "id",
                            currentEditingExpenseId
                        )
                        .eq(
                            "hotel_id",
                            currentHotelId
                        );

                if (result.error) {
                    throw result.error;
                }

                savePaymentSource(
                    currentEditingExpenseId,
                    data.paymentSource
                );

                showAlert(
                    "Expense updated successfully.",
                    "success"
                );


            /* -------------------------------------------------
               NEW EXPENSE
            ------------------------------------------------- */

            } else {

                const result =
                    await client
                        .from("expenses")
                        .insert({

                            description:
                                data.description,

                            amount:
                                data.amount,

                            expense_date:
                                data.expenseDate,

                            category:
                                data.category,

                            hotel_id:
                                currentHotelId

                        })
                        .select(
                            "id"
                        )
                        .single();

                if (result.error) {
                    throw result.error;
                }

                savePaymentSource(
                    result.data.id,
                    data.paymentSource
                );

                showAlert(
                    "Expense saved successfully.",
                    "success"
                );
            }

            clearExpenseForm();

            await loadExpenses();

        } catch (error) {

            showAlert(
                "Expense could not be saved: " +
                (
                    error?.message ||
                    "Please try again."
                ),
                "danger"
            );

        } finally {

            setSavingState(false);

            if (button) {

                button.disabled =
                    false;

                button.textContent =
                    "Save Expense";
            }
        }
    }


    /* =====================================================
       LEDGER LOOKUP
       
       IMPORTANT:
       Use select("*") so verification does not depend
       on optional column names existing in the table.
    ===================================================== */

    async function getExpenseLedgerEntry(
        expenseId
    ) {

        if (!currentHotelId) {
            return [];
        }

        const id =
            Number(expenseId);

        if (
            !Number.isFinite(id) ||
            id <= 0
        ) {

            return [];
        }

        const client =
            getSupabase();

        const reference =
            "EXP-" + id;


        /* -------------------------------------------------
           FIRST: REFERENCE NUMBER
           
           This is the safest lookup because the expense
           financial engine uses EXP-<expenseId>.
        ------------------------------------------------- */

        try {

            const referenceResult =
                await client
                    .from("financial_transactions")
                    .select("*")
                    .eq(
                        "hotel_id",
                        currentHotelId
                    )
                    .eq(
                        "reference_number",
                        reference
                    )
                    .order(
                        "id",
                        {
                            ascending: false
                        }
                    );

            if (
                !referenceResult.error &&
                referenceResult.data &&
                referenceResult.data.length
            ) {

                return referenceResult.data;
            }

        } catch (error) {
            /* Continue to expense_id lookup */
        }


        /* -------------------------------------------------
           SECOND: EXPENSE ID
        ------------------------------------------------- */

        try {

            const expenseIdResult =
                await client
                    .from("financial_transactions")
                    .select("*")
                    .eq(
                        "hotel_id",
                        currentHotelId
                    )
                    .eq(
                        "expense_id",
                        id
                    )
                    .order(
                        "id",
                        {
                            ascending: false
                        }
                    );

            if (
                !expenseIdResult.error
            ) {

                return (
                    expenseIdResult.data ||
                    []
                );
            }

        } catch (error) {
            /* Continue */
        }

        return [];
    }


    /* =====================================================
       POSTED STATUS
    ===================================================== */

    function expenseIsPosted(
        rows
    ) {

        return (
            rows || []
        ).some(
            function (row) {

                const type =
                    String(
                        row.transaction_type ||
                        ""
                    ).toLowerCase();

                return (
                    row.is_reversal !== true &&
                    type === "expense" &&
                    Number(
                        row.amount || 0
                    ) > 0
                );

            }
        );
    }


    /* =====================================================
       LOAD EXPENSES
    ===================================================== */

    async function loadExpenses() {

        const table =
            $("expensesTableBody");

        if (
            !currentHotelId
        ) {

            if (table) {

                table.innerHTML =
                    `
                    <tr>

                        <td colspan="7"
                            class="empty-state">

                            Hotel information is not available.

                        </td>

                    </tr>
                    `;
            }

            return;
        }

        if (table) {

            table.innerHTML =
                `
                <tr>

                    <td colspan="7"
                        class="empty-state">

                        Loading expenses...

                    </td>

                </tr>
                `;
        }

        try {

            const result =
                await getSupabase()
                    .from("expenses")
                    .select(
                        "id,created_at,description,amount,expense_date,category,hotel_id"
                    )
                    .eq(
                        "hotel_id",
                        currentHotelId
                    )
                    .order(
                        "expense_date",
                        {
                            ascending: false
                        }
                    )
                    .order(
                        "id",
                        {
                            ascending: false
                        }
                    );

            if (result.error) {
                throw result.error;
            }

            allExpenses =
                result.data || [];

            await renderExpenses(
                allExpenses
            );

            await updateSummary(
                allExpenses
            );

        } catch (error) {

            allExpenses =
                [];

            if (table) {

                table.innerHTML =
                    `
                    <tr>

                        <td colspan="7"
                            class="empty-state">

                            <div class="empty-state-icon">
                                ⚠️
                            </div>

                            <h3>
                                Unable to load expenses
                            </h3>

                            <p>
                                ${escapeHtml(
                                    error?.message ||
                                    "Please try again."
                                )}
                            </p>

                        </td>

                    </tr>
                    `;
            }

            showAlert(
                "Unable to load expenses: " +
                (
                    error?.message ||
                    "Please try again."
                ),
                "danger"
            );
        }
    }


    /* =====================================================
       RENDER EXPENSES
    ===================================================== */

    async function renderExpenses(
        expenses
    ) {

        const table =
            $("expensesTableBody");

        if (!table) {
            return;
        }

        if (
            !expenses ||
            expenses.length === 0
        ) {

            table.innerHTML =
                `
                <tr>

                    <td colspan="7"
                        class="empty-state">

                        <div class="empty-state-icon">
                            💰
                        </div>

                        <h3>
                            No expense records
                        </h3>

                        <p>
                            Record your first hotel expense above.
                        </p>

                    </td>

                </tr>
                `;

            return;
        }


        const ledgerResults =
            await Promise.all(
                expenses.map(
                    function (expense) {

                        return getExpenseLedgerEntry(
                            expense.id
                        );

                    }
                )
            );


        table.innerHTML =
            expenses.map(
                function (
                    expense,
                    index
                ) {

                    const ledgerRows =
                        ledgerResults[index] ||
                        [];

                    const posted =
                        expenseIsPosted(
                            ledgerRows
                        );

                    return `
                    <tr>

                        <td>
                            ${escapeHtml(
                                formatDate(
                                    expense.expense_date
                                )
                            )}
                        </td>

                        <td>
                            <strong>
                                ${escapeHtml(
                                    expense.description
                                )}
                            </strong>
                        </td>

                        <td>
                            ${escapeHtml(
                                expense.category
                            )}
                        </td>

                        <td>
                            <strong>
                                ${money(
                                    expense.amount
                                )}
                            </strong>
                        </td>

                        <td>
                            ${escapeHtml(
                                getPaymentSource(
                                    expense.id
                                )
                            )}
                        </td>

                        <td>
                            ${
                                posted
                                    ?
                                    `
                                    <span class="status status-posted">
                                        Posted
                                    </span>
                                    `
                                    :
                                    `
                                    <span class="status status-pending">
                                        Pending
                                    </span>
                                    `
                            }
                        </td>

                        <td>

                            <div class="action-buttons">

                                <button
                                    type="button"
                                    class="btn btn-info"
                                    data-expense-action="voucher"
                                    data-expense-id="${expense.id}">
                                    Voucher
                                </button>

                                <button
                                    type="button"
                                    class="btn btn-light"
                                    data-expense-action="edit"
                                    data-expense-id="${expense.id}">
                                    Edit
                                </button>

                                ${
                                    posted
                                        ?
                                        `
                                        <button
                                            type="button"
                                            class="btn btn-success"
                                            data-expense-action="ledger"
                                            data-expense-id="${expense.id}">
                                            Ledger
                                        </button>
                                        `
                                        :
                                        `
                                        <button
                                            type="button"
                                            class="btn btn-primary"
                                            data-expense-action="post"
                                            data-expense-id="${expense.id}">
                                            Post
                                        </button>
                                        `
                                }

                                <button
                                    type="button"
                                    class="btn btn-danger"
                                    data-expense-action="delete"
                                    data-expense-id="${expense.id}">
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

    async function updateSummary(
        expenses
    ) {

        const list =
            expenses || [];

        const total =
            list.reduce(
                function (
                    sum,
                    item
                ) {

                    return (
                        sum +
                        Number(
                            item.amount || 0
                        )
                    );

                },
                0
            );


        const ledgerResults =
            await Promise.all(
                list.map(
                    function (expense) {

                        return getExpenseLedgerEntry(
                            expense.id
                        );

                    }
                )
            );


        let posted =
            0;


        list.forEach(
            function (
                expense,
                index
            ) {

                if (
                    expenseIsPosted(
                        ledgerResults[index]
                    )
                ) {

                    posted +=
                        Number(
                            expense.amount || 0
                        );
                }
            }
        );


        const pending =
            Math.max(
                0,
                total - posted
            );


        if ($("totalExpenses")) {

            $("totalExpenses").textContent =
                money(total);
        }

        if ($("postedExpenses")) {

            $("postedExpenses").textContent =
                money(posted);
        }

        if ($("pendingExpenses")) {

            $("pendingExpenses").textContent =
                money(pending);
        }

        if ($("expenseCount")) {

            $("expenseCount").textContent =
                String(
                    list.length
                );
        }
    }


    /* =====================================================
       SEARCH
    ===================================================== */

    async function searchExpenses() {

        const term =
            $("expenseSearch")
                ?.value
                .trim()
                .toLowerCase() || "";


        if (!term) {

            await renderExpenses(
                allExpenses
            );

            return;
        }


        const filtered =
            allExpenses.filter(
                function (expense) {

                    return [

                        expense.description,

                        expense.category,

                        expense.expense_date,

                        getPaymentSource(
                            expense.id
                        ),

                        expense.amount

                    ]
                        .join(" ")
                        .toLowerCase()
                        .includes(term);
                }
            );


        await renderExpenses(
            filtered
        );
    }


    /* =====================================================
       EDIT
    ===================================================== */

    async function editExpense(
        expenseId
    ) {

        const id =
            Number(expenseId);


        const expense =
            allExpenses.find(
                function (item) {

                    return (
                        Number(item.id) ===
                        id
                    );

                }
            );


        if (!expense) {

            showAlert(
                "Expense record could not be found.",
                "danger"
            );

            return;
        }


        const ledger =
            await getExpenseLedgerEntry(
                id
            );


        if (
            expenseIsPosted(
                ledger
            )
        ) {

            showAlert(
                "This expense has already been posted and cannot be edited.",
                "warning"
            );

            return;
        }


        currentEditingExpenseId =
            id;


        if ($("expenseFormTitle")) {

            $("expenseFormTitle").textContent =
                "Edit Expense";
        }


        if ($("expenseDescription")) {

            $("expenseDescription").value =
                expense.description || "";
        }


        if ($("expenseCategory")) {

            $("expenseCategory").value =
                expense.category || "";
        }


        if ($("expenseDate")) {

            $("expenseDate").value =
                expense.expense_date ||
                today();
        }


        if ($("expenseAmount")) {

            $("expenseAmount").value =
                expense.amount || "";
        }


        if ($("expensePaymentSource")) {

            $("expensePaymentSource").value =
                getPaymentSource(id);
        }


        if ($("expenseNotes")) {

            $("expenseNotes").value =
                "";
        }


        if ($("saveExpenseBtn")) {

            $("saveExpenseBtn").textContent =
                "Update Expense";
        }


        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }


    /* =====================================================
       DELETE
    ===================================================== */

    async function deleteExpense(
        expenseId
    ) {

        const id =
            Number(expenseId);


        const expense =
            allExpenses.find(
                function (item) {

                    return (
                        Number(item.id) ===
                        id
                    );

                }
            );


        if (!expense) {

            showAlert(
                "Expense record not found.",
                "danger"
            );

            return;
        }


        const ledger =
            await getExpenseLedgerEntry(
                id
            );


        if (
            expenseIsPosted(
                ledger
            )
        ) {

            showAlert(
                "This expense has already been posted to the financial ledger and cannot be deleted.",
                "warning"
            );

            return;
        }


        if (
            !window.confirm(
                "Delete expense '" +
                expense.description +
                "' for " +
                money(expense.amount) +
                "?"
            )
        ) {

            return;
        }


        try {

            setSavingState(true);


            const result =
                await getSupabase()
                    .from("expenses")
                    .delete()
                    .eq(
                        "id",
                        id
                    )
                    .eq(
                        "hotel_id",
                        currentHotelId
                    );


            if (result.error) {
                throw result.error;
            }


            try {

                localStorage.removeItem(
                    paymentStorageKey(
                        id
                    )
                );

            } catch (error) {
                /* Ignore */
            }


            showAlert(
                "Expense deleted successfully.",
                "success"
            );


            await loadExpenses();


        } catch (error) {

            showAlert(
                "Expense could not be deleted: " +
                (
                    error?.message ||
                    "Please try again."
                ),
                "danger"
            );


        } finally {

            setSavingState(false);
        }
    }


    /* =====================================================
       POST EXPENSE
    ===================================================== */

    async function postExpense(
        expenseId
    ) {

        if (
            !(await ensureHotel())
        ) {

            return;
        }


        const id =
            Number(expenseId);


        if (
            !Number.isFinite(id) ||
            id <= 0
        ) {

            showAlert(
                "Invalid expense ID.",
                "danger"
            );

            return;
        }


        const expense =
            allExpenses.find(
                function (item) {

                    return (
                        Number(item.id) ===
                        id
                    );

                }
            );


        if (!expense) {

            showAlert(
                "Expense record not found.",
                "danger"
            );

            return;
        }


        /* -------------------------------------------------
           CHECK FOR EXISTING POSTING
        ------------------------------------------------- */

        const existing =
            await getExpenseLedgerEntry(
                id
            );


        if (
            expenseIsPosted(
                existing
            )
        ) {

            showAlert(
                "This expense is already posted to the financial ledger.",
                "warning"
            );

            await loadExpenses();

            return;
        }


        /* -------------------------------------------------
           FINANCIAL ENGINE
        ------------------------------------------------- */

        const engine =
            window.EDUTECH_FINANCIAL_ENGINE;


        if (
            !engine ||
            typeof engine.postExpense !==
            "function"
        ) {

            showAlert(
                "The financial engine is not ready. Please refresh the page.",
                "danger"
            );

            return;
        }


        const button =
            document.querySelector(
                'button[data-expense-action="post"][data-expense-id="' +
                id +
                '"]'
            );


        try {

            setSavingState(true);


            if (button) {

                button.disabled =
                    true;

                button.textContent =
                    "Posting...";
            }


            /* -------------------------------------------------
               CENTRAL FINANCIAL ENGINE
            ------------------------------------------------- */

            const postingResult =
                await engine.postExpense({

                    hotelId:
                        currentHotelId,

                    expenseId:
                        expense.id,

                    description:
                        expense.description,

                    category:
                        expense.category,

                    amount:
                        Number(
                            expense.amount
                        ),

                    expenseDate:
                        expense.expense_date,

                    paymentSource:
                        getPaymentSource(
                            expense.id
                        ),

                    notes:
                        ""

                });


            /* -------------------------------------------------
               VERIFY DATABASE AFTER POSTING
            ------------------------------------------------- */

            const verifyRows =
                await getExpenseLedgerEntry(
                    id
                );


            const posted =
                expenseIsPosted(
                    verifyRows
                );


            if (!posted) {

                let detail =
                    "The financial engine returned, but no expense ledger entry was found.";

                if (
                    postingResult &&
                    typeof postingResult ===
                    "object"
                ) {

                    if (
                        postingResult.error
                    ) {

                        detail =
                            postingResult.error.message ||
                            detail;
                    }

                    if (
                        postingResult.message
                    ) {

                        detail =
                            postingResult.message;
                    }
                }


                throw new Error(
                    detail
                );
            }


            /* -------------------------------------------------
               VERIFIED SUCCESS
            ------------------------------------------------- */

            showAlert(
                "Expense posted successfully to the financial ledger.",
                "success"
            );


            await loadExpenses();


        } catch (error) {

            showAlert(
                "Expense ledger posting failed: " +
                (
                    error?.message ||
                    "Please try again."
                ),
                "danger"
            );


            try {

                await loadExpenses();

            } catch (reloadError) {
                /* Keep original error */
            }


        } finally {

            setSavingState(false);


            if (button) {

                button.disabled =
                    false;

                button.textContent =
                    "Post";
            }
        }
    }


    /* =====================================================
       VOUCHER
    ===================================================== */

    function viewExpenseVoucher(
        expenseId
    ) {

        const id =
            Number(expenseId);


        const expense =
            allExpenses.find(
                function (item) {

                    return (
                        Number(item.id) ===
                        id
                    );

                }
            );


        if (!expense) {

            showAlert(
                "Expense record not found.",
                "danger"
            );

            return;
        }


        currentVoucherExpense =
            expense;


        const modal =
            $("voucherModal");

        const body =
            $("voucherModalBody");


        if (!modal || !body) {
            return;
        }


        const voucherNumber =
            "EXP-" +
            String(expense.id);


        body.innerHTML =
            `
            <div class="voucher">

                <div class="voucher-header">

                    <h2>
                        ${escapeHtml(
                            currentHotel?.hotel_name ||
                            "EDU TECH Hotel"
                        )}
                    </h2>

                    <p>
                        Expense Payment Voucher
                    </p>

                    <p>
                        ${escapeHtml(
                            currentHotel?.location ||
                            ""
                        )}
                    </p>

                    <p>
                        Voucher No:
                        <strong>
                            ${escapeHtml(
                                voucherNumber
                            )}
                        </strong>
                    </p>

                </div>


                <table class="voucher-table">

                    <tr>

                        <td class="voucher-label">
                            Voucher Date
                        </td>

                        <td>
                            ${escapeHtml(
                                formatDate(
                                    expense.expense_date
                                )
                            )}
                        </td>

                    </tr>


                    <tr>

                        <td class="voucher-label">
                            Description
                        </td>

                        <td>
                            ${escapeHtml(
                                expense.description
                            )}
                        </td>

                    </tr>


                    <tr>

                        <td class="voucher-label">
                            Category
                        </td>

                        <td>
                            ${escapeHtml(
                                expense.category
                            )}
                        </td>

                    </tr>


                    <tr>

                        <td class="voucher-label">
                            Payment Source
                        </td>

                        <td>
                            ${escapeHtml(
                                getPaymentSource(
                                    expense.id
                                )
                            )}
                        </td>

                    </tr>


                    <tr>

                        <td class="voucher-label">
                            Expense ID
                        </td>

                        <td>
                            ${escapeHtml(
                                String(
                                    expense.id
                                )
                            )}
                        </td>

                    </tr>


                    <tr>

                        <td class="voucher-label">
                            Ledger Reference
                        </td>

                        <td>
                            ${escapeHtml(
                                "EXP-" +
                                String(
                                    expense.id
                                )
                            )}
                        </td>

                    </tr>

                </table>


                <div class="voucher-total">

                    Amount:
                    ${money(
                        expense.amount
                    )}

                </div>


                <div
                    style="
                        margin-top:30px;
                        display:flex;
                        justify-content:space-between;
                        gap:30px;
                        font-size:13px;
                    "
                >

                    <div>
                        __________________________
                        <br>
                        Prepared By
                    </div>

                    <div>
                        __________________________
                        <br>
                        Approved By
                    </div>

                </div>

            </div>
            `;


        modal.classList.add(
            "show"
        );
    }


    /* =====================================================
       LEDGER
    ===================================================== */

    async function viewExpenseLedger(
        expenseId
    ) {

        const modal =
            $("ledgerModal");

        const body =
            $("ledgerModalBody");


        if (!modal || !body) {
            return;
        }


        modal.classList.add(
            "show"
        );


        body.innerHTML =
            "Loading ledger...";


        try {

            const rows =
                await getExpenseLedgerEntry(
                    Number(expenseId)
                );


            if (!rows.length) {

                body.innerHTML =
                    `
                    <div class="empty-state">

                        <div class="empty-state-icon">
                            📒
                        </div>

                        <h3>
                            No ledger entry
                        </h3>

                        <p>
                            This expense has not yet been posted.
                        </p>

                    </div>
                    `;

                return;
            }


            body.innerHTML =
                `
                <div class="ledger-box">

                    <table class="ledger-table">

                        <thead>

                            <tr>

                                <th>
                                    Date
                                </th>

                                <th>
                                    Transaction
                                </th>

                                <th>
                                    Description
                                </th>

                                <th>
                                    Type
                                </th>

                                <th>
                                    Amount
                                </th>

                            </tr>

                        </thead>


                        <tbody>

                            ${
                                rows.map(
                                    function (row) {

                                        return `
                                        <tr>

                                            <td>
                                                ${escapeHtml(
                                                    formatDate(
                                                        row.transaction_date
                                                    )
                                                )}
                                            </td>

                                            <td>
                                                ${escapeHtml(
                                                    row.transaction_number ||
                                                    row.reference_number ||
                                                    ""
                                                )}
                                            </td>

                                            <td>
                                                ${escapeHtml(
                                                    row.description ||
                                                    ""
                                                )}
                                            </td>

                                            <td>
                                                ${escapeHtml(
                                                    row.transaction_type ||
                                                    ""
                                                )}
                                            </td>

                                            <td>
                                                ${money(
                                                    row.amount
                                                )}
                                            </td>

                                        </tr>
                                        `;

                                    }
                                ).join("")
                            }

                        </tbody>

                    </table>

                </div>
                `;


        } catch (error) {

            body.innerHTML =
                `
                <div class="empty-state">

                    <div class="empty-state-icon">
                        ⚠️
                    </div>

                    <h3>
                        Unable to load ledger
                    </h3>

                    <p>
                        ${escapeHtml(
                            error?.message ||
                            "Please try again."
                        )}
                    </p>

                </div>
                `;
        }
    }


    /* =====================================================
       PRINT VOUCHER
    ===================================================== */

    function printVoucher() {

        const voucher =
            document.querySelector(
                "#voucherModalBody .voucher"
            );


        if (!voucher) {

            showAlert(
                "Open the voucher first.",
                "warning"
            );

            return;
        }


        const printWindow =
            window.open(
                "",
                "_blank",
                "width=900,height=700"
            );


        if (!printWindow) {

            showAlert(
                "Please allow pop-ups to print the voucher.",
                "warning"
            );

            return;
        }


        printWindow.document.write(
            `
            <!DOCTYPE html>

            <html>

            <head>

                <title>
                    Expense Voucher
                </title>

                <style>

                    body{
                        font-family:Arial,Helvetica,sans-serif;
                        padding:30px;
                        color:#243746;
                    }

                    .voucher{
                        max-width:800px;
                        margin:auto;
                        padding:25px;
                        border:1px solid #ddd;
                    }

                    .voucher-header{
                        text-align:center;
                        border-bottom:2px solid #0f3d56;
                        padding-bottom:15px;
                        margin-bottom:20px;
                    }

                    .voucher-header h2{
                        color:#0f3d56;
                        margin:0;
                    }

                    .voucher-header p{
                        margin:5px 0;
                    }

                    table{
                        width:100%;
                        border-collapse:collapse;
                    }

                    td{
                        padding:10px;
                        border:1px solid #ddd;
                    }

                    .voucher-label{
                        width:35%;
                        background:#f5f7f9;
                        font-weight:bold;
                    }

                    .voucher-total{
                        margin-top:20px;
                        text-align:right;
                        font-size:20px;
                        font-weight:bold;
                    }

                </style>

            </head>


            <body>

                ${voucher.outerHTML}

            </body>

            </html>
            `
        );


        printWindow.document.close();

        printWindow.focus();


        setTimeout(
            function () {

                printWindow.print();

            },
            300
        );
    }


    /* =====================================================
       REFRESH
    ===================================================== */

    async function refreshExpenses() {

        const button =
            $("refreshExpensesBtn");


        if (button) {

            button.disabled =
                true;

            button.textContent =
                "Refreshing...";
        }


        try {

            await loadHotelInformation();

            await loadExpenses();


            showAlert(
                "Expenses refreshed successfully.",
                "success"
            );


        } catch (error) {

            showAlert(
                error?.message ||
                "Unable to refresh expenses.",
                "danger"
            );


        } finally {

            if (button) {

                button.disabled =
                    false;

                button.textContent =
                    "↻ Refresh";
            }

            setSavingState(false);
        }
    }


    /* =====================================================
       OPEN FORM
    ===================================================== */

    function openExpenseForm() {

        clearExpenseForm();


        if ($("expenseDescription")) {

            $("expenseDescription").focus();
        }


        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }


    /* =====================================================
       TABLE EVENTS
    ===================================================== */

    function attachTableEvents() {

        const table =
            $("expensesTableBody");


        if (!table) {
            return;
        }


        if (
            table.dataset.eventsAttached ===
            "true"
        ) {

            return;
        }


        table.dataset.eventsAttached =
            "true";


        table.addEventListener(
            "click",
            async function (event) {

                const button =
                    event.target.closest(
                        "button[data-expense-action]"
                    );


                if (!button) {
                    return;
                }


                event.preventDefault();
                event.stopPropagation();


                const action =
                    button.dataset.expenseAction;


                const id =
                    button.dataset.expenseId;


                if (
                    action ===
                    "voucher"
                ) {

                    viewExpenseVoucher(id);

                    return;
                }


                if (
                    action ===
                    "edit"
                ) {

                    await editExpense(id);

                    return;
                }


                if (
                    action ===
                    "delete"
                ) {

                    await deleteExpense(id);

                    return;
                }


                if (
                    action ===
                    "post"
                ) {

                    await postExpense(id);

                    return;
                }


                if (
                    action ===
                    "ledger"
                ) {

                    await viewExpenseLedger(id);

                }

            }
        );
    }


    /* =====================================================
       MAIN EVENTS
    ===================================================== */

    function attachMainEvents() {

        const save =
            $("saveExpenseBtn");


        if (
            save &&
            save.dataset.bound !==
                "true"
        ) {

            save.dataset.bound =
                "true";


            save.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();
                    event.stopPropagation();

                    saveExpense();

                }
            );
        }


        const clear =
            $("clearExpenseBtn");


        if (
            clear &&
            clear.dataset.bound !==
                "true"
        ) {

            clear.dataset.bound =
                "true";


            clear.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();
                    event.stopPropagation();

                    clearExpenseForm();

                }
            );
        }


        const refresh =
            $("refreshExpensesBtn");


        if (
            refresh &&
            refresh.dataset.bound !==
                "true"
        ) {

            refresh.dataset.bound =
                "true";


            refresh.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();
                    event.stopPropagation();

                    refreshExpenses();

                }
            );
        }


        const search =
            $("expenseSearch");


        if (
            search &&
            search.dataset.bound !==
                "true"
        ) {

            search.dataset.bound =
                "true";


            search.addEventListener(
                "input",
                searchExpenses
            );
        }


        const print =
            $("printVoucherBtn");


        if (
            print &&
            print.dataset.bound !==
                "true"
        ) {

            print.dataset.bound =
                "true";


            print.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();
                    event.stopPropagation();

                    printVoucher();

                }
            );
        }


        document
            .querySelectorAll(
                ".modal"
            )
            .forEach(
                function (modal) {

                    if (
                        modal.dataset.expenseModalBound ===
                        "true"
                    ) {

                        return;
                    }


                    modal.dataset.expenseModalBound =
                        "true";


                    modal.addEventListener(
                        "click",
                        function (event) {

                            if (
                                event.target ===
                                modal
                            ) {

                                modal.classList.remove(
                                    "show"
                                );
                            }

                        }
                    );

                }
            );
    }


    /* =====================================================
       GLOBAL EVENTS
    ===================================================== */

    function attachGlobalEvents() {

        if (
            document.body.dataset.expensesGlobal ===
            "true"
        ) {

            return;
        }


        document.body.dataset.expensesGlobal =
            "true";


        document.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key ===
                    "Escape"
                ) {

                    document
                        .querySelectorAll(
                            ".modal.show"
                        )
                        .forEach(
                            function (modal) {

                                modal.classList.remove(
                                    "show"
                                );

                            }
                        );


                    setSavingState(false);
                }
            }
        );
    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.loadExpenses =
        loadExpenses;


    window.refreshExpenses =
        refreshExpenses;


    window.saveExpense =
        saveExpense;


    window.handleExpenseSave =
        saveExpense;


    window.clearExpenseForm =
        clearExpenseForm;


    window.clearForm =
        clearExpenseForm;


    window.openExpenseForm =
        openExpenseForm;


    window.addExpense =
        openExpenseForm;


    window.addNewExpense =
        openExpenseForm;


    window.newExpense =
        openExpenseForm;


    window.showExpenseForm =
        openExpenseForm;


    window.editExpense =
        editExpense;


    window.deleteExpense =
        deleteExpense;


    window.postExpense =
        postExpense;


    window.viewExpenseVoucher =
        viewExpenseVoucher;


    window.viewExpenseLedger =
        viewExpenseLedger;


    window.printVoucher =
        printVoucher;


    window.closeModal =
        function (modalId) {

            const modal =
                $(modalId);


            if (modal) {

                modal.classList.remove(
                    "show"
                );
            }


            setSavingState(false);
        };


    window.EDUTECH_EXPENSES_READY =
        true;


    window.EDUTECH_EXPENSES =
        {

            getHotelId:
                function () {
                    return currentHotelId;
                },


            getHotel:
                function () {
                    return currentHotel;
                },


            reload:
                refreshExpenses

        };


    /* =====================================================
       INITIALIZATION
    ===================================================== */

    async function initialize() {

        if (pageStarted) {
            return;
        }


        pageStarted =
            true;


        setSavingState(false);


        attachMainEvents();

        attachTableEvents();

        attachGlobalEvents();


        if ($("expenseDate")) {

            $("expenseDate").value =
                today();
        }


        try {

            await loadHotelInformation();

            await loadExpenses();


        } catch (error) {

            setSavingState(false);


            const message =
                error?.message ||
                "Unable to identify the hotel.";


            showAlert(
                message,
                "danger"
            );


            const table =
                $("expensesTableBody");


            if (table) {

                table.innerHTML =
                    `
                    <tr>

                        <td colspan="7"
                            class="empty-state">

                            <div class="empty-state-icon">
                                ⚠️
                            </div>

                            <h3>
                                Hotel account not available
                            </h3>

                            <p>
                                ${escapeHtml(
                                    message
                                )}
                            </p>

                        </td>

                    </tr>
                    `;
            }
        }
    }


    /* =====================================================
       START
    ===================================================== */

    attachMainEvents();

    attachTableEvents();

    attachGlobalEvents();


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