/* =========================================================
   EDU TECH HOTEL MANAGEMENT SYSTEM
   CENTRAL FINANCIAL ENGINE
   VERSION: 2026.11.15.02

   PURPOSE
   ---------------------------------------------------------
   Central financial engine for:

   - Accommodation revenue
   - Guest payments
   - Restaurant sales
   - Expenses
   - Salaries
   - Salary advances
   - Inventory purchases
   - Maintenance expenses
   - Transfers
   - Reversals
   - Cashier handovers
   - Bank deposits
   - Cash movement history

   IMPORTANT CASHIER SCHEMA NOTES
   ---------------------------------------------------------
   cashier_handovers DOES NOT contain:

      created_by
      difference

   bank_deposits DOES NOT contain:

      created_by

   Therefore those fields are NOT inserted into
   cashier_handovers.

   HANDOVER CONFIRMATION
   ---------------------------------------------------------
   The database has a CHECK constraint on the
   cashier_handovers.status column.

   The values "confirmed" and "completed" are not
   accepted by that constraint.

   Therefore confirmation DOES NOT change status.

   Confirmation is recorded using:

      confirmed_at

   Difference is calculated by JavaScript and returned
   to the cashier page. It is NOT stored in
   cashier_handovers.

   IMPORTANT LEDGER RULE
   ---------------------------------------------------------
   Guest payments and expenses are financial transactions
   and are posted to financial_transactions.

   A cashier handover is an operational confirmation of
   physical cash. It is NOT posted again as a guest
   payment, otherwise the same money would be duplicated.

========================================================= */

