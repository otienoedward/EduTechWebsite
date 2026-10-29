// ============================================================
// EDU TECH HOTEL MANAGEMENT SYSTEM
// Main JavaScript File
// ============================================================


// ============================================================
// ROOMS
// ============================================================

const ROOM_STORAGE_KEY = "eduTechRooms";

function openRoomForm() {
    const modal = document.getElementById("roomModal");

    if (modal) {
        modal.style.display = "flex";
    }
}

function closeRoomForm() {
    const modal = document.getElementById("roomModal");

    if (modal) {
        modal.style.display = "none";
    }
}

function getRoomStatusClass(status) {

    switch (status) {

        case "Available":
            return "available-status";

        case "Occupied":
            return "occupied-status";

        case "Cleaning":
            return "cleaning-status";

        case "Maintenance":
            return "maintenance-status";

        default:
            return "";
    }
}


// ============================================================
// ROOM STORAGE
// ============================================================

function getStoredRooms() {

    const savedRooms =
        localStorage.getItem(ROOM_STORAGE_KEY);

    if (savedRooms) {

        try {

            return JSON.parse(savedRooms);

        } catch (error) {

            console.error(
                "Could not read saved rooms.",
                error
            );
        }
    }

    return [

        {
            number: "101",
            type: "Single",
            price: 2500,
            status: "Available"
        },

        {
            number: "102",
            type: "Double",
            price: 4000,
            status: "Occupied"
        },

        {
            number: "103",
            type: "Deluxe",
            price: 6500,
            status: "Cleaning"
        },

        {
            number: "104",
            type: "Suite",
            price: 10000,
            status: "Maintenance"
        }

    ];
}

function saveRooms(rooms) {

    localStorage.setItem(
        ROOM_STORAGE_KEY,
        JSON.stringify(rooms)
    );
}


// ============================================================
// DISPLAY ROOMS
// ============================================================

function displayRooms() {

    const table =
        document.getElementById("roomsTable");

    if (!table) return;

    const tbody =
        table.querySelector("tbody");

    if (!tbody) return;

    const rooms =
        getStoredRooms();

    tbody.innerHTML = "";


    rooms.forEach(function(room) {

        const row =
            document.createElement("tr");

        row.innerHTML = `

            <td>${room.number}</td>

            <td>${room.type}</td>

            <td>KSh ${Number(room.price).toLocaleString()}</td>

            <td>
                <span class="room-status ${getRoomStatusClass(room.status)}">
                    ${room.status}
                </span>
            </td>

            <td>

                <button class="edit-btn">
                    Edit
                </button>

                <button class="delete-btn">
                    Delete
                </button>

            </td>

        `;

        tbody.appendChild(row);

    });


    attachRoomButtons();

    updateRoomCounts();

    applyRoomFilters();

    saveCurrentModuleTablesForReports();
}


// ============================================================
// ROOM COUNTS
// ============================================================

function updateRoomCounts() {

    const table =
        document.getElementById("roomsTable");

    if (!table) return;

    const rows =
        table.querySelectorAll("tbody tr");

    let available = 0;
    let occupied = 0;
    let maintenance = 0;


    rows.forEach(function(row) {

        const status =
            row.querySelector(".room-status");

        if (!status) return;

        const value =
            status.textContent.trim();


        if (value === "Available") {
            available++;
        }

        if (value === "Occupied") {
            occupied++;
        }

        if (value === "Maintenance") {
            maintenance++;
        }

    });


    const total =
        rows.length;


    const availableCard =
        document.querySelector(
            ".cards .card:nth-child(2) p"
        );

    const occupiedCard =
        document.querySelector(
            ".cards .card:nth-child(3) p"
        );

    const maintenanceCard =
        document.querySelector(
            ".cards .card:nth-child(4) p"
        );

    const totalCard =
        document.querySelector(
            ".cards .card:nth-child(1) p"
        );


    if (totalCard) {
        totalCard.textContent = total;
    }

    if (availableCard) {
        availableCard.textContent = available;
    }

    if (occupiedCard) {
        occupiedCard.textContent = occupied;
    }

    if (maintenanceCard) {
        maintenanceCard.textContent = maintenance;
    }
}


// ============================================================
// ROOM FILTERS
// ============================================================

function applyRoomFilters() {

    const searchInput =
        document.getElementById("searchRoom");

    const statusFilter =
        document.getElementById("statusFilter");

    const table =
        document.getElementById("roomsTable");


    if (!table) return;


    const searchText =
        searchInput
            ? searchInput.value.toLowerCase()
            : "";


    const selectedStatus =
        statusFilter
            ? statusFilter.value
            : "all";


    const rows =
        table.querySelectorAll("tbody tr");


    rows.forEach(function(row) {

        const roomNumber =
            row.cells[0]
                ? row.cells[0]
                    .textContent
                    .toLowerCase()
                : "";


        const statusElement =
            row.querySelector(".room-status");


        const status =
            statusElement
                ? statusElement
                    .textContent
                    .trim()
                : "";


        const matchesSearch =
            roomNumber.includes(searchText);


        const matchesStatus =
            selectedStatus === "all" ||
            status === selectedStatus;


        row.style.display =
            matchesSearch && matchesStatus
                ? ""
                : "none";

    });
}

function searchRooms() {
    applyRoomFilters();
}

function filterRooms() {
    applyRoomFilters();
}


// ============================================================
// EDIT ROOM
// ============================================================

function editRoom(button) {

    const row =
        button.closest("tr");

    if (!row) return;


    const roomNumber =
        row.cells[0]
            .textContent
            .trim();


    const roomType =
        row.cells[1]
            .textContent
            .trim();


    const price =
        row.cells[2]
            .textContent
            .replace("KSh", "")
            .replace(/,/g, "")
            .trim();


    const status =
        row.cells[3]
            .textContent
            .trim();


    const numberInput =
        document.getElementById("roomNumber");

    const typeInput =
        document.getElementById("roomType");

    const priceInput =
        document.getElementById("roomPrice");

    const statusInput =
        document.getElementById("roomStatus");


    if (numberInput) {
        numberInput.value = roomNumber;
    }

    if (typeInput) {
        typeInput.value = roomType;
    }

    if (priceInput) {
        priceInput.value = price;
    }

    if (statusInput) {
        statusInput.value = status;
    }


    openRoomForm();


    const form =
        document.getElementById("roomForm");


    if (form) {

        form.dataset.editingRoom =
            roomNumber;
    }
}


