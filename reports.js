/* =========================================================
   EDU TECH HOTEL MANAGEMENT SYSTEM
   REPORTS MODULE
   VERSION: 2026.11.06.01

   PURPOSE:
   - Load authenticated user
   - Load correct hotel
   - Generate hotel reports
   - Room performance
   - Guest totals
   - Reservations
   - Payments
   - Restaurant sales
   - Expenses
   - Housekeeping
   - Maintenance
   - Inventory
   - Employees
   - Print
   - PDF
   - Excel
   - Word
   - Hotel-specific reporting
   ========================================================= */

"use strict";

/* =========================================================
   GLOBAL VARIABLES
   ========================================================= */

let supabaseClient = null;
let currentUser = null;
let currentProfile = null;
let currentRole = "";
let currentHotelId = null;
let currentHotel = null;

let reportPeriod = "today";
let reportData = null;
let reportGenerating = false;

const ALLOWED_REPORT_ROLES = [
    "system_owner",
    "hotel_owner",
    "manager"
];


/* =========================================================
   GENERAL HELPERS
   ========================================================= */

function getSupabaseClient() {
    if (window.supabaseClient) {
        return window.supabaseClient;
    }

    if (window.supabase) {
        return window.supabase;
    }

    return null;
}


function normalizeRole(role) {
    return String(role || "")
        .trim()
        .toLowerCase()
        .replace(/-/g, "_")
        .replace(/\s+/g, "_");
}


function getElement(id) {
    return document.getElementById(id);
}


function setText(id, value) {
    const element = getElement(id);

    if (element) {
        element.textContent = value;
    }
}