(function () {

    "use strict";


    /* =====================================================
       VERSION
    ===================================================== */

    const VERSION = "2026.11.15.02";


    /* =====================================================
       GLOBAL FLAGS
    ===================================================== */

    window.EDUTECH_FINANCIAL_ENGINE_READY = false;


    /* =====================================================
       VALID TRANSACTION TYPES
    ===================================================== */

    const VALID_TRANSACTION_TYPES = [
        "income",
        "expense",
        "salary",
        "salary_advance",
        "transfer",
        "other"
    ];


    /* =====================================================
       BASIC HELPERS
    ===================================================== */

    function roundMoney(value) {

        const number = Number(value);

        if (!Number.isFinite(number)) {
            return 0;
        }

        return Math.round(
            (number + Number.EPSILON) * 100
        ) / 100;
    }


    function money(value) {

        return roundMoney(value).toFixed(2);
    }


    function makeError(message) {

        return new Error(
            String(
                message ||
                "Unknown financial engine error."
            )
        );
    }


    function safeNumber(value) {

        const number = Number(value);

        return Number.isFinite(number)
            ? number
            : 0;
    }


    function createId() {

        return (
            Date.now().toString(36) +
            Math.random()
                .toString(36)
                .substring(2, 10)
        ).toUpperCase();
    }


    async function withTimeout(
        promise,
        milliseconds,
        message
    ) {

        let timer;

        const timeout = new Promise(
            function (_, reject) {

                timer = setTimeout(
                    function () {

                        reject(
                            makeError(
                                message ||
                                "Operation timed out."
                            )
                        );

                    },
                    milliseconds
                );

            }
        );

        try {

            return await Promise.race([
                promise,
                timeout
            ]);

        } finally {

            clearTimeout(timer);

        }
    }


    /* =====================================================
       SUPABASE CLIENT
    ===================================================== */

    async function waitForSupabaseClient() {

        const start = Date.now();

        while (
            Date.now() - start <
            15000
        ) {

            const candidates = [

                window.supabaseClient,

                window.supabaseClientInstance,

                window.edutechSupabase,

                window.EDUTECH_SUPABASE

            ];


            for (
                const candidate
                of candidates
            ) {

                if (
                    candidate &&
                    typeof candidate.from ===
                        "function" &&
                    candidate.auth &&
                    typeof candidate.auth.getUser ===
                        "function"
                ) {

                    return candidate;

                }

            }


            if (
                window.supabase &&
                typeof window.supabase.from ===
                    "function" &&
                window.supabase.auth &&
                typeof window.supabase.auth.getUser ===
                    "function"
            ) {

                return window.supabase;

            }


            await new Promise(
                function (resolve) {

                    setTimeout(
                        resolve,
                        250
                    );

                }
            );

        }


        throw makeError(
            "Supabase client is not available. " +
            "Make sure supabase.js loads before financial-engine.js."
        );
    }


    async function getDb() {

        return await waitForSupabaseClient();

    }


    /* =====================================================
       HOTEL / USER
    ===================================================== */

    async function getCurrentUser() {

        const db =
            await getDb();


        const result =
            await db.auth.getUser();


        if (result.error) {

            throw makeError(
                "Unable to identify the current user: " +
                result.error.message
            );

        }


        if (
            !result.data ||
            !result.data.user
        ) {

            throw makeError(
                "No authenticated user was found."
            );

        }


        return result.data.user;

    }


    async function getCurrentProfile() {

        const db =
            await getDb();


        const user =
            await getCurrentUser();


        const result =
            await db
                .from("profiles")
                .select(
                    "id,full_name,role,hotel_id,is_active"
                )
                .eq(
                    "id",
                    user.id
                )
                .maybeSingle();


        if (result.error) {

            throw makeError(
                "Unable to load user profile: " +
                result.error.message
            );

        }


        if (!result.data) {

            throw makeError(
                "No profile was found for the current user."
            );

        }


        if (
            result.data.is_active === false
        ) {

            throw makeError(
                "The current user account is inactive."
            );

        }


        if (!result.data.hotel_id) {

            throw makeError(
                "The current user is not assigned to a hotel."
            );

        }


        return result.data;

    }


    async function getHotelId() {

        const profile =
            await getCurrentProfile();


        return Number(
            profile.hotel_id
        );

    }


    async function getCurrentHotel() {

        const db =
            await getDb();


        const hotelId =
            await getHotelId();


        const result =
            await db
                .from("hotels")
                .select("*")
                .eq(
                    "id",
                    hotelId
                )
                .maybeSingle();


        if (result.error) {

            throw makeError(
                "Unable to load hotel: " +
                result.error.message
            );

        }


        return result.data || null;

    }


    /* =====================================================
       ACCOUNT HELPERS
    ===================================================== */

    async function getAccountByCode(
        hotelId,
        accountCode
    ) {

        const db =
            await getDb();


        const result =
            await db
                .from("financial_accounts")
                .select("*")
                .eq(
                    "hotel_id",
                    hotelId
                )
                .eq(
                    "account_code",
                    String(accountCode)
                )
                .maybeSingle();


        if (result.error) {

            throw makeError(
                "Unable to load financial account " +
                accountCode +
                ": " +
                result.error.message
            );

        }


        return result.data || null;

    }


    async function ensureAccount(
        hotelId,
        accountCode,
        accountName,
        accountType
    ) {

        const db =
            await getDb();


        let account =
            await getAccountByCode(
                hotelId,
                accountCode
            );


        if (account) {

            return account;

        }


        const insertResult =
            await db
                .from("financial_accounts")
                .insert({

                    hotel_id:
                        hotelId,

                    account_code:
                        accountCode,

                    account_name:
                        accountName,

                    account_type:
                        accountType,

                    status:
                        "active"

                })
                .select("*")
                .single();


        if (insertResult.error) {

            throw makeError(
                "Unable to create financial account " +
                accountCode +
                ": " +
                insertResult.error.message
            );

        }


        return insertResult.data;

    }


    async function ensureCoreAccounts(
        hotelId
    ) {

        const accounts = {};


        accounts.bank =
            await ensureAccount(
                hotelId,
                "1000",
                "Bank",
                "asset"
            );


        accounts.cash =
            await ensureAccount(
                hotelId,
                "1010",
                "Cash",
                "asset"
            );


        accounts.mpesa =
            await ensureAccount(
                hotelId,
                "1020",
                "M-Pesa",
                "asset"
            );


        accounts.employeeAdvances =
            await ensureAccount(
                hotelId,
                "1030",
                "Employee Advances",
                "asset"
            );


        accounts.card =
            await ensureAccount(
                hotelId,
                "1040",
                "Card",
                "asset"
            );


        accounts.receivables =
            await ensureAccount(
                hotelId,
                "1100",
                "Guest Receivables",
                "asset"
            );


        accounts.payables =
            await ensureAccount(
                hotelId,
                "2000",
                "Accounts Payable",
                "liability"
            );


        accounts.salaryPayable =
            await ensureAccount(
                hotelId,
                "2010",
                "Employee Salary Payable",
                "liability"
            );


        accounts.vatPayable =
            await ensureAccount(
                hotelId,
                "2030",
                "VAT Payable",
                "liability"
            );


        accounts.ownerEquity =
            await ensureAccount(
                hotelId,
                "3000",
                "Owner Equity",
                "equity"
            );


        accounts.roomRevenue =
            await ensureAccount(
                hotelId,
                "4000",
                "Room Revenue",
                "revenue"
            );


        accounts.restaurantRevenue =
            await ensureAccount(
                hotelId,
                "4010",
                "Restaurant Revenue",
                "revenue"
            );


        accounts.otherRevenue =
            await ensureAccount(
                hotelId,
                "4020",
                "Other Revenue",
                "revenue"
            );


        accounts.salaryExpense =
            await ensureAccount(
                hotelId,
                "5000",
                "Salaries Expense",
                "expense"
            );


        accounts.foodExpense =
            await ensureAccount(
                hotelId,
                "5010",
                "Food Expense",
                "expense"
            );


        accounts.utilitiesExpense =
            await ensureAccount(
                hotelId,
                "5020",
                "Utilities Expense",
                "expense"
            );


        accounts.maintenanceExpense =
            await ensureAccount(
                hotelId,
                "5030",
                "Maintenance Expense",
                "expense"
            );


        accounts.cleaningExpense =
            await ensureAccount(
                hotelId,
                "5040",
                "Cleaning Expense",
                "expense"
            );


        accounts.inventoryExpense =
            await ensureAccount(
                hotelId,
                "5050",
                "Inventory Expense",
                "expense"
            );


        accounts.otherExpense =
            await ensureAccount(
                hotelId,
                "5060",
                "Other Expenses",
                "expense"
            );


        return accounts;

    }


    /* =====================================================
       RUNNING BALANCE
    ===================================================== */

    async function getCurrentRunningBalance(
        hotelId
    ) {

        const db =
            await getDb();


        const result =
            await db
                .from("financial_transactions")
                .select(
                    "money_in,money_out,created_at,id"
                )
                .eq(
                    "hotel_id",
                    hotelId
                )
                .order(
                    "created_at",
                    {
                        ascending: true
                    }
                )
                .order(
                    "id",
                    {
                        ascending: true
                    }
                );


        if (result.error) {

            throw makeError(
                "Unable to calculate running balance: " +
                result.error.message
            );

        }


        let balance = 0;


        for (
            const transaction
            of result.data || []
        ) {

            balance =
                roundMoney(
                    balance +
                    roundMoney(
                        transaction.money_in
                    ) -
                    roundMoney(
                        transaction.money_out
                    )
                );

        }


        return balance;

    }


    /* =====================================================
       TRANSACTION NUMBER
    ===================================================== */

    async function generateTransactionNumber(
        hotelId
    ) {

        const db =
            await getDb();


        const prefix =
            "FIN-" +
            hotelId +
            "-" +
            new Date()
                .toISOString()
                .slice(0, 10)
                .replace(/-/g, "");


        const result =
            await db
                .from("financial_transactions")
                .select(
                    "transaction_number"
                )
                .eq(
                    "hotel_id",
                    hotelId
                )
                .like(
                    "transaction_number",
                    prefix + "-%"
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                )
                .limit(1);


        if (result.error) {

            throw makeError(
                "Unable to generate transaction number: " +
                result.error.message
            );

        }


        let nextNumber = 1;


        if (
            result.data &&
            result.data.length
        ) {

            const latest =
                String(
                    result.data[0]
                        .transaction_number ||
                    ""
                );


            const parts =
                latest.split("-");


            const lastPart =
                Number(
                    parts[
                        parts.length - 1
                    ]
                );


            if (
                Number.isFinite(
                    lastPart
                )
            ) {

                nextNumber =
                    lastPart + 1;

            }

        }


        return (
            prefix +
            "-" +
            String(
                nextNumber
            ).padStart(
                5,
                "0"
            )
        );

    }


    /* =====================================================
       DUPLICATE REFERENCE CHECK
    ===================================================== */

    async function findTransactionByReference(
        hotelId,
        referenceNumber
    ) {

        if (!referenceNumber) {

            return null;

        }


        const db =
            await getDb();


        const result =
            await db
                .from("financial_transactions")
                .select("*")
                .eq(
                    "hotel_id",
                    hotelId
                )
                .eq(
                    "reference_number",
                    referenceNumber
                )
                .eq(
                    "is_reversal",
                    false
                )
                .limit(1);


        if (result.error) {

            throw makeError(
                "Unable to check duplicate financial reference: " +
                result.error.message
            );

        }


        return (
            result.data &&
            result.data.length
                ? result.data[0]
                : null
        );

    }


    /* =====================================================
       CORE TRANSACTION POSTING
    ===================================================== */

    async function postTransaction(
        options
    ) {

        options =
            options || {};


        const hotelId =
            Number(
                options.hotelId ||
                await getHotelId()
            );


        const amount =
            roundMoney(
                options.amount
            );


        if (amount <= 0) {

            throw makeError(
                "Financial transaction amount must be greater than zero."
            );

        }


        const transactionType =
            options.transactionType ||
            "other";


        if (
            !VALID_TRANSACTION_TYPES.includes(
                transactionType
            )
        ) {

            throw makeError(
                "Invalid financial transaction type: " +
                transactionType
            );

        }


        const referenceNumber =
            options.referenceNumber ||
            null;


        const existing =
            await findTransactionByReference(
                hotelId,
                referenceNumber
            );


        if (existing) {

            return {

                success:
                    true,

                alreadyPosted:
                    true,

                transaction:
                    existing

            };

        }


        const db =
            await getDb();


        const currentBalance =
            await getCurrentRunningBalance(
                hotelId
            );


        const moneyIn =
            roundMoney(
                options.moneyIn
            );


        const moneyOut =
            roundMoney(
                options.moneyOut
            );


        const calculatedIn =
            moneyIn > 0
                ? moneyIn
                : (
                    moneyOut === 0
                        ? amount
                        : 0
                );


        const calculatedOut =
            moneyOut > 0
                ? moneyOut
                : 0;


        const balanceAfter =
            roundMoney(
                currentBalance +
                calculatedIn -
                calculatedOut
            );


        const transactionNumber =
            options.transactionNumber ||
            await generateTransactionNumber(
                hotelId
            );


        const user =
            await getCurrentUser();


        const payload = {

            hotel_id:
                hotelId,

            transaction_number:
                transactionNumber,

            transaction_date:
                options.transactionDate ||
                new Date().toISOString(),

            transaction_type:
                transactionType,

            description:
                options.description ||
                "Financial transaction",

            reference_number:
                referenceNumber,

            debit_account_id:
                options.debitAccountId ||
                null,

            credit_account_id:
                options.creditAccountId ||
                null,

            amount:
                amount,

            money_in:
                calculatedIn,

            money_out:
                calculatedOut,

            balance_after:
                balanceAfter,

            is_reversal:
                Boolean(
                    options.isReversal
                ),

            reversed_transaction_id:
                options.reversedTransactionId ||
                null,

            created_by:
                user.id

        };


        const result =
            await db
                .from(
                    "financial_transactions"
                )
                .insert(
                    payload
                )
                .select("*")
                .single();


        if (result.error) {

            throw makeError(
                "Unable to post financial transaction: " +
                result.error.message
            );

        }


        return {

            success:
                true,

            alreadyPosted:
                false,

            transaction:
                result.data

        };

    }


    /* =====================================================
       ACCOMMODATION LEDGER
    ===================================================== */

    async function postAccommodationCharge(
        options
    ) {

        options =
            options || {};


        const hotelId =
            Number(
                options.hotelId ||
                await getHotelId()
            );


        const reservationId =
            options.reservationId ||
            null;


        const referenceBase =
            options.referenceNumber ||
            (
                reservationId
                    ? "ACCOM-" +
                      reservationId
                    : null
            );


        if (!referenceBase) {

            throw makeError(
                "Reservation ID or accommodation reference is required."
            );

        }


        let roomRevenue =
            roundMoney(
                options.roomRevenue
            );


        let vatAmount =
            roundMoney(
                options.vatAmount
            );


        const suppliedAmount =
            roundMoney(
                options.amount
            );


        if (
            roomRevenue <= 0 &&
            suppliedAmount > 0
        ) {

            const vatRate =
                safeNumber(
                    options.vatRate
                );


            vatAmount =
                roundMoney(
                    suppliedAmount *
                    vatRate /
                    100
                );


            roomRevenue =
                roundMoney(
                    suppliedAmount -
                    vatAmount
                );

        }


        const grossAmount =
            roundMoney(
                roomRevenue +
                vatAmount
            );


        if (grossAmount <= 0) {

            throw makeError(
                "Accommodation charge must be greater than zero."
            );

        }


        const revenueReference =
            referenceBase.endsWith(
                "-REV"
            )
                ? referenceBase
                : referenceBase + "-REV";


        const vatReference =
            referenceBase.endsWith(
                "-VAT"
            )
                ? referenceBase
                : referenceBase + "-VAT";


        const existingRevenue =
            await findTransactionByReference(
                hotelId,
                revenueReference
            );


        const existingVat =
            await findTransactionByReference(
                hotelId,
                vatReference
            );


        if (
            existingRevenue &&
            (
                vatAmount <= 0 ||
                existingVat
            )
        ) {

            return {

                success:
                    true,

                alreadyPosted:
                    true,

                revenueTransaction:
                    existingRevenue,

                vatTransaction:
                    existingVat ||
                    null,

                netAmount:
                    roomRevenue,

                vatAmount:
                    vatAmount,

                grossAmount:
                    grossAmount

            };

        }


        if (
            existingRevenue &&
            vatAmount > 0 &&
            !existingVat
        ) {

            throw makeError(
                "Accommodation revenue is already posted but the VAT posting is missing. The transaction was not duplicated."
            );

        }


        if (
            existingVat &&
            !existingRevenue
        ) {

            throw makeError(
                "Accommodation VAT is already posted but the revenue posting is missing. The transaction was not duplicated."
            );

        }


        const accounts =
            await ensureCoreAccounts(
                hotelId
            );


        const revenueResult =
            await postTransaction({

                hotelId:
                    hotelId,

                transactionType:
                    "income",

                amount:
                    roomRevenue,

                moneyIn:
                    0,

                moneyOut:
                    0,

                description:
                    options.description ||
                    "Accommodation revenue",

                referenceNumber:
                    revenueReference,

                debitAccountId:
                    accounts.receivables.id,

                creditAccountId:
                    accounts.roomRevenue.id

            });


        let vatResult =
            null;


        if (
            vatAmount > 0
        ) {

            vatResult =
                await postTransaction({

                    hotelId:
                        hotelId,

                    transactionType:
                        "income",

                    amount:
                        vatAmount,

                    moneyIn:
                        0,

                    moneyOut:
                        0,

                    description:
                        "Accommodation VAT",

                    referenceNumber:
                        vatReference,

                    debitAccountId:
                        accounts.receivables.id,

                    creditAccountId:
                        accounts.vatPayable.id

                });

        }


        return {

            success:
                true,

            alreadyPosted:
                false,

            revenueTransaction:
                revenueResult.transaction,

            vatTransaction:
                vatResult
                    ? vatResult.transaction
                    : null,

            netAmount:
                roomRevenue,

            vatAmount:
                vatAmount,

            grossAmount:
                grossAmount

        };

    }


    /* =====================================================
       PAYMENT
    ===================================================== */

    async function postPayment(
        options
    ) {

        options =
            options || {};


        const hotelId =
            Number(
                options.hotelId ||
                await getHotelId()
            );


        const amount =
            roundMoney(
                options.amount
            );


        if (amount <= 0) {

            throw makeError(
                "Payment amount must be greater than zero."
            );

        }


        const paymentId =
            options.paymentId ||
            null;


        const reference =
            options.referenceNumber ||
            (
                paymentId
                    ? "PAY-" +
                      paymentId
                    : "PAY-" +
                      createId()
            );


        const accounts =
            await ensureCoreAccounts(
                hotelId
            );


        let paymentAccount =
            options.paymentAccountId ||
            null;


        if (!paymentAccount) {

            const method =
                String(
                    options.paymentMethod ||
                    "cash"
                ).toLowerCase();


            if (
                method === "cash" ||
                method === "cashier"
            ) {

                paymentAccount =
                    accounts.cash.id;

            } else if (
                method === "mpesa" ||
                method === "m-pesa"
            ) {

                paymentAccount =
                    accounts.mpesa.id;

            } else if (
                method === "card"
            ) {

                paymentAccount =
                    accounts.card.id;

            } else if (
                method === "bank"
            ) {

                paymentAccount =
                    accounts.bank.id;

            } else {

                paymentAccount =
                    accounts.cash.id;

            }

        }


        return await postTransaction({

            hotelId:
                hotelId,

            transactionType:
                "transfer",

            amount:
                amount,

            moneyIn:
                amount,

            moneyOut:
                0,

            description:
                options.description ||
                "Guest payment",

            referenceNumber:
                reference,

            debitAccountId:
                paymentAccount,

            creditAccountId:
                accounts.receivables.id

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
            Number(
                options.hotelId ||
                await getHotelId()
            );


        const amount =
            roundMoney(
                options.amount
            );


        if (amount <= 0) {

            throw makeError(
                "Expense amount must be greater than zero."
            );

        }


        const accounts =
            await ensureCoreAccounts(
                hotelId
            );


        const expenseAccount =
            options.expenseAccountId ||
            accounts.otherExpense.id;


        const paymentAccount =
            options.paymentAccountId ||
            accounts.cash.id;


        const reference =
            options.referenceNumber ||
            (
                options.expenseId
                    ? "EXP-" +
                      options.expenseId
                    : "EXP-" +
                      createId()
            );


        return await postTransaction({

            hotelId:
                hotelId,

            transactionType:
                "expense",

            amount:
                amount,

            moneyIn:
                0,

            moneyOut:
                amount,

            description:
                options.description ||
                "Hotel expense",

            referenceNumber:
                reference,

            debitAccountId:
                expenseAccount,

            creditAccountId:
                paymentAccount

        });

    }


    /* =====================================================
       SALARY
    ===================================================== */

    async function postSalary(
        options
    ) {

        options =
            options || {};


        const hotelId =
            Number(
                options.hotelId ||
                await getHotelId()
            );


        const amount =
            roundMoney(
                options.amount
            );


        if (amount <= 0) {

            throw makeError(
                "Salary amount must be greater than zero."
            );

        }


        const accounts =
            await ensureCoreAccounts(
                hotelId
            );


        const reference =
            options.referenceNumber ||
            (
                options.employeeId
                    ? "SAL-" +
                      options.employeeId +
                      "-" +
                      createId()
                    : "SAL-" +
                      createId()
            );


        return await postTransaction({

            hotelId:
                hotelId,

            transactionType:
                "salary",

            amount:
                amount,

            moneyIn:
                0,

            moneyOut:
                amount,

            description:
                options.description ||
                "Employee salary",

            referenceNumber:
                reference,

            debitAccountId:
                accounts.salaryExpense.id,

            creditAccountId:
                options.paymentAccountId ||
                accounts.cash.id

        });

    }


    /* =====================================================
       SALARY ADVANCE
    ===================================================== */

    async function postSalaryAdvance(
        options
    ) {

        options =
            options || {};


        const hotelId =
            Number(
                options.hotelId ||
                await getHotelId()
            );


        const amount =
            roundMoney(
                options.amount
            );


        if (amount <= 0) {

            throw makeError(
                "Salary advance must be greater than zero."
            );

        }


        const accounts =
            await ensureCoreAccounts(
                hotelId
            );


        const reference =
            options.referenceNumber ||
            (
                options.employeeId
                    ? "ADV-" +
                      options.employeeId +
                      "-" +
                      createId()
                    : "ADV-" +
                      createId()
            );


        return await postTransaction({

            hotelId:
                hotelId,

            transactionType:
                "salary_advance",

            amount:
                amount,

            moneyIn:
                0,

            moneyOut:
                amount,

            description:
                options.description ||
                "Employee salary advance",

            referenceNumber:
                reference,

            debitAccountId:
                accounts.employeeAdvances.id,

            creditAccountId:
                options.paymentAccountId ||
                accounts.cash.id

        });

    }


    /* =====================================================
       RESTAURANT SALE
    ===================================================== */

    async function postRestaurantSale(
        options
    ) {

        options =
            options || {};


        const hotelId =
            Number(
                options.hotelId ||
                await getHotelId()
            );


        const amount =
            roundMoney(
                options.amount
            );


        if (amount <= 0) {

            throw makeError(
                "Restaurant sale must be greater than zero."
            );

        }


        const accounts =
            await ensureCoreAccounts(
                hotelId
            );


        const reference =
            options.referenceNumber ||
            (
                options.saleId
                    ? "REST-" +
                      options.saleId
                    : "REST-" +
                      createId()
            );


        return await postTransaction({

            hotelId:
                hotelId,

            transactionType:
                "income",

            amount:
                amount,

            moneyIn:
                amount,

            moneyOut:
                0,

            description:
                options.description ||
                "Restaurant sale",

            referenceNumber:
                reference,

            debitAccountId:
                options.paymentAccountId ||
                accounts.cash.id,

            creditAccountId:
                accounts.restaurantRevenue.id

        });

    }


    /* =====================================================
       MAINTENANCE EXPENSE
    ===================================================== */

    async function postMaintenanceExpense(
        options
    ) {

        options =
            options || {};


        const hotelId =
            Number(
                options.hotelId ||
                await getHotelId()
            );


        const accounts =
            await ensureCoreAccounts(
                hotelId
            );


        return await postExpense({

            hotelId:
                hotelId,

            amount:
                options.amount,

            description:
                options.description ||
                "Maintenance expense",

            referenceNumber:
                options.referenceNumber ||
                (
                    options.maintenanceId
                        ? "MAINT-" +
                          options.maintenanceId
                        : "MAINT-" +
                          createId()
                ),

            expenseAccountId:
                accounts.maintenanceExpense.id,

            paymentAccountId:
                options.paymentAccountId ||
                accounts.cash.id

        });

    }


    /* =====================================================
       INVENTORY EXPENSE
    ===================================================== */

    async function postInventoryPurchase(
        options
    ) {

        options =
            options || {};


        const hotelId =
            Number(
                options.hotelId ||
                await getHotelId()
            );


        const accounts =
            await ensureCoreAccounts(
                hotelId
            );


        return await postExpense({

            hotelId:
                hotelId,

            amount:
                options.amount,

            description:
                options.description ||
                "Inventory purchase",

            referenceNumber:
                options.referenceNumber ||
                (
                    options.purchaseId
                        ? "INV-" +
                          options.purchaseId
                        : "INV-" +
                          createId()
                ),

            expenseAccountId:
                accounts.inventoryExpense.id,

            paymentAccountId:
                options.paymentAccountId ||
                accounts.cash.id

        });

    }


    /* =====================================================
       TRANSFER
    ===================================================== */

    async function postTransfer(
        options
    ) {

        options =
            options || {};


        const hotelId =
            Number(
                options.hotelId ||
                await getHotelId()
            );


        const amount =
            roundMoney(
                options.amount
            );


        if (amount <= 0) {

            throw makeError(
                "Transfer amount must be greater than zero."
            );

        }


        if (
            !options.fromAccountId ||
            !options.toAccountId
        ) {

            throw makeError(
                "Both source and destination accounts are required."
            );

        }


        const reference =
            options.referenceNumber ||
            "TRANSFER-" +
            createId();


        return await postTransaction({

            hotelId:
                hotelId,

            transactionType:
                "transfer",

            amount:
                amount,

            moneyIn:
                0,

            moneyOut:
                0,

            description:
                options.description ||
                "Account transfer",

            referenceNumber:
                reference,

            debitAccountId:
                options.toAccountId,

            creditAccountId:
                options.fromAccountId

        });

    }


    /* =====================================================
       REVERSAL
    ===================================================== */

    async function reverseTransaction(
        transactionId
    ) {

        if (!transactionId) {

            throw makeError(
                "Transaction ID is required for reversal."
            );

        }


        const db =
            await getDb();


        const result =
            await db
                .from(
                    "financial_transactions"
                )
                .select("*")
                .eq(
                    "id",
                    transactionId
                )
                .maybeSingle();


        if (result.error) {

            throw makeError(
                "Unable to load transaction for reversal: " +
                result.error.message
            );

        }


        const original =
            result.data;


        if (!original) {

            throw makeError(
                "The financial transaction was not found."
            );

        }


        if (original.is_reversal) {

            throw makeError(
                "A reversal transaction cannot be reversed again."
            );

        }


        const reversalReference =
            "REV-" +
            original.transaction_number;


        const existing =
            await findTransactionByReference(
                original.hotel_id,
                reversalReference
            );


        if (existing) {

            return {

                success:
                    true,

                alreadyPosted:
                    true,

                transaction:
                    existing

            };

        }


        return await postTransaction({

            hotelId:
                original.hotel_id,

            transactionType:
                original.transaction_type,

            amount:
                safeNumber(
                    original.amount
                ),

            moneyIn:
                safeNumber(
                    original.money_out
                ),

            moneyOut:
                safeNumber(
                    original.money_in
                ),

            description:
                "Reversal of " +
                original.transaction_number,

            referenceNumber:
                reversalReference,

            debitAccountId:
                original.credit_account_id,

            creditAccountId:
                original.debit_account_id,

            isReversal:
                true,

            reversedTransactionId:
                original.id

        });

    }


    /* =====================================================
       CASH PAYMENTS
    ===================================================== */

    async function getCashPayments(
        options
    ) {

        options =
            options || {};


        const hotelId =
            Number(
                options.hotelId ||
                await getHotelId()
            );


        const db =
            await getDb();


        const accounts =
            await ensureCoreAccounts(
                hotelId
            );


        const result =
            await db
                .from(
                    "financial_transactions"
                )
                .select("*")
                .eq(
                    "hotel_id",
                    hotelId
                )
                .eq(
                    "transaction_type",
                    "transfer"
                )
                .eq(
                    "is_reversal",
                    false
                )
                .eq(
                    "debit_account_id",
                    accounts.cash.id
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (result.error) {

            throw makeError(
                "Unable to load cash payments: " +
                result.error.message
            );

        }


        return result.data || [];

    }


    /* =====================================================
       CASHIER HANDOVERS
    ===================================================== */

    async function getCashierHandovers(
        options
    ) {

        options =
            options || {};


        const hotelId =
            Number(
                options.hotelId ||
                await getHotelId()
            );


        const db =
            await getDb();


        let query =
            db
                .from(
                    "cashier_handovers"
                )
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


        /*
         * The database status constraint is currently
         * unknown/restricted.
         *
         * We therefore keep the normal status filtering
         * for values that the cashier page requests.
         */

        if (options.status) {

            query =
                query.eq(
                    "status",
                    options.status
                );

        }


        const result =
            await query;


        if (result.error) {

            throw makeError(
                "Unable to load cashier handovers: " +
                result.error.message
            );

        }


        return result.data || [];

    }


    /* =====================================================
       CREATE CASHIER HANDOVER
    ===================================================== */

    async function createCashierHandover(
        options
    ) {

        options =
            options || {};


        const hotelId =
            Number(
                options.hotelId ||
                await getHotelId()
            );


        const expectedAmount =
            roundMoney(
                options.expectedAmount
            );


        const actualAmount =
            roundMoney(
                options.actualAmount
            );


        if (expectedAmount < 0) {

            throw makeError(
                "Expected cash amount cannot be negative."
            );

        }


        if (actualAmount < 0) {

            throw makeError(
                "Actual cash amount cannot be negative."
            );

        }


        const difference =
            roundMoney(
                actualAmount -
                expectedAmount
            );


        const db =
            await getDb();


        const handoverNumber =
            options.handoverNumber ||
            (
                "HAND-" +
                hotelId +
                "-" +
                Date.now()
            );


        /*
         * IMPORTANT
         * -------------------------------------------------
         * cashier_handovers DOES NOT contain:
         *
         * created_by
         * difference
         *
         * Therefore neither is inserted.
         */

        const payload = {

            hotel_id:
                hotelId,

            handover_number:
                handoverNumber,

            handover_date:
                options.handoverDate ||
                new Date().toISOString(),

            expected_amount:
                expectedAmount,

            actual_amount:
                actualAmount,

            status:
                "pending",

            notes:
                options.notes ||
                null

        };


        const result =
            await db
                .from(
                    "cashier_handovers"
                )
                .insert(
                    payload
                )
                .select("*")
                .single();


        if (result.error) {

            throw makeError(
                "Unable to create cashier handover: " +
                result.error.message
            );

        }


        return {

            success:
                true,

            handover:
                result.data,

            difference:
                difference

        };

    }


    /* =====================================================
       CONFIRM CASHIER HANDOVER
    ===================================================== */

    async function confirmCashierHandover(
        handoverId
    ) {

        if (!handoverId) {

            throw makeError(
                "Handover ID is required."
            );

        }


        const db =
            await getDb();


        /*
         * IMPORTANT
         * -------------------------------------------------
         * The database rejects both "confirmed" and
         * "completed" because of the cashier_handovers
         * status CHECK constraint.
         *
         * Therefore we DO NOT change the status here.
         *
         * We record the confirmation using confirmed_at.
         *
         * This does NOT create another financial transaction.
         * The original guest payment remains the financial
         * ledger transaction.
         */

        const confirmationTime =
            new Date().toISOString();


        const result =
            await db
                .from(
                    "cashier_handovers"
                )
                .update({

                    confirmed_at:
                        confirmationTime

                })
                .eq(
                    "id",
                    handoverId
                )
                .select("*")
                .single();


        if (result.error) {

            throw makeError(
                "Unable to confirm cashier handover: " +
                result.error.message
            );

        }


        const handover =
            result.data;


        const expectedAmount =
            safeNumber(
                handover.expected_amount
            );


        const actualAmount =
            safeNumber(
                handover.actual_amount
            );


        return {

            success:
                true,

            handover:
                handover,

            difference:
                roundMoney(
                    actualAmount -
                    expectedAmount
                )

        };

    }


    /* =====================================================
       BANK DEPOSITS
    ===================================================== */

    async function getBankDeposits(
        options
    ) {

        options =
            options || {};


        const hotelId =
            Number(
                options.hotelId ||
                await getHotelId()
            );


        const db =
            await getDb();


        let query =
            db
                .from(
                    "bank_deposits"
                )
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


        if (options.status) {

            query =
                query.eq(
                    "status",
                    options.status
                );

        }


        const result =
            await query;


        if (result.error) {

            throw makeError(
                "Unable to load bank deposits: " +
                result.error.message
            );

        }


        return result.data || [];

    }


    /* =====================================================
       CREATE BANK DEPOSIT
    ===================================================== */

    async function createBankDeposit(
        options
    ) {

        options =
            options || {};


        const hotelId =
            Number(
                options.hotelId ||
                await getHotelId()
            );


        const expectedAmount =
            roundMoney(
                options.expectedAmount
            );


        const actualAmount =
            roundMoney(
                options.actualAmount
            );


        if (expectedAmount < 0) {

            throw makeError(
                "Expected deposit amount cannot be negative."
            );

        }


        if (actualAmount <= 0) {

            throw makeError(
                "Bank deposit amount must be greater than zero."
            );

        }


        const difference =
            roundMoney(
                actualAmount -
                expectedAmount
            );


        const db =
            await getDb();


        const depositNumber =
            options.depositNumber ||
            (
                "DEP-" +
                hotelId +
                "-" +
                Date.now()
            );


        /*
         * IMPORTANT:
         *
         * bank_deposits DOES NOT contain created_by.
         */

        const payload = {

            hotel_id:
                hotelId,

            deposit_number:
                depositNumber,

            deposit_date:
                options.depositDate ||
                new Date().toISOString(),

            bank_account_id:
                options.bankAccountId ||
                null,

            expected_amount:
                expectedAmount,

            actual_amount:
                actualAmount,

            difference:
                difference,

            reference:
                options.reference ||
                null,

            status:
                "pending"

        };


        const result =
            await db
                .from(
                    "bank_deposits"
                )
                .insert(
                    payload
                )
                .select("*")
                .single();


        if (result.error) {

            throw makeError(
                "Unable to create bank deposit: " +
                result.error.message
            );

        }


        return {

            success:
                true,

            deposit:
                result.data,

            difference:
                difference

        };

    }


    /* =====================================================
       CONFIRM BANK DEPOSIT
    ===================================================== */

    async function confirmBankDeposit(
        depositId
    ) {

        if (!depositId) {

            throw makeError(
                "Bank deposit ID is required."
            );

        }


        const db =
            await getDb();


        const result =
            await db
                .from(
                    "bank_deposits"
                )
                .update({

                    status:
                        "confirmed",

                    confirmed_at:
                        new Date().toISOString()

                })
                .eq(
                    "id",
                    depositId
                )
                .select("*")
                .single();


        if (result.error) {

            throw makeError(
                "Unable to confirm bank deposit: " +
                result.error.message
            );

        }


        return {

            success:
                true,

            deposit:
                result.data

        };

    }


    /* =====================================================
       CASHIER BALANCE
    ===================================================== */

    async function getCashierCashBalance(
        options
    ) {

        options =
            options || {};


        const hotelId =
            Number(
                options.hotelId ||
                await getHotelId()
            );


        const db =
            await getDb();


        const accounts =
            await ensureCoreAccounts(
                hotelId
            );


        const cashAccountId =
            accounts.cash.id;


        const result =
            await db
                .from(
                    "financial_transactions"
                )
                .select(
                    "money_in,money_out,debit_account_id,credit_account_id,amount"
                )
                .eq(
                    "hotel_id",
                    hotelId
                )
                .eq(
                    "is_reversal",
                    false
                );


        if (result.error) {

            throw makeError(
                "Unable to calculate cashier balance: " +
                result.error.message
            );

        }


        let balance = 0;


        for (
            const transaction
            of result.data || []
        ) {

            const amount =
                roundMoney(
                    transaction.amount
                );


            if (
                transaction.debit_account_id ===
                cashAccountId
            ) {

                balance =
                    roundMoney(
                        balance +
                        amount
                    );

            }


            if (
                transaction.credit_account_id ===
                cashAccountId
            ) {

                balance =
                    roundMoney(
                        balance -
                        amount
                    );

            }

        }


        /*
         * Handover records are operational records.
         * They are not deducted from the financial ledger
         * balance.
         */

        return roundMoney(
            balance
        );

    }


    /* =====================================================
       CASH MOVEMENTS
    ===================================================== */

    async function getCashMovements(
        options
    ) {

        options =
            options || {};


        const hotelId =
            Number(
                options.hotelId ||
                await getHotelId()
            );


        const db =
            await getDb();


        const accounts =
            await ensureCoreAccounts(
                hotelId
            );


        const cashAccountId =
            accounts.cash.id;


        const result =
            await db
                .from(
                    "financial_transactions"
                )
                .select("*")
                .eq(
                    "hotel_id",
                    hotelId
                )
                .or(
                    "debit_account_id.eq." +
                    cashAccountId +
                    ",credit_account_id.eq." +
                    cashAccountId
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (result.error) {

            throw makeError(
                "Unable to load cash movements: " +
                result.error.message
            );

        }


        return result.data || [];

    }


    /* =====================================================
       REBUILD RUNNING BALANCES
    ===================================================== */

    async function rebuildRunningBalances(
        hotelId
    ) {

        hotelId =
            Number(
                hotelId ||
                await getHotelId()
            );


        const db =
            await getDb();


        const result =
            await db
                .from(
                    "financial_transactions"
                )
                .select(
                    "id,money_in,money_out,created_at"
                )
                .eq(
                    "hotel_id",
                    hotelId
                )
                .order(
                    "created_at",
                    {
                        ascending: true
                    }
                )
                .order(
                    "id",
                    {
                        ascending: true
                    }
                );


        if (result.error) {

            throw makeError(
                "Unable to load transactions for balance rebuild: " +
                result.error.message
            );

        }


        let balance = 0;


        for (
            const transaction
            of result.data || []
        ) {

            balance =
                roundMoney(
                    balance +
                    safeNumber(
                        transaction.money_in
                    ) -
                    safeNumber(
                        transaction.money_out
                    )
                );


            const updateResult =
                await db
                    .from(
                        "financial_transactions"
                    )
                    .update({

                        balance_after:
                            balance

                    })
                    .eq(
                        "id",
                        transaction.id
                    );


            if (updateResult.error) {

                throw makeError(
                    "Unable to rebuild transaction balance: " +
                    updateResult.error.message
                );

            }

        }


        return {

            success:
                true,

            finalBalance:
                balance

        };

    }


    /* =====================================================
       HEALTH CHECK
    ===================================================== */

    async function healthCheck() {

        try {

            const db =
                await getDb();


            const hotelId =
                await getHotelId();


            const result =
                await db
                    .from(
                        "financial_transactions"
                    )
                    .select("id")
                    .eq(
                        "hotel_id",
                        hotelId
                    )
                    .limit(1);


            if (result.error) {

                throw result.error;

            }


            return {

                success:
                    true,

                ready:
                    true,

                hotelId:
                    hotelId,

                version:
                    VERSION

            };

        } catch (error) {

            return {

                success:
                    false,

                ready:
                    false,

                error:
                    error.message,

                version:
                    VERSION

            };

        }

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    const FinancialEngine = {

        VERSION:
            VERSION,

        waitForSupabaseClient:
            waitForSupabaseClient,

        getDb:
            getDb,

        getHotelId:
            getHotelId,

        getCurrentUser:
            getCurrentUser,

        getCurrentProfile:
            getCurrentProfile,

        getCurrentHotel:
            getCurrentHotel,

        ensureCoreAccounts:
            ensureCoreAccounts,

        getAccountByCode:
            getAccountByCode,

        getCurrentRunningBalance:
            getCurrentRunningBalance,

        postTransaction:
            postTransaction,

        postAccommodationCharge:
            postAccommodationCharge,

        postPayment:
            postPayment,

        postExpense:
            postExpense,

        postSalary:
            postSalary,

        postSalaryAdvance:
            postSalaryAdvance,

        postRestaurantSale:
            postRestaurantSale,

        postMaintenanceExpense:
            postMaintenanceExpense,

        postInventoryPurchase:
            postInventoryPurchase,

        postTransfer:
            postTransfer,

        reverseTransaction:
            reverseTransaction,

        getCashPayments:
            getCashPayments,

        getCashierHandovers:
            getCashierHandovers,

        createCashierHandover:
            createCashierHandover,

        confirmCashierHandover:
            confirmCashierHandover,

        getBankDeposits:
            getBankDeposits,

        createBankDeposit:
            createBankDeposit,

        confirmBankDeposit:
            confirmBankDeposit,

        getCashierCashBalance:
            getCashierCashBalance,

        getCashMovements:
            getCashMovements,

        rebuildRunningBalances:
            rebuildRunningBalances,

        healthCheck:
            healthCheck

    };


    /* =====================================================
       GLOBAL EXPORTS
    ===================================================== */

    window.EDUTECH_FINANCIAL_ENGINE =
        FinancialEngine;


    window.FinancialEngine =
        FinancialEngine;


    window.EDUTECH_FINANCIAL_ENGINE_VERSION =
        VERSION;


    /* =====================================================
       READY FLAG
    ===================================================== */

    window.EDUTECH_FINANCIAL_ENGINE_READY =
        true;


    /* =====================================================
       READY EVENT
    ===================================================== */

    try {

        window.dispatchEvent(
            new CustomEvent(
                "edutech-financial-engine-ready",
                {
                    detail: {

                        version:
                            VERSION,

                        engine:
                            FinancialEngine

                    }
                }
            )
        );


    } catch (error) {

        console.warn(
            "EDU TECH Financial Engine ready event could not be dispatched.",
            error
        );

    }


    /* =====================================================
       CONSOLE MESSAGE
    ===================================================== */

    console.log(
        "EDU TECH Financial Engine " +
        VERSION +
        " loaded successfully."
    );


})();