// ============================================================
// DELETE ROOM
// ============================================================

function deleteRoom(button) {

    if (
        !confirm(
            "Are you sure you want to delete this room?"
        )
    ) {
        return;
    }


    const row =
        button.closest("tr");

    if (!row) return;


    const roomNumber =
        row.cells[0]
            .textContent
            .trim();


    let rooms =
        getStoredRooms();


    rooms =
        rooms.filter(function(room) {

            return room.number !== roomNumber;

        });


    saveRooms(rooms);

    displayRooms();
}


// ============================================================
// GUESTS
// ============================================================

function openGuestForm() {

    const modal =
        document.getElementById("guestModal");

    if (modal) {
        modal.style.display = "flex";
    }
}

function closeGuestForm() {

    const modal =
        document.getElementById("guestModal");

    if (modal) {
        modal.style.display = "none";
    }
}


function updateGuestCount() {

    const table =
        document.getElementById("guestTable");

    if (!table) return;


    const count =
        table.querySelectorAll(
            "tbody tr"
        ).length;


    const cards =
        document.querySelectorAll(
            ".cards .card"
        );


    if (cards.length > 0) {

        const firstCardNumber =
            cards[0].querySelector("p");


        if (firstCardNumber) {

            firstCardNumber.textContent =
                count;

        }
    }
}


function viewGuest(button) {

    const row =
        button.closest("tr");

    if (!row) return;


    alert(
        "Guest Details\n\n" +
        "Name: " +
        row.cells[0]
            .textContent
            .trim() +
        "\n" +
        "Phone: " +
        row.cells[1]
            .textContent
            .trim()
    );
}


function deleteGuest(button) {

    if (
        !confirm(
            "Are you sure you want to delete this guest?"
        )
    ) {
        return;
    }


    const row =
        button.closest("tr");


    if (row) {

        row.remove();

        updateGuestCount();

        saveCurrentModuleTablesForReports();

    }
}


function searchGuests() {

    const input =
        document.getElementById("searchGuest");

    const table =
        document.getElementById("guestTable");


    if (!input || !table) return;


    const searchText =
        input.value.toLowerCase();


    table
        .querySelectorAll("tbody tr")
        .forEach(function(row) {

            row.style.display =
                row.textContent
                    .toLowerCase()
                    .includes(searchText)
                    ? ""
                    : "";

            if (
                !row.textContent
                    .toLowerCase()
                    .includes(searchText)
            ) {
                row.style.display = "none";
            }

        });
}


// ============================================================
// RESERVATIONS
// ============================================================

function openReservationForm() {

    const modal =
        document.getElementById(
            "reservationModal"
        );

    if (modal) {
        modal.style.display = "flex";
    }
}


function closeReservationForm() {

    const modal =
        document.getElementById(
            "reservationModal"
        );

    if (modal) {
        modal.style.display = "none";
    }
}


function updateReservationCounts() {

    const table =
        document.getElementById(
            "reservationTable"
        );

    if (!table) return;


    const rows =
        table.querySelectorAll("tbody tr");


    let total =
        rows.length;

    let confirmed = 0;
    let pending = 0;
    let cancelled = 0;


    rows.forEach(function(row) {

        const text =
            row.textContent
                .toLowerCase();


        if (text.includes("confirmed")) {
            confirmed++;
        }

        if (text.includes("pending")) {
            pending++;
        }

        if (text.includes("cancelled")) {
            cancelled++;
        }

    });


    const cards =
        document.querySelectorAll(
            ".cards .card"
        );


    if (
        cards[0] &&
        cards[0].querySelector("p")
    ) {

        cards[0]
            .querySelector("p")
            .textContent = total;

    }


    if (
        cards[1] &&
        cards[1].querySelector("p")
    ) {

        cards[1]
            .querySelector("p")
            .textContent = confirmed;

    }


    if (
        cards[2] &&
        cards[2].querySelector("p")
    ) {

        cards[2]
            .querySelector("p")
            .textContent = pending;

    }


    if (
        cards[3] &&
        cards[3].querySelector("p")
    ) {

        cards[3]
            .querySelector("p")
            .textContent = cancelled;

    }
}


function viewReservation(button) {

    const row =
        button.closest("tr");

    if (row) {

        alert(
            "Reservation Details\n\n" +
            row.textContent.trim()
        );

    }
}


function deleteReservation(button) {

    if (
        !confirm(
            "Are you sure you want to delete this reservation?"
        )
    ) {
        return;
    }


    const row =
        button.closest("tr");


    if (row) {

        row.remove();

        updateReservationCounts();

        saveCurrentModuleTablesForReports();

    }
}


function searchReservations() {

    const input =
        document.getElementById(
            "searchReservation"
        );

    const table =
        document.getElementById(
            "reservationTable"
        );


    if (!input || !table) return;


    const searchText =
        input.value.toLowerCase();


    table
        .querySelectorAll("tbody tr")
        .forEach(function(row) {

            const matches =
                row.textContent
                    .toLowerCase()
                    .includes(searchText);

            row.style.display =
                matches ? "" : "none";

        });
}


function filterReservations() {

    const filter =
        document.getElementById(
            "reservationFilter"
        );

    const table =
        document.getElementById(
            "reservationTable"
        );


    if (!filter || !table) return;


    const selected =
        filter.value.toLowerCase();


    table
        .querySelectorAll("tbody tr")
        .forEach(function(row) {

            if (selected === "all") {

                row.style.display = "";

                return;
            }


            row.style.display =
                row.textContent
                    .toLowerCase()
                    .includes(selected)
                    ? ""
                    : "none";

        });
}


