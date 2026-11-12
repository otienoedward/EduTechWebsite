/* ============================================================
   EDU TECH HOTEL MANAGEMENT SYSTEM
   FINANCIAL ENGINE
   Version: 2026.11.12.09
   ============================================================ */

(function () {
    "use strict";

    console.log("Loading EDU TECH Financial Engine 2026.11.12.09...");

    /* =========================================================
       CONSTANTS
       ========================================================= */

    const ALLOWED_TRANSACTION_TYPES = [
        "income",
        "expense",
        "salary",
        "salary_advance",
        "transfer",
        "other"
    ];

    const ENGINE_VERSION = "2026.11.12.09";

    /* =========================================================
       BASIC HELPERS
       ========================================================= */

    function roundMoney(value) {
        const number = Number(value || 0);

        if (!Number.isFinite(number)) {
            return 0;
        }

        return Math.round((number + Number.EPSILON) * 100) / 100;
    }

    function nullable(value) {
        if (
            value === undefined ||
            value === null ||
            value === ""
        ) {
            return null;
        }

        return value;
    }

    function text(value, fallback = "") {
        if (
            value === undefined ||
            value === null
        ) {
            return fallback;
        }

        return String(value);
    }

    function todayISO() {
        const date = new Date();

        return date.toISOString().slice(0, 10);
    }

    function nowISO() {
        return new Date().toISOString();
    }

    function generateNumber(prefix) {
        return `${prefix}-${Date.now()}-${Math.floor(
            Math.random() * 9000 + 1000
        )}`;
    }

    function normalizeTransactionType(type) {
        const value = text(type, "other")
            .trim()
            .toLowerCase();

        if (!ALLOWED_TRANSACTION_TYPES.includes(value)) {
            throw new Error(
                `Invalid transaction type "${value}". ` +
                `Allowed types are: ${ALLOWED_TRANSACTION_TYPES.join(", ")}.`
            );
        }

        return value;
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

        if (
            window.supabase &&
            typeof window.supabase.from === "function"
        ) {
            return window.supabase;
        }

        if (
            window.supabase &&
            typeof window.supabase.createClient === "function" &&
            window.SUPABASE_URL &&
            window.SUPABASE_ANON_KEY
        ) {
            if (!window.__EDUTECH_SUPABASE_CLIENT__) {
                window.__EDUTECH_SUPABASE_CLIENT__ =
                    window.supabase.createClient(
                        window.SUPABASE_URL,
                        window.SUPABASE_ANON_KEY
                    );
            }

            return window.__EDUTECH_SUPABASE_CLIENT__;
        }

        throw new Error(
            "Supabase client is not available. Check supabase.js."
        );
    }

    async function waitForSupabaseClient(timeout = 10000) {
        const started = Date.now();

        while (Date.now() - started < timeout) {
            try {
                return getSupabase();
            } catch (error) {
                await new Promise(resolve =>
                    setTimeout(resolve, 100)
                );
            }
        }

        throw new Error(
            "Supabase client could not be loaded."
        );
    }

    /* =========================================================
       CURRENT USER
       ========================================================= */

    async function getCurrentUser() {
        const supabase = await waitForSupabaseClient();

        const {
            data,
            error
        } = await supabase.auth.getUser();

        if (error) {
            return null;
        }

        return data?.user || null;
    }

    async function getCurrentUserId() {
        const user = await getCurrentUser();

        return user?.id || null;
    }

    /* =========================================================
       FINANCIAL ACCOUNT HELPERS
       ========================================================= */

    async function getAccountByCode(hotelId, accountCode) {
        const supabase = await waitForSupabaseClient();

        const {
            data,
            error
        } = await supabase
            .from("financial_accounts")
            .select("*")
            .eq("hotel_id", hotelId)
            .eq("account_code", String(accountCode))
            .maybeSingle();

        if (error) {
            throw new Error(
                `Unable to load financial account ${accountCode}: ${error.message}`
            );
        }

        return data || null;
    }

    async function ensureAccount(
        hotelId,
        accountCode,
        accountName,
        accountType
    ) {
        let account = await getAccountByCode(
            hotelId,
            accountCode
        );

        if (account) {
            return account;
        }

        const supabase = await waitForSupabaseClient();

        const {
            data,
            error
        } = await supabase
            .from("financial_accounts")
            .insert({
                hotel_id: hotelId,
                account_code: String(accountCode),
                account_name: accountName,
                account_type: accountType,
                status: "active"
            })
            .select("*")
            .single();

        if (error) {
            /*
             * Another request may have created it between
             * our SELECT and INSERT.
             */
            account = await getAccountByCode(
                hotelId,
                accountCode
            );

            if (account) {
                return account;
            }

            throw new Error(
                `Unable to create financial account ${accountCode}: ${error.message}`
            );
        }

        return data;
    }

    async function ensureStandardAccounts(hotelId) {
        const accounts = {};

        accounts.bank = await ensureAccount(
            hotelId,
            "1000",
            "Bank",
            "asset"
        );

        accounts.cash = await ensureAccount(
            hotelId,
            "1010",
            "Cash",
            "asset"
        );

        accounts.mpesa = await ensureAccount(
            hotelId,
            "1020",
            "M-Pesa",
            "asset"
        );

        accounts.employeeAdvances = await ensureAccount(
            hotelId,
            "1030",
            "Employee Advances",
            "asset"
        );

        accounts.card = await ensureAccount(
            hotelId,
            "1040",
            "Card",
            "asset"
        );

        accounts.guestReceivables = await ensureAccount(
            hotelId,
            "1100",
            "Guest Receivables",
            "asset"
        );

        accounts.payables = await ensureAccount(
            hotelId,
            "2000",
            "Accounts Payable",
            "liability"
        );

        accounts.salaryPayable = await ensureAccount(
            hotelId,
            "2010",
            "Employee Salary Payable",
            "liability"
        );

        accounts.vatPayable = await ensureAccount(
            hotelId,
            "2030",
            "VAT Payable",
            "liability"
        );

        accounts.ownerEquity = await ensureAccount(
            hotelId,
            "3000",
            "Owner Equity",
            "equity"
        );

        accounts.roomRevenue = await ensureAccount(
            hotelId,
            "4000",
            "Room Revenue",
            "revenue"
        );

        accounts.restaurantRevenue = await ensureAccount(
            hotelId,
            "4010",
            "Restaurant Revenue",
            "revenue"
        );

        accounts.otherRevenue = await ensureAccount(
            hotelId,
            "4020",
            "Other Revenue",
            "revenue"
        );

        accounts.salaryExpense = await ensureAccount(
            hotelId,
            "5000",
            "Salaries Expense",
            "expense"
        );

        accounts.foodExpense = await ensureAccount(
            hotelId,
            "5010",
            "Food Expense",
            "expense"
        );

        accounts.utilitiesExpense = await ensureAccount(
            hotelId,
            "5020",
            "Utilities Expense",
            "expense"
        );

        accounts.maintenanceExpense = await ensureAccount(
            hotelId,
            "5030",
            "Maintenance Expense",
            "expense"
        );

        accounts.cleaningExpense = await ensureAccount(
            hotelId,
            "5040",
            "Cleaning Expense",
            "expense"
        );

        accounts.inventoryExpense = await ensureAccount(
            hotelId,
            "5050",
            "Inventory Expense",
            "expense"
        );

        accounts.otherExpense = await ensureAccount(
            hotelId,
            "5060",
            "Other Expenses",
            "expense"
        );

        return accounts;
    }

    /* =========================================================
       PAYMENT ACCOUNT
       ========================================================= */

    async function getPaymentAccount(
        hotelId,
        paymentMethod,
        bankAccountId = null
    ) {
        const method = text(
            paymentMethod,
            "cash"
        ).trim().toLowerCase();

        if (
            method === "cash" ||
            method === "cashier"
        ) {
            return ensureAccount(
                hotelId,
                "1010",
                "Cash",
                "asset"
            );
        }

        if (
            method === "mpesa" ||
            method === "m-pesa" ||
            method === "m_pesa"
        ) {
            return ensureAccount(
                hotelId,
                "1020",
                "M-Pesa",
                "asset"
            );
        }

        if (
            method === "card" ||
            method === "visa" ||
            method === "mastercard"
        ) {
            return ensureAccount(
                hotelId,
                "1040",
                "Card",
                "asset"
            );
        }

        if (
            method === "bank" ||
            method === "bank_transfer" ||
            method === "transfer"
        ) {
            if (bankAccountId) {
                const supabase =
                    await waitForSupabaseClient();

                const {
                    data: bankAccount,
                    error
                } = await supabase
                    .from("bank_accounts")
                    .select("*")
                    .eq("id", bankAccountId)
                    .eq("hotel_id", hotelId)
                    .maybeSingle();

                if (error) {
                    throw new Error(
                        `Unable to load bank account: ${error.message}`
                    );
                }

                if (bankAccount) {
                    return ensureAccount(
                        hotelId,
                        "1000",
                        "Bank",
                        "asset"
                    );
                }
            }

            return ensureAccount(
                hotelId,
                "1000",
                "Bank",
                "asset"
            );
        }

        return ensureAccount(
            hotelId,
            "1010",
            "Cash",
            "asset"
        );
    }

    /* =========================================================
       TRANSACTION NUMBER
       ========================================================= */

    async function transactionNumberExists(
        hotelId,
        transactionNumber
    ) {
        const supabase = await waitForSupabaseClient();

        const {
            data,
            error
        } = await supabase
            .from("financial_transactions")
            .select("id")
            .eq("hotel_id", hotelId)
            .eq(
                "transaction_number",
                transactionNumber
            )
            .maybeSingle();

        if (error) {
            throw new Error(
                `Unable to check transaction number: ${error.message}`
            );
        }

        return !!data;
    }

    async function uniqueTransactionNumber(
        hotelId,
        prefix
    ) {
        let number = generateNumber(prefix);

        let attempts = 0;

        while (
            await transactionNumberExists(
                hotelId,
                number
            )
        ) {
            attempts++;

            number =
                `${prefix}-${Date.now()}-${attempts}`;
        }

        return number;
    }

    /* =========================================================
       GENERIC JOURNAL POST
       ========================================================= */

    async function postJournal(options = {}) {
        const hotelId = options.hotelId;

        if (!hotelId) {
            throw new Error(
                "Hotel ID is required."
            );
        }

        const amount = roundMoney(
            options.amount
        );

        if (amount <= 0) {
            throw new Error(
                "Journal amount must be greater than zero."
            );
        }

        const transactionType =
            normalizeTransactionType(
                options.transactionType || "other"
            );

        if (
            !options.debitAccountId ||
            !options.creditAccountId
        ) {
            throw new Error(
                "Both debit and credit accounts are required."
            );
        }

        if (
            Number(options.debitAccountId) ===
            Number(options.creditAccountId)
        ) {
            throw new Error(
                "Debit and credit accounts cannot be the same."
            );
        }

        const supabase =
            await waitForSupabaseClient();

        const transactionNumber =
            options.transactionNumber ||
            await uniqueTransactionNumber(
                hotelId,
                options.prefix || "TXN"
            );

        const userId =
            options.createdBy ??
            await getCurrentUserId();

        const row = {
            hotel_id: hotelId,
            transaction_number:
                transactionNumber,
            transaction_date:
                options.transactionDate ||
                todayISO(),
            description:
                text(
                    options.description,
                    "Financial transaction"
                ),
            reference_number:
                nullable(
                    options.referenceNumber
                ),
            transaction_type:
                transactionType,
            bank_account_id:
                nullable(
                    options.bankAccountId
                ),
            debit_account_id:
                options.debitAccountId,
            credit_account_id:
                options.creditAccountId,
            amount: amount,
            employee_id:
                nullable(options.employeeId),
            payment_id:
                nullable(options.paymentId),
            expense_id:
                nullable(options.expenseId),
            notes:
                nullable(options.notes),
            created_by:
                nullable(userId),
            money_in:
                roundMoney(
                    options.moneyIn || 0
                ),
            money_out:
                roundMoney(
                    options.moneyOut || 0
                ),
            balance_after:
                nullable(options.balanceAfter),
            is_reversal:
                !!options.isReversal,
            reversed_transaction_id:
                nullable(
                    options.reversedTransactionId
                ),
            reversal_reason:
                nullable(
                    options.reversalReason
                )
        };

        const {
            data,
            error
        } = await supabase
            .from("financial_transactions")
            .insert(row)
            .select("*")
            .single();

        if (error) {
            throw new Error(
                `Unable to post financial transaction: ${error.message}`
            );
        }

        return data;
    }

    /* =========================================================
       BATCH JOURNAL
       ========================================================= */

    async function postJournalBatch(
        options = {}
    ) {
        const hotelId = options.hotelId;

        if (!hotelId) {
            throw new Error(
                "Hotel ID is required."
            );
        }

        const entries = Array.isArray(
            options.entries
        )
            ? options.entries
            : [];

        if (!entries.length) {
            throw new Error(
                "No journal entries supplied."
            );
        }

        const amountTotal = roundMoney(
            entries.reduce(
                (sum, entry) =>
                    sum +
                    Number(
                        entry.amount || 0
                    ),
                0
            )
        );

        if (amountTotal <= 0) {
            throw new Error(
                "Journal amount must be greater than zero."
            );
        }

        const transactionNumber =
            options.transactionNumber ||
            await uniqueTransactionNumber(
                hotelId,
                options.prefix || "JNL"
            );

        const userId =
            options.createdBy ??
            await getCurrentUserId();

        const supabase =
            await waitForSupabaseClient();

        const rows = entries.map(
            entry => ({
                hotel_id: hotelId,
                transaction_number:
                    transactionNumber,
                transaction_date:
                    options.transactionDate ||
                    todayISO(),
                description:
                    text(
                        entry.description ||
                        options.description,
                        "Financial transaction"
                    ),
                reference_number:
                    nullable(
                        entry.referenceNumber ??
                        options.referenceNumber
                    ),
                transaction_type:
                    normalizeTransactionType(
                        entry.transactionType ||
                        options.transactionType ||
                        "other"
                    ),
                bank_account_id:
                    nullable(
                        entry.bankAccountId ??
                        options.bankAccountId
                    ),
                debit_account_id:
                    entry.debitAccountId,
                credit_account_id:
                    entry.creditAccountId,
                amount:
                    roundMoney(
                        entry.amount
                    ),
                employee_id:
                    nullable(
                        entry.employeeId ??
                        options.employeeId
                    ),
                payment_id:
                    nullable(
                        entry.paymentId ??
                        options.paymentId
                    ),
                expense_id:
                    nullable(
                        entry.expenseId ??
                        options.expenseId
                    ),
                notes:
                    nullable(
                        entry.notes ??
                        options.notes
                    ),
                created_by:
                    nullable(userId),
                money_in:
                    roundMoney(
                        entry.moneyIn ??
                        options.moneyIn ??
                        0
                    ),
                money_out:
                    roundMoney(
                        entry.moneyOut ??
                        options.moneyOut ??
                        0
                    ),
                balance_after:
                    nullable(
                        entry.balanceAfter
                    ),
                is_reversal:
                    !!(
                        entry.isReversal ??
                        options.isReversal
                    ),
                reversed_transaction_id:
                    nullable(
                        entry.reversedTransactionId ??
                        options.reversedTransactionId
                    ),
                reversal_reason:
                    nullable(
                        entry.reversalReason ??
                        options.reversalReason
                    )
            })
        );

        const {
            data,
            error
        } = await supabase
            .from("financial_transactions")
            .insert(rows)
            .select("*");

        if (error) {
            throw new Error(
                `Unable to post journal batch: ${error.message}`
            );
        }

        return data || [];
    }

    /* =========================================================
       ACCOMMODATION CHARGE
       ========================================================= */

    async function postAccommodationCharge(
        options = {}
    ) {
        const hotelId =
            options.hotelId;

        const amount =
            roundMoney(
                options.amount
            );

        if (!hotelId) {
            throw new Error(
                "Hotel ID is required."
            );
        }

        if (amount <= 0) {
            throw new Error(
                "Accommodation amount must be greater than zero."
            );
        }

        const supabase =
            await waitForSupabaseClient();

        const referenceNumber =
            options.referenceNumber ||
            options.reservationId
                ? `ACCOM-${options.reservationId}`
                : null;

        if (referenceNumber) {
            const {
                data: existing
            } = await supabase
                .from("financial_transactions")
                .select("*")
                .eq("hotel_id", hotelId)
                .eq(
                    "reference_number",
                    referenceNumber
                )
                .limit(1);

            if (
                existing &&
                existing.length
            ) {
                return existing;
            }
        }

        const vatRate =
            options.vatRate === undefined
                ? 0.16
                : Number(options.vatRate);

        const vatInclusive =
            options.vatInclusive !== false;

        let netAmount;
        let vatAmount;

        if (vatInclusive) {
            netAmount =
                roundMoney(
                    amount /
                    (1 + vatRate)
                );

            vatAmount =
                roundMoney(
                    amount -
                    netAmount
                );
        } else {
            netAmount =
                roundMoney(amount);

            vatAmount =
                roundMoney(
                    amount * vatRate
                );
        }

        const totalAmount =
            roundMoney(
                netAmount +
                vatAmount
            );

        const accounts =
            await ensureStandardAccounts(
                hotelId
            );

        const transactionNumber =
            await uniqueTransactionNumber(
                hotelId,
                `ACCOM-${options.reservationId || "ROOM"}`
            );

        const userId =
            await getCurrentUserId();

        const rows = [
            {
                hotel_id: hotelId,
                transaction_number:
                    transactionNumber,
                transaction_date:
                    options.transactionDate ||
                    todayISO(),
                description:
                    options.description ||
                    "Accommodation charge - Room Revenue",
                reference_number:
                    referenceNumber,
                transaction_type:
                    "income",
                bank_account_id:
                    null,
                debit_account_id:
                    accounts.guestReceivables.id,
                credit_account_id:
                    accounts.roomRevenue.id,
                amount:
                    netAmount,
                employee_id:
                    null,
                payment_id:
                    null,
                expense_id:
                    null,
                notes:
                    nullable(options.notes),
                created_by:
                    nullable(userId),
                money_in:
                    0,
                money_out:
                    0,
                balance_after:
                    null,
                is_reversal:
                    false,
                reversed_transaction_id:
                    null,
                reversal_reason:
                    null
            }
        ];

        if (vatAmount > 0) {
            rows.push({
                hotel_id: hotelId,
                transaction_number:
                    transactionNumber,
                transaction_date:
                    options.transactionDate ||
                    todayISO(),
                description:
                    options.description ||
                    "Accommodation charge - VAT",
                reference_number:
                    referenceNumber
                        ? `${referenceNumber}-VAT`
                        : null,
                transaction_type:
                    "income",
                bank_account_id:
                    null,
                debit_account_id:
                    accounts.guestReceivables.id,
                credit_account_id:
                    accounts.vatPayable.id,
                amount:
                    vatAmount,
                employee_id:
                    null,
                payment_id:
                    null,
                expense_id:
                    null,
                notes:
                    nullable(options.notes),
                created_by:
                    nullable(userId),
                money_in:
                    0,
                money_out:
                    0,
                balance_after:
                    null,
                is_reversal:
                    false,
                reversed_transaction_id:
                    null,
                reversal_reason:
                    null
            });
        }

        const {
            data,
            error
        } = await supabase
            .from("financial_transactions")
            .insert(rows)
            .select("*");

        if (error) {
            throw new Error(
                `Unable to post accommodation charge: ${error.message}`
            );
        }

        return {
            transactions: data || [],
            grossAmount: totalAmount,
            netAmount,
            vatAmount
        };
    }

    /* =========================================================
       PAYMENT
       ========================================================= */

    async function postPayment(
        options = {}
    ) {
        const hotelId =
            options.hotelId;

        const amount =
            roundMoney(
                options.amount
            );

        if (!hotelId) {
            throw new Error(
                "Hotel ID is required."
            );
        }

        if (amount <= 0) {
            throw new Error(
                "Payment amount must be greater than zero."
            );
        }

        const supabase =
            await waitForSupabaseClient();

        const paymentId =
            options.paymentId || null;

        const reference =
            options.referenceNumber ||
            (
                paymentId
                    ? `PAY-${paymentId}`
                    : `PAY-${Date.now()}`
            );

        const {
            data: duplicate
        } = await supabase
            .from("financial_transactions")
            .select("*")
            .eq("hotel_id", hotelId)
            .eq(
                "reference_number",
                reference
            )
            .limit(1);

        if (
            duplicate &&
            duplicate.length
        ) {
            return duplicate[0];
        }

        const accounts =
            await ensureStandardAccounts(
                hotelId
            );

        const paymentAccount =
            await getPaymentAccount(
                hotelId,
                options.paymentMethod ||
                "cash",
                options.bankAccountId
            );

        return postJournal({
            hotelId,
            transactionType:
                "transfer",
            transactionNumber:
                await uniqueTransactionNumber(
                    hotelId,
                    "PAY"
                ),
            transactionDate:
                options.paymentDate ||
                todayISO(),
            description:
                options.description ||
                "Guest payment",
            referenceNumber:
                reference,
            debitAccountId:
                paymentAccount.id,
            creditAccountId:
                accounts.guestReceivables.id,
            amount,
            paymentId,
            notes:
                options.notes,
            moneyIn:
                amount,
            prefix:
                "PAY"
        });
    }

    /* =========================================================
       EXPENSE
       ========================================================= */

    async function postExpense(
        options = {}
    ) {
        const hotelId =
            options.hotelId;

        const amount =
            roundMoney(
                options.amount
            );

        if (!hotelId) {
            throw new Error(
                "Hotel ID is required."
            );
        }

        if (amount <= 0) {
            throw new Error(
                "Expense amount must be greater than zero."
            );
        }

        const expenseAccount =
            options.expenseAccountId ||
            options.debitAccountId;

        if (!expenseAccount) {
            throw new Error(
                "Expense account is required."
            );
        }

        const paymentAccount =
            await getPaymentAccount(
                hotelId,
                options.paymentMethod ||
                "cash",
                options.bankAccountId
            );

        return postJournal({
            hotelId,
            transactionType:
                options.transactionType ||
                "expense",
            transactionNumber:
                options.transactionNumber ||
                await uniqueTransactionNumber(
                    hotelId,
                    "EXP"
                ),
            transactionDate:
                options.expenseDate ||
                todayISO(),
            description:
                options.description ||
                "Expense",
            referenceNumber:
                options.referenceNumber,
            debitAccountId:
                expenseAccount,
            creditAccountId:
                paymentAccount.id,
            amount,
            expenseId:
                options.expenseId,
            employeeId:
                options.employeeId,
            notes:
                options.notes,
            moneyOut:
                amount,
            prefix:
                "EXP"
        });
    }

    /* =========================================================
       RESTAURANT SALE
       ========================================================= */

    async function postRestaurantSale(
        options = {}
    ) {
        const hotelId =
            options.hotelId;

        const amount =
            roundMoney(
                options.amount
            );

        if (amount <= 0) {
            throw new Error(
                "Restaurant sale amount must be greater than zero."
            );
        }

        const accounts =
            await ensureStandardAccounts(
                hotelId
            );

        const paymentAccount =
            await getPaymentAccount(
                hotelId,
                options.paymentMethod ||
                "cash",
                options.bankAccountId
            );

        return postJournal({
            hotelId,
            transactionType:
                "income",
            transactionNumber:
                await uniqueTransactionNumber(
                    hotelId,
                    "REST"
                ),
            transactionDate:
                options.transactionDate ||
                todayISO(),
            description:
                options.description ||
                "Restaurant sale",
            referenceNumber:
                options.referenceNumber,
            debitAccountId:
                paymentAccount.id,
            creditAccountId:
                accounts.restaurantRevenue.id,
            amount,
            notes:
                options.notes,
            moneyIn:
                amount,
            prefix:
                "REST"
        });
    }

    /* =========================================================
       OTHER REVENUE
       ========================================================= */

    async function postOtherRevenue(
        options = {}
    ) {
        const hotelId =
            options.hotelId;

        const amount =
            roundMoney(
                options.amount
            );

        if (amount <= 0) {
            throw new Error(
                "Revenue amount must be greater than zero."
            );
        }

        const accounts =
            await ensureStandardAccounts(
                hotelId
            );

        const paymentAccount =
            await getPaymentAccount(
                hotelId,
                options.paymentMethod ||
                "cash",
                options.bankAccountId
            );

        return postJournal({
            hotelId,
            transactionType:
                "income",
            transactionNumber:
                await uniqueTransactionNumber(
                    hotelId,
                    "REV"
                ),
            transactionDate:
                options.transactionDate ||
                todayISO(),
            description:
                options.description ||
                "Other revenue",
            referenceNumber:
                options.referenceNumber,
            debitAccountId:
                paymentAccount.id,
            creditAccountId:
                accounts.otherRevenue.id,
            amount,
            notes:
                options.notes,
            moneyIn:
                amount,
            prefix:
                "REV"
        });
    }

    /* =========================================================
       CASHIER HANDOVERS
       ========================================================= */

    async function createCashierHandover(
        options = {}
    ) {
        const hotelId =
            options.hotelId;

        if (!hotelId) {
            throw new Error(
                "Hotel ID is required."
            );
        }

        const paymentIds =
            Array.isArray(options.paymentIds)
                ? options.paymentIds
                : [];

        if (!paymentIds.length) {
            throw new Error(
                "Select at least one cash payment."
            );
        }

        const supabase =
            await waitForSupabaseClient();

        /*
         * Load selected payments.
         */
        const {
            data: payments,
            error: paymentError
        } = await supabase
            .from("payments")
            .select(
                "id, amount, payment_method, payment_date, hotel_id"
            )
            .in("id", paymentIds)
            .eq("hotel_id", hotelId);

        if (paymentError) {
            throw new Error(
                `Unable to load selected payments: ${paymentError.message}`
            );
        }

        if (!payments?.length) {
            throw new Error(
                "The selected cash payments could not be found."
            );
        }

        const validPayments =
            payments.filter(payment =>
                String(
                    payment.payment_method || ""
                ).toLowerCase() === "cash"
            );

        if (!validPayments.length) {
            throw new Error(
                "No valid cash payments were selected."
            );
        }

        const expectedAmount =
            roundMoney(
                validPayments.reduce(
                    (sum, payment) =>
                        sum +
                        Number(
                            payment.amount || 0
                        ),
                    0
                )
            );

        const actualAmount =
            roundMoney(
                options.actualAmount ??
                expectedAmount
            );

        if (actualAmount <= 0) {
            throw new Error(
                "Actual cash amount must be greater than zero."
            );
        }

        const differenceAmount =
            roundMoney(
                actualAmount -
                expectedAmount
            );

        /*
         * IMPORTANT:
         *
         * The cashier_handovers table uses a CHECK constraint.
         * We start with the known valid operational state:
         * "pending".
         *
         * The handover is changed to "balanced" only after
         * successful confirmation.
         */
        const handoverNumber =
            await uniqueHandoverNumber(
                hotelId
            );

        const receptionistUserId =
            nullable(
                options.receptionistUserId
            );

        const cashierUserId =
            nullable(
                options.cashierUserId
            );

        const {
            data: handover,
            error: handoverError
        } = await supabase
            .from("cashier_handovers")
            .insert({
                hotel_id:
                    hotelId,
                handover_number:
                    handoverNumber,
                handover_date:
                    options.handoverDate ||
                    todayISO(),
                receptionist_user_id:
                    receptionistUserId,
                cashier_user_id:
                    cashierUserId,
                expected_amount:
                    expectedAmount,
                actual_amount:
                    actualAmount,
                difference_amount:
                    differenceAmount,
                status:
                    "pending",
                notes:
                    nullable(
                        options.notes
                    )
            })
            .select("*")
            .single();

        if (handoverError) {
            throw new Error(
                `Unable to create cash handover: ${handoverError.message}`
            );
        }

        /*
         * Create handover items.
         *
         * hotel_id is explicitly included because the database
         * requires cashier_handover_items.hotel_id NOT NULL.
         */
        const items =
            validPayments.map(
                payment => ({
                    hotel_id:
                        hotelId,
                    handover_id:
                        handover.id,
                    payment_id:
                        payment.id
                })
            );

        const {
            data: handoverItems,
            error: itemError
        } = await supabase
            .from("cashier_handover_items")
            .insert(items)
            .select("*");

        if (itemError) {
            /*
             * Remove orphan parent if item insertion fails.
             */
            await supabase
                .from("cashier_handovers")
                .delete()
                .eq("id", handover.id)
                .eq("hotel_id", hotelId);

            throw new Error(
                `Unable to create cash handover items: ${itemError.message}`
            );
        }

        return {
            handover,
            items: handoverItems || [],
            payments: validPayments
        };
    }

    async function uniqueHandoverNumber(
        hotelId
    ) {
        const supabase =
            await waitForSupabaseClient();

        let number;

        for (let attempt = 0; attempt < 20; attempt++) {
            number =
                `HO-${hotelId}-${Date.now()}-${Math.floor(
                    Math.random() * 9000 + 1000
                )}`;

            const {
                data
            } = await supabase
                .from("cashier_handovers")
                .select("id")
                .eq("hotel_id", hotelId)
                .eq(
                    "handover_number",
                    number
                )
                .maybeSingle();

            if (!data) {
                return number;
            }
        }

        throw new Error(
            "Unable to generate a unique handover number."
        );
    }

    /* =========================================================
       CONFIRM CASHIER HANDOVER
       ========================================================= */

    async function confirmCashierHandover(
        options = {}
    ) {
        const hotelId =
            options.hotelId;

        const handoverId =
            options.handoverId;

        const cashierUserId =
            nullable(
                options.cashierUserId
            );

        if (!hotelId) {
            throw new Error(
                "Hotel ID is required."
            );
        }

        if (!handoverId) {
            throw new Error(
                "Handover ID is required."
            );
        }

        const supabase =
            await waitForSupabaseClient();

        /*
         * -----------------------------------------------------
         * LOAD EXISTING HANDOVER
         * -----------------------------------------------------
         */
        const {
            data: handover,
            error: loadError
        } = await supabase
            .from("cashier_handovers")
            .select("*")
            .eq("id", handoverId)
            .eq("hotel_id", hotelId)
            .maybeSingle();

        if (loadError) {
            throw new Error(
                `Unable to load cash handover: ${loadError.message}`
            );
        }

        if (!handover) {
            throw new Error(
                "Cash handover was not found."
            );
        }

        /*
         * -----------------------------------------------------
         * ALREADY BALANCED
         * -----------------------------------------------------
         */
        if (
            String(
                handover.status || ""
            ).toLowerCase() === "balanced"
        ) {
            const {
                data: existingMovement
            } = await supabase
                .from("cashier_cash_movements")
                .select("*")
                .eq("hotel_id", hotelId)
                .eq(
                    "handover_id",
                    handoverId
                )
                .maybeSingle();

            return {
                handover,
                movement:
                    existingMovement || null,
                alreadyConfirmed:
                    true
            };
        }

        /*
         * -----------------------------------------------------
         * VALIDATE AMOUNT
         * -----------------------------------------------------
         */
        const actualAmount =
            roundMoney(
                handover.actual_amount
            );

        if (actualAmount <= 0) {
            throw new Error(
                "Actual cash amount must be greater than zero."
            );
        }

        /*
         * -----------------------------------------------------
         * CHECK EXISTING CASH MOVEMENT
         * -----------------------------------------------------
         */
        const {
            data: existingMovement,
            error: movementLookupError
        } = await supabase
            .from("cashier_cash_movements")
            .select("*")
            .eq("hotel_id", hotelId)
            .eq(
                "handover_id",
                handoverId
            )
            .maybeSingle();

        if (movementLookupError) {
            throw new Error(
                `Unable to check cashier movement: ${movementLookupError.message}`
            );
        }

        let movement =
            existingMovement || null;

        /*
         * -----------------------------------------------------
         * CREATE CASH MOVEMENT ONCE
         * -----------------------------------------------------
         */
        if (!movement) {
            const movementNumber =
                `CM-HO-${handoverId}-${Date.now()}`;

            let movementData = {
                hotel_id:
                    hotelId,
                movement_number:
                    movementNumber,
                movement_date:
                    handover.handover_date ||
                    todayISO(),
                movement_type:
                    "cash_handover",
                cashier_user_id:
                    cashierUserId ||
                    nullable(
                        handover.cashier_user_id
                    ),
                handover_id:
                    handoverId,
                bank_deposit_id:
                    null,
                amount:
                    actualAmount,
                description:
                    `Cash received from handover ${handover.handover_number}`,
                created_by:
                    nullable(
                        await getCurrentUserId()
                    )
            };

            let {
                data: createdMovement,
                error: movementError
            } = await supabase
                .from("cashier_cash_movements")
                .insert(movementData)
                .select("*")
                .single();

            /*
             * Compatibility fallback for installations where
             * movement_type is "handover".
             */
            if (
                movementError &&
                /check constraint|movement_type/i.test(
                    movementError.message || ""
                )
            ) {
                movementData.movement_type =
                    "handover";

                const retry =
                    await supabase
                        .from(
                            "cashier_cash_movements"
                        )
                        .insert(movementData)
                        .select("*")
                        .single();

                createdMovement =
                    retry.data;

                movementError =
                    retry.error;
            }

            if (movementError) {
                throw new Error(
                    `Unable to create cashier cash movement: ${movementError.message}`
                );
            }

            movement =
                createdMovement;
        }

        /*
         * -----------------------------------------------------
         * CONFIRM HANDOVER
         *
         * IMPORTANT:
         * The valid completed status is "balanced".
         * -----------------------------------------------------
         */
        const updateData = {
            status:
                "balanced",
            confirmed_at:
                nowISO()
        };

        if (cashierUserId) {
            updateData.cashier_user_id =
                cashierUserId;
        }

        const {
            data: updatedHandover,
            error: updateError
        } = await supabase
            .from("cashier_handovers")
            .update(updateData)
            .eq("id", handoverId)
            .eq("hotel_id", hotelId)
            .select("*")
            .single();

        if (updateError) {
            throw new Error(
                `Unable to confirm cash handover: ${updateError.message}`
            );
        }

        return {
            handover:
                updatedHandover,
            movement,
            alreadyConfirmed:
                false
        };
    }

    /* =========================================================
       GET HANDOVERS
       ========================================================= */

    async function getCashierHandovers(
        hotelId
    ) {
        const supabase =
            await waitForSupabaseClient();

        const {
            data,
            error
        } = await supabase
            .from("cashier_handovers")
            .select("*")
            .eq("hotel_id", hotelId)
            .order(
                "created_at",
                {
                    ascending: false
                }
            );

        if (error) {
            throw new Error(
                `Unable to load cash handovers: ${error.message}`
            );
        }

        return data || [];
    }

    /* =========================================================
       CASHIER BALANCE
       ========================================================= */

    async function getCashierCashBalance(
        hotelId
    ) {
        const supabase =
            await waitForSupabaseClient();

        const {
            data,
            error
        } = await supabase
            .from("cashier_cash_movements")
            .select(
                "movement_type, amount"
            )
            .eq("hotel_id", hotelId);

        if (error) {
            throw new Error(
                `Unable to load cashier balance: ${error.message}`
            );
        }

        let balance = 0;

        (data || []).forEach(
            movement => {
                const amount =
                    roundMoney(
                        movement.amount
                    );

                const type =
                    String(
                        movement.movement_type ||
                        ""
                    ).toLowerCase();

                if (
                    type === "cash_handover" ||
                    type === "handover" ||
                    type === "cash_in" ||
                    type === "deposit_reversal"
                ) {
                    balance += amount;
                } else {
                    balance -= amount;
                }
            }
        );

        return roundMoney(balance);
    }

    /* =========================================================
       CASH MOVEMENTS
       ========================================================= */

    async function getCashMovements(
        hotelId
    ) {
        const supabase =
            await waitForSupabaseClient();

        const {
            data,
            error
        } = await supabase
            .from("cashier_cash_movements")
            .select("*")
            .eq("hotel_id", hotelId)
            .order(
                "created_at",
                {
                    ascending: false
                }
            );

        if (error) {
            throw new Error(
                `Unable to load cash movements: ${error.message}`
            );
        }

        return data || [];
    }

    /* =========================================================
       BANK DEPOSITS
       ========================================================= */

    async function createBankDeposit(
        options = {}
    ) {
        const hotelId =
            options.hotelId;

        if (!hotelId) {
            throw new Error(
                "Hotel ID is required."
            );
        }

        const expectedAmount =
            roundMoney(
                options.expectedAmount
            );

        const actualAmount =
            roundMoney(
                options.actualAmount ??
                expectedAmount
            );

        if (actualAmount <= 0) {
            throw new Error(
                "Actual deposit amount must be greater than zero."
            );
        }

        if (!options.bankAccountId) {
            throw new Error(
                "Bank account is required."
            );
        }

        const supabase =
            await waitForSupabaseClient();

        const depositNumber =
            await uniqueDepositNumber(
                hotelId
            );

        const {
            data,
            error
        } = await supabase
            .from("bank_deposits")
            .insert({
                hotel_id:
                    hotelId,
                deposit_number:
                    depositNumber,
                bank_account_id:
                    options.bankAccountId,
                cashier_user_id:
                    nullable(
                        options.cashierUserId
                    ),
                deposit_date:
                    options.depositDate ||
                    todayISO(),
                expected_amount:
                    expectedAmount,
                actual_amount:
                    actualAmount,
                difference_amount:
                    roundMoney(
                        actualAmount -
                        expectedAmount
                    ),
                bank_reference:
                    nullable(
                        options.bankReference
                    ),
                status:
                    "pending",
                notes:
                    nullable(
                        options.notes
                    )
            })
            .select("*")
            .single();

        if (error) {
            throw new Error(
                `Unable to create bank deposit: ${error.message}`
            );
        }

        return data;
    }

    async function uniqueDepositNumber(
        hotelId
    ) {
        const supabase =
            await waitForSupabaseClient();

        for (
            let attempt = 0;
            attempt < 20;
            attempt++
        ) {
            const number =
                `DEP-${hotelId}-${Date.now()}-${Math.floor(
                    Math.random() * 9000 + 1000
                )}`;

            const {
                data
            } = await supabase
                .from("bank_deposits")
                .select("id")
                .eq(
                    "hotel_id",
                    hotelId
                )
                .eq(
                    "deposit_number",
                    number
                )
                .maybeSingle();

            if (!data) {
                return number;
            }
        }

        throw new Error(
            "Unable to generate a unique deposit number."
        );
    }

    async function confirmBankDeposit(
        options = {}
    ) {
        const hotelId =
            options.hotelId;

        const depositId =
            options.depositId;

        if (!hotelId) {
            throw new Error(
                "Hotel ID is required."
            );
        }

        if (!depositId) {
            throw new Error(
                "Deposit ID is required."
            );
        }

        const supabase =
            await waitForSupabaseClient();

        const {
            data: deposit,
            error: loadError
        } = await supabase
            .from("bank_deposits")
            .select("*")
            .eq("id", depositId)
            .eq("hotel_id", hotelId)
            .maybeSingle();

        if (loadError) {
            throw new Error(
                `Unable to load bank deposit: ${loadError.message}`
            );
        }

        if (!deposit) {
            throw new Error(
                "Bank deposit was not found."
            );
        }

        if (
            String(
                deposit.status || ""
            ).toLowerCase() ===
            "balanced"
        ) {
            return {
                deposit,
                movement: null,
                alreadyConfirmed:
                    true
            };
        }

        const actualAmount =
            roundMoney(
                deposit.actual_amount
            );

        if (actualAmount <= 0) {
            throw new Error(
                "Actual deposit amount must be greater than zero."
            );
        }

        /*
         * Check for an existing deposit movement.
         */
        const {
            data: existingMovement
        } = await supabase
            .from("cashier_cash_movements")
            .select("*")
            .eq("hotel_id", hotelId)
            .eq(
                "bank_deposit_id",
                depositId
            )
            .maybeSingle();

        let movement =
            existingMovement || null;

        if (!movement) {
            const movementData = {
                hotel_id:
                    hotelId,
                movement_number:
                    `CM-DEP-${depositId}-${Date.now()}`,
                movement_date:
                    deposit.deposit_date ||
                    todayISO(),
                movement_type:
                    "bank_deposit",
                cashier_user_id:
                    nullable(
                        options.cashierUserId ||
                        deposit.cashier_user_id
                    ),
                handover_id:
                    null,
                bank_deposit_id:
                    depositId,
                amount:
                    actualAmount,
                description:
                    `Bank deposit ${deposit.deposit_number}`,
                created_by:
                    nullable(
                        await getCurrentUserId()
                    )
            };

            let {
                data: createdMovement,
                error: movementError
            } = await supabase
                .from(
                    "cashier_cash_movements"
                )
                .insert(movementData)
                .select("*")
                .single();

            if (
                movementError &&
                /check constraint|movement_type/i.test(
                    movementError.message || ""
                )
            ) {
                movementData.movement_type =
                    "bank";

                const retry =
                    await supabase
                        .from(
                            "cashier_cash_movements"
                        )
                        .insert(
                            movementData
                        )
                        .select("*")
                        .single();

                createdMovement =
                    retry.data;

                movementError =
                    retry.error;
            }

            if (movementError) {
                throw new Error(
                    `Unable to create bank deposit movement: ${movementError.message}`
                );
            }

            movement =
                createdMovement;
        }

        /*
         * Completed bank deposit state.
         */
        const {
            data: updatedDeposit,
            error: updateError
        } = await supabase
            .from("bank_deposits")
            .update({
                status:
                    "balanced"
            })
            .eq("id", depositId)
            .eq("hotel_id", hotelId)
            .select("*")
            .single();

        if (updateError) {
            throw new Error(
                `Unable to confirm bank deposit: ${updateError.message}`
            );
        }

        return {
            deposit:
                updatedDeposit,
            movement,
            alreadyConfirmed:
                false
        };
    }

    async function getBankDeposits(
        hotelId
    ) {
        const supabase =
            await waitForSupabaseClient();

        const {
            data,
            error
        } = await supabase
            .from("bank_deposits")
            .select("*")
            .eq("hotel_id", hotelId)
            .order(
                "created_at",
                {
                    ascending: false
                }
            );

        if (error) {
            throw new Error(
                `Unable to load bank deposits: ${error.message}`
            );
        }

        return data || [];
    }

    /* =========================================================
       REVERSE TRANSACTION
       ========================================================= */

    async function reverseTransaction(
        transactionId,
        reason = ""
    ) {
        const supabase =
            await waitForSupabaseClient();

        const {
            data: original,
            error: loadError
        } = await supabase
            .from("financial_transactions")
            .select("*")
            .eq("id", transactionId)
            .maybeSingle();

        if (loadError) {
            throw new Error(
                `Unable to load transaction: ${loadError.message}`
            );
        }

        if (!original) {
            throw new Error(
                "Transaction not found."
            );
        }

        if (original.is_reversal) {
            throw new Error(
                "A reversal transaction cannot be reversed again."
            );
        }

        const {
            data: existingReversal
        } = await supabase
            .from("financial_transactions")
            .select("*")
            .eq(
                "reversed_transaction_id",
                transactionId
            )
            .maybeSingle();

        if (existingReversal) {
            return existingReversal;
        }

        const transactionNumber =
            await uniqueTransactionNumber(
                original.hotel_id,
                "REVERSAL"
            );

        const reversal = {
            hotel_id:
                original.hotel_id,
            transaction_number:
                transactionNumber,
            transaction_date:
                todayISO(),
            description:
                `Reversal: ${original.description || ""}`,
            reference_number:
                original.reference_number,
            transaction_type:
                normalizeTransactionType(
                    original.transaction_type
                ),
            bank_account_id:
                original.bank_account_id,
            debit_account_id:
                original.credit_account_id,
            credit_account_id:
                original.debit_account_id,
            amount:
                roundMoney(
                    original.amount
                ),
            employee_id:
                original.employee_id,
            payment_id:
                original.payment_id,
            expense_id:
                original.expense_id,
            notes:
                nullable(reason),
            created_by:
                nullable(
                    await getCurrentUserId()
                ),
            money_in:
                roundMoney(
                    original.money_out
                ),
            money_out:
                roundMoney(
                    original.money_in
                ),
            balance_after:
                null,
            is_reversal:
                true,
            reversed_transaction_id:
                original.id,
            reversal_reason:
                nullable(reason)
        };

        const {
            data,
            error
        } = await supabase
            .from("financial_transactions")
            .insert(reversal)
            .select("*")
            .single();

        if (error) {
            throw new Error(
                `Unable to reverse transaction: ${error.message}`
            );
        }

        return data;
    }

    /* =========================================================
       LEDGER
       ========================================================= */

    async function getLedger(
        hotelId,
        options = {}
    ) {
        const supabase =
            await waitForSupabaseClient();

        let query =
            supabase
                .from(
                    "financial_transactions"
                )
                .select("*")
                .eq(
                    "hotel_id",
                    hotelId
                )
                .order(
                    "transaction_date",
                    {
                        ascending: true
                    }
                )
                .order(
                    "created_at",
                    {
                        ascending: true
                    }
                );

        if (options.fromDate) {
            query =
                query.gte(
                    "transaction_date",
                    options.fromDate
                );
        }

        if (options.toDate) {
            query =
                query.lte(
                    "transaction_date",
                    options.toDate
                );
        }

        const {
            data,
            error
        } = await query;

        if (error) {
            throw new Error(
                `Unable to load ledger: ${error.message}`
            );
        }

        return data || [];
    }

    /* =========================================================
       ACCOUNT BALANCE
       ========================================================= */

    async function getAccountBalance(
        hotelId,
        accountId
    ) {
        const supabase =
            await waitForSupabaseClient();

        const {
            data,
            error
        } = await supabase
            .from(
                "financial_transactions"
            )
            .select(
                "debit_account_id, credit_account_id, amount"
            )
            .eq(
                "hotel_id",
                hotelId
            );

        if (error) {
            throw new Error(
                `Unable to calculate account balance: ${error.message}`
            );
        }

        let balance = 0;

        (data || []).forEach(
            transaction => {
                const amount =
                    roundMoney(
                        transaction.amount
                    );

                if (
                    Number(
                        transaction.debit_account_id
                    ) === Number(accountId)
                ) {
                    balance += amount;
                }

                if (
                    Number(
                        transaction.credit_account_id
                    ) === Number(accountId)
                ) {
                    balance -= amount;
                }
            }
        );

        return roundMoney(balance);
    }

    /* =========================================================
       FINANCIAL SUMMARY
       ========================================================= */

    async function getFinancialSummary(
        hotelId
    ) {
        const ledger =
            await getLedger(
                hotelId
            );

        let totalDebit = 0;
        let totalCredit = 0;
        let moneyIn = 0;
        let moneyOut = 0;

        ledger.forEach(
            transaction => {
                totalDebit +=
                    Number(
                        transaction.amount || 0
                    );

                totalCredit +=
                    Number(
                        transaction.amount || 0
                    );

                moneyIn +=
                    Number(
                        transaction.money_in || 0
                    );

                moneyOut +=
                    Number(
                        transaction.money_out || 0
                    );
            }
        );

        totalDebit =
            roundMoney(totalDebit);

        totalCredit =
            roundMoney(totalCredit);

        moneyIn =
            roundMoney(moneyIn);

        moneyOut =
            roundMoney(moneyOut);

        return {
            records:
                ledger.length,
            totalDebit,
            totalCredit,
            moneyIn,
            moneyOut,
            closingCashBank:
                roundMoney(
                    moneyIn -
                    moneyOut
                ),
            difference:
                roundMoney(
                    totalDebit -
                    totalCredit
                ),
            balanced:
                Math.abs(
                    totalDebit -
                    totalCredit
                ) < 0.01
        };
    }

    /* =========================================================
       VAT SUMMARY
       ========================================================= */

    async function getVATSummary(
        hotelId
    ) {
        const vatAccount =
            await getAccountByCode(
                hotelId,
                "2030"
            );

        if (!vatAccount) {
            return {
                balance: 0,
                account: null
            };
        }

        const balance =
            await getAccountBalance(
                hotelId,
                vatAccount.id
            );

        return {
            balance,
            account:
                vatAccount
        };
    }

    /* =========================================================
       HEALTH CHECK
       ========================================================= */

    async function healthCheck(
        hotelId
    ) {
        try {
            await waitForSupabaseClient();

            const accounts =
                await ensureStandardAccounts(
                    hotelId
                );

            return {
                ok: true,
                version:
                    ENGINE_VERSION,
                hotelId,
                accountsReady:
                    !!accounts
            };
        } catch (error) {
            return {
                ok: false,
                version:
                    ENGINE_VERSION,
                hotelId,
                error:
                    error.message
            };
        }
    }

    /* =========================================================
       PUBLIC API
       ========================================================= */

    const API = {
        version:
            ENGINE_VERSION,

        roundMoney,

        getSupabase,
        waitForSupabaseClient,

        getCurrentUser,
        getCurrentUserId,

        getAccountByCode,
        ensureAccount,
        ensureStandardAccounts,

        postJournal,
        postJournalBatch,

        postAccommodationCharge,
        postPayment,
        postExpense,
        postRestaurantSale,
        postOtherRevenue,

        createCashierHandover,
        confirmCashierHandover,
        getCashierHandovers,
        getCashierCashBalance,
        getCashMovements,

        createBankDeposit,
        confirmBankDeposit,
        getBankDeposits,

        reverseTransaction,

        getLedger,
        getAccountBalance,
        getFinancialSummary,
        getVATSummary,

        healthCheck
    };

    window.EDUTECH_FINANCIAL_ENGINE =
        API;

    /*
     * Legacy compatibility.
     */
    window.FinancialEngine =
        API;

    window.EDUTECH_FINANCIAL_ENGINE_READY =
        true;

    window.dispatchEvent(
        new CustomEvent(
            "edutech-financial-engine-ready",
            {
                detail: {
                    version:
                        ENGINE_VERSION,
                    engine:
                        API
                }
            }
        )
    );

    console.log(
        `EDU TECH Financial Engine ${ENGINE_VERSION} ready.`
    );

})();