/* =========================================================
   EDU TECH HOTEL MANAGEMENT SYSTEM
   INVENTORY MODULE
   VERSION: 2026.11.06.30

   MATCHED EXACTLY TO CURRENT inventory.html

   FEATURES:
   - Load logged-in user
   - Load correct hotel
   - Display inventory
   - Add inventory
   - Edit inventory
   - Delete inventory
   - Search inventory
   - Filter inventory
   - Inventory statistics
   - Purchase total calculation
   - Post NEW purchases to financial engine
   - Update EXISTING ledger transaction when editing
   - Print inventory
   - Save as PDF through browser print
   - Export inventory CSV
   - Reliable modal opening/closing
   - Reliable Add/Edit/Delete buttons
   ========================================================= */

"use strict";

(function () {

    /* =========================================================
       GLOBAL VARIABLES
       ========================================================= */

    let supabaseClient = null;
    let currentUser = null;
    let currentHotel = null;
    let inventoryRecords = [];

    let filteredRecords = [];

    let isSaving = false;


    /* =========================================================
       DOM HELPER
       ========================================================= */

    function $(id) {
        return document.getElementById(id);
    }


    /* =========================================================
       MESSAGE
       ========================================================= */

    function showMessage(message, type = "success") {

        const box = $("inventoryMessage");

        if (!box) {
            return;
        }

        box.textContent = message;

        box.style.display = "block";

        if (type === "error") {

            box.style.background = "#f8d7da";
            box.style.color = "#842029";

        } else if (type === "warning") {

            box.style.background = "#fff3cd";
            box.style.color = "#856404";

        } else {

            box.style.background = "#d1e7dd";
            box.style.color = "#0f5132";

        }

        clearTimeout(showMessage.timer);

        showMessage.timer = setTimeout(function () {

            box.style.display = "none";

        }, 5000);
    }


    /* =========================================================
       SUPABASE
       ========================================================= */

    function getSupabaseClient() {

        if (supabaseClient) {
            return supabaseClient;
        }

        if (
            typeof window.supabase !== "undefined" &&
            typeof window.supabase.from === "function"
        ) {

            supabaseClient = window.supabase;

            return supabaseClient;
        }

        if (
            window.supabaseClient &&
            typeof window.supabaseClient.from === "function"
        ) {

            supabaseClient = window.supabaseClient;

            return supabaseClient;
        }

        throw new Error(
            "Supabase client was not loaded. Check supabase.js."
        );
    }


    /* =========================================================
       FINANCIAL ENGINE
       ========================================================= */

    function getFinancialEngine() {

        if (
            window.EDUTECH_FINANCIAL_ENGINE &&
            typeof window.EDUTECH_FINANCIAL_ENGINE.postInventoryPurchase === "function"
        ) {

            return window.EDUTECH_FINANCIAL_ENGINE;
        }

        return null;
    }


    /* =========================================================
       NUMBER HELPERS
       ========================================================= */

    function numberValue(value) {

        const number = Number(value);

        return Number.isFinite(number) ? number : 0;
    }


    function money(value) {

        return numberValue(value).toFixed(2);
    }


    function formatMoney(value) {

        return "KSh " + numberValue(value).toLocaleString(
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


    /* =========================================================
       HOTEL ID HELPERS
       ========================================================= */

    function getStoredHotelId() {

        const possibleKeys = [
            "hotelId",
            "hotel_id",
            "currentHotelId",
            "selectedHotelId",
            "userHotelId"
        ];

        for (const key of possibleKeys) {

            const value =
                sessionStorage.getItem(key) ||
                localStorage.getItem(key);

            if (value && /^\d+$/.test(String(value))) {

                return Number(value);
            }
        }

        return null;
    }


    /* =========================================================
       USER / HOTEL
       ========================================================= */

    async function loadUserAndHotel() {

        const supabase = getSupabaseClient();

        let user = null;

        try {

            const result = await supabase.auth.getUser();

            user = result.data?.user || null;

        } catch (error) {

            console.warn("Unable to read authenticated user.", error);
        }

        currentUser = user;

        const userNameElement = $("currentUserName");
        const userRoleElement = $("currentUserRole");

        if (userNameElement) {

            const displayName =
                user?.user_metadata?.full_name ||
                user?.user_metadata?.name ||
                user?.email ||
                "System User";

            userNameElement.textContent = displayName;
        }

        if (userRoleElement) {

            const role =
                user?.user_metadata?.role ||
                sessionStorage.getItem("userRole") ||
                localStorage.getItem("userRole") ||
                "Hotel Owner";

            userRoleElement.textContent = role;
        }


        /* -----------------------------------------------------
           FIND HOTEL
           ----------------------------------------------------- */

        let hotelId = getStoredHotelId();

        /*
           Try common global/session values used by the system.
        */

        if (!hotelId && window.currentHotelId) {

            hotelId = Number(window.currentHotelId);
        }

        if (
            !hotelId &&
            window.currentHotel &&
            window.currentHotel.id
        ) {

            hotelId = Number(window.currentHotel.id);
        }


        /*
           If hotel ID is not stored, try user metadata.
        */

        if (
            !hotelId &&
            user &&
            user.user_metadata &&
            user.user_metadata.hotel_id
        ) {

            hotelId = Number(user.user_metadata.hotel_id);
        }


        /*
           Final fallback:
           If there is only one active hotel, use it.
        */

        if (!hotelId) {

            const { data, error } = await supabase
                .from("hotels")
                .select("id, hotel_name, location, phone, status")
                .eq("status", "active")
                .order("id", { ascending: true });

            if (!error && data && data.length === 1) {

                hotelId = Number(data[0].id);
            }
        }


        if (!hotelId) {

            throw new Error(
                "No hotel was selected for this user. Please select a hotel first."
            );
        }


        /* -----------------------------------------------------
           LOAD HOTEL
        ----------------------------------------------------- */

        const { data: hotel, error: hotelError } = await supabase
            .from("hotels")
            .select("id, hotel_name, location, phone, status")
            .eq("id", hotelId)
            .maybeSingle();

        if (hotelError) {

            throw hotelError;
        }

        if (!hotel) {

            throw new Error(
                "The selected hotel could not be found."
            );
        }

        currentHotel = hotel;


        /*
           Keep hotel ID available to other pages.
        */

        sessionStorage.setItem(
            "hotelId",
            String(hotel.id)
        );

        localStorage.setItem(
            "hotelId",
            String(hotel.id)
        );


        /* -----------------------------------------------------
           DISPLAY HOTEL
        ----------------------------------------------------- */

        const hotelNameElement = $("inventoryHotelName");

        if (hotelNameElement) {

            hotelNameElement.textContent =
                hotel.hotel_name || "Hotel";
        }


        const hotelSelect = $("inventoryFormHotel");

        if (hotelSelect) {

            hotelSelect.innerHTML = "";

            const option = document.createElement("option");

            option.value = String(hotel.id);

            option.textContent =
                hotel.hotel_name || "Selected Hotel";

            option.selected = true;

            hotelSelect.appendChild(option);
        }


        return hotel;
    }


    /* =========================================================
       LOAD INVENTORY
       ========================================================= */

    async function loadInventory() {

        const supabase = getSupabaseClient();

        if (!currentHotel || !currentHotel.id) {

            throw new Error(
                "Hotel information is not available."
            );
        }


        const { data, error } = await supabase
            .from("inventory")
            .select(`
                id,
                created_at,
                item_name,
                quantity,
                unit,
                reorder_level,
                unit_price,
                hotel_id
            `)
            .eq("hotel_id", currentHotel.id)
            .order("id", { ascending: true });


        if (error) {

            throw error;
        }


        inventoryRecords = Array.isArray(data)
            ? data
            : [];

        applyFilters();
    }


    /* =========================================================
       STOCK STATUS
       ========================================================= */

    function getStockStatus(item) {

        const quantity = numberValue(item.quantity);

        const reorderLevel =
            numberValue(item.reorder_level);


        if (quantity <= 0) {

            return {
                key: "out-of-stock",
                label: "Out of Stock",
                className: "out-of-stock"
            };
        }


        if (quantity <= reorderLevel) {

            return {
                key: "low-stock",
                label: "Low Stock",
                className: "low-stock"
            };
        }


        return {
            key: "in-stock",
            label: "In Stock",
            className: "in-stock"
        };
    }


    /* =========================================================
       FILTER INVENTORY
       ========================================================= */

    function applyFilters() {

        const searchInput = $("inventorySearch");

        const filterSelect = $("inventoryFilter");

        const search = (
            searchInput?.value || ""
        ).trim().toLowerCase();

        const filter =
            filterSelect?.value || "all";


        filteredRecords = inventoryRecords.filter(
            function (item) {

                const status =
                    getStockStatus(item);

                const searchableText = [
                    item.id,
                    item.item_name,
                    item.unit,
                    item.quantity,
                    item.reorder_level,
                    item.unit_price
                ]
                    .join(" ")
                    .toLowerCase();


                const matchesSearch =
                    !search ||
                    searchableText.includes(search);


                const matchesFilter =
                    filter === "all" ||
                    status.key === filter;


                return (
                    matchesSearch &&
                    matchesFilter
                );
            }
        );


        renderInventory();

        updateInventoryStatistics();
    }


    /* =========================================================
       RENDER INVENTORY
       ========================================================= */

    function renderInventory() {

        const tableBody =
            $("inventoryTableBody");

        if (!tableBody) {
            return;
        }


        if (!filteredRecords.length) {

            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="empty-state">
                        No inventory records found.
                    </td>
                </tr>
            `;

            return;
        }


        tableBody.innerHTML =
            filteredRecords.map(function (item) {

                const quantity =
                    numberValue(item.quantity);

                const unitPrice =
                    numberValue(item.unit_price);

                const reorderLevel =
                    numberValue(item.reorder_level);

                const totalValue =
                    quantity * unitPrice;

                const status =
                    getStockStatus(item);


                return `
                    <tr data-id="${escapeHtml(item.id)}">

                        <td>
                            ${escapeHtml(item.id)}
                        </td>

                        <td>
                            <strong>
                                ${escapeHtml(item.item_name)}
                            </strong>
                        </td>

                        <td>
                            ${escapeHtml(item.unit)}
                        </td>

                        <td>
                            ${quantity.toLocaleString(
                                "en-KE",
                                {
                                    maximumFractionDigits: 2
                                }
                            )}
                        </td>

                        <td>
                            ${reorderLevel.toLocaleString(
                                "en-KE",
                                {
                                    maximumFractionDigits: 2
                                }
                            )}
                        </td>

                        <td>
                            ${formatMoney(unitPrice)}
                        </td>

                        <td>
                            <strong>
                                ${formatMoney(totalValue)}
                            </strong>
                        </td>

                        <td>
                            <span class="status ${status.className}">
                                ${status.label}
                            </span>
                        </td>

                        <td>

                            <div class="actions">

                                <button
                                    type="button"
                                    class="btn btn-warning edit-inventory-btn"
                                    data-id="${escapeHtml(item.id)}"
                                >
                                    Edit
                                </button>

                                <button
                                    type="button"
                                    class="btn btn-danger delete-inventory-btn"
                                    data-id="${escapeHtml(item.id)}"
                                >
                                    Delete
                                </button>

                            </div>

                        </td>

                    </tr>
                `;

            }).join("");
    }


    /* =========================================================
       STATISTICS
       ========================================================= */

    function updateInventoryStatistics() {

        const totalItems =
            inventoryRecords.length;


        const inStock =
            inventoryRecords.filter(
                function (item) {

                    return getStockStatus(item).key ===
                        "in-stock";
                }
            ).length;


        const lowStock =
            inventoryRecords.filter(
                function (item) {

                    return getStockStatus(item).key ===
                        "low-stock";
                }
            ).length;


        const totalValue =
            inventoryRecords.reduce(
                function (total, item) {

                    return total +
                        (
                            numberValue(item.quantity) *
                            numberValue(item.unit_price)
                        );

                },
                0
            );


        if ($("totalInventoryItems")) {

            $("totalInventoryItems").textContent =
                totalItems;
        }


        if ($("inStockItems")) {

            $("inStockItems").textContent =
                inStock;
        }


        if ($("lowStockItems")) {

            $("lowStockItems").textContent =
                lowStock;
        }


        if ($("inventoryValue")) {

            $("inventoryValue").textContent =
                formatMoney(totalValue);
        }
    }


    /* =========================================================
       PURCHASE TOTAL
       ========================================================= */

    function updatePurchaseTotal() {

        const quantity =
            numberValue(
                $("inventoryQuantity")?.value
            );

        const unitPrice =
            numberValue(
                $("inventoryUnitPrice")?.value
            );


        const total =
            quantity * unitPrice;


        if ($("purchaseTotal")) {

            $("purchaseTotal").textContent =
                formatMoney(total);
        }


        return total;
    }


    /* =========================================================
       OPEN MODAL
       ========================================================= */

    function openInventoryModal(item = null) {

        const modal =
            $("inventoryModal");

        const form =
            $("inventoryForm");


        if (!modal || !form) {

            showMessage(
                "Inventory form could not be opened.",
                "error"
            );

            return;
        }


        /*
           Reset form first.
        */

        form.reset();


        /*
           Make sure hotel remains selected.
        */

        const hotelSelect =
            $("inventoryFormHotel");

        if (
            hotelSelect &&
            currentHotel &&
            currentHotel.id
        ) {

            hotelSelect.innerHTML = "";

            const option =
                document.createElement("option");

            option.value =
                String(currentHotel.id);

            option.textContent =
                currentHotel.hotel_name;

            option.selected = true;

            hotelSelect.appendChild(option);
        }


        if (item) {

            $("inventoryModalTitle").textContent =
                "Edit Inventory";

            $("inventoryId").value =
                item.id;

            $("inventoryItemName").value =
                item.item_name || "";

            $("inventoryUnit").value =
                item.unit || "";

            $("inventoryQuantity").value =
                item.quantity ?? "";

            $("inventoryReorderLevel").value =
                item.reorder_level ?? 0;

            $("inventoryUnitPrice").value =
                item.unit_price ?? "";


            /*
               When editing, try to load the payment
               method from the existing ledger transaction.
            */

            loadExistingPaymentMethod(item.id);

        } else {

            $("inventoryModalTitle").textContent =
                "Add Inventory";

            $("inventoryId").value = "";

            $("inventoryItemName").value = "";

            $("inventoryUnit").value = "";

            $("inventoryQuantity").value = "";

            $("inventoryReorderLevel").value = "0";

            $("inventoryUnitPrice").value = "";

            if ($("paymentMethod")) {

                $("paymentMethod").value = "cash";
            }
        }


        updatePurchaseTotal();


        /*
           IMPORTANT:
           Current HTML has:
              .modal { display:none; }

           Therefore use display:flex.
        */

        modal.style.display = "flex";

        modal.setAttribute(
            "aria-hidden",
            "false"
        );


        /*
           Focus item name.
        */

        setTimeout(function () {

            $("inventoryItemName")?.focus();

        }, 100);
    }


    /* =========================================================
       CLOSE MODAL
       ========================================================= */

    function closeInventoryModal() {

        const modal =
            $("inventoryModal");

        if (!modal) {
            return;
        }


        modal.style.display = "none";

        modal.setAttribute(
            "aria-hidden",
            "true"
        );


        const form =
            $("inventoryForm");

        if (form) {

            form.reset();
        }


        if ($("inventoryId")) {

            $("inventoryId").value = "";
        }


        if ($("inventoryModalTitle")) {

            $("inventoryModalTitle").textContent =
                "Add Inventory";
        }


        if ($("purchaseTotal")) {

            $("purchaseTotal").textContent =
                "KSh 0.00";
        }
    }


    /* =========================================================
       FIND INVENTORY RECORD
       ========================================================= */

    function findInventoryById(id) {

        return inventoryRecords.find(
            function (item) {

                return String(item.id) === String(id);
            }
        );
    }


    /* =========================================================
       EDIT INVENTORY
       ========================================================= */

    function editInventory(id) {

        const item =
            findInventoryById(id);


        if (!item) {

            showMessage(
                "Inventory record could not be found.",
                "error"
            );

            return;
        }


        openInventoryModal(item);
    }


    /* =========================================================
       DELETE INVENTORY
       ========================================================= */

    async function deleteInventory(id) {

        const item =
            findInventoryById(id);


        if (!item) {

            showMessage(
                "Inventory record could not be found.",
                "error"
            );

            return;
        }


        const confirmed =
            window.confirm(
                `Delete "${item.item_name}" from inventory?`
            );


        if (!confirmed) {
            return;
        }


        const supabase =
            getSupabaseClient();


        try {

            const { error } =
                await supabase
                    .from("inventory")
                    .delete()
                    .eq("id", item.id)
                    .eq("hotel_id", currentHotel.id);


            if (error) {

                throw error;
            }


            showMessage(
                "Inventory item deleted successfully.",
                "success"
            );


            await loadInventory();

        } catch (error) {

            console.error(error);

            showMessage(
                "Unable to delete inventory item: " +
                (
                    error.message ||
                    "Unknown error"
                ),
                "error"
            );
        }
    }


    /* =========================================================
       PAYMENT ACCOUNT CODE
       ========================================================= */

    function getPaymentAccountCode(paymentMethod) {

        const method =
            String(paymentMethod || "cash")
                .trim()
                .toLowerCase();


        if (method === "mpesa") {
            return "1020";
        }

        if (method === "bank") {
            return "1000";
        }

        if (method === "card") {
            return "1040";
        }

        return "1010";
    }


    /* =========================================================
       PAYMENT METHOD FROM LEDGER
       ========================================================= */

    async function loadExistingPaymentMethod(
        inventoryId
    ) {

        const supabase =
            getSupabaseClient();


        if (!currentHotel?.id) {
            return;
        }


        try {

            const reference =
                `INV-${inventoryId}`;


            const { data, error } =
                await supabase
                    .from("financial_transactions")
                    .select(`
                        id,
                        credit_account_id,
                        reference_number
                    `)
                    .eq(
                        "hotel_id",
                        currentHotel.id
                    )
                    .eq(
                        "reference_number",
                        reference
                    )
                    .order(
                        "id",
                        { ascending: false }
                    )
                    .limit(1)
                    .maybeSingle();


            if (error) {

                /*
                   Do not block Edit if the ledger cannot
                   be read.
                */

                console.warn(
                    "Could not read existing inventory ledger transaction.",
                    error
                );

                return;
            }


            if (!data) {
                return;
            }


            const creditCode =
                String(
                    data.credit_account_id || ""
                );


            const paymentSelect =
                $("paymentMethod");


            if (!paymentSelect) {
                return;
            }


            /*
               Depending on the database, credit_account_id
               may be an actual numeric account ID rather
               than the account code.

               Try matching using the financial engine's
               account information when available.
            */

            const engine =
                getFinancialEngine();


            if (
                engine &&
                typeof engine.getAccountByCode === "function"
            ) {

                const methods = [
                    {
                        value: "cash",
                        code: "1010"
                    },
                    {
                        value: "mpesa",
                        code: "1020"
                    },
                    {
                        value: "bank",
                        code: "1000"
                    },
                    {
                        value: "card",
                        code: "1040"
                    }
                ];


                for (const method of methods) {

                    try {

                        const account =
                            await engine.getAccountByCode(
                                currentHotel.id,
                                method.code
                            );


                        if (
                            account &&
                            String(account.id) ===
                            creditCode
                        ) {

                            paymentSelect.value =
                                method.value;

                            return;
                        }

                    } catch (e) {
                        /*
                           Continue checking.
                        */
                    }
                }
            }


            /*
               Fallback if credit_account_id itself
               contains an account code.
            */

            const directMatch = [
                ["1010", "cash"],
                ["1020", "mpesa"],
                ["1000", "bank"],
                ["1040", "card"]
            ];


            for (const pair of directMatch) {

                if (creditCode === pair[0]) {

                    paymentSelect.value =
                        pair[1];

                    return;
                }
            }

        } catch (error) {

            console.warn(
                "Unable to load existing payment method.",
                error
            );
        }
    }


    /* =========================================================
       FIND EXISTING LEDGER TRANSACTION
       ========================================================= */

    async function findInventoryLedgerTransaction(
        inventoryId
    ) {

        const supabase =
            getSupabaseClient();


        const reference =
            `INV-${inventoryId}`;


        const { data, error } =
            await supabase
                .from("financial_transactions")
                .select("*")
                .eq(
                    "hotel_id",
                    currentHotel.id
                )
                .eq(
                    "reference_number",
                    reference
                )
                .order(
                    "id",
                    { ascending: false }
                )
                .limit(1)
                .maybeSingle();


        if (error) {

            throw error;
        }


        return data || null;
    }


    /* =========================================================
       UPDATE EXISTING LEDGER TRANSACTION
       ========================================================= */

    async function updateInventoryLedger(
        inventoryId,
        amount,
        itemName,
        paymentMethod
    ) {

        const supabase =
            getSupabaseClient();


        const transaction =
            await findInventoryLedgerTransaction(
                inventoryId
            );


        if (!transaction) {

            /*
               Do NOT create a second transaction during edit.

               The requirement is to update the existing
               ledger transaction.
            */

            throw new Error(
                `No existing financial transaction was found for INV-${inventoryId}. The inventory was not changed.`
            );
        }


        /*
           Determine the correct credit account.
        */

        const paymentCode =
            getPaymentAccountCode(
                paymentMethod
            );


        let creditAccountId =
            transaction.credit_account_id;


        const engine =
            getFinancialEngine();


        /*
           Ask the existing financial engine for the
           actual account ID.
        */

        if (
            engine &&
            typeof engine.getAccountByCode === "function"
        ) {

            try {

                const account =
                    await engine.getAccountByCode(
                        currentHotel.id,
                        paymentCode
                    );


                if (account && account.id) {

                    creditAccountId =
                        account.id;
                }

            } catch (error) {

                console.warn(
                    "Could not resolve payment account.",
                    error
                );
            }
        }


        const updates = {

            amount: Number(amount),

            description:
                `Inventory purchase - ${itemName}`,

            transaction_type: "expense",

            debit_account_id:
                transaction.debit_account_id,

            credit_account_id:
                creditAccountId,

            money_in: 0,

            money_out: Number(amount)

        };


        /*
           Update only the existing transaction.
        */

        const { data, error } =
            await supabase
                .from("financial_transactions")
                .update(updates)
                .eq(
                    "id",
                    transaction.id
                )
                .eq(
                    "hotel_id",
                    currentHotel.id
                )
                .select()
                .single();


        if (error) {

            throw error;
        }


        /*
           Recalculate running balances after the
           edited transaction.

           The financial engine uses balance_after,
           so changing an earlier amount can affect
           subsequent transactions.
        */

        await recalculateLedgerBalances(
            transaction.id
        );


        return data;
    }


    /* =========================================================
       RECALCULATE LEDGER BALANCES
       ========================================================= */

    async function recalculateLedgerBalances(
        changedTransactionId
    ) {

        const supabase =
            getSupabaseClient();


        /*
           Load all transactions for this hotel
           in chronological order.
        */

        const { data: transactions, error } =
            await supabase
                .from("financial_transactions")
                .select(`
                    id,
                    transaction_date,
                    created_at,
                    amount,
                    money_in,
                    money_out,
                    balance_after
                `)
                .eq(
                    "hotel_id",
                    currentHotel.id
                )
                .order(
                    "transaction_date",
                    { ascending: true }
                )
                .order(
                    "id",
                    { ascending: true }
                );


        if (error) {

            /*
               Balance recalculation should not make the
               inventory update fail if the table/database
               does not permit this operation.
            */

            console.warn(
                "Could not load ledger balances for recalculation.",
                error
            );

            return;
        }


        let balance = 0;


        for (const transaction of (
            transactions || []
        )) {

            const moneyIn =
                numberValue(
                    transaction.money_in
                );

            const moneyOut =
                numberValue(
                    transaction.money_out
                );


            balance +=
                moneyIn -
                moneyOut;


            /*
               Update balance_after.

               Only do this when the calculated value
               differs from the stored value.
            */

            if (
                Math.abs(
                    numberValue(
                        transaction.balance_after
                    ) -
                    balance
                ) > 0.001
            ) {

                const { error: updateError } =
                    await supabase
                        .from("financial_transactions")
                        .update({
                            balance_after:
                                Number(balance.toFixed(2))
                        })
                        .eq(
                            "id",
                            transaction.id
                        )
                        .eq(
                            "hotel_id",
                            currentHotel.id
                        );


                if (updateError) {

                    console.warn(
                        "Could not update ledger balance.",
                        updateError
                    );

                    /*
                       Continue so remaining transactions
                       can still be processed.
                    */
                }
            }
        }
    }


    /* =========================================================
       SAVE INVENTORY
       ========================================================= */

    async function saveInventory(event) {

        if (event) {

            event.preventDefault();
        }


        if (isSaving) {
            return;
        }


        const supabase =
            getSupabaseClient();


        if (!currentHotel?.id) {

            showMessage(
                "No hotel is selected.",
                "error"
            );

            return;
        }


        const id =
            $("inventoryId")?.value?.trim();


        const itemName =
            $("inventoryItemName")?.value?.trim();


        const unit =
            $("inventoryUnit")?.value?.trim();


        const quantity =
            numberValue(
                $("inventoryQuantity")?.value
            );


        const reorderLevel =
            numberValue(
                $("inventoryReorderLevel")?.value
            );


        const unitPrice =
            numberValue(
                $("inventoryUnitPrice")?.value
            );


        const paymentMethod =
            $("paymentMethod")?.value ||
            "cash";


        if (!itemName) {

            showMessage(
                "Please enter the item name.",
                "error"
            );

            $("inventoryItemName")?.focus();

            return;
        }


        if (!unit) {

            showMessage(
                "Please enter the unit.",
                "error"
            );

            $("inventoryUnit")?.focus();

            return;
        }


        if (quantity < 0) {

            showMessage(
                "Quantity cannot be negative.",
                "error"
            );

            return;
        }


        if (unitPrice <= 0) {

            showMessage(
                "Unit purchase price must be greater than zero.",
                "error"
            );

            $("inventoryUnitPrice")?.focus();

            return;
        }


        const total =
            quantity * unitPrice;


        if (total <= 0) {

            showMessage(
                "Purchase value must be greater than zero.",
                "error"
            );

            return;
        }


        isSaving = true;


        const saveButton =
            $("saveInventoryBtn");


        const originalButtonText =
            saveButton?.textContent ||
            "Save Inventory";


        if (saveButton) {

            saveButton.disabled = true;

            saveButton.textContent =
                id
                    ? "Updating..."
                    : "Saving...";
        }


        try {

            /* =================================================
               EDIT EXISTING INVENTORY
               ================================================= */

            if (id) {

                /*
                   First update the existing inventory row.
                */

                const { data: updatedItem, error } =
                    await supabase
                        .from("inventory")
                        .update({

                            item_name:
                                itemName,

                            unit:
                                unit,

                            quantity:
                                quantity,

                            reorder_level:
                                reorderLevel,

                            unit_price:
                                unitPrice

                        })
                        .eq(
                            "id",
                            id
                        )
                        .eq(
                            "hotel_id",
                            currentHotel.id
                        )
                        .select()
                        .single();


                if (error) {

                    throw error;
                }


                /*
                   Update the EXISTING financial ledger
                   transaction.

                   No new ledger transaction is created.
                */

                await updateInventoryLedger(
                    id,
                    total,
                    itemName,
                    paymentMethod
                );


                closeInventoryModal();


                showMessage(
                    "Inventory and existing financial ledger transaction updated successfully.",
                    "success"
                );


                await loadInventory();


                return;
            }


            /* =================================================
               ADD NEW INVENTORY
               ================================================= */

            const { data: newItem, error } =
                await supabase
                    .from("inventory")
                    .insert({

                        item_name:
                            itemName,

                        quantity:
                            quantity,

                        unit:
                            unit,

                        reorder_level:
                            reorderLevel,

                        unit_price:
                            unitPrice,

                        hotel_id:
                            currentHotel.id

                    })
                    .select()
                    .single();


            if (error) {

                throw error;
            }


            /*
               Post NEW inventory purchase to the existing
               financial engine.
            */

            const engine =
                getFinancialEngine();


            if (!engine) {

                /*
                   Roll back inventory record if the
                   financial engine is unavailable.

                   This prevents inventory being saved
                   without its corresponding financial
                   transaction.
                */

                await supabase
                    .from("inventory")
                    .delete()
                    .eq(
                        "id",
                        newItem.id
                    )
                    .eq(
                        "hotel_id",
                        currentHotel.id
                    );


                throw new Error(
                    "Financial engine is not available. Inventory was not saved."
                );
            }


            if (
                typeof engine.postInventoryPurchase !==
                "function"
            ) {

                await supabase
                    .from("inventory")
                    .delete()
                    .eq(
                        "id",
                        newItem.id
                    )
                    .eq(
                        "hotel_id",
                        currentHotel.id
                    );


                throw new Error(
                    "Inventory financial posting function is not available."
                );
            }


            try {

                await engine.postInventoryPurchase({

                    id:
                        newItem.id,

                    hotelId:
                        currentHotel.id,

                    amount:
                        total,

                    total:
                        total,

                    paymentMethod:
                        paymentMethod,

                    description:
                        `Inventory purchase - ${itemName}`,

                    referenceNumber:
                        `INV-${newItem.id}`

                });

            } catch (financialError) {

                /*
                   Roll back inventory if financial posting
                   fails.
                */

                await supabase
                    .from("inventory")
                    .delete()
                    .eq(
                        "id",
                        newItem.id
                    )
                    .eq(
                        "hotel_id",
                        currentHotel.id
                    );


                throw new Error(
                    "Inventory was not saved because the financial transaction could not be posted: " +
                    (
                        financialError.message ||
                        "Unknown financial error"
                    )
                );
            }


            closeInventoryModal();


            showMessage(
                "Inventory added and financial transaction posted successfully.",
                "success"
            );


            await loadInventory();


        } catch (error) {

            console.error(error);

            showMessage(
                error.message ||
                "Unable to save inventory.",
                "error"
            );

        } finally {

            isSaving = false;


            if (saveButton) {

                saveButton.disabled = false;

                saveButton.textContent =
                    originalButtonText;
            }
        }
    }


    /* =========================================================
       TABLE CLICK HANDLER
       ========================================================= */

    function handleTableClick(event) {

        const editButton =
            event.target.closest(
                ".edit-inventory-btn"
            );


        if (editButton) {

            event.preventDefault();

            event.stopPropagation();

            const id =
                editButton.dataset.id;

            editInventory(id);

            return;
        }


        const deleteButton =
            event.target.closest(
                ".delete-inventory-btn"
            );


        if (deleteButton) {

            event.preventDefault();

            event.stopPropagation();

            const id =
                deleteButton.dataset.id;

            deleteInventory(id);

            return;
        }
    }


    /* =========================================================
       PRINT
       ========================================================= */

    function printInventory() {

        window.print();
    }


    /* =========================================================
       CSV / EXCEL EXPORT
       ========================================================= */

    function downloadExcel() {

        if (!inventoryRecords.length) {

            showMessage(
                "There is no inventory data to export.",
                "warning"
            );

            return;
        }


        const rows = [];


        rows.push([
            "ID",
            "Item",
            "Unit",
            "Quantity",
            "Reorder Level",
            "Unit Price",
            "Total Value",
            "Stock Status"
        ]);


        inventoryRecords.forEach(
            function (item) {

                const quantity =
                    numberValue(item.quantity);

                const unitPrice =
                    numberValue(item.unit_price);

                const reorderLevel =
                    numberValue(item.reorder_level);

                const totalValue =
                    quantity * unitPrice;

                const status =
                    getStockStatus(item);


                rows.push([
                    item.id,
                    item.item_name,
                    item.unit,
                    quantity,
                    reorderLevel,
                    unitPrice.toFixed(2),
                    totalValue.toFixed(2),
                    status.label
                ]);
            }
        );


        const csv =
            rows.map(
                function (row) {

                    return row.map(
                        function (value) {

                            const text =
                                String(
                                    value ?? ""
                                );

                            return `"${text.replace(
                                /"/g,
                                '""'
                            )}"`;
                        }
                    ).join(",");
                }
            ).join("\n");


        const blob =
            new Blob(
                [csv],
                {
                    type: "text/csv;charset=utf-8;"
                }
            );


        const url =
            URL.createObjectURL(blob);


        const link =
            document.createElement("a");


        const hotelName =
            currentHotel?.hotel_name ||
            "Hotel";


        link.href = url;

        link.download =
            `${hotelName}-inventory.csv`;


        document.body.appendChild(link);

        link.click();

        link.remove();


        URL.revokeObjectURL(url);


        showMessage(
            "Inventory exported successfully.",
            "success"
        );
    }


    /* =========================================================
       REFRESH
       ========================================================= */

    async function refreshInventory() {

        try {

            await loadInventory();

        } catch (error) {

            showMessage(
                error.message ||
                "Unable to refresh inventory.",
                "error"
            );
        }
    }


    /* =========================================================
       EVENT BINDING
       ========================================================= */

    function bindEvents() {

        /*
           ADD BUTTON
        */

        const newInventoryButton =
            $("newInventoryBtn");


        if (newInventoryButton) {

            newInventoryButton.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();

                    event.stopPropagation();

                    openInventoryModal();

                }
            );
        }


        /*
           CLOSE BUTTON
        */

        const closeButton =
            $("closeInventoryModal");


        if (closeButton) {

            closeButton.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();

                    closeInventoryModal();

                }
            );
        }


        /*
           CANCEL BUTTON
        */

        const cancelButton =
            $("cancelInventoryBtn");


        if (cancelButton) {

            cancelButton.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();

                    closeInventoryModal();

                }
            );
        }


        /*
           FORM SUBMIT
        */

        const form =
            $("inventoryForm");


        if (form) {

            form.addEventListener(
                "submit",
                saveInventory
            );
        }


        /*
           TABLE EDIT / DELETE
        */

        const tableBody =
            $("inventoryTableBody");


        if (tableBody) {

            tableBody.addEventListener(
                "click",
                handleTableClick
            );
        }


        /*
           SEARCH
        */

        const search =
            $("inventorySearch");


        if (search) {

            search.addEventListener(
                "input",
                applyFilters
            );
        }


        /*
           FILTER
        */

        const filter =
            $("inventoryFilter");


        if (filter) {

            filter.addEventListener(
                "change",
                applyFilters
            );
        }


        /*
           PURCHASE TOTAL
        */

        const quantity =
            $("inventoryQuantity");


        const unitPrice =
            $("inventoryUnitPrice");


        if (quantity) {

            quantity.addEventListener(
                "input",
                updatePurchaseTotal
            );

            quantity.addEventListener(
                "change",
                updatePurchaseTotal
            );
        }


        if (unitPrice) {

            unitPrice.addEventListener(
                "input",
                updatePurchaseTotal
            );

            unitPrice.addEventListener(
                "change",
                updatePurchaseTotal
            );
        }


        /*
           PRINT
        */

        const printButton =
            $("printInventoryBtn");


        if (printButton) {

            printButton.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();

                    printInventory();

                }
            );
        }


        /*
           PDF
           
           Browser print dialog provides:
           Print -> Save as PDF
        */

        const pdfButton =
            $("downloadPdfBtn");


        if (pdfButton) {

            pdfButton.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();

                    printInventory();

                }
            );
        }


        /*
           EXCEL
        */

        const excelButton =
            $("downloadExcelBtn");


        if (excelButton) {

            excelButton.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();

                    downloadExcel();

                }
            );
        }


        /*
           CLICK OUTSIDE MODAL
        */

        const modal =
            $("inventoryModal");


        if (modal) {

            modal.addEventListener(
                "click",
                function (event) {

                    if (
                        event.target === modal
                    ) {

                        closeInventoryModal();
                    }
                }
            );
        }


        /*
           ESCAPE KEY
        */

        document.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key === "Escape"
                ) {

                    const modal =
                        $("inventoryModal");

                    if (
                        modal &&
                        modal.style.display === "flex"
                    ) {

                        closeInventoryModal();
                    }
                }
            }
        );
    }


    /* =========================================================
       INITIALIZE
       ========================================================= */

    async function initializeInventory() {

        /*
           Bind buttons FIRST.

           This is important:
           A hotel/database loading error must NOT prevent
           the Add button from receiving its click event.
        */

        bindEvents();


        try {

            getSupabaseClient();


            await loadUserAndHotel();


            await loadInventory();


        } catch (error) {

            console.error(error);

            const tableBody =
                $("inventoryTableBody");


            if (tableBody) {

                tableBody.innerHTML = `
                    <tr>
                        <td colspan="9" class="empty-state">
                            Unable to load inventory.
                        </td>
                    </tr>
                `;
            }


            showMessage(
                error.message ||
                "Unable to initialize inventory.",
                "error"
            );
        }
    }


    /* =========================================================
       PUBLIC FUNCTIONS
       ========================================================= */

    window.openInventoryModal =
        openInventoryModal;

    window.closeInventoryModal =
        closeInventoryModal;

    window.editInventory =
        editInventory;

    window.deleteInventory =
        deleteInventory;

    window.printInventory =
        printInventory;

    window.downloadExcel =
        downloadExcel;

    window.refreshInventory =
        refreshInventory;

    window.updatePurchaseTotal =
        updatePurchaseTotal;


    /* =========================================================
       START
       ========================================================= */

    if (
        document.readyState === "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initializeInventory
        );

    } else {

        initializeInventory();
    }

})();