// ============================================================
// CHECK-IN
// ============================================================

function openCheckinForm() {

    const modal =
        document.getElementById(
            "checkinModal"
        );

    if (modal) {
        modal.style.display = "flex";
    }
}


function closeCheckinForm() {

    const modal =
        document.getElementById(
            "checkinModal"
        );

    if (modal) {
        modal.style.display = "none";
    }
}


function updateCheckinCounts() {

    const table =
        document.getElementById(
            "checkinTable"
        );

    if (!table) return;


    const rows =
        table.querySelectorAll("tbody tr");


    const today =
        new Date()
            .toISOString()
            .split("T")[0];


    let todayCount = 0;
    let checkedIn = 0;
    let expected = 0;
    let pending = 0;


    rows.forEach(function(row) {

        const text =
            row.textContent
                .toLowerCase();


        if (text.includes("checked in")) {
            checkedIn++;
        }

        if (text.includes("expected")) {
            expected++;
        }

        if (text.includes("pending")) {
            pending++;
        }

        if (
            row.textContent.includes(today)
        ) {
            todayCount++;
        }

    });


    const todayElement =
        document.getElementById(
            "todayCheckins"
        );

    const checkedElement =
        document.getElementById(
            "checkedInCount"
        );

    const expectedElement =
        document.getElementById(
            "expectedArrivals"
        );

    const pendingElement =
        document.getElementById(
            "pendingCheckins"
        );


    if (todayElement) {
        todayElement.textContent =
            todayCount;
    }

    if (checkedElement) {
        checkedElement.textContent =
            checkedIn;
    }

    if (expectedElement) {
        expectedElement.textContent =
            expected;
    }

    if (pendingElement) {
        pendingElement.textContent =
            pending;
    }
}


function viewCheckin(button) {

    const row =
        button.closest("tr");

    if (row) {

        alert(
            "Check-in Details\n\n" +
            row.textContent.trim()
        );

    }
}


function deleteCheckin(button) {

    if (
        !confirm(
            "Are you sure you want to delete this check-in?"
        )
    ) {
        return;
    }


    const row =
        button.closest("tr");


    if (row) {

        row.remove();

        updateCheckinCounts();

        saveCurrentModuleTablesForReports();

    }
}


function searchCheckins() {

    const input =
        document.getElementById(
            "searchCheckin"
        );

    const table =
        document.getElementById(
            "checkinTable"
        );


    if (!input || !table) return;


    const searchText =
        input.value.toLowerCase();


    table
        .querySelectorAll("tbody tr")
        .forEach(function(row) {

            row.style.display =
                row.textContent
                    .toLowerCase()
                    .includes(searchText)
                    ? ""
                    : "none";

        });
}


function filterCheckins() {

    const filter =
        document.getElementById(
            "checkinFilter"
        );

    const table =
        document.getElementById(
            "checkinTable"
        );


    if (!filter || !table) return;


    const selected =
        filter.value.toLowerCase();


    table
        .querySelectorAll("tbody tr")
        .forEach(function(row) {

            if (selected === "all") {

                row.style.display = "";

                return;
            }


            row.style.display =
                row.textContent
                    .toLowerCase()
                    .includes(selected)
                    ? ""
                    : "none";

        });
}


// ============================================================
// CHECK-OUT
// ============================================================

function openCheckoutForm() {

    const modal =
        document.getElementById(
            "checkoutModal"
        );

    if (modal) {
        modal.style.display = "flex";
    }
}


function closeCheckoutForm() {

    const modal =
        document.getElementById(
            "checkoutModal"
        );

    if (modal) {
        modal.style.display = "none";
    }
}


function updateCheckoutCounts() {

    const table =
        document.getElementById(
            "checkoutTable"
        );

    if (!table) return;


    const rows =
        table.querySelectorAll("tbody tr");


    let completed = 0;
    let pending = 0;
    let revenue = 0;


    rows.forEach(function(row) {

        const text =
            row.textContent
                .toLowerCase();


        if (text.includes("completed")) {
            completed++;
        }

        if (text.includes("pending")) {
            pending++;
        }


        const amountCell =
            row.cells[4] ||
            row.cells[3];


        if (amountCell) {

            const amount =
                parseFloat(
                    amountCell.textContent
                        .replace(
                            /[^0-9.]/g,
                            ""
                        )
                );


            if (!isNaN(amount)) {
                revenue += amount;
            }

        }

    });


    const todayElement =
        document.getElementById(
            "todayCheckouts"
        );

    const completedElement =
        document.getElementById(
            "completedCheckouts"
        );

    const pendingElement =
        document.getElementById(
            "pendingCheckouts"
        );

    const revenueElement =
        document.getElementById(
            "checkoutRevenue"
        );


    if (todayElement) {
        todayElement.textContent =
            rows.length;
    }

    if (completedElement) {
        completedElement.textContent =
            completed;
    }

    if (pendingElement) {
        pendingElement.textContent =
            pending;
    }

    if (revenueElement) {

        revenueElement.textContent =
            "KSh " +
            revenue.toLocaleString();

    }
}


function viewCheckout(button) {

    const row =
        button.closest("tr");

    if (row) {

        alert(
            "Check-out Details\n\n" +
            row.textContent.trim()
        );

    }
}


function deleteCheckout(button) {

    if (
        !confirm(
            "Are you sure you want to delete this check-out?"
        )
    ) {
        return;
    }


    const row =
        button.closest("tr");


    if (row) {

        row.remove();

        updateCheckoutCounts();

        saveCurrentModuleTablesForReports();

    }
}


function searchCheckouts() {

    const input =
        document.getElementById(
            "searchCheckout"
        );

    const table =
        document.getElementById(
            "checkoutTable"
        );


    if (!input || !table) return;


    const searchText =
        input.value.toLowerCase();


    table
        .querySelectorAll("tbody tr")
        .forEach(function(row) {

            row.style.display =
                row.textContent
                    .toLowerCase()
                    .includes(searchText)
                    ? ""
                    : "none";

        });
}