function formatMoney(value) {
    const amount = Number(value) || 0;

    return "KSh " + amount.toLocaleString("en-KE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}


function formatNumber(value) {
    return (Number(value) || 0).toLocaleString("en-KE");
}


function showMessage(message, type = "info") {
    const element = getElement("reportMessage");

    if (!element) {
        return;
    }

    element.textContent = message;
    element.style.display = "block";
    element.style.padding = "10px";
    element.style.marginTop = "10px";
    element.style.borderRadius = "6px";

    if (type === "error") {
        element.style.background = "#fee2e2";
        element.style.color = "#991b1b";
    } else if (type === "success") {
        element.style.background = "#dcfce7";
        element.style.color = "#166534";
    } else {
        element.style.background = "#e0f2fe";
        element.style.color = "#075985";
    }
}


function hideMessage() {
    const element = getElement("reportMessage");

    if (element) {
        element.style.display = "none";
        element.textContent = "";
    }
}


function safeDate(value) {
    if (!value) {
        return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date;
}


function todayDateString() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function getPeriodRange(period) {
    const now = new Date();

    const start = new Date(now);
    const end = new Date(now);

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    if (period === "today") {
        return {
            start,
            end
        };
    }

    if (period === "week") {
        const day = start.getDay();

        const difference =
            day === 0 ? 6 : day - 1;

        start.setDate(
            start.getDate() - difference
        );

        start.setHours(0, 0, 0, 0);

        return {
            start,
            end
        };
    }

    if (period === "month") {
        start.setDate(1);
        start.setHours(0, 0, 0, 0);

        return {
            start,
            end
        };
    }

    if (period === "year") {
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);

        return {
            start,
            end
        };
    }

    return {
        start,
        end
    };
}


function isWithinPeriod(value, range) {
    const date = safeDate(value);

    if (!date) {
        return false;
    }

    return (
        date >= range.start &&
        date <= range.end
    );
}


function getPeriodLabel(period) {
    const labels = {
        today: "Today",
        week: "This Week",
        month: "This Month",
        year: "This Year"
    };

    return labels[period] || "Selected Period";
}


function sumField(rows, field) {
    return (rows || []).reduce(
        (total, row) => {
            return total + (Number(row[field]) || 0);
        },
        0
    );
}


function statusIs(status, values) {
    const normalized = String(status || "")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");

    return values.includes(normalized);
}


function setButtonLoading(
    buttonId,
    loading,
    originalText
) {
    const button = getElement(buttonId);

    if (!button) {
        return;
    }

    if (loading) {
        if (!button.dataset.originalText) {
            button.dataset.originalText =
                button.textContent;
        }

        button.disabled = true;
        button.textContent = "Generating...";
    } else {
        button.disabled = false;

        button.textContent =
            button.dataset.originalText ||
            originalText;
    }
}


/* =========================================================
   AUTHENTICATION
   ========================================================= */

async function loadAuthenticatedUser() {

    supabaseClient =
        getSupabaseClient();

    if (!supabaseClient) {
        throw new Error(
            "Supabase client was not found. Check supabase.js."
        );
    }

    const {
        data: authData,
        error: authError
    } = await supabaseClient.auth.getUser();

    if (authError) {
        throw authError;
    }

    if (
        !authData ||
        !authData.user
    ) {
        throw new Error(
            "You are not logged in. Please log in again."
        );
    }

    currentUser =
        authData.user;

    const {
        data: profile,
        error: profileError
    } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

    if (profileError) {
        throw new Error(
            "Unable to load your profile: " +
            profileError.message
        );
    }

    if (!profile) {
        throw new Error(
            "Your user profile was not found."
        );
    }

    currentProfile =
        profile;

    currentRole =
        normalizeRole(profile.role);

    if (
        !ALLOWED_REPORT_ROLES.includes(
            currentRole
        )
    ) {
        throw new Error(
            "You do not have permission to access Reports."
        );
    }

    setText(
        "currentUserName",
        profile.full_name ||
        currentUser.email ||
        "User"
    );

    setText(
        "currentUserRole",
        String(
            profile.role || ""
        ).replace(/_/g, " ")
    );

    return profile;
}


/* =========================================================
   HOTEL SELECTION
   ========================================================= */

function getSelectedHotelId() {

    /*
       HOTEL OWNERS AND MANAGERS
       use their assigned hotel.
    */

    if (
        currentRole !== "system_owner"
    ) {
        return (
            currentProfile.hotel_id ||
            null
        );
    }


    /*
       SYSTEM OWNER
       may select an active hotel.
    */

    const possibleKeys = [
        "activeHotelId",
        "active_hotel_id",
        "selectedHotelId",
        "selectedHotelID",
        "hotelId"
    ];

    for (
        const key of possibleKeys
    ) {

        const sessionValue =
            sessionStorage.getItem(key);

        if (
            sessionValue &&
            sessionValue !== "null" &&
            sessionValue !== "undefined"
        ) {
            return sessionValue;
        }


        const localValue =
            localStorage.getItem(key);

        if (
            localValue &&
            localValue !== "null" &&
            localValue !== "undefined"
        ) {
            return localValue;
        }
    }

    return null;
}


async function loadHotelContext() {

    currentHotelId =
        getSelectedHotelId();

    if (!currentHotelId) {

        currentHotel = null;

        setText(
            "hotelNameDisplay",
            "No hotel selected"
        );

        setText(
            "hotelIdDisplay",
            "-"
        );

        throw new Error(
            currentRole === "system_owner"
                ? "Please select a hotel first, then open Reports again."
                : "Your account is not assigned to a hotel."
        );
    }


    const {
        data: hotel,
        error
    } = await supabaseClient
        .from("hotels")
        .select("*")
        .eq("id", currentHotelId)
        .maybeSingle();


    if (error) {

        throw new Error(
            "Unable to load hotel details: " +
            error.message
        );
    }


    if (!hotel) {

        throw new Error(
            "The selected hotel could not be found."
        );
    }


    currentHotel =
        hotel;


    setText(
        "hotelNameDisplay",
        hotel.hotel_name ||
        "Hotel"
    );


    setText(
        "hotelIdDisplay",
        hotel.id
    );
}


/* =========================================================
   DATABASE LOADING
   ========================================================= */

async function loadTable(tableName) {

    const {
        data,
        error
    } = await supabaseClient
        .from(tableName)
        .select("*")
        .eq("hotel_id", currentHotelId);


    if (error) {

        throw new Error(
            `Could not load ${tableName}: ${error.message}`
        );
    }


    return data || [];
}


async function loadAllReportTables() {

    showMessage(
        "Loading hotel records. Please wait..."
    );


    const tableNames = [
        "rooms",
        "guests",
        "reservations",
        "payments",
        "expenses",
        "restaurant_orders",
        "housekeeping",
        "maintenance",
        "inventory",
        "employees"
    ];


    const results =
        await Promise.all(
            tableNames.map(
                async (tableName) => {

                    const rows =
                        await loadTable(
                            tableName
                        );

                    return [
                        tableName,
                        rows
                    ];
                }
            )
        );


    const records = {};


    results.forEach(
        ([tableName, rows]) => {

            records[tableName] =
                rows;
        }
    );


    return records;
}


/* =========================================================
   REPORT CALCULATIONS
   ========================================================= */

function calculateReport(
    records,
    period
) {

    const range =
        getPeriodRange(period);


    const rooms =
        records.rooms || [];

    const guests =
        records.guests || [];

    const reservations =
        records.reservations || [];

    const payments =
        records.payments || [];

    const expenses =
        records.expenses || [];

    const restaurantOrders =
        records.restaurant_orders || [];

    const housekeeping =
        records.housekeeping || [];

    const maintenance =
        records.maintenance || [];

    const inventory =
        records.inventory || [];

    const employees =
        records.employees || [];


    /* =====================================================
       ROOMS
       ===================================================== */

    const totalRooms =
        rooms.length;


    const availableRooms =
        rooms.filter(
            row =>
                statusIs(
                    row.status,
                    ["available"]
                )
        ).length;


    const occupiedRooms =
        rooms.filter(
            row =>
                statusIs(
                    row.status,
                    ["occupied"]
                )
        ).length;


    const cleaningRooms =
        rooms.filter(
            row =>
                statusIs(
                    row.status,
                    ["cleaning"]
                )
        ).length;


    const maintenanceRooms =
        rooms.filter(
            row =>
                statusIs(
                    row.status,
                    ["maintenance"]
                )
        ).length;


    /* =====================================================
       GUESTS
       ===================================================== */

    const totalGuests =
        guests.length;


    /* =====================================================
       RESERVATIONS
       ===================================================== */

    const periodReservations =
        reservations.filter(
            row =>
                isWithinPeriod(
                    row.check_in ||
                    row.created_at,
                    range
                )
        );


    const pendingReservations =
        periodReservations.filter(
            row =>
                statusIs(
                    row.status,
                    [
                        "pending",
                        "reserved"
                    ]
                )
        ).length;


    const confirmedReservations =
        periodReservations.filter(
            row =>
                statusIs(
                    row.status,
                    [
                        "confirmed",
                        "checked_in",
                        "checked_out",
                        "completed"
                    ]
                )
        ).length;


    const reservationRevenue =
        sumField(
            periodReservations,
            "amount"
        );


    /* =====================================================
       PAYMENTS
       ===================================================== */

    const periodPayments =
        payments.filter(
            row =>
                isWithinPeriod(
                    row.payment_date ||
                    row.created_at,
                    range
                )
        );


    const paymentRevenue =
        sumField(
            periodPayments,
            "amount"
        );


    /* =====================================================
       RESTAURANT
       ===================================================== */

    const periodRestaurantOrders =
        restaurantOrders.filter(
            row => {

                if (
                    statusIs(
                        row.status,
                        [
                            "cancelled",
                            "canceled"
                        ]
                    )
                ) {
                    return false;
                }

                return isWithinPeriod(
                    row.order_date ||
                    row.created_at,
                    range
                );
            }
        );


    const restaurantSales =
        sumField(
            periodRestaurantOrders,
            "total"
        );


    /* =====================================================
       EXPENSES
       ===================================================== */

    const periodExpenses =
        expenses.filter(
            row =>
                isWithinPeriod(
                    row.expense_date ||
                    row.created_at,
                    range
                )
        );


    const totalExpenses =
        sumField(
            periodExpenses,
            "amount"
        );


    /*
       Net cash position shown here is:
       Payments collected - Expenses.

       Restaurant sales remain separate because restaurant
       payments may already exist in the payments table.
    */

    const financialNet =
        paymentRevenue -
        totalExpenses;


    /* =====================================================
       HOUSEKEEPING
       ===================================================== */

    const periodHousekeeping =
        housekeeping.filter(
            row =>
                isWithinPeriod(
                    row.created_at,
                    range
                )
        );


    const completedCleaning =
        periodHousekeeping.filter(
            row =>
                statusIs(
                    row.status,
                    [
                        "completed",
                        "complete",
                        "done"
                    ]
                )
        ).length;


    /* =====================================================
       MAINTENANCE
       ===================================================== */

    const periodMaintenance =
        maintenance.filter(
            row =>
                isWithinPeriod(
                    row.created_at,
                    range
                )
        );


    const pendingMaintenance =
        periodMaintenance.filter(
            row =>
                statusIs(
                    row.status,
                    [
                        "pending",
                        "open",
                        "in_progress",
                        "in progress"
                    ]
                )
        ).length;


    /* =====================================================
       INVENTORY
       ===================================================== */

    const inventoryValue =
        inventory.reduce(
            (total, item) => {

                const quantity =
                    Number(
                        item.quantity
                    ) || 0;

                const unitPrice =
                    Number(
                        item.unit_price
                    ) || 0;

                return (
                    total +
                    (
                        quantity *
                        unitPrice
                    )
                );

            },
            0
        );


    const lowStockItems =
        inventory.filter(
            item => {

                const quantity =
                    Number(
                        item.quantity
                    ) || 0;

                const reorderLevel =
                    Number(
                        item.reorder_level
                    ) || 0;

                return (
                    quantity <=
                    reorderLevel
                );
            }
        ).length;


    /* =====================================================
       EMPLOYEES
       ===================================================== */

    const activeEmployees =
        employees.filter(
            row =>
                statusIs(
                    row.status,
                    ["active"]
                )
        ).length;


    return {

        period,

        range,

        records,

        totalRooms,

        totalGuests,

        availableRooms,

        occupiedRooms,

        cleaningRooms,

        maintenanceRooms,

        periodReservations,

        reservationTotal:
            periodReservations.length,

        pendingReservations,

        confirmedReservations,

        reservationRevenue,

        periodPayments,

        financialPayments:
            paymentRevenue,

        periodRestaurantOrders,

        restaurantSales,

        periodExpenses,

        totalExpenses,

        financialNet,

        periodHousekeeping,

        housekeepingTasks:
            periodHousekeeping.length,

        completedCleaning,

        periodMaintenance,

        maintenanceTasks:
            periodMaintenance.length,

        pendingMaintenance,

        inventoryItems:
            inventory.length,

        inventoryValue,

        lowStockItems,

        activeEmployees
    };
}


/* =========================================================
   DISPLAY SUMMARY
   ========================================================= */

function displaySummary(data) {

    setText(
        "displayReportPeriod",
        getPeriodLabel(
            data.period
        )
    );


    setText(
        "totalRooms",
        formatNumber(
            data.totalRooms
        )
    );


    setText(
        "totalGuests",
        formatNumber(
            data.totalGuests
        )
    );


    setText(
        "totalReservations",
        formatNumber(
            data.reservationTotal
        )
    );


    setText(
        "totalRevenue",
        formatMoney(
            data.financialPayments
        )
    );


    setText(
        "restaurantSales",
        formatMoney(
            data.restaurantSales
        )
    );


    setText(
        "totalExpenses",
        formatMoney(
            data.totalExpenses
        )
    );


    setText(
        "performanceTotalRooms",
        formatNumber(
            data.totalRooms
        )
    );


    setText(
        "availableRooms",
        formatNumber(
            data.availableRooms
        )
    );


    setText(
        "occupiedRooms",
        formatNumber(
            data.occupiedRooms
        )
    );


    setText(
        "cleaningRooms",
        formatNumber(
            data.cleaningRooms
        )
    );


    setText(
        "maintenanceRooms",
        formatNumber(
            data.maintenanceRooms
        )
    );


    setText(
        "reservationTotal",
        formatNumber(
            data.reservationTotal
        )
    );


    setText(
        "pendingReservations",
        formatNumber(
            data.pendingReservations
        )
    );


    setText(
        "confirmedReservations",
        formatNumber(
            data.confirmedReservations
        )
    );


    setText(
        "reservationRevenue",
        formatMoney(
            data.reservationRevenue
        )
    );


    setText(
        "financialPayments",
        formatMoney(
            data.financialPayments
        )
    );


    setText(
        "financialRestaurant",
        formatMoney(
            data.restaurantSales
        )
    );


    setText(
        "financialExpenses",
        formatMoney(
            data.totalExpenses
        )
    );


    setText(
        "financialNet",
        formatMoney(
            data.financialNet
        )
    );


    setText(
        "housekeepingTasks",
        formatNumber(
            data.housekeepingTasks
        )
    );


    setText(
        "completedCleaning",
        formatNumber(
            data.completedCleaning
        )
    );


    setText(
        "maintenanceTasks",
        formatNumber(
            data.maintenanceTasks
        )
    );


    setText(
        "pendingMaintenance",
        formatNumber(
            data.pendingMaintenance
        )
    );


    setText(
        "inventoryItems",
        formatNumber(
            data.inventoryItems
        )
    );


    setText(
        "inventoryValue",
        formatMoney(
            data.inventoryValue
        )
    );
}


/* =========================================================
   COMPLETE REPORT TABLE
   ========================================================= */

function addReportRow(
    tableBody,
    label,
    value,
    status = "Reported"
) {

    const row =
        document.createElement("tr");


    const labelCell =
        document.createElement("td");


    const valueCell =
        document.createElement("td");


    const statusCell =
        document.createElement("td");


    labelCell.textContent =
        label;


    valueCell.textContent =
        value;


    statusCell.textContent =
        status;


    row.appendChild(
        labelCell
    );

    row.appendChild(
        valueCell
    );

    row.appendChild(
        statusCell
    );


    tableBody.appendChild(
        row
    );
}


function displayCompleteReport(
    data
) {

    const tableBody =
        getElement(
            "reportTableBody"
        );


    if (!tableBody) {
        return;
    }


    tableBody.innerHTML = "";


    addReportRow(
        tableBody,
        "Hotel",
        currentHotel
            ? currentHotel.hotel_name
            : "Hotel",
        "Current"
    );


    addReportRow(
        tableBody,
        "Reporting Period",
        getPeriodLabel(
            data.period
        ),
        "Selected"
    );


    addReportRow(
        tableBody,
        "Report Date",
        todayDateString(),
        "Generated"
    );


    addReportRow(
        tableBody,
        "Total Rooms",
        formatNumber(
            data.totalRooms
        ),
        "Current"
    );


    addReportRow(
        tableBody,
        "Available Rooms",
        formatNumber(
            data.availableRooms
        ),
        "Current"
    );


    addReportRow(
        tableBody,
        "Occupied Rooms",
        formatNumber(
            data.occupiedRooms
        ),
        "Current"
    );


    addReportRow(
        tableBody,
        "Rooms Being Cleaned",
        formatNumber(
            data.cleaningRooms
        ),
        "Current"
    );


    addReportRow(
        tableBody,
        "Rooms Under Maintenance",
        formatNumber(
            data.maintenanceRooms
        ),
        "Current"
    );


    addReportRow(
        tableBody,
        "Total Registered Guests",
        formatNumber(
            data.totalGuests
        ),
        "Current"
    );


    addReportRow(
        tableBody,
        "Reservations in Period",
        formatNumber(
            data.reservationTotal
        ),
        "Period"
    );


    addReportRow(
        tableBody,
        "Pending Reservations",
        formatNumber(
            data.pendingReservations
        ),
        "Period"
    );


    addReportRow(
        tableBody,
        "Confirmed / Completed Reservations",
        formatNumber(
            data.confirmedReservations
        ),
        "Period"
    );


    addReportRow(
        tableBody,
        "Booked Reservation Value",
        formatMoney(
            data.reservationRevenue
        ),
        "Period"
    );


    addReportRow(
        tableBody,
        "Payments Recorded",
        formatMoney(
            data.financialPayments
        ),
        "Period"
    );


    addReportRow(
        tableBody,
        "Restaurant Sales",
        formatMoney(
            data.restaurantSales
        ),
        "Period"
    );


    addReportRow(
        tableBody,
        "Expenses",
        formatMoney(
            data.totalExpenses
        ),
        "Period"
    );


    addReportRow(
        tableBody,
        "Net Payments After Expenses",
        formatMoney(
            data.financialNet
        ),
        "Calculated"
    );


    addReportRow(
        tableBody,
        "Housekeeping Tasks",
        formatNumber(
            data.housekeepingTasks
        ),
        "Period"
    );


    addReportRow(
        tableBody,
        "Completed Housekeeping Tasks",
        formatNumber(
            data.completedCleaning
        ),
        "Period"
    );


    addReportRow(
        tableBody,
        "Maintenance Tasks",
        formatNumber(
            data.maintenanceTasks
        ),
        "Period"
    );


    addReportRow(
        tableBody,
        "Pending Maintenance Tasks",
        formatNumber(
            data.pendingMaintenance
        ),
        "Period"
    );


    addReportRow(
        tableBody,
        "Inventory Items",
        formatNumber(
            data.inventoryItems
        ),
        "Current"
    );


    addReportRow(
        tableBody,
        "Current Inventory Value",
        formatMoney(
            data.inventoryValue
        ),
        "Current"
    );


    addReportRow(
        tableBody,
        "Low Stock Items",
        formatNumber(
            data.lowStockItems
        ),
        "Current"
    );


    addReportRow(
        tableBody,
        "Active Employees",
        formatNumber(
            data.activeEmployees
        ),
        "Current"
    );
}


/* =========================================================
   GENERATE REPORT
   ========================================================= */

async function generateReport() {

    if (reportGenerating) {
        return;
    }


    reportGenerating = true;


    setButtonLoading(
        "generateReportBtn",
        true,
        "Generate Report"
    );


    hideMessage();


    try {

        if (!supabaseClient) {
            supabaseClient =
                getSupabaseClient();
        }


        if (!currentHotelId) {
            await loadHotelContext();
        }


        const selector =
            getElement(
                "reportPeriod"
            );


        reportPeriod =
            selector
                ? selector.value
                : reportPeriod;


        if (
            ![
                "today",
                "week",
                "month",
                "year"
            ].includes(reportPeriod)
        ) {
            reportPeriod =
                "today";
        }


        const records =
            await loadAllReportTables();


        reportData =
            calculateReport(
                records,
                reportPeriod
            );


        displaySummary(
            reportData
        );


        displayCompleteReport(
            reportData
        );


        showMessage(
            "Report generated successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "Report generation error:",
            error
        );


        reportData = null;


        showMessage(
            error.message ||
            "Unable to generate report.",
            "error"
        );

    } finally {

        reportGenerating = false;


        setButtonLoading(
            "generateReportBtn",
            false,
            "Generate Report"
        );
    }
}


/* =========================================================
   PRINT REPORT
   ========================================================= */

function printReport() {

    if (!reportData) {

        showMessage(
            "Generate a report before printing.",
            "error"
        );

        return;
    }


    window.print();
}


/* =========================================================
   PDF EXPORT
   ========================================================= */

function downloadPDF() {

    if (!reportData) {

        showMessage(
            "Generate a report before downloading PDF.",
            "error"
        );

        return;
    }


    try {

        if (
            !window.jspdf ||
            !window.jspdf.jsPDF
        ) {
            throw new Error(
                "PDF library was not loaded. Check the jsPDF script in reports.html."
            );
        }


        if (!currentHotel) {
            throw new Error(
                "Hotel information is not available."
            );
        }


        const {
            jsPDF
        } = window.jspdf;


        const doc =
            new jsPDF();


        const left = 15;

        let y = 18;


        const pageWidth =
            doc.internal.pageSize
                .getWidth();


        const pageHeight =
            doc.internal.pageSize
                .getHeight();


        function addLine(
            label,
            value
        ) {

            if (
                y >
                pageHeight - 20
            ) {
                doc.addPage();

                y = 18;
            }


            doc.setFont(
                "helvetica",
                "normal"
            );


            doc.setFontSize(10);


            doc.text(
                String(label),
                left,
                y
            );


            doc.text(
                String(value),
                pageWidth - left,
                y,
                {
                    align: "right"
                }
            );


            y += 8;
        }


        doc.setFont(
            "helvetica",
            "bold"
        );


        doc.setFontSize(16);


        doc.text(
            currentHotel.hotel_name ||
            "Hotel Report",
            left,
            y
        );


        y += 9;


        doc.setFontSize(12);


        doc.text(
            "Hotel Management Report",
            left,
            y
        );


        y += 8;


        doc.setFont(
            "helvetica",
            "normal"
        );


        doc.setFontSize(10);


        doc.text(
            "Period: " +
            getPeriodLabel(
                reportData.period
            ),
            left,
            y
        );


        y += 6;


        doc.text(
            "Generated: " +
            todayDateString(),
            left,
            y
        );


        y += 10;


        doc.setFont(
            "helvetica",
            "bold"
        );


        doc.text(
            "REPORT DETAILS",
            left,
            y
        );


        y += 8;


        doc.setFont(
            "helvetica",
            "normal"
        );


        const rows = [

            [
                "Total Rooms",
                reportData.totalRooms
            ],

            [
                "Available Rooms",
                reportData.availableRooms
            ],

            [
                "Occupied Rooms",
                reportData.occupiedRooms
            ],

            [
                "Rooms Being Cleaned",
                reportData.cleaningRooms
            ],

            [
                "Rooms Under Maintenance",
                reportData.maintenanceRooms
            ],

            [
                "Total Registered Guests",
                reportData.totalGuests
            ],

            [
                "Reservations",
                reportData.reservationTotal
            ],

            [
                "Pending Reservations",
                reportData.pendingReservations
            ],

            [
                "Confirmed / Completed Reservations",
                reportData.confirmedReservations
            ],

            [
                "Booked Reservation Value",
                formatMoney(
                    reportData.reservationRevenue
                )
            ],

            [
                "Payments Recorded",
                formatMoney(
                    reportData.financialPayments
                )
            ],

            [
                "Restaurant Sales",
                formatMoney(
                    reportData.restaurantSales
                )
            ],

            [
                "Expenses",
                formatMoney(
                    reportData.totalExpenses
                )
            ],

            [
                "Net Payments After Expenses",
                formatMoney(
                    reportData.financialNet
                )
            ],

            [
                "Housekeeping Tasks",
                reportData.housekeepingTasks
            ],

            [
                "Completed Housekeeping Tasks",
                reportData.completedCleaning
            ],

            [
                "Maintenance Tasks",
                reportData.maintenanceTasks
            ],

            [
                "Pending Maintenance Tasks",
                reportData.pendingMaintenance
            ],

            [
                "Inventory Items",
                reportData.inventoryItems
            ],

            [
                "Inventory Value",
                formatMoney(
                    reportData.inventoryValue
                )
            ],

            [
                "Low Stock Items",
                reportData.lowStockItems
            ],

            [
                "Active Employees",
                reportData.activeEmployees
            ]
        ];


        rows.forEach(
            ([label, value]) => {
                addLine(
                    label,
                    value
                );
            }
        );


        y += 8;


        doc.setFontSize(9);


        doc.text(
            "Generated by EDU TECH Hotel Management System",
            left,
            Math.min(
                y,
                pageHeight - 10
            )
        );


        const hotelName =
            String(
                currentHotel.hotel_name ||
                "Hotel"
            ).replace(
                /[^a-z0-9]/gi,
                "_"
            );


        doc.save(
            `${hotelName}_Report_${todayDateString()}.pdf`
        );


        showMessage(
            "PDF report downloaded successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "PDF export error:",
            error
        );


        showMessage(
            error.message ||
            "PDF export failed.",
            "error"
        );
    }
}


/* =========================================================
   EXCEL EXPORT
   ========================================================= */

function downloadExcel() {

    if (!reportData) {

        showMessage(
            "Generate a report before downloading Excel.",
            "error"
        );

        return;
    }


    try {

        if (!window.XLSX) {

            throw new Error(
                "Excel library was not loaded. Check the XLSX script in reports.html."
            );
        }


        const rows = [

            [
                "EDU TECH HOTEL MANAGEMENT SYSTEM"
            ],

            [
                currentHotel.hotel_name ||
                "Hotel"
            ],

            [
                "Reporting Period",
                getPeriodLabel(
                    reportData.period
                )
            ],

            [
                "Generated Date",
                todayDateString()
            ],

            [],

            [
                "REPORT ITEM",
                "VALUE",
                "STATUS"
            ],

            [
                "Total Rooms",
                reportData.totalRooms,
                "Current"
            ],

            [
                "Available Rooms",
                reportData.availableRooms,
                "Current"
            ],

            [
                "Occupied Rooms",
                reportData.occupiedRooms,
                "Current"
            ],

            [
                "Rooms Being Cleaned",
                reportData.cleaningRooms,
                "Current"
            ],

            [
                "Rooms Under Maintenance",
                reportData.maintenanceRooms,
                "Current"
            ],

            [
                "Total Registered Guests",
                reportData.totalGuests,
                "Current"
            ],

            [
                "Reservations",
                reportData.reservationTotal,
                "Period"
            ],

            [
                "Pending Reservations",
                reportData.pendingReservations,
                "Period"
            ],

            [
                "Confirmed / Completed Reservations",
                reportData.confirmedReservations,
                "Period"
            ],

            [
                "Booked Reservation Value",
                reportData.reservationRevenue,
                "Period"
            ],

            [
                "Payments Recorded",
                reportData.financialPayments,
                "Period"
            ],

            [
                "Restaurant Sales",
                reportData.restaurantSales,
                "Period"
            ],

            [
                "Expenses",
                reportData.totalExpenses,
                "Period"
            ],

            [
                "Net Payments After Expenses",
                reportData.financialNet,
                "Calculated"
            ],

            [
                "Housekeeping Tasks",
                reportData.housekeepingTasks,
                "Period"
            ],

            [
                "Completed Housekeeping Tasks",
                reportData.completedCleaning,
                "Period"
            ],

            [
                "Maintenance Tasks",
                reportData.maintenanceTasks,
                "Period"
            ],

            [
                "Pending Maintenance Tasks",
                reportData.pendingMaintenance,
                "Period"
            ],

            [
                "Inventory Items",
                reportData.inventoryItems,
                "Current"
            ],

            [
                "Inventory Value",
                reportData.inventoryValue,
                "Current"
            ],

            [
                "Low Stock Items",
                reportData.lowStockItems,
                "Current"
            ],

            [
                "Active Employees",
                reportData.activeEmployees,
                "Current"
            ]
        ];


        const worksheet =
            window.XLSX.utils.aoa_to_sheet(
                rows
            );


        worksheet["!cols"] = [
            {
                wch: 40
            },
            {
                wch: 22
            },
            {
                wch: 18
            }
        ];


        const workbook =
            window.XLSX.utils.book_new();


        window.XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            "Hotel Report"
        );


        const hotelName =
            String(
                currentHotel.hotel_name ||
                "Hotel"
            ).replace(
                /[^a-z0-9]/gi,
                "_"
            );


        window.XLSX.writeFile(
            workbook,
            `${hotelName}_Report_${todayDateString()}.xlsx`
        );


        showMessage(
            "Excel report downloaded successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "Excel export error:",
            error
        );


        showMessage(
            error.message ||
            "Excel export failed.",
            "error"
        );
    }
}


/* =========================================================
   WORD EXPORT
   ========================================================= */

function downloadWord() {

    if (!reportData) {

        showMessage(
            "Generate a report before downloading Word.",
            "error"
        );

        return;
    }


    try {

        const rows = [

            [
                "Total Rooms",
                reportData.totalRooms
            ],

            [
                "Available Rooms",
                reportData.availableRooms
            ],

            [
                "Occupied Rooms",
                reportData.occupiedRooms
            ],

            [
                "Rooms Being Cleaned",
                reportData.cleaningRooms
            ],

            [
                "Rooms Under Maintenance",
                reportData.maintenanceRooms
            ],

            [
                "Total Registered Guests",
                reportData.totalGuests
            ],

            [
                "Reservations",
                reportData.reservationTotal
            ],

            [
                "Pending Reservations",
                reportData.pendingReservations
            ],

            [
                "Confirmed / Completed Reservations",
                reportData.confirmedReservations
            ],

            [
                "Booked Reservation Value",
                formatMoney(
                    reportData.reservationRevenue
                )
            ],

            [
                "Payments Recorded",
                formatMoney(
                    reportData.financialPayments
                )
            ],

            [
                "Restaurant Sales",
                formatMoney(
                    reportData.restaurantSales
                )
            ],

            [
                "Expenses",
                formatMoney(
                    reportData.totalExpenses
                )
            ],

            [
                "Net Payments After Expenses",
                formatMoney(
                    reportData.financialNet
                )
            ],

            [
                "Housekeeping Tasks",
                reportData.housekeepingTasks
            ],

            [
                "Completed Housekeeping Tasks",
                reportData.completedCleaning
            ],

            [
                "Maintenance Tasks",
                reportData.maintenanceTasks
            ],

            [
                "Pending Maintenance Tasks",
                reportData.pendingMaintenance
            ],

            [
                "Inventory Items",
                reportData.inventoryItems
            ],

            [
                "Inventory Value",
                formatMoney(
                    reportData.inventoryValue
                )
            ],

            [
                "Low Stock Items",
                reportData.lowStockItems
            ],

            [
                "Active Employees",
                reportData.activeEmployees
            ]
        ];


        const tableRows =
            rows.map(
                ([label, value]) => {

                    return `
                        <tr>
                            <td>${escapeHTML(label)}</td>
                            <td>${escapeHTML(value)}</td>
                        </tr>
                    `;
                }
            ).join("");


        const html = `
            <html>
            <head>
                <meta charset="UTF-8">

                <title>
                    Hotel Management Report
                </title>

                <style>

                    body {
                        font-family: Arial, sans-serif;
                        padding: 25px;
                        color: #222;
                    }

                    h1,
                    h2 {
                        text-align: center;
                    }

                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                    }

                    th,
                    td {
                        border: 1px solid #999;
                        padding: 9px;
                        text-align: left;
                    }

                    th {
                        background: #eeeeee;
                    }

                    .footer {
                        margin-top: 30px;
                        text-align: center;
                        font-size: 12px;
                    }

                </style>

            </head>

            <body>

                <h1>
                    ${escapeHTML(
                        currentHotel.hotel_name ||
                        "Hotel"
                    )}
                </h1>

                <h2>
                    Hotel Management Report
                </h2>

                <p>
                    <strong>
                        Reporting Period:
                    </strong>

                    ${escapeHTML(
                        getPeriodLabel(
                            reportData.period
                        )
                    )}
                </p>

                <p>
                    <strong>
                        Generated Date:
                    </strong>

                    ${escapeHTML(
                        todayDateString()
                    )}
                </p>

                <table>

                    <thead>

                        <tr>

                            <th>
                                Report Item
                            </th>

                            <th>
                                Value
                            </th>

                        </tr>

                    </thead>

                    <tbody>
                        ${tableRows}
                    </tbody>

                </table>

                <div class="footer">
                    Generated by EDU TECH Hotel Management System
                </div>

            </body>

            </html>
        `;


        const blob =
            new Blob(
                [
                    "\ufeff",
                    html
                ],
                {
                    type:
                        "application/msword"
                }
            );


        const url =
            URL.createObjectURL(
                blob
            );


        const link =
            document.createElement(
                "a"
            );


        const hotelName =
            String(
                currentHotel.hotel_name ||
                "Hotel"
            ).replace(
                /[^a-z0-9]/gi,
                "_"
            );


        link.href =
            url;


        link.download =
            `${hotelName}_Report_${todayDateString()}.doc`;


        document.body.appendChild(
            link
        );


        link.click();


        document.body.removeChild(
            link
        );


        URL.revokeObjectURL(
            url
        );


        showMessage(
            "Word report downloaded successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "Word export error:",
            error
        );


        showMessage(
            error.message ||
            "Word export failed.",
            "error"
        );
    }
}


/* =========================================================
   HTML ESCAPING
   ========================================================= */

function escapeHTML(value) {

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


/* =========================================================
   HOTEL CHANGE CHECK
   ========================================================= */

async function refreshReportsHotelContext() {

    const newHotelId =
        getSelectedHotelId();


    if (
        newHotelId &&
        String(newHotelId) !==
        String(currentHotelId)
    ) {

        currentHotelId =
            newHotelId;


        await loadHotelContext();


        await generateReport();
    }
}


/* =========================================================
   LOGOUT
   ========================================================= */

async function logoutUser() {

    try {

        if (supabaseClient) {

            await supabaseClient.auth.signOut();
        }

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );
    }


    sessionStorage.clear();


    localStorage.removeItem(
        "activeHotelId"
    );

    localStorage.removeItem(
        "active_hotel_id"
    );

    localStorage.removeItem(
        "selectedHotelId"
    );

    localStorage.removeItem(
        "selectedHotelID"
    );

    localStorage.removeItem(
        "hotelId"
    );


    window.location.href =
        "login.html";
}


/* =========================================================
   EVENT LISTENERS
   ========================================================= */

function setupReportEventListeners() {

    const generateButton =
        getElement(
            "generateReportBtn"
        );


    const printButton =
        getElement(
            "printReportBtn"
        );


    const pdfButton =
        getElement(
            "downloadPdfBtn"
        );


    const excelButton =
        getElement(
            "downloadExcelBtn"
        );


    const wordButton =
        getElement(
            "downloadWordBtn"
        );


    const periodSelector =
        getElement(
            "reportPeriod"
        );


    /* GENERATE */

    if (generateButton) {

        generateButton.addEventListener(
            "click",
            generateReport
        );
    }


    /* PRINT */

    if (printButton) {

        printButton.addEventListener(
            "click",
            printReport
        );
    }


    /* PDF */

    if (pdfButton) {

        pdfButton.addEventListener(
            "click",
            downloadPDF
        );
    }


    /* EXCEL */

    if (excelButton) {

        excelButton.addEventListener(
            "click",
            downloadExcel
        );
    }


    /* WORD */

    if (wordButton) {

        wordButton.addEventListener(
            "click",
            downloadWord
        );
    }


    /* PERIOD */

    if (periodSelector) {

        periodSelector.addEventListener(
            "change",
            function () {

                reportPeriod =
                    this.value;

            }
        );
    }


    /* LOGOUT */

    const logoutLinks =
        document.querySelectorAll(
            '[data-action="logout"], #logoutBtn, #logoutLink'
        );


    logoutLinks.forEach(
        link => {

            link.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();

                    logoutUser();
                }
            );
        }
    );
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initializeReports() {

    try {

        setupReportEventListeners();


        await loadAuthenticatedUser();


        await loadHotelContext();


        /*
           Generate the initial report automatically.
        */

        await generateReport();

    } catch (error) {

        console.error(
            "Reports initialization error:",
            error
        );


        showMessage(
            error.message ||
            "Reports could not be initialized.",
            "error"
        );
    }
}


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initializeReports
);


/* =========================================================
   EXPOSE FUNCTIONS
   ========================================================= */

window.generateReport =
    generateReport;

window.printReport =
    printReport;

window.downloadPDF =
    downloadPDF;

window.downloadExcel =
    downloadExcel;

window.downloadWord =
    downloadWord;

window.logoutUser =
    logoutUser;

window.refreshReportsHotelContext =
    refreshReportsHotelContext;