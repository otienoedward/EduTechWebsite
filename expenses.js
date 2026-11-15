/* =========================================================
   EDU TECH HOTEL MANAGEMENT SYSTEM
   EXPENSE MANAGEMENT
   Version: 2026.11.13.25

   Expense flow:

   expenses
        ↓
   Post Expense
        ↓
   Financial Engine
        ↓
   financial_transactions
        ↓
   transaction_type = "expense"
        ↓
   expense_id
        ↓
   reference_number = EXP-<expense id>
        ↓
   POSTED
========================================================= */

(function () {
    "use strict";

    console.log(
        "EDU TECH Expenses module 2026.11.13.25 loading..."
    );

    /* =====================================================
       DATABASE-SAFE TRANSACTION TYPE
    ===================================================== */

    const EXPENSE_TRANSACTION_TYPE =
        "expense";

    /* =====================================================
       STATE
    ===================================================== */

    let currentHotelId = null;
    let currentHotel = null;

    let currentEditingExpenseId = null;
    let currentVoucherExpense = null;

    let allExpenses = [];
    let pageStarted = false;

    const PAYMENT_SOURCE_PREFIX =
        "edutech_expense_payment_source_";

    /* =====================================================
       SUPABASE
    ===================================================== */

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
            "Supabase client is not available."
        );
    }

    /* =====================================================
       HELPERS
    ===================================================== */

    function escapeHtml(value) {
        return String(
            value ?? ""
        )
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );
    }

    function money(value) {
        const number =
            Number(
                value || 0
            );

        return number.toLocaleString(
            "en-KE",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
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
            return String(value);
        }

        return date.toLocaleDateString(
            "en-GB"
        );
    }

    function getToday() {
        const now =
            new Date();

        return [
            now.getFullYear(),

            String(
                now.getMonth() + 1
            ).padStart(2, "0"),

            String(
                now.getDate()
            ).padStart(2, "0")
        ].join("-");
    }

    function showMessage(message) {
        const candidates = [
            "expenseMessage",
            "expensesMessage",
            "message",
            "statusMessage"
        ];

        for (
            const id of candidates
        ) {
            const element =
                document.getElementById(
                    id
                );

            if (element) {
                element.textContent =
                    message;

                element.style.display =
                    "block";

                return;
            }
        }

        alert(message);
    }

    function getElement(...ids) {
        for (
            const id of ids
        ) {
            const element =
                document.getElementById(
                    id
                );

            if (element) {
                return element;
            }
        }

        return null;
    }

    /* =====================================================
       HOTEL
    ===================================================== */

    async function getHotelId() {
        if (currentHotelId) {
            return currentHotelId;
        }

        /*
           1. Authenticated profile
        */

        try {
            const supabase =
                getSupabase();

            const {
                data: authData
            } =
                await supabase.auth.getUser();

            const user =
                authData?.user;

            if (user) {
                const {
                    data: profile
                } =
                    await supabase
                        .from("profiles")
                        .select(
                            "hotel_id"
                        )
                        .eq(
                            "id",
                            user.id
                        )
                        .maybeSingle();

                if (
                    profile &&
                    profile.hotel_id
                ) {
                    currentHotelId =
                        profile.hotel_id;

                    return currentHotelId;
                }
            }
        } catch (error) {
            console.warn(
                "Expenses profile hotel lookup failed:",
                error.message
            );
        }

        /*
           2. Local/session storage
        */

        const storageKeys = [
            "hotelId",
            "hotel_id",
            "currentHotelId",
            "current_hotel_id",
            "edutech_hotel_id"
        ];

        for (
            const key of storageKeys
        ) {
            const value =
                localStorage.getItem(
                    key
                ) ||
                sessionStorage.getItem(
                    key
                );

            if (value) {
                currentHotelId =
                    value;

                return currentHotelId;
            }
        }

        /*
           3. Global values
        */

        if (
            window.currentHotelId
        ) {
            currentHotelId =
                window.currentHotelId;

            return currentHotelId;
        }

        if (
            window.EDUTECH_HOTEL_ID
        ) {
            currentHotelId =
                window.EDUTECH_HOTEL_ID;

            return currentHotelId;
        }

        throw new Error(
            "Unable to determine the current hotel."
        );
    }

    async function loadCurrentHotel() {
        const hotelId =
            await getHotelId();

        const supabase =
            getSupabase();

        const {
            data,
            error
        } =
            await supabase
                .from("hotels")
                .select("*")
                .eq(
                    "id",
                    hotelId
                )
                .maybeSingle();

        if (error) {
            console.warn(
                "Unable to load hotel:",
                error.message
            );

            return null;
        }

        currentHotel =
            data || null;

        return currentHotel;
    }

    /* =====================================================
       PAYMENT SOURCE
    ===================================================== */

    function getPaymentSource(
        expenseId
    ) {
        return (
            localStorage.getItem(
                PAYMENT_SOURCE_PREFIX +
                expenseId
            ) ||
            "Cash"
        );
    }

    function savePaymentSource(
        expenseId,
        paymentSource
    ) {
        localStorage.setItem(
            PAYMENT_SOURCE_PREFIX +
            expenseId,
            paymentSource ||
                "Cash"
        );
    }

    /* =====================================================
       LOAD EXPENSES
    ===================================================== */

    async function loadExpenses() {
        try {
            const hotelId =
                await getHotelId();

            const supabase =
                getSupabase();

            const {
                data,
                error
            } =
                await supabase
                    .from("expenses")
                    .select(
                        "id,created_at,description,amount,expense_date,category,hotel_id"
                    )
                    .eq(
                        "hotel_id",
                        hotelId
                    )
                    .order(
                        "expense_date",
                        {
                            ascending:
                                false
                        }
                    )
                    .order(
                        "id",
                        {
                            ascending:
                                false
                        }
                    );

            if (error) {
                throw new Error(
                    error.message
                );
            }

            allExpenses =
                Array.isArray(data)
                    ? data
                    : [];

            await renderExpenses();

            return allExpenses;

        } catch (error) {
            console.error(
                "EDU TECH loadExpenses error:",
                error
            );

            showMessage(
                "Unable to load expenses: " +
                error.message
            );

            return [];
        }
    }

    /* =====================================================
       LEDGER LOOKUP
    ===================================================== */

    async function getExpenseLedgerEntry(
        expenseId
    ) {
        const hotelId =
            await getHotelId();

        const supabase =
            getSupabase();

        const referenceNumber =
            "EXP-" +
            String(expenseId);

        /*
           PRIMARY:
           expense_id
        */

        try {
            const {
                data,
                error
            } =
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
                        "expense_id",
                        expenseId
                    )
                    .order(
                        "created_at",
                        {
                            ascending:
                                false
                        }
                    );

            if (
                !error &&
                Array.isArray(data)
            ) {
                const valid =
                    data.filter(
                        row =>
                            row.is_reversal !==
                                true &&
                            String(
                                row.transaction_type ||
                                ""
                            ).toLowerCase() ===
                                EXPENSE_TRANSACTION_TYPE &&
                            Number(
                                row.amount ||
                                0
                            ) > 0
                    );

                if (
                    valid.length
                ) {
                    return valid;
                }
            }
        } catch (error) {
            console.warn(
                "Expense ledger lookup by expense_id failed:",
                error.message
            );
        }

        /*
           SECONDARY:
           EXP-ID
        */

        try {
            const {
                data,
                error
            } =
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
                        referenceNumber
                    )
                    .order(
                        "created_at",
                        {
                            ascending:
                                false
                        }
                    );

            if (
                !error &&
                Array.isArray(data)
            ) {
                const valid =
                    data.filter(
                        row =>
                            row.is_reversal !==
                                true &&
                            String(
                                row.transaction_type ||
                                ""
                            ).toLowerCase() ===
                                EXPENSE_TRANSACTION_TYPE &&
                            Number(
                                row.amount ||
                                0
                            ) > 0
                    );

                if (
                    valid.length
                ) {
                    return valid;
                }
            }
        } catch (error) {
            console.warn(
                "Expense ledger lookup by reference failed:",
                error.message
            );
        }

        return [];
    }

    function expenseIsPosted(
        rows
    ) {
        if (
            !Array.isArray(rows) ||
            !rows.length
        ) {
            return false;
        }

        return rows.some(
            row =>
                row &&
                row.is_reversal !==
                    true &&
                String(
                    row.transaction_type ||
                    ""
                ).toLowerCase() ===
                    EXPENSE_TRANSACTION_TYPE &&
                Number(
                    row.amount ||
                    0
                ) > 0
        );
    }

    /* =====================================================
       RENDER
    ===================================================== */

    async function renderExpenses() {
        const tbody =
            getElement(
                "expensesTableBody",
                "expenseTableBody"
            );

        if (!tbody) {
            console.warn(
                "Expenses table body not found."
            );

            return;
        }

        tbody.innerHTML =
            '<tr><td colspan="10" style="text-align:center;">Checking ledger status...</td></tr>';

        const rows = [];

        for (
            const expense of
            allExpenses
        ) {
            let ledgerRows =
                [];

            try {
                ledgerRows =
                    await getExpenseLedgerEntry(
                        expense.id
                    );
            } catch (error) {
                console.warn(
                    "Ledger lookup failed for expense",
                    expense.id,
                    error.message
                );
            }

            const posted =
                expenseIsPosted(
                    ledgerRows
                );

            rows.push({
                expense,
                posted,
                ledgerRows
            });
        }

        if (!rows.length) {
            tbody.innerHTML =
                '<tr><td colspan="10" style="text-align:center;">No expenses found.</td></tr>';

            return;
        }

        tbody.innerHTML =
            rows
                .map(
                    item => {
                        const expense =
                            item.expense;

                        const posted =
                            item.posted;

                        const category =
                            expense.category ||
                            "General";

                        return `
                            <tr>

                                <td>
                                    ${escapeHtml(
                                        expense.id
                                    )}
                                </td>

                                <td>
                                    ${escapeHtml(
                                        formatDate(
                                            expense.expense_date
                                        )
                                    )}
                                </td>

                                <td>
                                    ${escapeHtml(
                                        expense.description ||
                                        ""
                                    )}
                                </td>

                                <td>
                                    ${escapeHtml(
                                        category
                                    )}
                                </td>

                                <td>
                                    KES ${money(
                                        expense.amount
                                    )}
                                </td>

                                <td>
                                    ${
                                        posted
                                            ? `
                                                <span
                                                    style="
                                                        display:inline-block;
                                                        padding:5px 10px;
                                                        border-radius:20px;
                                                        background:#dcfce7;
                                                        color:#166534;
                                                        font-weight:700;
                                                    "
                                                >
                                                    POSTED
                                                </span>
                                              `
                                            : `
                                                <span
                                                    style="
                                                        display:inline-block;
                                                        padding:5px 10px;
                                                        border-radius:20px;
                                                        background:#fef3c7;
                                                        color:#92400e;
                                                        font-weight:700;
                                                    "
                                                >
                                                    PENDING
                                                </span>
                                              `
                                    }
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
                                            ? `
                                                <button
                                                    type="button"
                                                    class="expense-ledger-btn"
                                                    data-expense-id="${escapeHtml(
                                                        expense.id
                                                    )}"
                                                >
                                                    Ledger
                                                </button>
                                              `
                                            : `
                                                <button
                                                    type="button"
                                                    class="expense-post-btn"
                                                    data-expense-id="${escapeHtml(
                                                        expense.id
                                                    )}"
                                                >
                                                    Post
                                                </button>
                                              `
                                    }
                                </td>

                                <td>
                                    ${
                                        posted
                                            ? `
                                                <button
                                                    type="button"
                                                    disabled
                                                    title="Posted expenses cannot be edited"
                                                >
                                                    Edit
                                                </button>

                                                <button
                                                    type="button"
                                                    disabled
                                                    title="Posted expenses cannot be deleted"
                                                >
                                                    Delete
                                                </button>
                                              `
                                            : `
                                                <button
                                                    type="button"
                                                    class="expense-edit-btn"
                                                    data-expense-id="${escapeHtml(
                                                        expense.id
                                                    )}"
                                                >
                                                    Edit
                                                </button>

                                                <button
                                                    type="button"
                                                    class="expense-delete-btn"
                                                    data-expense-id="${escapeHtml(
                                                        expense.id
                                                    )}"
                                                >
                                                    Delete
                                                </button>
                                              `
                                    }
                                </td>

                            </tr>
                        `;
                    }
                )
                .join("");
    }

    /* =====================================================
       SAVE EXPENSE
    ===================================================== */

    async function saveExpense() {
        try {
            const hotelId =
                await getHotelId();

            const supabase =
                getSupabase();

            const descriptionElement =
                getElement(
                    "expenseDescription",
                    "description"
                );

            const amountElement =
                getElement(
                    "expenseAmount",
                    "amount"
                );

            const dateElement =
                getElement(
                    "expenseDate",
                    "expense_date"
                );

            const categoryElement =
                getElement(
                    "expenseCategory",
                    "category"
                );

            const paymentElement =
                getElement(
                    "expensePaymentSource",
                    "paymentSource",
                    "paymentMethod"
                );

            const description =
                descriptionElement?.value
                    ?.trim() ||
                "";

            const amount =
                Number(
                    amountElement?.value ||
                    0
                );

            const expenseDate =
                dateElement?.value ||
                getToday();

            const category =
                categoryElement?.value
                    ?.trim() ||
                "General";

            const paymentSource =
                paymentElement?.value ||
                "Cash";

            if (!description) {
                throw new Error(
                    "Please enter the expense description."
                );
            }

            if (
                !Number.isFinite(
                    amount
                ) ||
                amount <= 0
            ) {
                throw new Error(
                    "Please enter a valid expense amount."
                );
            }

            /*
               EDIT
            */

            if (
                currentEditingExpenseId
            ) {
                const existingLedger =
                    await getExpenseLedgerEntry(
                        currentEditingExpenseId
                    );

                if (
                    expenseIsPosted(
                        existingLedger
                    )
                ) {
                    throw new Error(
                        "This expense is already posted and cannot be edited."
                    );
                }

                const {
                    error
                } =
                    await supabase
                        .from("expenses")
                        .update({
                            description,
                            amount,
                            expense_date:
                                expenseDate,
                            category
                        })
                        .eq(
                            "id",
                            currentEditingExpenseId
                        )
                        .eq(
                            "hotel_id",
                            hotelId
                        );

                if (error) {
                    throw new Error(
                        error.message
                    );
                }

                savePaymentSource(
                    currentEditingExpenseId,
                    paymentSource
                );

                showMessage(
                    "Expense updated successfully."
                );

            } else {

                /*
                   NEW EXPENSE
                */

                const {
                    data,
                    error
                } =
                    await supabase
                        .from("expenses")
                        .insert({
                            description,
                            amount,
                            expense_date:
                                expenseDate,
                            category,
                            hotel_id:
                                hotelId
                        })
                        .select("id")
                        .single();

                if (error) {
                    throw new Error(
                        error.message
                    );
                }

                if (!data?.id) {
                    throw new Error(
                        "Expense was saved but no expense ID was returned."
                    );
                }

                savePaymentSource(
                    data.id,
                    paymentSource
                );

                showMessage(
                    "Expense saved successfully. It is currently PENDING until you click Post."
                );
            }

            clearExpenseForm();

            await loadExpenses();

        } catch (error) {
            console.error(
                "EDU TECH saveExpense error:",
                error
            );

            showMessage(
                "Unable to save expense: " +
                error.message
            );
        }
    }

    /* =====================================================
       POST EXPENSE
    ===================================================== */

    async function postExpense(
        expenseId
    ) {
        try {
            const hotelId =
                await getHotelId();

            const supabase =
                getSupabase();

            /*
               Load expense.
            */

            const {
                data: expense,
                error: expenseError
            } =
                await supabase
                    .from("expenses")
                    .select("*")
                    .eq(
                        "id",
                        expenseId
                    )
                    .eq(
                        "hotel_id",
                        hotelId
                    )
                    .maybeSingle();

            if (expenseError) {
                throw new Error(
                    "Unable to load expense: " +
                    expenseError.message
                );
            }

            if (!expense) {
                throw new Error(
                    "Expense not found."
                );
            }

            /*
               Check duplicate posting.
            */

            const existingRows =
                await getExpenseLedgerEntry(
                    expense.id
                );

            if (
                expenseIsPosted(
                    existingRows
                )
            ) {
                showMessage(
                    "This expense is already POSTED to the financial ledger."
                );

                await loadExpenses();

                return;
            }

            /*
               Financial engine.
            */

            const engine =
                window.EDUTECH_FINANCIAL_ENGINE ||
                window.FinancialEngine;

            if (
                !engine ||
                typeof engine.postExpense !==
                    "function"
            ) {
                throw new Error(
                    "Financial engine is not loaded. Make sure financial-engine.js is loaded before expenses.js."
                );
            }

            console.log(
                "EDU TECH posting expense:",
                expense
            );

            const postingResult =
                await engine.postExpense({
                    hotelId:
                        hotelId,

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

            console.log(
                "EDU TECH expense posting result:",
                postingResult
            );

            /*
               Verify directly from database.
            */

            const verifyRows =
                await getExpenseLedgerEntry(
                    expense.id
                );

            console.log(
                "EDU TECH verified expense ledger rows:",
                verifyRows
            );

            if (
                !expenseIsPosted(
                    verifyRows
                )
            ) {
                throw new Error(
                    "The financial engine completed, but the expense ledger entry could not be verified."
                );
            }

            showMessage(
                "Expense posted successfully to the financial ledger."
            );

            await loadExpenses();

        } catch (error) {
            console.error(
                "EDU TECH EXPENSE POSTING FAILED:",
                error
            );

            showMessage(
                "Expense ledger posting failed: " +
                error.message
            );
        }
    }

    /* =====================================================
       EDIT EXPENSE
    ===================================================== */

    async function editExpense(
        expenseId
    ) {
        try {
            const expense =
                allExpenses.find(
                    item =>
                        String(
                            item.id
                        ) ===
                        String(
                            expenseId
                        )
                );

            if (!expense) {
                throw new Error(
                    "Expense not found."
                );
            }

            const ledgerRows =
                await getExpenseLedgerEntry(
                    expenseId
                );

            if (
                expenseIsPosted(
                    ledgerRows
                )
            ) {
                showMessage(
                    "Posted expenses cannot be edited."
                );

                return;
            }

            currentEditingExpenseId =
                expenseId;

            const descriptionElement =
                getElement(
                    "expenseDescription",
                    "description"
                );

            const amountElement =
                getElement(
                    "expenseAmount",
                    "amount"
                );

            const dateElement =
                getElement(
                    "expenseDate",
                    "expense_date"
                );

            const categoryElement =
                getElement(
                    "expenseCategory",
                    "category"
                );

            const paymentElement =
                getElement(
                    "expensePaymentSource",
                    "paymentSource",
                    "paymentMethod"
                );

            if (descriptionElement) {
                descriptionElement.value =
                    expense.description ||
                    "";
            }

            if (amountElement) {
                amountElement.value =
                    expense.amount ||
                    "";
            }

            if (dateElement) {
                dateElement.value =
                    expense.expense_date ||
                    getToday();
            }

            if (categoryElement) {
                categoryElement.value =
                    expense.category ||
                    "General";
            }

            if (paymentElement) {
                paymentElement.value =
                    getPaymentSource(
                        expense.id
                    );
            }

            openExpenseForm();

        } catch (error) {
            console.error(
                "EDU TECH editExpense error:",
                error
            );

            showMessage(
                "Unable to edit expense: " +
                error.message
            );
        }
    }

    /* =====================================================
       DELETE EXPENSE
    ===================================================== */

    async function deleteExpense(
        expenseId
    ) {
        try {
            const ledgerRows =
                await getExpenseLedgerEntry(
                    expenseId
                );

            if (
                expenseIsPosted(
                    ledgerRows
                )
            ) {
                showMessage(
                    "Posted expenses cannot be deleted."
                );

                return;
            }

            const confirmed =
                confirm(
                    "Are you sure you want to delete this expense?"
                );

            if (!confirmed) {
                return;
            }

            const hotelId =
                await getHotelId();

            const supabase =
                getSupabase();

            const {
                error
            } =
                await supabase
                    .from("expenses")
                    .delete()
                    .eq(
                        "id",
                        expenseId
                    )
                    .eq(
                        "hotel_id",
                        hotelId
                    );

            if (error) {
                throw new Error(
                    error.message
                );
            }

            localStorage.removeItem(
                PAYMENT_SOURCE_PREFIX +
                expenseId
            );

            showMessage(
                "Expense deleted successfully."
            );

            await loadExpenses();

        } catch (error) {
            console.error(
                "EDU TECH deleteExpense error:",
                error
            );

            showMessage(
                "Unable to delete expense: " +
                error.message
            );
        }
    }

    /* =====================================================
       VIEW LEDGER
    ===================================================== */

    async function viewExpenseLedger(
        expenseId
    ) {
        try {
            const rows =
                await getExpenseLedgerEntry(
                    expenseId
                );

            if (!rows.length) {
                showMessage(
                    "No ledger entry was found for this expense."
                );

                return;
            }

            const row =
                rows[0];

            const text =
                [
                    "EXPENSE LEDGER ENTRY",
                    "",
                    "Transaction ID: " +
                        (
                            row.id ||
                            ""
                        ),

                    "Expense ID: " +
                        (
                            row.expense_id ||
                            expenseId
                        ),

                    "Transaction Number: " +
                        (
                            row.transaction_number ||
                            ""
                        ),

                    "Transaction Type: " +
                        (
                            row.transaction_type ||
                            ""
                        ),

                    "Date: " +
                        (
                            row.transaction_date ||
                            ""
                        ),

                    "Description: " +
                        (
                            row.description ||
                            ""
                        ),

                    "Amount: KES " +
                        money(
                            row.amount
                        ),

                    "Money Out: KES " +
                        money(
                            row.money_out
                        ),

                    "Balance After: KES " +
                        money(
                            row.balance_after
                        ),

                    "Reference: " +
                        (
                            row.reference_number ||
                            ""
                        ),

                    "Status: POSTED"
                ].join("\n");

            alert(text);

        } catch (error) {
            console.error(
                "EDU TECH viewExpenseLedger error:",
                error
            );

            showMessage(
                "Unable to view expense ledger: " +
                error.message
            );
        }
    }

    /* =====================================================
       VOUCHER
    ===================================================== */

    function viewExpenseVoucher(
        expenseId
    ) {
        const expense =
            allExpenses.find(
                item =>
                    String(
                        item.id
                    ) ===
                    String(
                        expenseId
                    )
            );

        if (!expense) {
            showMessage(
                "Expense not found."
            );

            return;
        }

        currentVoucherExpense =
            expense;

        const modal =
            getElement(
                "expenseVoucherModal",
                "voucherModal"
            );

        if (modal) {
            modal.style.display =
                "flex";

            return;
        }

        alert(
            [
                "EXPENSE VOUCHER",
                "",
                "Expense #: " +
                    expense.id,

                "Date: " +
                    formatDate(
                        expense.expense_date
                    ),

                "Description: " +
                    expense.description,

                "Category: " +
                    (
                        expense.category ||
                        "General"
                    ),

                "Amount: KES " +
                    money(
                        expense.amount
                    ),

                "Payment Source: " +
                    getPaymentSource(
                        expense.id
                    )
            ].join("\n")
        );
    }

    /* =====================================================
       FORM HELPERS
    ===================================================== */

    function clearExpenseForm() {
        currentEditingExpenseId =
            null;

        const descriptionElement =
            getElement(
                "expenseDescription",
                "description"
            );

        const amountElement =
            getElement(
                "expenseAmount",
                "amount"
            );

        const dateElement =
            getElement(
                "expenseDate",
                "expense_date"
            );

        const categoryElement =
            getElement(
                "expenseCategory",
                "category"
            );

        const paymentElement =
            getElement(
                "expensePaymentSource",
                "paymentSource",
                "paymentMethod"
            );

        if (descriptionElement) {
            descriptionElement.value =
                "";
        }

        if (amountElement) {
            amountElement.value =
                "";
        }

        if (dateElement) {
            dateElement.value =
                getToday();
        }

        if (categoryElement) {
            categoryElement.value =
                "General";
        }

        if (paymentElement) {
            paymentElement.value =
                "Cash";
        }
    }

    function clearForm() {
        clearExpenseForm();
    }

    function openExpenseForm() {
        const modal =
            getElement(
                "expenseModal",
                "expenseFormModal"
            );

        if (modal) {
            modal.style.display =
                "flex";
        }
    }

    function closeModal() {
        const modals =
            document.querySelectorAll(
                ".modal"
            );

        modals.forEach(
            modal => {
                modal.style.display =
                    "none";
            }
        );

        currentEditingExpenseId =
            null;
    }

    function printVoucher() {
        window.print();
    }

    /* =====================================================
       EVENT DELEGATION
    ===================================================== */

    function attachTableEvents() {
        const tbody =
            getElement(
                "expensesTableBody",
                "expenseTableBody"
            );

        if (
            !tbody ||
            tbody.dataset
                .eventsAttached ===
                "true"
        ) {
            return;
        }

        tbody.dataset
            .eventsAttached =
            "true";

        tbody.addEventListener(
            "click",
            async function (event) {

                const postButton =
                    event.target.closest(
                        ".expense-post-btn"
                    );

                if (postButton) {
                    await postExpense(
                        postButton.dataset
                            .expenseId
                    );

                    return;
                }

                const editButton =
                    event.target.closest(
                        ".expense-edit-btn"
                    );

                if (editButton) {
                    await editExpense(
                        editButton.dataset
                            .expenseId
                    );

                    return;
                }

                const deleteButton =
                    event.target.closest(
                        ".expense-delete-btn"
                    );

                if (deleteButton) {
                    await deleteExpense(
                        deleteButton.dataset
                            .expenseId
                    );

                    return;
                }

                const ledgerButton =
                    event.target.closest(
                        ".expense-ledger-btn"
                    );

                if (ledgerButton) {
                    await viewExpenseLedger(
                        ledgerButton.dataset
                            .expenseId
                    );

                    return;
                }
            }
        );
    }

    /* =====================================================
       FORM EVENTS
    ===================================================== */

    function attachFormEvents() {
        const saveButton =
            getElement(
                "saveExpenseBtn",
                "saveExpenseButton"
            );

        if (
            saveButton &&
            saveButton.dataset
                .eventsAttached !==
                "true"
        ) {
            saveButton.dataset
                .eventsAttached =
                "true";

            saveButton.addEventListener(
                "click",
                saveExpense
            );
        }

        const clearButton =
            getElement(
                "clearExpenseBtn",
                "clearExpenseButton"
            );

        if (
            clearButton &&
            clearButton.dataset
                .eventsAttached !==
                "true"
        ) {
            clearButton.dataset
                .eventsAttached =
                "true";

            clearButton.addEventListener(
                "click",
                clearExpenseForm
            );
        }
    }

    /* =====================================================
       INITIALIZE
    ===================================================== */

    async function initExpenses() {
        if (pageStarted) {
            return;
        }

        pageStarted = true;

        try {
            await loadCurrentHotel();
        } catch (error) {
            console.warn(
                "Unable to load current hotel:",
                error.message
            );
        }

        attachTableEvents();
        attachFormEvents();

        const dateElement =
            getElement(
                "expenseDate",
                "expense_date"
            );

        if (
            dateElement &&
            !dateElement.value
        ) {
            dateElement.value =
                getToday();
        }

        await loadExpenses();

        window.EDUTECH_EXPENSES_READY =
            true;

        console.log(
            "EDU TECH Expenses module ready."
        );
    }

    /* =====================================================
       PUBLIC FUNCTIONS
    ===================================================== */

    window.loadExpenses =
        loadExpenses;

    window.refreshExpenses =
        loadExpenses;

    window.saveExpense =
        saveExpense;

    window.handleExpenseSave =
        saveExpense;

    window.clearExpenseForm =
        clearExpenseForm;

    window.clearForm =
        clearForm;

    window.openExpenseForm =
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
        closeModal;

    window.EDUTECH_EXPENSES = {
        getHotelId,

        getHotel: () =>
            currentHotel,

        reload:
            loadExpenses
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
            initExpenses,
            {
                once: true
            }
        );
    } else {
        initExpenses();
    }

})();