function filterCheckouts() {

    const filter =
        document.getElementById(
            "checkoutFilter"
        );

    const table =
        document.getElementById(
            "checkoutTable"
        );


    if (!filter || !table) return;


    const selected =
        filter.value.toLowerCase();


    table
        .querySelectorAll("tbody tr")
        .forEach(function(row) {

            if (selected === "all") {

                row.style.display = "";

                return;
            }


            row.style.display =
                row.textContent
                    .toLowerCase()
                    .includes(selected)
                    ? ""
                    : "none";

        });
}


// ============================================================
// RESTAURANT
// ============================================================

function openRestaurantForm() {

    const modal =
        document.getElementById(
            "restaurantModal"
        );

    if (modal) {
        modal.style.display = "flex";
    }
}


function closeRestaurantForm() {

    const modal =
        document.getElementById(
            "restaurantModal"
        );

    if (modal) {
        modal.style.display = "none";
    }
}


function updateRestaurantCounts() {

    const table =
        document.getElementById(
            "restaurantTable"
        );

    if (!table) return;


    const rows =
        table.querySelectorAll("tbody tr");


    let total =
        rows.length;

    let pending = 0;
    let completed = 0;
    let revenue = 0;


    rows.forEach(function(row) {

        const text =
            row.textContent
                .toLowerCase();


        if (text.includes("pending")) {
            pending++;
        }

        if (text.includes("completed")) {
            completed++;
        }


        const cells =
            row.querySelectorAll("td");


        cells.forEach(function(cell) {

            const amount =
                parseFloat(
                    cell.textContent
                        .replace(
                            /[^0-9.]/g,
                            ""
                        )
                );


            if (
                !isNaN(amount) &&
                cell.textContent.includes("KSh")
            ) {

                revenue += amount;

            }

        });

    });


    const cards =
        document.querySelectorAll(
            ".cards .card"
        );


    if (
        cards[0] &&
        cards[0].querySelector("p")
    ) {

        cards[0]
            .querySelector("p")
            .textContent =
            total;

    }


    if (
        cards[1] &&
        cards[1].querySelector("p")
    ) {

        cards[1]
            .querySelector("p")
            .textContent =
            completed;

    }


    if (
        cards[2] &&
        cards[2].querySelector("p")
    ) {

        cards[2]
            .querySelector("p")
            .textContent =
            pending;

    }


    if (
        cards[3] &&
        cards[3].querySelector("p")
    ) {

        cards[3]
            .querySelector("p")
            .textContent =
            "KSh " +
            revenue.toLocaleString();

    }
}


function viewRestaurantOrder(button) {

    const row =
        button.closest("tr");

    if (row) {

        alert(
            "Restaurant Order Details\n\n" +
            row.textContent.trim()
        );

    }
}


function deleteRestaurantOrder(button) {

    if (
        !confirm(
            "Are you sure you want to delete this restaurant order?"
        )
    ) {
        return;
    }


    const row =
        button.closest("tr");


    if (row) {

        row.remove();

        updateRestaurantCounts();

        saveCurrentModuleTablesForReports();

    }
}


function searchRestaurantOrders() {

    const input =
        document.getElementById(
            "searchRestaurant"
        );

    const table =
        document.getElementById(
            "restaurantTable"
        );


    if (!input || !table) return;


    const searchText =
        input.value.toLowerCase();


    table
        .querySelectorAll("tbody tr")
        .forEach(function(row) {

            row.style.display =
                row.textContent
                    .toLowerCase()
                    .includes(searchText)
                    ? ""
                    : "none";

        });
}


function filterRestaurantOrders() {

    const filter =
        document.getElementById(
            "restaurantFilter"
        );

    const table =
        document.getElementById(
            "restaurantTable"
        );


    if (!filter || !table) return;


    const selected =
        filter.value.toLowerCase();


    table
        .querySelectorAll("tbody tr")
        .forEach(function(row) {

            if (selected === "all") {

                row.style.display = "";

                return;
            }


            row.style.display =
                row.textContent
                    .toLowerCase()
                    .includes(selected)
                    ? ""
                    : "none";

        });
}


// ============================================================
// INVENTORY
// ============================================================

function openInventoryForm() {

    const modal =
        document.getElementById(
            "inventoryModal"
        );

    if (modal) {
        modal.style.display = "flex";
    }
}


function closeInventoryForm() {

    const modal =
        document.getElementById(
            "inventoryModal"
        );

    if (modal) {
        modal.style.display = "none";
    }
}


function updateInventoryCounts() {

    const table =
        document.getElementById(
            "inventoryTable"
        );

    if (!table) return;


    const rows =
        table.querySelectorAll("tbody tr");


    let total =
        rows.length;

    let lowStock = 0;
    let outOfStock = 0;


    rows.forEach(function(row) {

        const text =
            row.textContent
                .toLowerCase();


        if (text.includes("low stock")) {
            lowStock++;
        }

        if (text.includes("out of stock")) {
            outOfStock++;
        }

    });


    const cards =
        document.querySelectorAll(
            ".cards .card"
        );


    if (
        cards[0] &&
        cards[0].querySelector("p")
    ) {

        cards[0]
            .querySelector("p")
            .textContent =
            total;

    }


    if (
        cards[1] &&
        cards[1].querySelector("p")
    ) {

        cards[1]
            .querySelector("p")
            .textContent =
            total -
            lowStock -
            outOfStock;

    }


    if (
        cards[2] &&
        cards[2].querySelector("p")
    ) {

        cards[2]
            .querySelector("p")
            .textContent =
            lowStock;

    }


    if (
        cards[3] &&
        cards[3].querySelector("p")
    ) {

        cards[3]
            .querySelector("p")
            .textContent =
            outOfStock;

    }
}


function viewInventory(button) {

    const row =
        button.closest("tr");

    if (row) {

        alert(
            "Inventory Details\n\n" +
            row.textContent.trim()
        );

    }
}


