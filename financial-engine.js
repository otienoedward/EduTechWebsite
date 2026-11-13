/* =========================================================
   EDU TECH HOTEL MANAGEMENT SYSTEM
   FINANCIAL ENGINE
   VERSION: 2026.11.13.22
   ---------------------------------------------------------
   SAFE DATABASE VERSION

   IMPORTANT:
   financial_transactions is NOT assumed to contain:
   - guest_id
   - payment_method
   - reservation_id

   The engine therefore DOES NOT send those fields.

   financial_accounts is read using select("*")
   and never assumes a "code" column exists.
========================================================= */

(function () {
    "use strict";

    const VERSION = "2026.11.13.22";

    console.log(
        "%cEDU TECH Financial Engine " + VERSION + " loaded",
        "color:#0b7dda;font-weight:bold;"
    );

    /* =====================================================
       BASIC HELPERS
    ===================================================== */

    function safeText(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value).trim();
    }

    function money(value) {
        const number = Number(value);

        if (!Number.isFinite(number)) {
            return 0;
        }

        return Math.round(
            (number + Number.EPSILON) * 100
        ) / 100;
    }

    function positiveMoney(value) {
        const amount = money(value);

        return amount > 0 ? amount : 0;
    }

    function todayDate() {
        return new Date()
            .toISOString()
            .slice(0, 10);
    }

    function generateTransactionNumber() {
        const now = new Date();

        const datePart =
            now.getFullYear() +
            String(now.getMonth() + 1).padStart(2, "0") +
            String(now.getDate()).padStart(2, "0");

        const randomPart =
            Math.floor(
                100000 +
                Math.random() * 900000
            );

        return (
            "TXN-" +
            datePart +
            "-" +
            randomPart
        );
    }

    /* =====================================================
       CURRENT USER
    ===================================================== */

    function getCurrentUserId() {
        try {
            const possibleUsers = [
                window.currentUser,
                window.loggedInUser,
                window.user,
                window.currentUserProfile
            ];

            for (
                const user of possibleUsers
            ) {
                if (
                    user &&
                    typeof user === "object"
                ) {
                    return (
                        user.id ||
                        user.user_id ||
                        user.userId ||
                        null
                    );
                }
            }
        } catch (error) {
            console.warn(
                "Unable to determine current user:",
                error
            );
        }

        return null;
    }

    /* =====================================================
       SUPABASE CLIENT
    ===================================================== */

    function getSupabaseClient() {

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
            "Supabase client is not available. Check that supabase.js loads before financial-engine.js."
        );
    }

    /* =====================================================
       LEGACY ARGUMENT SUPPORT
    ===================================================== */

    function normalizeOptions(
        first,
        second
    ) {

        /*
           Supports:

           postPayment(options)

           and older:

           postPayment(supabase, options)
        */

        if (
            second &&
            typeof second === "object" &&
            !Array.isArray(second)
        ) {
            return second;
        }

        if (
            first &&
            typeof first === "object" &&
            !Array.isArray(first)
        ) {
            return first;
        }

        return {};
    }

    /* =====================================================
       PAYMENT METHOD
    ===================================================== */

    function normalizePaymentMethod(
        value
    ) {

        const raw =
            safeText(value)
                .toLowerCase();

        const normalized =
            raw.replace(
                /[\s_-]+/g,
                ""
            );

        if (
            normalized === "mpesa" ||
            normalized === "m"
        ) {
            return "mpesa";
        }

        if (
            normalized === "card"
        ) {
            return "card";
        }

        if (
            normalized === "bank" ||
            normalized ===
                "banktransfer" ||
            normalized ===
                "transfer"
        ) {
            return "bank";
        }

        return "cash";
    }

    /* =====================================================
       LOAD FINANCIAL ACCOUNTS
    ===================================================== */

    async function getFinancialAccounts(
        hotelId
    ) {

        const supabase =
            getSupabaseClient();

        if (!hotelId) {
            throw new Error(
                "Hotel ID is required to load financial accounts."
            );
        }

        const {
            data,
            error
        } =
            await supabase
                .from(
                    "financial_accounts"
                )
                .select("*")
                .eq(
                    "hotel_id",
                    hotelId
                );

        if (error) {
            throw new Error(
                "Unable to load financial accounts: " +
                error.message
            );
        }

        return Array.isArray(data)
            ? data
            : [];
    }

    /* =====================================================
       ACCOUNT ID
    ===================================================== */

    function getAccountId(
        account
    ) {

        if (!account) {
            return null;
        }

        return (
            account.id ||
            account.account_id ||
            account.accountId ||
            null
        );
    }

    /* =====================================================
       ACCOUNT SEARCH VALUES
    ===================================================== */

    function getAccountSearchText(
        account
    ) {

        if (
            !account ||
            typeof account !==
                "object"
        ) {
            return "";
        }

        const fields = [
            "id",
            "account_id",
            "account_name",
            "account_number",
            "account_type",
            "name",
            "title",
            "description",
            "type",
            "category"
        ];

        const values = [];

        fields.forEach(
            function (field) {

                if (
                    Object.prototype
                        .hasOwnProperty.call(
                            account,
                            field
                        )
                ) {

                    const value =
                        safeText(
                            account[field]
                        );

                    if (value) {
                        values.push(
                            value
                        );
                    }
                }
            }
        );

        return values
            .join(" ")
            .toLowerCase();
    }

    /* =====================================================
       FIND ACCOUNT BY KEYWORDS
    ===================================================== */

    function findAccountByKeywords(
        accounts,
        keywords
    ) {

        if (
            !Array.isArray(accounts)
        ) {
            return null;
        }

        for (
            const account of accounts
        ) {

            const searchable =
                getAccountSearchText(
                    account
                );

            for (
                const keyword of keywords
            ) {

                const normalizedKeyword =
                    safeText(
                        keyword
                    ).toLowerCase();

                if (
                    normalizedKeyword &&
                    searchable.includes(
                        normalizedKeyword
                    )
                ) {
                    return account;
                }
            }
        }

        return null;
    }

    /* =====================================================
       FIND CASH ACCOUNT
    ===================================================== */

    function findCashAccount(
        accounts
    ) {

        return findAccountByKeywords(
            accounts,
            [
                "cash",
                "cash account",
                "cash on hand"
            ]
        );
    }

    /* =====================================================
       FIND M-PESA ACCOUNT
    ===================================================== */

    function findMpesaAccount(
        accounts
    ) {

        return findAccountByKeywords(
            accounts,
            [
                "mpesa",
                "m-pesa",
                "mobile money",
                "mobile"
            ]
        );
    }

    /* =====================================================
       FIND CARD ACCOUNT
    ===================================================== */

    function findCardAccount(
        accounts
    ) {

        return findAccountByKeywords(
            accounts,
            [
                "card",
                "bank card",
                "credit card",
                "debit card"
            ]
        );
    }

    /* =====================================================
       FIND BANK ACCOUNT
    ===================================================== */

    function findBankAccount(
        accounts
    ) {

        return findAccountByKeywords(
            accounts,
            [
                "bank",
                "bank account"
            ]
        );
    }

    /* =====================================================
       FIND RECEIVABLE ACCOUNT
    ===================================================== */

    function findReceivableAccount(
        accounts
    ) {

        return findAccountByKeywords(
            accounts,
            [
                "accounts receivable",
                "receivable",
                "guest receivable",
                "guest receivables"
            ]
        );
    }

    /* =====================================================
       RESOLVE PAYMENT ACCOUNT
    ===================================================== */

    async function resolvePaymentAccount(
        hotelId,
        paymentMethod
    ) {

        const accounts =
            await getFinancialAccounts(
                hotelId
            );

        if (
            !accounts.length
        ) {
            throw new Error(
                "No financial accounts have been created for this hotel."
            );
        }

        const method =
            normalizePaymentMethod(
                paymentMethod
            );

        let account =
            null;

        if (
            method === "cash"
        ) {
            account =
                findCashAccount(
                    accounts
                );
        }

        if (
            method === "mpesa"
        ) {
            account =
                findMpesaAccount(
                    accounts
                );
        }

        if (
            method === "card"
        ) {
            account =
                findCardAccount(
                    accounts
                );
        }

        if (
            method === "bank"
        ) {
            account =
                findBankAccount(
                    accounts
                );
        }

        if (!account) {

            const available =
                accounts
                    .map(
                        function (item) {

                            return {
                                id:
                                    getAccountId(
                                        item
                                    ),
                                name:
                                    item.account_name ||
                                    item.name ||
                                    item.title ||
                                    "",
                                number:
                                    item.account_number ||
                                    "",
                                type:
                                    item.account_type ||
                                    item.type ||
                                    ""
                            };
                        }
                    );

            throw new Error(
                "No financial account was found for payment method '" +
                method +
                "'. Available accounts: " +
                JSON.stringify(
                    available
                )
            );
        }

        const accountId =
            getAccountId(
                account
            );

        if (!accountId) {
            throw new Error(
                "The payment account exists but has no valid account ID."
            );
        }

        return {
            account:
                account,

            accountId:
                accountId,

            method:
                method,

            accounts:
                accounts
        };
    }

    /* =====================================================
       FIND SPECIFIC ACCOUNT
    ===================================================== */

    async function findFinancialAccount(
        hotelId,
        identifier
    ) {

        const accounts =
            await getFinancialAccounts(
                hotelId
            );

        const target =
            safeText(
                identifier
            ).toLowerCase();

        for (
            const account of accounts
        ) {

            const searchable =
                getAccountSearchText(
                    account
                );

            if (
                searchable.includes(
                    target
                )
            ) {
                return account;
            }
        }

        throw new Error(
            "Unable to find financial account '" +
            safeText(identifier) +
            "'."
        );
    }

    /* =====================================================
       GET RUNNING BALANCE
       -----------------------------------------------------
       We only request fields needed by the engine.
    ===================================================== */

    async function getRunningBalance(
        hotelId
    ) {

        const supabase =
            getSupabaseClient();

        const {
            data,
            error
        } =
            await supabase
                .from(
                    "financial_transactions"
                )
                .select(
                    "balance_after"
                )
                .eq(
                    "hotel_id",
                    hotelId
                )
                .order(
                    "created_at",
                    {
                        ascending:
                            false
                    }
                )
                .limit(1);

        if (error) {
            throw new Error(
                "Unable to read financial balance: " +
                error.message
            );
        }

        if (
            data &&
            data.length &&
            data[0].balance_after !==
                null &&
            data[0].balance_after !==
                undefined
        ) {
            return money(
                data[0].balance_after
            );
        }

        return 0;
    }

    /* =====================================================
       BUILD TRANSACTION ROW
       -----------------------------------------------------
       THIS IS THE CRITICAL PART.

       We deliberately send ONLY fields that the financial
       engine knows about.

       NEVER SEND:
       guest_id
       payment_method
       reservation_id
    ===================================================== */

    async function buildTransactionRow(
        options
    ) {

        const hotelId =
            options.hotelId ||
            options.hotel_id;

        const amount =
            positiveMoney(
                options.amount
            );

        if (!hotelId) {
            throw new Error(
                "Financial transaction requires hotel ID."
            );
        }

        if (
            amount <= 0
        ) {
            throw new Error(
                "Financial transaction amount must be greater than zero."
            );
        }

        const previousBalance =
            await getRunningBalance(
                hotelId
            );

        const moneyIn =
            options.moneyIn !==
            undefined
                ? positiveMoney(
                    options.moneyIn
                )
                : amount;

        const moneyOut =
            options.moneyOut !==
            undefined
                ? positiveMoney(
                    options.moneyOut
                )
                : 0;

        const balanceAfter =
            money(
                previousBalance +
                moneyIn -
                moneyOut
            );

        /*
           IMPORTANT:

           Do NOT add reservation_id here.
           Do NOT add payment_method here.
           Do NOT add guest_id here.
        */

        return {
            hotel_id:
                hotelId,

            transaction_number:
                options.transactionNumber ||
                generateTransactionNumber(),

            transaction_type:
                options.transactionType ||
                "Payment",

            transaction_date:
                options.transactionDate ||
                todayDate(),

            debit_account_id:
                options.debitAccountId ||
                null,

            credit_account_id:
                options.creditAccountId ||
                null,

            amount:
                amount,

            money_in:
                moneyIn,

            money_out:
                moneyOut,

            balance_after:
                balanceAfter,

            description:
                options.description ||
                "Financial transaction",

            reference_number:
                options.referenceNumber ||
                null,

            is_reversal:
                options.isReversal ===
                true,

            reversed_transaction_id:
                options.reversedTransactionId ||
                null,

            created_by:
                options.createdBy ||
                getCurrentUserId()
        };
    }

    /* =====================================================
       POST FINANCIAL TRANSACTION
    ===================================================== */

    async function postTransaction(
        options
    ) {

        const supabase =
            getSupabaseClient();

        const row =
            await buildTransactionRow(
                options
            );

        /*
           Safety protection:
           remove fields that must NEVER enter
           financial_transactions.
        */

        delete row.guest_id;
        delete row.payment_method;
        delete row.reservation_id;

        console.log(
            "EDU TECH financial transaction row:",
            row
        );

        const {
            data,
            error
        } =
            await supabase
                .from(
                    "financial_transactions"
                )
                .insert(
                    row
                )
                .select()
                .maybeSingle();

        if (error) {
            throw new Error(
                "Unable to post financial transaction: " +
                error.message
            );
        }

        return {
            success:
                true,

            data:
                data,

            transaction:
                data,

            row:
                row
        };
    }

    /* =====================================================
       POST PAYMENT
       -----------------------------------------------------
       Supports:

       postPayment(options)

       and:

       postPayment(supabase, options)
    ===================================================== */

    async function postPayment(
        first,
        second
    ) {

        const options =
            normalizeOptions(
                first,
                second
            );

        const hotelId =
            options.hotelId ||
            options.hotel_id;

        const amount =
            options.amount !==
            undefined
                ? options.amount
                : options.payment;

        const paymentMethod =
            options.paymentMethod ||
            options.payment_method ||
            options.method ||
            "cash";

        const referenceNumber =
            options.referenceNumber ||
            options.reference_number ||
            options.reference ||
            null;

        const description =
            options.description ||
            "Guest payment at check-out";

        if (!hotelId) {
            throw new Error(
                "Payment failed: hotel ID is missing."
            );
        }

        const paymentAmount =
            positiveMoney(
                amount
            );

        if (
            paymentAmount <= 0
        ) {
            throw new Error(
                "Payment failed: payment amount must be greater than zero."
            );
        }

        console.log(
            "Financial Engine processing payment:",
            {
                hotelId:
                    hotelId,

                amount:
                    paymentAmount,

                paymentMethod:
                    paymentMethod,

                reference:
                    referenceNumber
            }
        );

        /*
           Find the account receiving the money.
        */

        const paymentAccount =
            await resolvePaymentAccount(
                hotelId,
                paymentMethod
            );

        /*
           Find Accounts Receivable.
        */

        const accounts =
            paymentAccount.accounts;

        const receivableAccount =
            findReceivableAccount(
                accounts
            );

        if (
            !receivableAccount
        ) {
            throw new Error(
                "Accounts Receivable financial account was not found for this hotel."
            );
        }

        const debitAccountId =
            paymentAccount.accountId;

        const creditAccountId =
            getAccountId(
                receivableAccount
            );

        if (
            !creditAccountId
        ) {
            throw new Error(
                "Accounts Receivable account has no valid ID."
            );
        }

        /*
           POST ONLY THE SAFE FIELDS.
        */

        return await postTransaction({
            hotelId:
                hotelId,

            amount:
                paymentAmount,

            debitAccountId:
                debitAccountId,

            creditAccountId:
                creditAccountId,

            transactionType:
                "Payment",

            moneyIn:
                paymentAmount,

            moneyOut:
                0,

            description:
                description,

            referenceNumber:
                referenceNumber
        });
    }

    /* =====================================================
       COMPATIBILITY METHODS
    ===================================================== */

    async function recordPayment(
        first,
        second
    ) {
        return await postPayment(
            first,
            second
        );
    }

    async function createPayment(
        first,
        second
    ) {
        return await postPayment(
            first,
            second
        );
    }

    async function addPayment(
        first,
        second
    ) {
        return await postPayment(
            first,
            second
        );
    }

    /* =====================================================
       ACCOMMODATION CHARGE
       -----------------------------------------------------
       This version also avoids reservation_id.
    ===================================================== */

    async function postAccommodationCharge(
        options
    ) {

        options =
            options || {};

        const hotelId =
            options.hotelId ||
            options.hotel_id;

        const amount =
            positiveMoney(
                options.amount ||
                options.total ||
                options.totalBill
            );

        if (!hotelId) {
            throw new Error(
                "Accommodation charge requires hotel ID."
            );
        }

        if (
            amount <= 0
        ) {
            throw new Error(
                "Accommodation charge amount must be greater than zero."
            );
        }

        const accounts =
            await getFinancialAccounts(
                hotelId
            );

        const receivableAccount =
            findReceivableAccount(
                accounts
            );

        if (
            !receivableAccount
        ) {
            throw new Error(
                "Accounts Receivable financial account was not found."
            );
        }

        const revenueAccount =
            findAccountByKeywords(
                accounts,
                [
                    "room revenue",
                    "accommodation revenue",
                    "hotel revenue",
                    "room income",
                    "accommodation income"
                ]
            );

        if (
            !revenueAccount
        ) {
            throw new Error(
                "Accommodation Revenue financial account was not found."
            );
        }

        return await postTransaction({
            hotelId:
                hotelId,

            amount:
                amount,

            debitAccountId:
                getAccountId(
                    receivableAccount
                ),

            creditAccountId:
                getAccountId(
                    revenueAccount
                ),

            transactionType:
                "Accommodation",

            moneyIn:
                amount,

            moneyOut:
                0,

            description:
                options.description ||
                "Accommodation charge"
        });
    }

    /* =====================================================
       EXPENSE
    ===================================================== */

    async function postExpense(
        options
    ) {

        options =
            options || {};

        const hotelId =
            options.hotelId ||
            options.hotel_id;

        const amount =
            positiveMoney(
                options.amount
            );

        if (!hotelId) {
            throw new Error(
                "Expense requires hotel ID."
            );
        }

        if (
            amount <= 0
        ) {
            throw new Error(
                "Expense amount must be greater than zero."
            );
        }

        const accounts =
            await getFinancialAccounts(
                hotelId
            );

        const expenseAccount =
            findAccountByKeywords(
                accounts,
                [
                    "expense",
                    "expenses"
                ]
            );

        const cashAccount =
            findCashAccount(
                accounts
            );

        if (
            !expenseAccount
        ) {
            throw new Error(
                "Expense financial account was not found."
            );
        }

        if (
            !cashAccount
        ) {
            throw new Error(
                "Cash financial account was not found."
            );
        }

        return await postTransaction({
            hotelId:
                hotelId,

            amount:
                amount,

            debitAccountId:
                getAccountId(
                    expenseAccount
                ),

            creditAccountId:
                getAccountId(
                    cashAccount
                ),

            transactionType:
                "Expense",

            moneyIn:
                0,

            moneyOut:
                amount,

            description:
                options.description ||
                "Expense"
        });
    }

    /* =====================================================
       OTHER REVENUE
    ===================================================== */

    async function postOtherRevenue(
        options
    ) {

        options =
            options || {};

        const hotelId =
            options.hotelId ||
            options.hotel_id;

        const amount =
            positiveMoney(
                options.amount
            );

        if (!hotelId) {
            throw new Error(
                "Revenue requires hotel ID."
            );
        }

        if (
            amount <= 0
        ) {
            throw new Error(
                "Revenue amount must be greater than zero."
            );
        }

        const accounts =
            await getFinancialAccounts(
                hotelId
            );

        const revenueAccount =
            findAccountByKeywords(
                accounts,
                [
                    "other revenue",
                    "other income",
                    "revenue",
                    "income"
                ]
            );

        const cashAccount =
            findCashAccount(
                accounts
            );

        if (
            !revenueAccount
        ) {
            throw new Error(
                "Revenue financial account was not found."
            );
        }

        if (
            !cashAccount
        ) {
            throw new Error(
                "Cash financial account was not found."
            );
        }

        return await postTransaction({
            hotelId:
                hotelId,

            amount:
                amount,

            debitAccountId:
                getAccountId(
                    cashAccount
                ),

            creditAccountId:
                getAccountId(
                    revenueAccount
                ),

            transactionType:
                "Revenue",

            moneyIn:
                amount,

            moneyOut:
                0,

            description:
                options.description ||
                "Other revenue"
        });
    }

    /* =====================================================
       LEDGER
    ===================================================== */

    async function getLedger(
        options
    ) {

        options =
            options || {};

        const supabase =
            getSupabaseClient();

        const hotelId =
            options.hotelId ||
            options.hotel_id;

        if (!hotelId) {
            throw new Error(
                "Hotel ID is required for ledger."
            );
        }

        let query =
            supabase
                .from(
                    "financial_transactions"
                )
                .select("*")
                .eq(
                    "hotel_id",
                    hotelId
                );

        /*
           Do not depend on reservation_id.
        */

        query =
            query.order(
                "created_at",
                {
                    ascending:
                        false
                }
            );

        if (
            options.limit
        ) {
            query =
                query.limit(
                    Number(
                        options.limit
                    )
                );
        }

        const {
            data,
            error
        } =
            await query;

        if (error) {
            throw new Error(
                "Unable to load financial ledger: " +
                error.message
            );
        }

        return data || [];
    }

    /* =====================================================
       SUMMARY
    ===================================================== */

    async function getSummary(
        hotelId
    ) {

        const ledger =
            await getLedger({
                hotelId:
                    hotelId
            });

        let totalIn =
            0;

        let totalOut =
            0;

        ledger.forEach(
            function (row) {

                totalIn +=
                    positiveMoney(
                        row.money_in
                    );

                totalOut +=
                    positiveMoney(
                        row.money_out
                    );
            }
        );

        return {
            totalIn:
                money(
                    totalIn
                ),

            totalOut:
                money(
                    totalOut
                ),

            net:
                money(
                    totalIn -
                    totalOut
                ),

            transactionCount:
                ledger.length
        };
    }

    /* =====================================================
       VAT
    ===================================================== */

    function calculateVAT(
        amount,
        rate
    ) {

        const base =
            positiveMoney(
                amount
            );

        const vatRate =
            Number(rate) || 0;

        const vat =
            money(
                base *
                (
                    vatRate /
                    100
                )
            );

        return {
            amount:
                base,

            rate:
                vatRate,

            vat:
                vat,

            totalIncludingVAT:
                money(
                    base +
                    vat
                )
        };
    }

    /* =====================================================
       REVERSE TRANSACTION
       -----------------------------------------------------
       Does not use reservation_id.
    ===================================================== */

    async function reverseTransaction(
        options
    ) {

        options =
            options || {};

        const supabase =
            getSupabaseClient();

        const hotelId =
            options.hotelId ||
            options.hotel_id;

        const transactionId =
            options.transactionId ||
            options.transaction_id;

        if (!hotelId) {
            throw new Error(
                "Hotel ID is required for reversal."
            );
        }

        if (!transactionId) {
            throw new Error(
                "Transaction ID is required for reversal."
            );
        }

        const {
            data: original,
            error
        } =
            await supabase
                .from(
                    "financial_transactions"
                )
                .select("*")
                .eq(
                    "id",
                    transactionId
                )
                .eq(
                    "hotel_id",
                    hotelId
                )
                .maybeSingle();

        if (error) {
            throw new Error(
                "Unable to find transaction for reversal: " +
                error.message
            );
        }

        if (!original) {
            throw new Error(
                "Transaction was not found."
            );
        }

        return await postTransaction({
            hotelId:
                hotelId,

            amount:
                positiveMoney(
                    original.amount
                ),

            debitAccountId:
                original.credit_account_id,

            creditAccountId:
                original.debit_account_id,

            transactionType:
                "Reversal",

            moneyIn:
                original.money_out ||
                0,

            moneyOut:
                original.money_in ||
                0,

            description:
                options.description ||
                (
                    "Reversal of transaction " +
                    (
                        original.transaction_number ||
                        original.id
                    )
                ),

            referenceNumber:
                original.reference_number,

            isReversal:
                true,

            reversedTransactionId:
                transactionId
        });
    }

    /* =====================================================
       HEALTH CHECK
    ===================================================== */

    async function healthCheck(
        hotelId
    ) {

        const result = {
            version:
                VERSION,

            supabase:
                false,

            financialAccounts:
                false,

            financialTransactions:
                false,

            accountsFound:
                0,

            status:
                "unknown"
        };

        try {

            const supabase =
                getSupabaseClient();

            result.supabase =
                true;

            const accounts =
                await getFinancialAccounts(
                    hotelId
                );

            result.financialAccounts =
                true;

            result.accountsFound =
                accounts.length;

            const {
                error
            } =
                await supabase
                    .from(
                        "financial_transactions"
                    )
                    .select(
                        "id"
                    )
                    .eq(
                        "hotel_id",
                        hotelId
                    )
                    .limit(1);

            if (error) {
                throw error;
            }

            result.financialTransactions =
                true;

            result.status =
                "healthy";

            return result;

        } catch (error) {

            result.status =
                "error";

            result.error =
                error.message;

            return result;
        }
    }

    /* =====================================================
       PUBLIC API
    ===================================================== */

    const FinancialEngine = {

        version:
            VERSION,

        getSupabaseClient:
            getSupabaseClient,

        normalizePaymentMethod:
            normalizePaymentMethod,

        getFinancialAccounts:
            getFinancialAccounts,

        findFinancialAccount:
            findFinancialAccount,

        resolvePaymentAccount:
            resolvePaymentAccount,

        getRunningBalance:
            getRunningBalance,

        buildTransactionRow:
            buildTransactionRow,

        postTransaction:
            postTransaction,

        postPayment:
            postPayment,

        recordPayment:
            recordPayment,

        createPayment:
            createPayment,

        addPayment:
            addPayment,

        postAccommodationCharge:
            postAccommodationCharge,

        postExpense:
            postExpense,

        postOtherRevenue:
            postOtherRevenue,

        reverseTransaction:
            reverseTransaction,

        getLedger:
            getLedger,

        getSummary:
            getSummary,

        calculateVAT:
            calculateVAT,

        healthCheck:
            healthCheck
    };

    /* =====================================================
       GLOBAL EXPORTS
    ===================================================== */

    window.FinancialEngine =
        FinancialEngine;

    window.EDUTECH_FINANCIAL_ENGINE =
        FinancialEngine;

    window.EDUTECH_FINANCIAL_ENGINE_READY =
        true;

    window.postPayment =
        function (options) {
            return FinancialEngine.postPayment(
                options
            );
        };

    window.postTransaction =
        function (options) {
            return FinancialEngine.postTransaction(
                options
            );
        };

    window.postExpense =
        function (options) {
            return FinancialEngine.postExpense(
                options
            );
        };

    window.postAccommodationCharge =
        function (options) {
            return FinancialEngine.postAccommodationCharge(
                options
            );
        };

    console.log(
        "%cEDU TECH Financial Engine READY - " +
        VERSION,
        "color:#16803c;font-weight:bold;"
    );

})();