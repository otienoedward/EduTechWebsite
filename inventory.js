/* =========================================================
   EDU TECH HOTEL MANAGEMENT SYSTEM
   INVENTORY MODULE
   VERSION: 2026.11.17.01

   PHASE 4 - INVENTORY CONTROL

   FEATURES
   ---------------------------------------------------------
   - Load logged-in user
   - Load correct hotel
   - Display inventory
   - Opening stock
   - Stock purchases
   - Stock movements
   - Sales / usage
   - Wastage / damage
   - Stock balance
   - Purchase price
   - Selling price
   - Profit per unit
   - Stock value
   - Minimum stock / reorder alerts
   - Purchase register
   - Movement register
   - Financial ledger integration
   - Idempotent purchase posting
   - Debit = Credit
   - Prevent negative stock
   - Search
   - Category filter
   - Stock status filter
   - Refresh
   - Export
   - Print
   ========================================================= */

(function () {

    "use strict";

    /* =====================================================
       GLOBAL STATE
       ===================================================== */

    let client = null;
    let currentUser = null;
    let currentHotel = null;

    let inventoryRecords = [];
    let purchaseRecords = [];
    let movementRecords = [];

    let editingInventoryId = null;


    /* =====================================================
       BASIC HELPERS
       ===================================================== */

    function qs(selector) {
        return document.querySelector(selector);
    }

    function qsa(selector) {
        return Array.from(document.querySelectorAll(selector));
    }

    function byId(id) {
        return document.getElementById(id);
    }

    function num(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
    }

    function money(value) {
        return num(value).toLocaleString(
            "en-KE",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        );
    }

    function esc(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function today() {
        return new Date().toISOString().slice(0, 10);
    }

    function showMessage(message, type = "info") {

        const existing = byId("inventoryMessage");

        if (existing) {
            existing.textContent = message;
            existing.className =
                "inventory-message " + type;

            setTimeout(() => {
                if (existing) {
                    existing.textContent = "";
                    existing.className =
                        "inventory-message";
                }
            }, 5000);

            return;
        }

        alert(message);
    }

    function closeModal(modal) {

        if (!modal) {
            return;
        }

        modal.classList.remove("show");
        modal.style.display = "none";
    }

    function openModal(modal) {

        if (!modal) {
            return;
        }

        modal.classList.add("show");
        modal.style.display = "flex";
    }


    /* =====================================================
       SUPABASE CLIENT
       ===================================================== */

    function getSupabaseClient() {

        if (window.supabaseClient) {
            return window.supabaseClient;
        }

        if (window.supabase) {

            if (
                typeof window.supabase.from === "function"
            ) {
                return window.supabase;
            }

            if (
                typeof window.supabase.createClient ===
                "function"
            ) {
                const url =
                    window.SUPABASE_URL ||
                    window.supabaseUrl;

                const key =
                    window.SUPABASE_ANON_KEY ||
                    window.supabaseAnonKey;

                if (url && key) {
                    return window.supabase.createClient(
                        url,
                        key
                    );
                }
            }
        }

        return null;
    }


    /* =====================================================
       LOAD USER
       ===================================================== */

    async function loadCurrentUser() {

        client = getSupabaseClient();

        if (!client) {
            throw new Error(
                "Supabase client was not found."
            );
        }

        const {
            data: {
                user
            } = {},
            error
        } = await client.auth.getUser();

        if (error) {
            throw error;
        }

        if (!user) {
            throw new Error(
                "No logged-in user was found."
            );
        }

        currentUser = user;

        return user;
    }


    /* =====================================================
       LOAD HOTEL
       ===================================================== */

    async function loadCurrentHotel() {

        let hotelId = null;

        const savedHotelId =
            sessionStorage.getItem("hotelId");

        if (savedHotelId) {
            hotelId = Number(savedHotelId);
        }

        /*
         * Support system-owner style hotel selection.
         */
        const roomHotel =
            sessionStorage.getItem("roomHotel");

        if (
            !hotelId &&
            roomHotel
        ) {
            try {

                const parsed =
                    JSON.parse(roomHotel);

                if (parsed && parsed.id) {
                    hotelId = Number(parsed.id);
                }

            } catch (error) {
                console.warn(
                    "Could not parse roomHotel.",
                    error
                );
            }
        }

        /*
         * Try profile hotel_id.
         */
        if (!hotelId && currentUser) {

            try {

                const {
                    data,
                    error
                } = await client
                    .from("profiles")
                    .select("hotel_id")
                    .eq(
                        "id",
                        currentUser.id
                    )
                    .maybeSingle();

                if (
                    !error &&
                    data &&
                    data.hotel_id
                ) {
                    hotelId =
                        Number(data.hotel_id);
                }

            } catch (error) {

                console.warn(
                    "Could not load profile hotel.",
                    error
                );
            }
        }

        /*
         * FANANA HOTEL fallback for current project.
         */
        if (!hotelId) {
            hotelId = 4;
        }

        const {
            data: hotel,
            error
        } = await client
            .from("hotels")
            .select("*")
            .eq("id", hotelId)
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!hotel) {
            throw new Error(
                "Hotel could not be found."
            );
        }

        currentHotel = hotel;

        sessionStorage.setItem(
            "hotelId",
            String(hotel.id)
        );

        updateHotelDisplay();

        return hotel;
    }


    /* =====================================================
       HOTEL DISPLAY
       ===================================================== */

    function updateHotelDisplay() {

        if (!currentHotel) {
            return;
        }

        const names = [
            "hotelName",
            "currentHotelName",
            "hotelDisplayName"
        ];

        names.forEach(id => {

            const element = byId(id);

            if (element) {
                element.textContent =
                    currentHotel.name ||
                    "Hotel Management System";
            }
        });

        const address =
            byId("hotelAddress");

        if (address) {

            address.textContent =
                currentHotel.address ||
                currentHotel.location ||
                "";
        }
    }


    /* =====================================================
       INVENTORY CALCULATIONS
       ===================================================== */

    function calculateInventory(row) {

        const opening =
            num(row.opening_stock);

        const purchased =
            num(row.total_purchased);

        const oldQuantity =
            num(row.quantity);

        const sales =
            num(row.total_sold);

        const used =
            num(row.total_used);

        const wastage =
            num(row.total_wastage);

        const adjustment =
            num(row.total_adjustment);

        /*
         * Existing legacy stock compatibility.
         *
         * If opening and purchases are zero but quantity
         * already exists, preserve the existing quantity.
         *
         * This prevents the current SODA quantity of 31
         * from disappearing.
         */
        let totalAvailable =
            opening +
            purchased +
            adjustment;

        if (
            totalAvailable === 0 &&
            oldQuantity > 0
        ) {
            totalAvailable =
                oldQuantity;
        }

        const outflow =
            sales +
            used +
            wastage;

        let balance =
            totalAvailable -
            outflow;

        if (balance < 0) {
            balance = 0;
        }

        const purchasePrice =
            num(row.purchase_price);

        const sellingPrice =
            num(row.selling_price);

        const profit =
            sellingPrice -
            purchasePrice;

        const stockValue =
            balance *
            purchasePrice;

        const minimumStock =
            num(
                row.minimum_stock ??
                row.reorder_level
            );

        let status = "In Stock";

        if (balance <= 0) {

            status =
                "Out of Stock";

        } else if (
            minimumStock > 0 &&
            balance <= minimumStock
        ) {

            status =
                "Low Stock";
        }

        return {
            opening,
            purchased,
            oldQuantity,
            totalAvailable,
            sales,
            used,
            wastage,
            adjustment,
            balance,
            purchasePrice,
            sellingPrice,
            profit,
            stockValue,
            minimumStock,
            status
        };
    }


    /* =====================================================
       LOAD INVENTORY
       ===================================================== */

    async function loadInventory() {

        if (!currentHotel) {
            return;
        }

        const {
            data,
            error
        } = await client
            .from("inventory")
            .select(`
                id,
                created_at,
                item_name,
                quantity,
                unit,
                reorder_level,
                unit_price,
                hotel_id,
                category,
                supplier,
                opening_stock,
                total_purchased,
                total_sold,
                total_used,
                total_wastage,
                total_adjustment,
                purchase_price,
                selling_price,
                minimum_stock,
                last_purchase_date,
                last_purchase_quantity,
                last_supplier,
                notes
            `)
            .eq(
                "hotel_id",
                currentHotel.id
            )
            .order(
                "item_name",
                {
                    ascending: true
                }
            );

        if (error) {
            throw error;
        }

        inventoryRecords =
            data || [];

        renderInventory();
        updateStatistics();
        populateCategoryFilter();
    }


    /* =====================================================
       RENDER INVENTORY
       ===================================================== */

    function renderInventory() {

        const tbody =
            byId("inventoryTableBody") ||
            byId("inventoryTable") ||
            byId("inventoryRecordsBody");

        if (!tbody) {
            return;
        }

        const search =
            (
                byId("inventorySearch") ||
                byId("searchInventory")
            )?.value
                ?.trim()
                .toLowerCase() || "";

        const category =
            (
                byId("categoryFilter")
            )?.value || "all";

        const status =
            (
                byId("stockStatusFilter")
            )?.value || "all";

        const filtered =
            inventoryRecords.filter(row => {

                const calc =
                    calculateInventory(row);

                const matchesSearch =
                    !search ||
                    String(
                        row.item_name || ""
                    )
                        .toLowerCase()
                        .includes(search) ||
                    String(
                        row.category || ""
                    )
                        .toLowerCase()
                        .includes(search) ||
                    String(
                        row.supplier || ""
                    )
                        .toLowerCase()
                        .includes(search);

                const matchesCategory =
                    category === "all" ||
                    String(
                        row.category || ""
                    ) === category;

                const matchesStatus =
                    status === "all" ||
                    (
                        status === "in_stock" &&
                        calc.status === "In Stock"
                    ) ||
                    (
                        status === "low_stock" &&
                        calc.status === "Low Stock"
                    ) ||
                    (
                        status === "out_of_stock" &&
                        calc.status === "Out of Stock"
                    );

                return (
                    matchesSearch &&
                    matchesCategory &&
                    matchesStatus
                );
            });

        if (!filtered.length) {

            tbody.innerHTML = `
                <tr>
                    <td
                        colspan="14"
                        style="text-align:center;padding:25px;"
                    >
                        No inventory records found.
                    </td>
                </tr>
            `;

            return;
        }

        tbody.innerHTML =
            filtered.map(row => {

                const calc =
                    calculateInventory(row);

                const statusClass =
                    calc.status
                        .toLowerCase()
                        .replace(
                            /\s+/g,
                            "-"
                        );

                return `
                    <tr>

                        <td>
                            <strong>
                                ${esc(row.item_name)}
                            </strong>
                        </td>

                        <td>
                            ${esc(
                                row.category || "-"
                            )}
                        </td>

                        <td>
                            ${esc(row.unit)}
                        </td>

                        <td>
                            ${calc.opening}
                        </td>

                        <td>
                            ${calc.purchased}
                        </td>

                        <td>
                            ${calc.totalAvailable}
                        </td>

                        <td>
                            ${calc.sales + calc.used}
                        </td>

                        <td>
                            <strong>
                                ${calc.balance}
                            </strong>
                        </td>

                        <td>
                            KSh
                            ${money(
                                calc.purchasePrice
                            )}
                        </td>

                        <td>
                            KSh
                            ${money(
                                calc.sellingPrice
                            )}
                        </td>

                        <td>
                            KSh
                            ${money(
                                calc.profit
                            )}
                        </td>

                        <td>
                            KSh
                            ${money(
                                calc.stockValue
                            )}
                        </td>

                        <td>
                            <span
                                class="stock-status ${statusClass}"
                            >
                                ${calc.status}
                            </span>
                        </td>

                        <td>
                            <button
                                type="button"
                                class="btn btn-sm btn-primary"
                                data-action="edit-inventory"
                                data-id="${row.id}"
                            >
                                Edit
                            </button>

                            <button
                                type="button"
                                class="btn btn-sm btn-danger"
                                data-action="delete-inventory"
                                data-id="${row.id}"
                            >
                                Delete
                            </button>
                        </td>

                    </tr>
                `;

            }).join("");
    }


    /* =====================================================
       STATISTICS
       ===================================================== */

    function updateStatistics() {

        const totalItems =
            inventoryRecords.length;

        let inStock = 0;
        let lowStock = 0;
        let outOfStock = 0;
        let inventoryValue = 0;

        inventoryRecords.forEach(row => {

            const calc =
                calculateInventory(row);

            inventoryValue +=
                calc.stockValue;

            if (
                calc.status ===
                "In Stock"
            ) {
                inStock++;

            } else if (
                calc.status ===
                "Low Stock"
            ) {
                lowStock++;

            } else {
                outOfStock++;
            }
        });

        setText(
            [
                "totalItems",
                "totalInventoryItems"
            ],
            totalItems
        );

        setText(
            [
                "itemsInStock",
                "inStockItems"
            ],
            inStock
        );

        setText(
            [
                "lowStockItems"
            ],
            lowStock
        );

        setText(
            [
                "outOfStockItems"
            ],
            outOfStock
        );

        setText(
            [
                "inventoryValue",
                "totalInventoryValue"
            ],
            "KSh " +
            money(inventoryValue)
        );
    }

    function setText(ids, value) {

        ids.forEach(id => {

            const el =
                byId(id);

            if (el) {
                el.textContent =
                    value;
            }
        });
    }


    /* =====================================================
       CATEGORY FILTER
       ===================================================== */

    function populateCategoryFilter() {

        const select =
            byId("categoryFilter");

        if (!select) {
            return;
        }

        const current =
            select.value;

        const categories =
            [...new Set(
                inventoryRecords
                    .map(row =>
                        String(
                            row.category || ""
                        ).trim()
                    )
                    .filter(Boolean)
            )].sort();

        select.innerHTML =
            `
                <option value="all">
                    All Categories
                </option>
            ` +
            categories
                .map(category => `
                    <option value="${esc(category)}">
                        ${esc(category)}
                    </option>
                `)
                .join("");

        if (
            categories.includes(current)
        ) {
            select.value =
                current;
        }
    }


    /* =====================================================
       LOAD PURCHASES
       ===================================================== */

    async function loadPurchases() {

        if (!currentHotel) {
            return;
        }

        const tbody =
            byId("purchaseTableBody") ||
            byId("purchasesTableBody") ||
            byId("purchaseRegisterBody");

        if (!tbody) {
            return;
        }

        /*
         * IMPORTANT:
         * These columns match the ACTUAL
         * inventory_purchases table.
         */

        const {
            data,
            error
        } = await client
            .from("inventory_purchases")
            .select(`
                id,
                hotel_id,
                inventory_id,
                purchase_number,
                purchase_date,
                item_name,
                category,
                supplier,
                quantity,
                unit,
                purchase_price,
                selling_price,
                total_purchase_cost,
                payment_method,
                invoice_reference,
                notes,
                financial_transaction_id,
                posting_status,
                posting_key,
                created_by,
                created_at,
                updated_at
            `)
            .eq(
                "hotel_id",
                currentHotel.id
            )
            .order(
                "purchase_date",
                {
                    ascending: false
                }
            )
            .order(
                "id",
                {
                    ascending: false
                }
            )
            .limit(200);

        if (error) {

            console.error(
                "Purchase register error:",
                error
            );

            tbody.innerHTML = `
                <tr>
                    <td
                        colspan="11"
                        style="text-align:center;color:#b91c1c;padding:20px;"
                    >
                        Could not load purchases.
                    </td>
                </tr>
            `;

            return;
        }

        purchaseRecords =
            data || [];

        renderPurchases();
    }


    /* =====================================================
       RENDER PURCHASES
       ===================================================== */

    function renderPurchases() {

        const tbody =
            byId("purchaseTableBody") ||
            byId("purchasesTableBody") ||
            byId("purchaseRegisterBody");

        if (!tbody) {
            return;
        }

        if (!purchaseRecords.length) {

            tbody.innerHTML = `
                <tr>
                    <td
                        colspan="11"
                        style="text-align:center;padding:20px;"
                    >
                        No stock purchases recorded yet.
                    </td>
                </tr>
            `;

            return;
        }

        tbody.innerHTML =
            purchaseRecords.map(purchase => {

                const status =
                    purchase.posting_status ||
                    "pending";

                return `
                    <tr>

                        <td>
                            ${esc(
                                purchase.purchase_date ||
                                ""
                            )}
                        </td>

                        <td>
                            <strong>
                                ${esc(
                                    purchase.purchase_number
                                )}
                            </strong>
                        </td>

                        <td>
                            ${esc(
                                purchase.item_name
                            )}
                        </td>

                        <td>
                            ${esc(
                                purchase.supplier ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${num(
                                purchase.quantity
                            )}
                        </td>

                        <td>
                            ${esc(
                                purchase.unit
                            )}
                        </td>

                        <td>
                            KSh
                            ${money(
                                purchase.purchase_price
                            )}
                        </td>

                        <td>
                            KSh
                            ${money(
                                purchase.selling_price
                            )}
                        </td>

                        <td>
                            KSh
                            ${money(
                                purchase.total_purchase_cost
                            )}
                        </td>

                        <td>
                            ${esc(
                                purchase.payment_method ||
                                "-"
                            )}
                        </td>

                        <td>
                            <div>
                                ${esc(
                                    purchase.invoice_reference ||
                                    "-"
                                )}
                            </div>

                            <small>
                                ${esc(status)}
                            </small>
                        </td>

                    </tr>
                `;

            }).join("");
    }


    /* =====================================================
       LOAD MOVEMENTS
       ===================================================== */

    async function loadMovements() {

        if (!currentHotel) {
            return;
        }

        const tbody =
            byId("movementTableBody") ||
            byId("movementsTableBody") ||
            byId("movementRegisterBody");

        if (!tbody) {
            return;
        }

        const {
            data,
            error
        } = await client
            .from("inventory_movements")
            .select(`
                id,
                hotel_id,
                inventory_id,
                movement_number,
                movement_date,
                movement_type,
                quantity,
                unit,
                unit_price,
                total_value,
                reference_type,
                reference_id,
                reference_number,
                notes,
                created_by,
                created_at
            `)
            .eq(
                "hotel_id",
                currentHotel.id
            )
            .order(
                "movement_date",
                {
                    ascending: false
                }
            )
            .order(
                "id",
                {
                    ascending: false
                }
            )
            .limit(200);

        if (error) {

            console.error(
                "Movement register error:",
                error
            );

            tbody.innerHTML = `
                <tr>
                    <td
                        colspan="10"
                        style="text-align:center;color:#b91c1c;padding:20px;"
                    >
                        Could not load stock movements.
                    </td>
                </tr>
            `;

            return;
        }

        movementRecords =
            data || [];

        renderMovements();
    }


    /* =====================================================
       RENDER MOVEMENTS
       ===================================================== */

    function renderMovements() {

        const tbody =
            byId("movementTableBody") ||
            byId("movementsTableBody") ||
            byId("movementRegisterBody");

        if (!tbody) {
            return;
        }

        if (!movementRecords.length) {

            tbody.innerHTML = `
                <tr>
                    <td
                        colspan="10"
                        style="text-align:center;padding:20px;"
                    >
                        No stock movements recorded yet.
                    </td>
                </tr>
            `;

            return;
        }

        tbody.innerHTML =
            movementRecords.map(movement => {

                return `
                    <tr>

                        <td>
                            ${esc(
                                movement.movement_date
                            )}
                        </td>

                        <td>
                            <strong>
                                ${esc(
                                    movement.movement_number
                                )}
                            </strong>
                        </td>

                        <td>
                            ${esc(
                                getInventoryName(
                                    movement.inventory_id
                                )
                            )}
                        </td>

                        <td>
                            ${esc(
                                movement.movement_type
                            )}
                        </td>

                        <td>
                            ${num(
                                movement.quantity
                            )}
                        </td>

                        <td>
                            ${esc(
                                movement.unit
                            )}
                        </td>

                        <td>
                            KSh
                            ${money(
                                movement.unit_price
                            )}
                        </td>

                        <td>
                            KSh
                            ${money(
                                movement.total_value
                            )}
                        </td>

                        <td>
                            ${esc(
                                movement.reference_number ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${esc(
                                movement.notes ||
                                "-"
                            )}
                        </td>

                    </tr>
                `;

            }).join("");
    }

    function getInventoryName(inventoryId) {

        const item =
            inventoryRecords.find(
                row =>
                    Number(row.id) ===
                    Number(inventoryId)
            );

        return item
            ? item.item_name
            : `Item #${inventoryId}`;
    }


    /* =====================================================
       MODAL HELPERS
       ===================================================== */

    function getModalByNames(names) {

        for (const name of names) {

            const element =
                byId(name);

            if (element) {
                return element;
            }
        }

        return null;
    }


    /* =====================================================
       INVENTORY MODAL
       ===================================================== */

    function openInventoryModal(id = null) {

        const modal =
            getModalByNames([
                "inventoryModal",
                "itemModal"
            ]);

        if (!modal) {
            return;
        }

        editingInventoryId =
            id
                ? Number(id)
                : null;

        const title =
            modal.querySelector(
                "[data-modal-title]"
            ) ||
            byId("inventoryModalTitle");

        if (title) {

            title.textContent =
                editingInventoryId
                    ? "Edit Inventory Item"
                    : "Add Inventory Item";
        }

        const row =
            inventoryRecords.find(
                item =>
                    Number(item.id) ===
                    editingInventoryId
            );

        setInput(
            [
                "inventoryItemName",
                "itemName"
            ],
            row?.item_name || ""
        );

        setInput(
            [
                "inventoryCategory",
                "category"
            ],
            row?.category || ""
        );

        setInput(
            [
                "inventorySupplier",
                "supplier"
            ],
            row?.supplier || ""
        );

        setInput(
            [
                "inventoryQuantity",
                "quantity"
            ],
            row
                ? calculateInventory(row).balance
                : 0
        );

        setInput(
            [
                "inventoryUnit",
                "unit"
            ],
            row?.unit || ""
        );

        setInput(
            [
                "inventoryPurchasePrice",
                "purchasePrice",
                "unitPrice"
            ],
            row
                ? row.purchase_price
                : 0
        );

        setInput(
            [
                "inventorySellingPrice",
                "sellingPrice"
            ],
            row
                ? row.selling_price
                : 0
        );

        setInput(
            [
                "inventoryMinimumStock",
                "minimumStock",
                "reorderLevel"
            ],
            row
                ? (
                    row.minimum_stock ??
                    row.reorder_level ??
                    0
                )
                : 0
        );

        setInput(
            [
                "inventoryNotes",
                "notes"
            ],
            row?.notes || ""
        );

        openModal(modal);
    }


    function setInput(ids, value) {

        for (const id of ids) {

            const element =
                byId(id);

            if (element) {

                element.value =
                    value ?? "";

                return;
            }
        }
    }

    function getInput(ids) {

        for (const id of ids) {

            const element =
                byId(id);

            if (element) {
                return element.value;
            }
        }

        return "";
    }


    /* =====================================================
       SAVE INVENTORY ITEM
       ===================================================== */

    async function saveInventory() {

        if (!currentHotel) {
            throw new Error(
                "Hotel is not loaded."
            );
        }

        const itemName =
            getInput([
                "inventoryItemName",
                "itemName"
            ]).trim();

        const category =
            getInput([
                "inventoryCategory",
                "category"
            ]).trim();

        const supplier =
            getInput([
                "inventorySupplier",
                "supplier"
            ]).trim();

        const unit =
            getInput([
                "inventoryUnit",
                "unit"
            ]).trim();

        const purchasePrice =
            num(
                getInput([
                    "inventoryPurchasePrice",
                    "purchasePrice",
                    "unitPrice"
                ])
            );

        const sellingPrice =
            num(
                getInput([
                    "inventorySellingPrice",
                    "sellingPrice"
                ])
            );

        const minimumStock =
            num(
                getInput([
                    "inventoryMinimumStock",
                    "minimumStock",
                    "reorderLevel"
                ])
            );

        const notes =
            getInput([
                "inventoryNotes",
                "notes"
            ]).trim();

        if (!itemName) {
            throw new Error(
                "Item name is required."
            );
        }

        if (!unit) {
            throw new Error(
                "Unit is required."
            );
        }

        const payload = {

            hotel_id:
                currentHotel.id,

            item_name:
                itemName,

            category:
                category || null,

            supplier:
                supplier || null,

            unit:
                unit,

            purchase_price:
                purchasePrice,

            selling_price:
                sellingPrice,

            minimum_stock:
                minimumStock,

            reorder_level:
                minimumStock,

            notes:
                notes || null
        };

        if (editingInventoryId) {

            const {
                error
            } = await client
                .from("inventory")
                .update(payload)
                .eq(
                    "id",
                    editingInventoryId
                )
                .eq(
                    "hotel_id",
                    currentHotel.id
                );

            if (error) {
                throw error;
            }

            showMessage(
                "Inventory item updated successfully.",
                "success"
            );

        } else {

            payload.quantity = 0;
            payload.opening_stock = 0;
            payload.total_purchased = 0;
            payload.total_sold = 0;
            payload.total_used = 0;
            payload.total_wastage = 0;
            payload.total_adjustment = 0;
            payload.unit_price =
                purchasePrice;

            const {
                error
            } = await client
                .from("inventory")
                .insert(payload);

            if (error) {
                throw error;
            }

            showMessage(
                "Inventory item added successfully.",
                "success"
            );
        }

        closeAllModals();

        await refreshAll();
    }


    /* =====================================================
       DELETE INVENTORY
       ===================================================== */

    async function deleteInventory(id) {

        const row =
            inventoryRecords.find(
                item =>
                    Number(item.id) ===
                    Number(id)
            );

        if (!row) {
            return;
        }

        const confirmed =
            confirm(
                `Delete "${row.item_name}" from inventory?`
            );

        if (!confirmed) {
            return;
        }

        const calc =
            calculateInventory(row);

        if (
            calc.balance > 0
        ) {

            alert(
                "This item still has stock. Reduce or clear the stock before deleting it."
            );

            return;
        }

        const {
            error
        } = await client
            .from("inventory")
            .delete()
            .eq(
                "id",
                id
            )
            .eq(
                "hotel_id",
                currentHotel.id
            );

        if (error) {
            throw error;
        }

        showMessage(
            "Inventory item deleted.",
            "success"
        );

        await refreshAll();
    }


    /* =====================================================
       PURCHASE MODAL
       ===================================================== */

    function openPurchaseModal() {

        const modal =
            getModalByNames([
                "purchaseModal",
                "stockPurchaseModal"
            ]);

        if (!modal) {
            return;
        }

        setInput(
            [
                "purchaseDate"
            ],
            today()
        );

        setInput(
            [
                "purchaseQuantity"
            ],
            1
        );

        setInput(
            [
                "purchasePrice"
            ],
            0
        );

        setInput(
            [
                "purchaseSellingPrice"
            ],
            0
        );

        setInput(
            [
                "purchaseSupplier"
            ],
            ""
        );

        setInput(
            [
                "purchaseInvoiceReference",
                "purchaseReference",
                "invoiceReference"
            ],
            ""
        );

        setInput(
            [
                "purchaseNotes"
            ],
            ""
        );

        calculatePurchaseTotal();

        openModal(modal);
    }


    /* =====================================================
       PURCHASE TOTAL
       ===================================================== */

    function calculatePurchaseTotal() {

        const quantity =
            num(
                getInput([
                    "purchaseQuantity"
                ])
            );

        const price =
            num(
                getInput([
                    "purchasePrice"
                ])
            );

        const total =
            quantity *
            price;

        setText(
            [
                "purchaseTotal",
                "purchaseTotalCost"
            ],
            "KSh " +
            money(total)
        );

        const hidden =
            byId("purchaseTotalInput");

        if (hidden) {
            hidden.value =
                total.toFixed(2);
        }
    }


    /* =====================================================
       PURCHASE NUMBER
       ===================================================== */

    function generatePurchaseNumber() {

        const now =
            new Date();

        const date =
            now.toISOString()
                .slice(0, 10)
                .replace(/-/g, "");

        const random =
            Math.random()
                .toString(36)
                .substring(2, 7)
                .toUpperCase();

        return (
            "PUR-" +
            currentHotel.id +
            "-" +
            date +
            "-" +
            random
        );
    }


    /* =====================================================
       PURCHASE PAYMENT ACCOUNT
       ===================================================== */

    async function getFinancialAccountId(
        code
    ) {

        const {
            data,
            error
        } = await client
            .from("financial_accounts")
            .select(
                "id,account_code,account_name"
            )
            .eq(
                "hotel_id",
                currentHotel.id
            )
            .eq(
                "account_code",
                code
            )
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!data) {
            throw new Error(
                `Financial account ${code} was not found for this hotel.`
            );
        }

        return data.id;
    }


    function paymentMethodToAccountCode(
        method
    ) {

        const value =
            String(
                method || ""
            )
                .trim()
                .toLowerCase();

        if (
            value === "cash"
        ) {
            return "1010";
        }

        if (
            value === "mpesa" ||
            value === "m-pesa"
        ) {
            return "1020";
        }

        if (
            value === "bank"
        ) {
            return "1000";
        }

        if (
            value === "card"
        ) {
            return "1040";
        }

        /*
         * Default to cash for blank/unknown
         * methods, but the purchase form should
         * normally require a method.
         */
        return "1010";
    }


    /* =====================================================
       FIND EXISTING FINANCIAL POSTING
       ===================================================== */

    async function findExistingPurchasePosting(
        postingKey
    ) {

        const {
            data,
            error
        } = await client
            .from("financial_transactions")
            .select(`
                id,
                hotel_id,
                transaction_number,
                transaction_date,
                description,
                reference_number,
                transaction_type,
                debit_account_id,
                credit_account_id,
                amount,
                money_in,
                money_out,
                balance_after,
                notes
            `)
            .eq(
                "hotel_id",
                currentHotel.id
            )
            .eq(
                "reference_number",
                postingKey
            )
            .maybeSingle();

        if (error) {

            /*
             * If the reference does not exist,
             * Supabase may return no row rather
             * than an error.
             */
            if (
                error.code === "PGRST116"
            ) {
                return null;
            }

            throw error;
        }

        return data || null;
    }


    /* =====================================================
       CREATE FINANCIAL TRANSACTION
       ===================================================== */

    async function postPurchaseToLedger(
        purchase
    ) {

        if (
            purchase.financial_transaction_id
        ) {

            const {
                data,
                error
            } = await client
                .from("financial_transactions")
                .select("id")
                .eq(
                    "id",
                    purchase.financial_transaction_id
                )
                .maybeSingle();

            if (error) {
                throw error;
            }

            if (data) {
                return data.id;
            }
        }

        const postingKey =
            purchase.posting_key ||
            (
                "INV-PURCHASE-" +
                purchase.id
            );

        /*
         * Idempotency check.
         */
        const existing =
            await findExistingPurchasePosting(
                postingKey
            );

        if (existing) {

            await client
                .from("inventory_purchases")
                .update({
                    financial_transaction_id:
                        existing.id,

                    posting_status:
                        "posted",

                    posting_key:
                        postingKey,

                    updated_at:
                        new Date().toISOString()
                })
                .eq(
                    "id",
                    purchase.id
                );

            return existing.id;
        }

        /*
         * Inventory expense = debit 5050
         * Payment account = credit based
         * on purchase payment method.
         */
        const expenseAccountId =
            await getFinancialAccountId(
                "5050"
            );

        const paymentAccountCode =
            paymentMethodToAccountCode(
                purchase.payment_method
            );

        const paymentAccountId =
            await getFinancialAccountId(
                paymentAccountCode
            );

        const amount =
            num(
                purchase.total_purchase_cost
            );

        if (amount <= 0) {
            throw new Error(
                "Purchase total must be greater than zero."
            );
        }

        const transactionNumber =
            "FIN-" +
            currentHotel.id +
            "-" +
            new Date()
                .toISOString()
                .replace(
                    /[-:TZ.]/g,
                    ""
                )
                .slice(0, 14) +
            "-" +
            Math.random()
                .toString(36)
                .substring(2, 6)
                .toUpperCase();

        const {
            data,
            error
        } = await client
            .from("financial_transactions")
            .insert({

                hotel_id:
                    currentHotel.id,

                transaction_number:
                    transactionNumber,

                transaction_date:
                    purchase.purchase_date ||
                    today(),

                description:
                    "Inventory purchase - " +
                    purchase.item_name,

                reference_number:
                    postingKey,

                transaction_type:
                    "inventory_purchase",

                debit_account_id:
                    expenseAccountId,

                credit_account_id:
                    paymentAccountId,

                amount:
                    amount,

                money_in:
                    0,

                money_out:
                    amount,

                notes:
                    [
                        "Inventory purchase",
                        purchase.purchase_number,
                        purchase.supplier
                            ? `Supplier: ${purchase.supplier}`
                            : "",
                        purchase.invoice_reference
                            ? `Invoice: ${purchase.invoice_reference}`
                            : ""
                    ]
                        .filter(Boolean)
                        .join(" | "),

                created_by:
                    currentUser?.id ||
                    null

            })
            .select(
                "id"
            )
            .single();

        if (error) {
            throw error;
        }

        if (!data?.id) {
            throw new Error(
                "Financial transaction was not created."
            );
        }

        /*
         * Save the financial transaction ID
         * back to the source purchase.
         */
        const {
            error:
                updateError
        } = await client
            .from("inventory_purchases")
            .update({

                financial_transaction_id:
                    data.id,

                posting_status:
                    "posted",

                posting_key:
                    postingKey,

                updated_at:
                    new Date().toISOString()

            })
            .eq(
                "id",
                purchase.id
            );

        if (updateError) {
            throw updateError;
        }

        return data.id;
    }


    /* =====================================================
       SAVE STOCK PURCHASE
       ===================================================== */

    async function savePurchase() {

        if (!currentHotel) {
            throw new Error(
                "Hotel is not loaded."
            );
        }

        const inventoryId =
            Number(
                getInput([
                    "purchaseInventoryId",
                    "inventoryId"
                ])
            ) || null;

        let inventory =
            inventoryId
                ? inventoryRecords.find(
                    row =>
                        Number(row.id) ===
                        inventoryId
                )
                : null;

        const selectedItemId =
            inventoryId;

        const itemNameInput =
            getInput([
                "purchaseItemName",
                "purchaseItem"
            ]).trim();

        if (!inventory && selectedItemId) {

            const {
                data,
                error
            } = await client
                .from("inventory")
                .select("*")
                .eq(
                    "id",
                    selectedItemId
                )
                .eq(
                    "hotel_id",
                    currentHotel.id
                )
                .maybeSingle();

            if (error) {
                throw error;
            }

            inventory = data;
        }

        if (!inventory && !itemNameInput) {

            throw new Error(
                "Select an inventory item."
            );
        }

        const purchaseDate =
            getInput([
                "purchaseDate"
            ]) ||
            today();

        const quantity =
            num(
                getInput([
                    "purchaseQuantity"
                ])
            );

        const unit =
            getInput([
                "purchaseUnit"
            ]).trim() ||
            inventory?.unit ||
            "";

        const purchasePrice =
            num(
                getInput([
                    "purchasePrice"
                ])
            );

        const sellingPrice =
            num(
                getInput([
                    "purchaseSellingPrice"
                ])
            );

        const supplier =
            getInput([
                "purchaseSupplier"
            ]).trim();

        const paymentMethod =
            getInput([
                "purchasePaymentMethod",
                "paymentMethod"
            ]).trim();

        const invoiceReference =
            getInput([
                "purchaseInvoiceReference",
                "purchaseReference",
                "invoiceReference"
            ]).trim();

        const notes =
            getInput([
                "purchaseNotes"
            ]).trim();

        if (
            quantity <= 0
        ) {
            throw new Error(
                "Purchase quantity must be greater than zero."
            );
        }

        if (
            purchasePrice <= 0
        ) {
            throw new Error(
                "Purchase price must be greater than zero."
            );
        }

        if (
            !unit
        ) {
            throw new Error(
                "Purchase unit is required."
            );
        }

        if (
            !paymentMethod
        ) {
            throw new Error(
                "Select a payment method."
            );
        }

        const itemName =
            inventory?.item_name ||
            itemNameInput;

        const category =
            inventory?.category ||
            getInput([
                "purchaseCategory",
                "category"
            ]).trim() ||
            null;

        const totalPurchaseCost =
            quantity *
            purchasePrice;

        const purchaseNumber =
            generatePurchaseNumber();

        /*
         * -------------------------------------------------
         * STEP 1
         * Create source purchase record.
         * -------------------------------------------------
         */

        const {
            data: purchase,
            error:
                purchaseError
        } = await client
            .from("inventory_purchases")
            .insert({

                hotel_id:
                    currentHotel.id,

                inventory_id:
                    inventory?.id ||
                    null,

                purchase_number:
                    purchaseNumber,

                purchase_date:
                    purchaseDate,

                item_name:
                    itemName,

                category:
                    category,

                supplier:
                    supplier ||
                    null,

                quantity:
                    quantity,

                unit:
                    unit,

                purchase_price:
                    purchasePrice,

                selling_price:
                    sellingPrice,

                total_purchase_cost:
                    totalPurchaseCost,

                payment_method:
                    paymentMethod,

                invoice_reference:
                    invoiceReference ||
                    null,

                notes:
                    notes ||
                    null,

                posting_status:
                    "pending",

                posting_key:
                    null,

                created_by:
                    currentUser?.id ||
                    null

            })
            .select("*")
            .single();

        if (purchaseError) {
            throw purchaseError;
        }

        /*
         * -------------------------------------------------
         * STEP 2
         * Post exactly once to financial ledger.
         * -------------------------------------------------
         */

        let financialTransactionId;

        try {

            financialTransactionId =
                await postPurchaseToLedger(
                    purchase
                );

        } catch (ledgerError) {

            /*
             * Preserve source purchase record so
             * it can be repaired/reposted instead
             * of silently disappearing.
             */
            await client
                .from("inventory_purchases")
                .update({

                    posting_status:
                        "failed",

                    posting_key:
                        "INV-PURCHASE-" +
                        purchase.id,

                    notes:
                        [
                            notes,
                            "Ledger posting failed: " +
                            ledgerError.message
                        ]
                            .filter(Boolean)
                            .join(" | "),

                    updated_at:
                        new Date().toISOString()

                })
                .eq(
                    "id",
                    purchase.id
                );

            throw new Error(
                "Purchase was saved, but financial posting failed: " +
                ledgerError.message
            );
        }

        /*
         * -------------------------------------------------
         * STEP 3
         * Update inventory stock.
         * -------------------------------------------------
         */

        let inventoryRow =
            inventory;

        if (!inventoryRow) {

            /*
             * If the purchase form supports creating
             * a purchase for a new item, create it.
             */
            const {
                data,
                error
            } = await client
                .from("inventory")
                .insert({

                    hotel_id:
                        currentHotel.id,

                    item_name:
                        itemName,

                    category:
                        category,

                    supplier:
                        supplier ||
                        null,

                    quantity:
                        quantity,

                    unit:
                        unit,

                    unit_price:
                        purchasePrice,

                    purchase_price:
                        purchasePrice,

                    selling_price:
                        sellingPrice,

                    opening_stock:
                        0,

                    total_purchased:
                        quantity,

                    total_sold:
                        0,

                    total_used:
                        0,

                    total_wastage:
                        0,

                    total_adjustment:
                        0,

                    minimum_stock:
                        0,

                    reorder_level:
                        0,

                    last_purchase_date:
                        purchaseDate,

                    last_purchase_quantity:
                        quantity,

                    last_supplier:
                        supplier ||
                        null,

                    notes:
                        notes ||
                        null

                })
                .select("*")
                .single();

            if (error) {
                throw error;
            }

            inventoryRow =
                data;

        } else {

            const current =
                calculateInventory(
                    inventoryRow
                );

            const newPurchased =
                current.purchased +
                quantity;

            const newQuantity =
                current.balance +
                quantity;

            const {
                error
            } = await client
                .from("inventory")
                .update({

                    quantity:
                        newQuantity,

                    total_purchased:
                        newPurchased,

                    purchase_price:
                        purchasePrice,

                    selling_price:
                        sellingPrice,

                    unit_price:
                        purchasePrice,

                    supplier:
                        supplier ||
                        inventoryRow.supplier ||
                        null,

                    category:
                        category ||
                        inventoryRow.category ||
                        null,

                    last_purchase_date:
                        purchaseDate,

                    last_purchase_quantity:
                        quantity,

                    last_supplier:
                        supplier ||
                        null,

                    notes:
                        notes ||
                        inventoryRow.notes ||
                        null

                })
                .eq(
                    "id",
                    inventoryRow.id
                )
                .eq(
                    "hotel_id",
                    currentHotel.id
                );

            if (error) {
                throw error;
            }
        }

        /*
         * -------------------------------------------------
         * STEP 4
         * Create stock movement.
         * -------------------------------------------------
         */

        const movementNumber =
            "MOV-" +
            currentHotel.id +
            "-" +
            new Date()
                .toISOString()
                .replace(
                    /[-:TZ.]/g,
                    ""
                )
                .slice(0, 14) +
            "-" +
            Math.random()
                .toString(36)
                .substring(2, 6)
                .toUpperCase();

        const finalInventoryId =
            inventoryRow?.id ||
            null;

        if (finalInventoryId) {

            const {
                error:
                    movementError
            } = await client
                .from("inventory_movements")
                .insert({

                    hotel_id:
                        currentHotel.id,

                    inventory_id:
                        finalInventoryId,

                    movement_number:
                        movementNumber,

                    movement_date:
                        purchaseDate,

                    movement_type:
                        "purchase",

                    quantity:
                        quantity,

                    unit:
                        unit,

                    unit_price:
                        purchasePrice,

                    total_value:
                        totalPurchaseCost,

                    reference_type:
                        "inventory_purchase",

                    reference_id:
                        purchase.id,

                    reference_number:
                        purchaseNumber,

                    notes:
                        notes ||
                        "Stock purchase",

                    created_by:
                        currentUser?.id ||
                        null

                });

            if (movementError) {
                console.error(
                    "Movement creation warning:",
                    movementError
                );
            }
        }

        /*
         * -------------------------------------------------
         * STEP 5
         * Link financial transaction if needed.
         * -------------------------------------------------
         */

        await client
            .from("inventory_purchases")
            .update({

                financial_transaction_id:
                    financialTransactionId,

                posting_status:
                    "posted",

                posting_key:
                    "INV-PURCHASE-" +
                    purchase.id,

                updated_at:
                    new Date().toISOString()

            })
            .eq(
                "id",
                purchase.id
            );

        closeAllModals();

        showMessage(
            "Stock purchase saved, stock updated and financial transaction posted successfully.",
            "success"
        );

        await refreshAll();
    }


    /* =====================================================
       MOVEMENT MODAL
       ===================================================== */

    function openMovementModal() {

        const modal =
            getModalByNames([
                "movementModal",
                "stockMovementModal"
            ]);

        if (!modal) {
            return;
        }

        setInput(
            [
                "movementDate"
            ],
            today()
        );

        setInput(
            [
                "movementQuantity"
            ],
            1
        );

        setInput(
            [
                "movementReference"
            ],
            ""
        );

        setInput(
            [
                "movementNotes"
            ],
            ""
        );

        openModal(modal);
    }


    /* =====================================================
       MOVEMENT NUMBER
       ===================================================== */

    function generateMovementNumber() {

        return (
            "MOV-" +
            currentHotel.id +
            "-" +
            Date.now() +
            "-" +
            Math.random()
                .toString(36)
                .substring(2, 6)
                .toUpperCase()
        );
    }


    /* =====================================================
       SAVE MOVEMENT
       ===================================================== */

    async function saveMovement() {

        const inventoryId =
            Number(
                getInput([
                    "movementInventoryId",
                    "movementItemId",
                    "inventoryId"
                ])
            );

        if (!inventoryId) {
            throw new Error(
                "Select an inventory item."
            );
        }

        const inventory =
            inventoryRecords.find(
                row =>
                    Number(row.id) ===
                    inventoryId
            );

        if (!inventory) {
            throw new Error(
                "Inventory item could not be found."
            );
        }

        const movementType =
            getInput([
                "movementType"
            ])
                .trim()
                .toLowerCase();

        const quantity =
            num(
                getInput([
                    "movementQuantity"
                ])
            );

        const movementDate =
            getInput([
                "movementDate"
            ]) ||
            today();

        const referenceNumber =
            getInput([
                "movementReference"
            ]).trim();

        const notes =
            getInput([
                "movementNotes"
            ]).trim();

        if (!movementType) {
            throw new Error(
                "Select a movement type."
            );
        }

        if (
            quantity <= 0
        ) {
            throw new Error(
                "Movement quantity must be greater than zero."
            );
        }

        const calc =
            calculateInventory(
                inventory
            );

        const decreaseTypes = [
            "sale",
            "usage",
            "restaurant_usage",
            "wastage",
            "damage"
        ];

        const increaseTypes = [
            "adjustment_in",
            "return"
        ];

        let newQuantity =
            calc.balance;

        if (
            decreaseTypes.includes(
                movementType
            )
        ) {

            if (
                quantity >
                calc.balance
            ) {

                throw new Error(
                    `Insufficient stock. Available balance is ${calc.balance} ${inventory.unit}.`
                );
            }

            newQuantity -=
                quantity;

        } else if (
            increaseTypes.includes(
                movementType
            )
        ) {

            newQuantity +=
                quantity;

        } else if (
            movementType ===
            "adjustment"
        ) {

            /*
             * Generic adjustment is treated
             * as a quantity reduction.
             */
            if (
                quantity >
                calc.balance
            ) {

                throw new Error(
                    `Insufficient stock. Available balance is ${calc.balance} ${inventory.unit}.`
                );
            }

            newQuantity -=
                quantity;

        } else {

            throw new Error(
                "Invalid movement type."
            );
        }

        const unitPrice =
            num(
                inventory.purchase_price
            );

        const totalValue =
            quantity *
            unitPrice;

        const movementNumber =
            generateMovementNumber();

        const {
            error:
                movementError
        } = await client
            .from("inventory_movements")
            .insert({

                hotel_id:
                    currentHotel.id,

                inventory_id:
                    inventory.id,

                movement_number:
                    movementNumber,

                movement_date:
                    movementDate,

                movement_type:
                    movementType,

                quantity:
                    quantity,

                unit:
                    inventory.unit,

                unit_price:
                    unitPrice,

                total_value:
                    totalValue,

                reference_type:
                    referenceNumber
                        ? "manual"
                        : null,

                reference_id:
                    null,

                reference_number:
                    referenceNumber ||
                    null,

                notes:
                    notes ||
                    null,

                created_by:
                    currentUser?.id ||
                    null
            });

        if (movementError) {
            throw movementError;
        }

        /*
         * Update stock totals.
         */
        const update = {
            quantity:
                newQuantity
        };

        if (
            movementType ===
            "sale"
        ) {

            update.total_sold =
                calc.sales +
                quantity;

        } else if (
            movementType ===
            "usage" ||
            movementType ===
            "restaurant_usage"
        ) {

            update.total_used =
                calc.used +
                quantity;

        } else if (
            movementType ===
            "wastage" ||
            movementType ===
            "damage"
        ) {

            update.total_wastage =
                calc.wastage +
                quantity;

        } else if (
            movementType ===
            "adjustment_in" ||
            movementType ===
            "return"
        ) {

            update.total_adjustment =
                calc.adjustment +
                quantity;
        }

        const {
            error:
                updateError
        } = await client
            .from("inventory")
            .update(update)
            .eq(
                "id",
                inventory.id
            )
            .eq(
                "hotel_id",
                currentHotel.id
            );

        if (updateError) {
            throw updateError;
        }

        closeAllModals();

        showMessage(
            "Stock movement recorded successfully.",
            "success"
        );

        await refreshAll();
    }


    /* =====================================================
       OPENING STOCK MODAL
       ===================================================== */

    function openOpeningStockModal() {

        const modal =
            getModalByNames([
                "openingStockModal"
            ]);

        if (!modal) {
            return;
        }

        setInput(
            [
                "openingStockQuantity"
            ],
            0
        );

        setInput(
            [
                "openingStockNotes"
            ],
            ""
        );

        openModal(modal);
    }


    /* =====================================================
       SAVE OPENING STOCK
       ===================================================== */

    async function saveOpeningStock() {

        const inventoryId =
            Number(
                getInput([
                    "openingStockInventoryId",
                    "inventoryId"
                ])
            );

        const quantity =
            num(
                getInput([
                    "openingStockQuantity"
                ])
            );

        const notes =
            getInput([
                "openingStockNotes"
            ]).trim();

        if (!inventoryId) {
            throw new Error(
                "Select an inventory item."
            );
        }

        if (
            quantity < 0
        ) {
            throw new Error(
                "Opening stock cannot be negative."
            );
        }

        const inventory =
            inventoryRecords.find(
                row =>
                    Number(row.id) ===
                    inventoryId
            );

        if (!inventory) {
            throw new Error(
                "Inventory item not found."
            );
        }

        const {
            error
        } = await client
            .from("inventory")
            .update({

                opening_stock:
                    quantity,

                quantity:
                    quantity,

                notes:
                    notes ||
                    inventory.notes ||
                    null

            })
            .eq(
                "id",
                inventoryId
            )
            .eq(
                "hotel_id",
                currentHotel.id
            );

        if (error) {
            throw error;
        }

        closeAllModals();

        showMessage(
            "Opening stock updated successfully.",
            "success"
        );

        await refreshAll();
    }


    /* =====================================================
       CLOSE MODALS
       ===================================================== */

    function closeAllModals() {

        qsa(
            ".modal"
        ).forEach(modal => {
            closeModal(modal);
        });

        [
            "inventoryModal",
            "itemModal",
            "purchaseModal",
            "stockPurchaseModal",
            "movementModal",
            "stockMovementModal",
            "openingStockModal"
        ].forEach(id => {

            const modal =
                byId(id);

            if (modal) {
                closeModal(modal);
            }
        });
    }


    /* =====================================================
       REFRESH EVERYTHING
       ===================================================== */

    async function refreshAll() {

        await loadInventory();

        await Promise.all([
            loadPurchases(),
            loadMovements()
        ]);
    }


    /* =====================================================
       EXPORT INVENTORY
       ===================================================== */

    function exportInventory() {

        const rows =
            inventoryRecords.map(row => {

                const calc =
                    calculateInventory(row);

                return {

                    Item:
                        row.item_name,

                    Category:
                        row.category || "",

                    Unit:
                        row.unit,

                    "Opening Stock":
                        calc.opening,

                    Purchases:
                        calc.purchased,

                    "Total Available":
                        calc.totalAvailable,

                    "Sales / Usage":
                        calc.sales +
                        calc.used,

                    Balance:
                        calc.balance,

                    "Purchase Price":
                        calc.purchasePrice,

                    "Selling Price":
                        calc.sellingPrice,

                    "Profit / Unit":
                        calc.profit,

                    "Stock Value":
                        calc.stockValue,

                    Status:
                        calc.status

                };
            });

        if (!rows.length) {

            alert(
                "There is no inventory data to export."
            );

            return;
        }

        const headers =
            Object.keys(rows[0]);

        const csv = [
            headers.join(","),
            ...rows.map(row =>
                headers.map(header =>
                    csvEscape(
                        row[header]
                    )
                ).join(",")
            )
        ].join("\n");

        const blob =
            new Blob(
                [csv],
                {
                    type:
                        "text/csv;charset=utf-8;"
                }
            );

        const url =
            URL.createObjectURL(
                blob
            );

        const a =
            document.createElement(
                "a"
            );

        a.href = url;

        a.download =
            `inventory-${currentHotel.id}-${today()}.csv`;

        document.body.appendChild(a);

        a.click();

        a.remove();

        URL.revokeObjectURL(url);
    }

    function csvEscape(value) {

        const text =
            String(
                value ?? ""
            );

        if (
            text.includes(",") ||
            text.includes('"') ||
            text.includes("\n")
        ) {

            return (
                '"' +
                text.replace(
                    /"/g,
                    '""'
                ) +
                '"'
            );
        }

        return text;
    }


    /* =====================================================
       PRINT
       ===================================================== */

    function printInventory() {

        window.print();
    }


    /* =====================================================
       EVENT BINDING
       ===================================================== */

    function bindEvents() {

        /*
         * Search
         */
        [
            "inventorySearch",
            "searchInventory"
        ].forEach(id => {

            const el =
                byId(id);

            if (el) {

                el.addEventListener(
                    "input",
                    renderInventory
                );
            }
        });

        /*
         * Filters
         */
        [
            "categoryFilter",
            "stockStatusFilter"
        ].forEach(id => {

            const el =
                byId(id);

            if (el) {

                el.addEventListener(
                    "change",
                    renderInventory
                );
            }
        });

        /*
         * Purchase total calculation.
         */
        [
            "purchaseQuantity",
            "purchasePrice"
        ].forEach(id => {

            const el =
                byId(id);

            if (el) {

                el.addEventListener(
                    "input",
                    calculatePurchaseTotal
                );
            }
        });

        /*
         * Event delegation.
         *
         * This keeps buttons working even after
         * table rows are re-rendered.
         */
        document.addEventListener(
            "click",
            async function (event) {

                const button =
                    event.target.closest(
                        "[data-action]"
                    );

                if (!button) {
                    return;
                }

                const action =
                    button.dataset.action;

                const id =
                    button.dataset.id;

                try {

                    if (
                        action ===
                        "edit-inventory"
                    ) {

                        openInventoryModal(
                            id
                        );

                    } else if (
                        action ===
                        "delete-inventory"
                    ) {

                        await deleteInventory(
                            id
                        );

                    } else if (
                        action ===
                        "add-inventory"
                    ) {

                        openInventoryModal();

                    } else if (
                        action ===
                        "stock-purchase"
                    ) {

                        openPurchaseModal();

                    } else if (
                        action ===
                        "stock-movement"
                    ) {

                        openMovementModal();

                    } else if (
                        action ===
                        "opening-stock"
                    ) {

                        openOpeningStockModal();

                    } else if (
                        action ===
                        "refresh-inventory"
                    ) {

                        await refreshAll();

                    } else if (
                        action ===
                        "export-inventory"
                    ) {

                        exportInventory();

                    } else if (
                        action ===
                        "print-inventory"
                    ) {

                        printInventory();

                    } else if (
                        action ===
                        "close-modal"
                    ) {

                        closeAllModals();
                    }

                } catch (error) {

                    console.error(
                        error
                    );

                    alert(
                        error.message ||
                        "An unexpected error occurred."
                    );
                }
            }
        );

        /*
         * Close buttons.
         */
        qsa(
            "[data-close-modal]"
        ).forEach(button => {

            button.addEventListener(
                "click",
                closeAllModals
            );
        });

        /*
         * Escape key.
         */
        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Escape"
                ) {
                    closeAllModals();
                }
            }
        );

        /*
         * Direct button compatibility.
         */
        bindDirectButton(
            [
                "addInventoryBtn",
                "addInventoryButton"
            ],
            () =>
                openInventoryModal()
        );

        bindDirectButton(
            [
                "stockPurchaseBtn",
                "addPurchaseBtn",
                "stockPurchaseButton"
            ],
            () =>
                openPurchaseModal()
        );

        bindDirectButton(
            [
                "stockMovementBtn",
                "addMovementBtn",
                "stockMovementButton"
            ],
            () =>
                openMovementModal()
        );

        bindDirectButton(
            [
                "openingStockBtn",
                "openingStockButton"
            ],
            () =>
                openOpeningStockModal()
        );

        bindDirectButton(
            [
                "refreshBtn",
                "refreshInventoryBtn"
            ],
            async () =>
                refreshAll()
        );

        bindDirectButton(
            [
                "exportBtn",
                "exportInventoryBtn"
            ],
            () =>
                exportInventory()
        );

        bindDirectButton(
            [
                "printBtn",
                "printInventoryBtn"
            ],
            () =>
                printInventory()
        );

        /*
         * Save buttons.
         */
        bindDirectButton(
            [
                "saveInventoryBtn",
                "saveItemBtn"
            ],
            async () =>
                saveInventory()
        );

        bindDirectButton(
            [
                "savePurchaseBtn",
                "saveStockPurchaseBtn"
            ],
            async () =>
                savePurchase()
        );

        bindDirectButton(
            [
                "saveMovementBtn",
                "saveStockMovementBtn"
            ],
            async () =>
                saveMovement()
        );

        bindDirectButton(
            [
                "saveOpeningStockBtn"
            ],
            async () =>
                saveOpeningStock()
        );

        /*
         * Form submit compatibility.
         */
        bindFormSubmit(
            [
                "inventoryForm",
                "itemForm"
            ],
            async event => {

                event.preventDefault();

                try {
                    await saveInventory();
                } catch (error) {

                    console.error(error);

                    alert(
                        error.message ||
                        "Could not save inventory."
                    );
                }
            }
        );

        bindFormSubmit(
            [
                "purchaseForm",
                "stockPurchaseForm"
            ],
            async event => {

                event.preventDefault();

                try {
                    await savePurchase();
                } catch (error) {

                    console.error(error);

                    alert(
                        error.message ||
                        "Could not save purchase."
                    );
                }
            }
        );

        bindFormSubmit(
            [
                "movementForm",
                "stockMovementForm"
            ],
            async event => {

                event.preventDefault();

                try {
                    await saveMovement();
                } catch (error) {

                    console.error(error);

                    alert(
                        error.message ||
                        "Could not save movement."
                    );
                }
            }
        );

        bindFormSubmit(
            [
                "openingStockForm"
            ],
            async event => {

                event.preventDefault();

                try {
                    await saveOpeningStock();
                } catch (error) {

                    console.error(error);

                    alert(
                        error.message ||
                        "Could not save opening stock."
                    );
                }
            }
        );
    }


    function bindDirectButton(
        ids,
        handler
    ) {

        ids.forEach(id => {

            const button =
                byId(id);

            if (!button) {
                return;
            }

            button.addEventListener(
                "click",
                async event => {

                    event.preventDefault();

                    try {

                        await handler();

                    } catch (error) {

                        console.error(
                            error
                        );

                        alert(
                            error.message ||
                            "Action failed."
                        );
                    }
                }
            );
        });
    }


    function bindFormSubmit(
        ids,
        handler
    ) {

        ids.forEach(id => {

            const form =
                byId(id);

            if (!form) {
                return;
            }

            form.addEventListener(
                "submit",
                handler
            );
        });
    }


    /* =====================================================
       INITIALIZATION
       ===================================================== */

    async function init() {

        try {

            /*
             * Bind UI first.
             * This ensures buttons remain responsive
             * even if database loading takes time.
             */
            bindEvents();

            await loadCurrentUser();

            await loadCurrentHotel();

            await refreshAll();

            /*
             * Recalculate purchase total if the
             * purchase form already contains values.
             */
            calculatePurchaseTotal();

            console.log(
                "EDU TECH Inventory Module initialized.",
                {
                    hotel:
                        currentHotel?.name,
                    hotelId:
                        currentHotel?.id,
                    inventoryCount:
                        inventoryRecords.length,
                    purchaseCount:
                        purchaseRecords.length,
                    movementCount:
                        movementRecords.length
                }
            );

        } catch (error) {

            console.error(
                "Inventory initialization error:",
                error
            );

            const message =
                byId(
                    "inventoryMessage"
                );

            if (message) {

                message.textContent =
                    error.message ||
                    "Inventory module could not initialize.";

                message.className =
                    "inventory-message error";
            } else {

                console.error(
                    error.message
                );
            }
        }
    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    window.EDUTECHInventory = {

        init,

        refresh:
            refreshAll,

        loadInventory,

        loadPurchases,

        loadMovements,

        openInventory:
            openInventoryModal,

        openPurchase:
            openPurchaseModal,

        openMovement:
            openMovementModal,

        openOpeningStock:
            openOpeningStockModal,

        saveInventory,

        savePurchase,

        saveMovement,

        saveOpeningStock,

        exportInventory,

        printInventory
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
            init
        );

    } else {

        init();
    }

})();