function deleteInventory(button) {

    if (
        !confirm(
            "Are you sure you want to delete this inventory item?"
        )
    ) {
        return;
    }


    const row =
        button.closest("tr");


    if (row) {

        row.remove();

        updateInventoryCounts();

        saveCurrentModuleTablesForReports();

    }
}


function searchInventory() {

    const input =
        document.getElementById(
            "searchInventory"
        );

    const table =
        document.getElementById(
            "inventoryTable"
        );


    if (!input || !table) return;


    const searchText =
        input.value.toLowerCase();


    table
        .querySelectorAll("tbody tr")
        .forEach(function(row) {

            row.style.display =
                row.textContent
                    .toLowerCase()
                    .includes(searchText)
                    ? ""
                    : "none";

        });
}


function filterInventory() {

    const filter =
        document.getElementById(
            "inventoryFilter"
        );

    const table =
        document.getElementById(
            "inventoryTable"
        );


    if (!filter || !table) return;


    const selected =
        filter.value.toLowerCase();


    table
        .querySelectorAll("tbody tr")
        .forEach(function(row) {

            if (selected === "all") {

                row.style.display = "";

                return;
            }


            row.style.display =
                row.textContent
                    .toLowerCase()
                    .includes(selected)
                    ? ""
                    : "none";

        });
}


// ============================================================
// PAYMENTS
// ============================================================

function openPaymentForm() {

    const modal =
        document.getElementById(
            "paymentModal"
        );

    if (modal) {
        modal.style.display = "flex";
    }
}


function closePaymentForm() {

    const modal =
        document.getElementById(
            "paymentModal"
        );

    if (modal) {
        modal.style.display = "none";
    }
}


function updatePaymentCounts() {

    const table =
        document.getElementById(
            "paymentTable"
        );

    if (!table) return;


    const rows =
        table.querySelectorAll("tbody tr");


    let totalPayments =
        rows.length;

    let completed = 0;
    let pending = 0;
    let revenue = 0;


    rows.forEach(function(row) {

        const text =
            row.textContent
                .toLowerCase();


        if (text.includes("completed")) {
            completed++;
        }

        if (text.includes("pending")) {
            pending++;
        }


        row.querySelectorAll("td")
            .forEach(function(cell) {

                if (
                    cell.textContent.includes(
                        "KSh"
                    )
                ) {

                    const amount =
                        parseFloat(
                            cell.textContent
                                .replace(
                                    /[^0-9.]/g,
                                    ""
                                )
                        );


                    if (!isNaN(amount)) {
                        revenue += amount;
                    }

                }

            });

    });


    const cards =
        document.querySelectorAll(
            ".cards .card"
        );


    if (
        cards[0] &&
        cards[0].querySelector("p")
    ) {

        cards[0]
            .querySelector("p")
            .textContent =
            totalPayments;

    }


    if (
        cards[1] &&
        cards[1].querySelector("p")
    ) {

        cards[1]
            .querySelector("p")
            .textContent =
            completed;

    }


    if (
        cards[2] &&
        cards[2].querySelector("p")
    ) {

        cards[2]
            .querySelector("p")
            .textContent =
            pending;

    }


    if (
        cards[3] &&
        cards[3].querySelector("p")
    ) {

        cards[3]
            .querySelector("p")
            .textContent =
            "KSh " +
            revenue.toLocaleString();

    }
}


function viewPayment(button) {

    const row =
        button.closest("tr");

    if (row) {

        alert(
            "Payment Details\n\n" +
            row.textContent.trim()
        );

    }
}


function deletePayment(button) {

    if (
        !confirm(
            "Are you sure you want to delete this payment?"
        )
    ) {
        return;
    }


    const row =
        button.closest("tr");


    if (row) {

        row.remove();

        updatePaymentCounts();

        saveCurrentModuleTablesForReports();

    }
}


function searchPayments() {

    const input =
        document.getElementById(
            "searchPayment"
        );

    const table =
        document.getElementById(
            "paymentTable"
        );


    if (!input || !table) return;


    const searchText =
        input.value.toLowerCase();


    table
        .querySelectorAll("tbody tr")
        .forEach(function(row) {

            row.style.display =
                row.textContent
                    .toLowerCase()
                    .includes(searchText)
                    ? ""
                    : "none";

        });
}


function filterPayments() {

    const filter =
        document.getElementById(
            "paymentFilter"
        );

    const table =
        document.getElementById(
            "paymentTable"
        );


    if (!filter || !table) return;


    const selected =
        filter.value.toLowerCase();


    table
        .querySelectorAll("tbody tr")
        .forEach(function(row) {

            if (selected === "all") {

                row.style.display = "";

                return;
            }


            row.style.display =
                row.textContent
                    .toLowerCase()
                    .includes(selected)
                    ? ""
                    : "none";

        });
}


// ============================================================
// EXPENSES
// ============================================================

function openExpenseForm() {

    const modal =
        document.getElementById(
            "expenseModal"
        );

    if (modal) {
        modal.style.display = "flex";
    }
}


function closeExpenseForm() {

    const modal =
        document.getElementById(
            "expenseModal"
        );

    if (modal) {
        modal.style.display = "none";
    }
}


function updateExpenseCounts() {

    const table =
        document.getElementById(
            "expenseTable"
        );

    if (!table) return;


    const rows =
        table.querySelectorAll("tbody tr");


    let totalExpenses =
        rows.length;

    let totalAmount = 0;
    let pending = 0;


    rows.forEach(function(row) {

        const text =
            row.textContent
                .toLowerCase();


        if (text.includes("pending")) {
            pending++;
        }


        row.querySelectorAll("td")
            .forEach(function(cell) {

                if (
                    cell.textContent.includes(
                        "KSh"
                    )
                ) {

                    const amount =
                        parseFloat(
                            cell.textContent
                                .replace(
                                    /[^0-9.]/g,
                                    ""
                                )
                        );


                    if (!isNaN(amount)) {
                        totalAmount += amount;
                    }

                }

            });

    });


    const cards =
        document.querySelectorAll(
            ".cards .card"
        );


    if (
        cards[0] &&
        cards[0].querySelector("p")
    ) {

        cards[0]
            .querySelector("p")
            .textContent =
            totalExpenses;

    }


    if (
        cards[1] &&
        cards[1].querySelector("p")
    ) {

        cards[1]
            .querySelector("p")
            .textContent =
            "KSh " +
            totalAmount.toLocaleString();

    }


    if (
        cards[2] &&
        cards[2].querySelector("p")
    ) {

        cards[2]
            .querySelector("p")
            .textContent =
            pending;

    }
}


function viewExpense(button) {

    const row =
        button.closest("tr");

    if (row) {

        alert(
            "Expense Details\n\n" +
            row.textContent.trim()
        );

    }
}


function deleteExpense(button) {

    if (
        !confirm(
            "Are you sure you want to delete this expense?"
        )
    ) {
        return;
    }


    const row =
        button.closest("tr");


    if (row) {

        row.remove();

        updateExpenseCounts();

        saveCurrentModuleTablesForReports();

    }
}


function searchExpenses() {

    const input =
        document.getElementById(
            "searchExpense"
        );

    const table =
        document.getElementById(
            "expenseTable"
        );


    if (!input || !table) return;


    const searchText =
        input.value.toLowerCase();


    table
        .querySelectorAll("tbody tr")
        .forEach(function(row) {

            row.style.display =
                row.textContent
                    .toLowerCase()
                    .includes(searchText)
                    ? ""
                    : "none";

        });
}


function filterExpenses() {

    const filter =
        document.getElementById(
            "expenseFilter"
        );

    const table =
        document.getElementById(
            "expenseTable"
        );


    if (!filter || !table) return;


    const selected =
        filter.value.toLowerCase();


    table
        .querySelectorAll("tbody tr")
        .forEach(function(row) {

            if (selected === "all") {

                row.style.display = "";

                return;
            }


            row.style.display =
                row.textContent
                    .toLowerCase()
                    .includes(selected)
                    ? ""
                    : "none";

        });
}


// ============================================================
// MODAL CLOSE
// ============================================================

window.addEventListener(
    "click",
    function(event) {

        const modals =
            document.querySelectorAll(
                ".modal"
            );


        modals.forEach(function(modal) {

            if (event.target === modal) {

                modal.style.display =
                    "none";

            }

        });

    }
);


// ============================================================
// REPORTING DATA BRIDGE
// ============================================================

const REPORT_STORAGE_KEYS = {

    rooms:
        "eduTechReportRooms",

    guests:
        "eduTechReportGuests",

    reservations:
        "eduTechReportReservations",

    checkins:
        "eduTechReportCheckins",

    checkouts:
        "eduTechReportCheckouts",

    restaurant:
        "eduTechReportRestaurant",

    inventory:
        "eduTechReportInventory",

    payments:
        "eduTechReportPayments",

    expenses:
        "eduTechReportExpenses",

    employees:
        "eduTechReportEmployees",

    housekeeping:
        "eduTechReportHousekeeping",

    maintenance:
        "eduTechReportMaintenance"

};


// ============================================================
// READ REPORT STORAGE
// ============================================================

function reportReadStorage(key) {

    try {

        const value =
            localStorage.getItem(key);


        if (!value) {
            return [];
        }


        const parsed =
            JSON.parse(value);


        return Array.isArray(parsed)
            ? parsed
            : [];


    } catch (error) {

        console.warn(
            "Report storage read error:",
            key,
            error
        );


        return [];
    }
}


// ============================================================
// WRITE REPORT STORAGE
// ============================================================

function reportWriteStorage(
    key,
    data
) {

    try {

        localStorage.setItem(
            key,
            JSON.stringify(
                Array.isArray(data)
                    ? data
                    : []
            )
        );


    } catch (error) {

        console.warn(
            "Report storage write error:",
            key,
            error
        );

    }
}


// ============================================================
// GET TABLE HEADERS
// ============================================================

function reportGetTableHeaders(table) {

    if (!table) {
        return [];
    }


    const headers =
        table.querySelectorAll(
            "thead th"
        );


    return Array.from(headers).map(
        function(header) {

            return header
                .textContent
                .trim()
                .toLowerCase()
                .replace(
                    /\s+/g,
                    "_"
                );

        }
    );
}


// ============================================================
// CONVERT TABLE ROW TO OBJECT
// ============================================================

function reportTableRowToObject(
    row,
    headers
) {

    const cells =
        row.querySelectorAll("td");


    const record = {};


    headers.forEach(
        function(header, index) {

            if (!cells[index]) {
                return;
            }


            record[header] =
                cells[index]
                    .textContent
                    .trim();

        }
    );


    return record;
}


// ============================================================
// SAVE TABLE TO REPORT STORAGE
// ============================================================

function reportSaveTable(
    tableId,
    storageKey
) {

    const table =
        document.getElementById(
            tableId
        );


    if (!table) {
        return;
    }


    const tbody =
        table.querySelector("tbody");


    if (!tbody) {
        return;
    }


    const headers =
        reportGetTableHeaders(table);


    const rows =
        tbody.querySelectorAll("tr");


    const records = [];


    rows.forEach(function(row) {

        const text =
            row.textContent
                .trim()
                .toLowerCase();


        if (!text) {
            return;
        }


        if (
            text.includes("no record") ||
            text.includes("no records") ||
            text.includes("no data")
        ) {
            return;
        }


        const record =
            reportTableRowToObject(
                row,
                headers
            );


        if (
            Object.keys(record).length > 0
        ) {

            records.push(record);

        }

    });


    /*
     * Only replace existing report data
     * when real rows are present.
     */

    if (records.length > 0) {

        reportWriteStorage(
            storageKey,
            records
        );

    }
}


// ============================================================
// SAVE ALL CURRENT TABLES
// ============================================================

function saveCurrentModuleTablesForReports() {

    reportSaveTable(
        "roomsTable",
        REPORT_STORAGE_KEYS.rooms
    );


    reportSaveTable(
        "guestTable",
        REPORT_STORAGE_KEYS.guests
    );


    reportSaveTable(
        "reservationTable",
        REPORT_STORAGE_KEYS.reservations
    );


    reportSaveTable(
        "checkinTable",
        REPORT_STORAGE_KEYS.checkins
    );


    reportSaveTable(
        "checkoutTable",
        REPORT_STORAGE_KEYS.checkouts
    );


    reportSaveTable(
        "restaurantTable",
        REPORT_STORAGE_KEYS.restaurant
    );


    reportSaveTable(
        "inventoryTable",
        REPORT_STORAGE_KEYS.inventory
    );


    reportSaveTable(
        "paymentTable",
        REPORT_STORAGE_KEYS.payments
    );


    reportSaveTable(
        "expenseTable",
        REPORT_STORAGE_KEYS.expenses
    );


    reportSaveTable(
        "employeeTable",
        REPORT_STORAGE_KEYS.employees
    );


    reportSaveTable(
        "housekeepingTable",
        REPORT_STORAGE_KEYS.housekeeping
    );


    reportSaveTable(
        "maintenanceTable",
        REPORT_STORAGE_KEYS.maintenance
    );
}


// ============================================================
// REPORT TABLE WATCHER
// ============================================================

function startReportTableWatcher() {

    const tableIds = [

        "roomsTable",

        "guestTable",

        "reservationTable",

        "checkinTable",

        "checkoutTable",

        "restaurantTable",

        "inventoryTable",

        "paymentTable",

        "expenseTable",

        "employeeTable",

        "housekeepingTable",

        "maintenanceTable"

    ];


    tableIds.forEach(
        function(tableId) {

            const table =
                document.getElementById(
                    tableId
                );


            if (!table) {
                return;
            }


            const observer =
                new MutationObserver(
                    function() {

                        saveCurrentModuleTablesForReports();

                    }
                );


            observer.observe(
                table,
                {
                    childList: true,
                    subtree: true
                }
            );

        }
    );
}


// ============================================================
// GLOBAL REPORT OBJECT
// ============================================================

window.eduTechReports = {

    keys:
        REPORT_STORAGE_KEYS,

    read:
        reportReadStorage,

    write:
        reportWriteStorage,

    saveTables:
        saveCurrentModuleTablesForReports

};


// ============================================================
// PAGE INITIALIZATION
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    function() {


        // ----------------------------------------------------
        // ROOMS
        // ----------------------------------------------------

        const roomForm =
            document.getElementById(
                "roomForm"
            );


        if (roomForm) {

            if (
                !localStorage.getItem(
                    ROOM_STORAGE_KEY
                )
            ) {

                const defaultRooms =
                    getStoredRooms();

                saveRooms(
                    defaultRooms
                );

            }


            displayRooms();


            roomForm.addEventListener(
                "submit",
                function(event) {

                    event.preventDefault();


                    const roomNumber =
                        document
                            .getElementById(
                                "roomNumber"
                            )
                            .value
                            .trim();


                    const roomType =
                        document
                            .getElementById(
                                "roomType"
                            )
                            .value;


                    const roomPrice =
                        document
                            .getElementById(
                                "roomPrice"
                            )
                            .value;


                    const roomStatus =
                        document
                            .getElementById(
                                "roomStatus"
                            )
                            .value;


                    if (
                        !roomNumber ||
                        !roomType ||
                        !roomPrice
                    ) {

                        return;

                    }


                    let rooms =
                        getStoredRooms();


                    const editingRoom =
                        roomForm.dataset
                            .editingRoom;


                    const newRoom = {

                        number:
                            roomNumber,

                        type:
                            roomType,

                        price:
                            Number(
                                roomPrice
                            ),

                        status:
                            roomStatus

                    };


                    if (editingRoom) {

                        const roomIndex =
                            rooms.findIndex(
                                function(room) {

                                    return (
                                        room.number ===
                                        editingRoom
                                    );

                                }
                            );


                        if (
                            roomIndex !== -1
                        ) {

                            rooms[
                                roomIndex
                            ] =
                                newRoom;

                        }


                        delete roomForm
                            .dataset
                            .editingRoom;


                    } else {

                        rooms.push(
                            newRoom
                        );

                    }


                    saveRooms(
                        rooms
                    );


                    displayRooms();


                    closeRoomForm();


                    roomForm.reset();


                    alert(
                        "Room saved successfully."
                    );

                }
            );

        }


        // ----------------------------------------------------
        // OTHER MODULE COUNTERS
        // ----------------------------------------------------

        updateGuestCount();

        updateReservationCounts();

        updateCheckinCounts();

        updateCheckoutCounts();

        updateRestaurantCounts();

        updateInventoryCounts();

        updatePaymentCounts();

        updateExpenseCounts();


        // ----------------------------------------------------
        // REPORT DATA BRIDGE
        // ----------------------------------------------------

        setTimeout(
            function() {

                saveCurrentModuleTablesForReports();

                startReportTableWatcher();

            },
            1000
        );


        setTimeout(
            function() {

                saveCurrentModuleTablesForReports();

            },
            3000
        );


        setTimeout(
            function() {

                saveCurrentModuleTablesForReports();

            },
            6000
        );

    }
);


// ============================================================
// SAVE REPORT DATA BEFORE LEAVING PAGE
// ============================================================

window.addEventListener(
    "beforeunload",
    function() {

        saveCurrentModuleTablesForReports();

    }
);


// ============================================================
// ROOM BUTTONS
// ============================================================

function attachRoomButtons() {

    const table =
        document.getElementById(
            "roomsTable"
        );


    if (!table) return;


    table
        .querySelectorAll(".edit-btn")
        .forEach(
            function(button) {

                button.onclick =
                    function() {

                        editRoom(this);

                    };

            }
        );


    table
        .querySelectorAll(".delete-btn")
        .forEach(
            function(button) {

                button.onclick =
                    function() {

                        deleteRoom(this);

                    };

            }
        );

}```javascript
/* ============================================================
   GLOBAL ROLE-BASED SIDEBAR CONTROL
   EDU TECH HOTEL MANAGEMENT SYSTEM
   ============================================================

   This runs on EVERY page that loads script.js.

   Receptionist:
   Dashboard
   Rooms
   Guests
   Reservations
   Check-in
   Check-out
   Payments
   Reports

   Manager:
   All hotel operational modules except Hotels management

   Hotel Owner:
   All hotel operational modules except Hotels management

   System Owner:
   All modules including Hotels
   ============================================================ */

(function () {

    const ROLE_PERMISSIONS = {

        system_owner: [
            "rooms",
            "guests",
            "reservations",
            "checkin",
            "checkout",
            "restaurant",
            "inventory",
            "payments",
            "expenses",
            "employees",
            "housekeeping",
            "maintenance",
            "reports",
            "settings",
            "hotels"
        ],

        hotel_owner: [
            "rooms",
            "guests",
            "reservations",
            "checkin",
            "checkout",
            "restaurant",
            "inventory",
            "payments",
            "expenses",
            "employees",
            "housekeeping",
            "maintenance",
            "reports",
            "settings"
        ],

        manager: [
            "rooms",
            "guests",
            "reservations",
            "checkin",
            "checkout",
            "restaurant",
            "inventory",
            "payments",
            "expenses",
            "employees",
            "housekeeping",
            "maintenance",
            "reports",
            "settings"
        ],

        receptionist: [
            "rooms",
            "guests",
            "reservations",
            "checkin",
            "checkout",
            "payments",
            "reports"
        ]

    };


    function getCurrentUserRole() {

        let role =
            sessionStorage.getItem("userRole") ||
            localStorage.getItem("userRole") ||
            "";

        return String(role)
            .toLowerCase()
            .trim();
    }


    function getModuleFromLink(link) {

        const href =
            link.getAttribute("href") || "";

        const cleanHref =
            href
                .split("?")[0]
                .split("#")[0]
                .toLowerCase()
                .trim();


        if (cleanHref.includes("rooms.html")) {
            return "rooms";
        }

        if (cleanHref.includes("guests.html")) {
            return "guests";
        }

        if (cleanHref.includes("reservations.html")) {
            return "reservations";
        }

        if (cleanHref.includes("checkin.html")) {
            return "checkin";
        }

        if (cleanHref.includes("checkout.html")) {
            return "checkout";
        }

        if (cleanHref.includes("restaurant.html")) {
            return "restaurant";
        }

        if (cleanHref.includes("inventory.html")) {
            return "inventory";
        }

        if (cleanHref.includes("payments.html")) {
            return "payments";
        }

        if (cleanHref.includes("expenses.html")) {
            return "expenses";
        }

        if (cleanHref.includes("employees.html")) {
            return "employees";
        }

        if (cleanHref.includes("housekeeping.html")) {
            return "housekeeping";
        }

        if (cleanHref.includes("maintenance.html")) {
            return "maintenance";
        }

        if (cleanHref.includes("reports.html")) {
            return "reports";
        }

        if (cleanHref.includes("settings.html")) {
            return "settings";
        }

        if (cleanHref.includes("hotels.html")) {
            return "hotels";
        }

        return null;
    }


    function applyGlobalRoleSidebar() {

        const role =
            getCurrentUserRole();


        /*
         -------------------------------------------------------
         If there is no role yet, do not change the sidebar.
         This prevents the page from disappearing while the
         login/profile information is still loading.
         -------------------------------------------------------
        */

        if (!role) {
            return;
        }


        const allowedModules =
            ROLE_PERMISSIONS[role];


        /*
         -------------------------------------------------------
         Unknown role:
         Hide protected module links rather than showing
         everything.
         -------------------------------------------------------
        */

        if (!allowedModules) {

            document
                .querySelectorAll(".sidebar nav a")
                .forEach(function (link) {

                    const module =
                        getModuleFromLink(link);


                    if (module) {

                        link.style.display =
                            "none";

                    }

                });

            return;
        }


        /*
         -------------------------------------------------------
         Apply permissions to EVERY sidebar link.
         -------------------------------------------------------
        */

        document
            .querySelectorAll(".sidebar nav a")
            .forEach(function (link) {

                const module =
                    getModuleFromLink(link);


                /*
                 Dashboard is always allowed.
                */

                if (
                    link.href.toLowerCase()
                    .includes("index.html")
                    ||
                    link.getAttribute("href") === "./"
                    ||
                    link.getAttribute("href") === "/"
                ) {

                    link.style.display = "";
                    return;

                }


                /*
                 If the link is not one of the protected
                 modules, leave its appearance unchanged.
                */

                if (!module) {
                    return;
                }


                /*
                 Show only modules allowed for this role.
                */

                if (
                    allowedModules.includes(module)
                ) {

                    link.style.display = "";

                } else {

                    link.style.display =
                        "none";

                }

            });


        console.log(
            "Global sidebar permissions applied for role:",
            role
        );

    }


    /*
     -----------------------------------------------------------
     Run immediately if the page has already loaded.
     -----------------------------------------------------------
    */

    applyGlobalRoleSidebar();


    /*
     -----------------------------------------------------------
     Run again when the page DOM is ready.
     -----------------------------------------------------------
    */

    if (
        document.readyState === "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            applyGlobalRoleSidebar
        );

    } else {

        applyGlobalRoleSidebar();

    }


    /*
     -----------------------------------------------------------
     Small retry period.

     This is important because some pages load the user's
     role/profile slightly after the HTML appears.

     It does NOT change the page design.
     -----------------------------------------------------------
    */

    let sidebarAttempts = 0;

    const sidebarTimer =
        setInterval(function () {

            applyGlobalRoleSidebar();

            sidebarAttempts++;


            if (
                sidebarAttempts >= 10
            ) {

                clearInterval(
                    sidebarTimer
                );

            }

        }, 500);


})();
```