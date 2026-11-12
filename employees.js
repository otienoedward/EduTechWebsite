/* =========================================================
   EDU TECH HOTEL MANAGEMENT SYSTEM
   EMPLOYEES + PAYROLL MODULE

   VERSION:
   2026.11.09.18

   MATCHED EXACTLY TO CURRENT employees.html

   IMPORTANT:
   - Do NOT change employees.html
   - This file uses the exact IDs currently in HTML
   - No aggressive document capture handling
   - Sidebar/navigation clicks are left alone
   - Normal employee deletion protects payroll history
   - Permanent employee deletion can remove payroll history
   - DELETE operations do NOT use .select()
   - DELETE operations are separately verified
   - Supabase RLS errors are clearly reported
   ========================================================= */

"use strict";


/* =========================================================
   SUPABASE
   ========================================================= */

function getEmployeeSupabaseClient() {

    const clients = [
        window.supabaseClient,
        window.sb,
        window.hotelSupabase,
        window.employeeSupabase
    ];

    for (const client of clients) {

        if (
            client &&
            typeof client.from === "function"
        ) {
            return client;
        }
    }

    if (
        window.supabase &&
        typeof window.supabase.from === "function"
    ) {
        return window.supabase;
    }

    return null;
}


/* =========================================================
   STATE
   ========================================================= */

let currentUser = null;
let currentProfile = null;
let currentHotelId = null;
let currentHotel = null;

let employees = [];
let payrollRecords = [];
let deductionSettings = [];

let editingEmployeeId = null;
let editingPayrollId = null;

let employeeSaveInProgress = false;
let payrollSaveInProgress = false;
let employeesModuleInitialized = false;


/* =========================================================
   DEFAULT DEDUCTIONS
   ========================================================= */

const DEFAULT_DEDUCTIONS = [
    {
        key: "sha",
        name: "SHA"
    },
    {
        key: "nssf",
        name: "NSSF"
    },
    {
        key: "paye",
        name: "PAYE"
    },
    {
        key: "salary_advance",
        name: "Salary Advance"
    },
    {
        key: "fines",
        name: "Fines"
    },
    {
        key: "other_deduction_1",
        name: "Other Deduction 1"
    },
    {
        key: "other_deduction_2",
        name: "Other Deduction 2"
    },
    {
        key: "other_deduction_3",
        name: "Other Deduction 3"
    }
];


/* =========================================================
   EXACT CURRENT HTML DEDUCTION IDS
   ========================================================= */

const DEDUCTION_SLOTS = {

    sha: {
        amountId: "payrollSha"
    },

    nssf: {
        amountId: "payrollNssf"
    },

    paye: {
        amountId: "payrollPaye"
    },

    salary_advance: {
        amountId: "payrollSalaryAdvance"
    },

    fines: {
        amountId: "payrollFines"
    },

    other_deduction_1: {
        amountId: "otherDeduction1",
        nameId: "otherDeduction1Name"
    },

    other_deduction_2: {
        amountId: "otherDeduction2",
        nameId: "otherDeduction2Name"
    },

    other_deduction_3: {
        amountId: "otherDeduction3",
        nameId: "otherDeduction3Name"
    }

};


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function $(id) {
    return document.getElementById(id);
}


function safeNumber(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return 0;
    }

    const number = Number(
        String(value).replace(/,/g, "")
    );

    return Number.isFinite(number)
        ? number
        : 0;
}


function money(value) {

    return safeNumber(value).toLocaleString(
        "en-KE",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    );
}


function todayISO() {

    const d = new Date();

    return (
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0")
    );
}


function currentPayrollMonth() {

    const d = new Date();

    return (
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-01"
    );
}


function normalizePayrollMonth(value) {

    if (!value) {
        return currentPayrollMonth();
    }

    const text = String(value).trim();

    if (/^\d{4}-\d{2}$/.test(text)) {
        return text + "-01";
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        return text;
    }

    return currentPayrollMonth();
}


function formatPayrollMonth(value) {

    const normalized =
        normalizePayrollMonth(value);

    const date =
        new Date(normalized + "T00:00:00");

    if (Number.isNaN(date.getTime())) {
        return String(value || "-");
    }

    return date.toLocaleDateString(
        "en-GB",
        {
            month: "long",
            year: "numeric"
        }
    );
}


function formatDate(value) {

    if (!value) {
        return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleDateString("en-GB");
}


function valueOf(id) {

    const element = $(id);

    if (!element) {
        return "";
    }

    return element.value ?? "";
}


function setValue(id, value) {

    const element = $(id);

    if (!element) {
        return;
    }

    element.value =
        value === null ||
        value === undefined
            ? ""
            : value;
}


function setText(id, value) {

    const element = $(id);

    if (!element) {
        return;
    }

    element.textContent =
        value === null ||
        value === undefined
            ? ""
            : value;
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


function showMessage(message, type = "info") {

    try {

        if (
            typeof window.showToast === "function"
        ) {

            window.showToast(
                message,
                type
            );

            return;
        }

        if (
            typeof window.showNotification === "function"
        ) {

            window.showNotification(
                message,
                type
            );

            return;
        }

    } catch (error) {

        console.warn(
            "Notification error:",
            error
        );
    }

    console.log(
        "[" +
        String(type).toUpperCase() +
        "] " +
        message
    );
}


/* =========================================================
   HOTEL ID
   ========================================================= */

function getStoredHotelId() {

    const keys = [
        "hotelId",
        "hotel_id",
        "currentHotelId",
        "current_hotel_id",
        "selectedHotelId",
        "selected_hotel_id"
    ];

    for (const key of keys) {

        try {

            const value =
                localStorage.getItem(key);

            const number = Number(value);

            if (
                Number.isFinite(number) &&
                number > 0
            ) {
                return number;
            }

        } catch (error) {
            console.warn(error);
        }
    }

    for (const key of keys) {

        try {

            const value =
                sessionStorage.getItem(key);

            const number = Number(value);

            if (
                Number.isFinite(number) &&
                number > 0
            ) {
                return number;
            }

        } catch (error) {
            console.warn(error);
        }
    }

    return null;
}


function saveHotelId(id) {

    const number = Number(id);

    if (
        !Number.isFinite(number) ||
        number <= 0
    ) {
        return;
    }

    try {
        localStorage.setItem(
            "hotelId",
            String(number)
        );
    } catch (error) {
        console.warn(error);
    }

    try {
        sessionStorage.setItem(
            "hotelId",
            String(number)
        );
    } catch (error) {
        console.warn(error);
    }
}


/* =========================================================
   HEADER
   ========================================================= */

function updateEmployeeHeader() {

    const userName =
        currentProfile?.full_name ||
        currentProfile?.name ||
        currentUser?.user_metadata?.full_name ||
        currentUser?.user_metadata?.name ||
        currentUser?.email ||
        "Test Hotel Owner";

    const role =
        currentProfile?.role ||
        currentProfile?.user_role ||
        currentUser?.user_metadata?.role ||
        "hotel_owner";

    const hotelName =
        currentHotel?.hotel_name ||
        currentHotel?.name ||
        currentHotel?.business_name ||
        "Not Selected";


    setText(
        "currentUserName",
        userName
    );

    setText(
        "currentUserRole",
        role
    );

    setText(
        "currentHotelName",
        hotelName
    );

    document
        .querySelectorAll(
            ".current-hotel-name, [data-current-hotel]"
        )
        .forEach(
            element => {
                element.textContent = hotelName;
            }
        );
}


/* =========================================================
   RESOLVE USER / HOTEL
   ========================================================= */

async function resolveCurrentUser() {

    const supabase =
        getEmployeeSupabaseClient();

    currentHotelId =
        getStoredHotelId();


    if (
        supabase &&
        supabase.auth &&
        typeof supabase.auth.getUser === "function"
    ) {

        try {

            const result =
                await supabase.auth.getUser();

            currentUser =
                result?.data?.user || null;

        } catch (error) {

            console.warn(
                "User lookup failed:",
                error
            );
        }
    }


    if (
        supabase &&
        currentUser?.id
    ) {

        try {

            const result =
                await supabase
                    .from("profiles")
                    .select("*")
                    .eq(
                        "id",
                        currentUser.id
                    )
                    .maybeSingle();

            if (
                !result.error &&
                result.data
            ) {

                currentProfile =
                    result.data;
            }

        } catch (error) {

            console.warn(
                "Profile lookup failed:",
                error
            );
        }
    }


    const profileHotelId =
        currentProfile?.hotel_id ||
        currentProfile?.current_hotel_id ||
        currentProfile?.hotelId ||
        currentUser?.user_metadata?.hotel_id ||
        currentUser?.user_metadata?.hotelId;


    if (profileHotelId) {

        const number =
            Number(profileHotelId);

        if (
            Number.isFinite(number) &&
            number > 0
        ) {

            currentHotelId = number;
        }
    }


    if (currentHotelId) {
        saveHotelId(currentHotelId);
    }


    if (
        supabase &&
        currentHotelId
    ) {

        try {

            const result =
                await supabase
                    .from("hotels")
                    .select("*")
                    .eq(
                        "id",
                        currentHotelId
                    )
                    .maybeSingle();

            if (
                !result.error &&
                result.data
            ) {

                currentHotel =
                    result.data;
            }

        } catch (error) {

            console.warn(
                "Hotel lookup failed:",
                error
            );
        }
    }


    updateEmployeeHeader();

    return Boolean(currentHotelId);
}


/* =========================================================
   DEDUCTIONS
   ========================================================= */

function getDeductionName(key) {

    const configured =
        deductionSettings.find(
            item =>
                item.deduction_key === key
        );

    if (
        configured &&
        configured.deduction_name
    ) {

        return configured.deduction_name;
    }


    const fallback =
        DEFAULT_DEDUCTIONS.find(
            item =>
                item.key === key
        );

    return fallback?.name || key;
}


async function loadDeductionSettings() {

    deductionSettings =
        DEFAULT_DEDUCTIONS.map(
            item => ({
                deduction_key: item.key,
                deduction_name: item.name
            })
        );


    const supabase =
        getEmployeeSupabaseClient();

    if (
        !supabase ||
        !currentHotelId
    ) {
        return;
    }


    try {

        const result =
            await supabase
                .from(
                    "payroll_deduction_settings"
                )
                .select("*")
                .eq(
                    "hotel_id",
                    currentHotelId
                )
                .eq(
                    "is_active",
                    true
                )
                .order(
                    "display_order",
                    {
                        ascending: true
                    }
                );


        if (
            !result.error &&
            result.data?.length
        ) {

            deductionSettings =
                result.data;
        }

    } catch (error) {

        console.warn(
            "Deduction settings unavailable:",
            error
        );
    }
}


/* =========================================================
   EMPLOYEE NUMBER
   ========================================================= */

function generateEmployeeNumber() {

    let highest = 0;

    employees.forEach(
        employee => {

            const match =
                String(
                    employee.employee_number || ""
                ).match(
                    /EMP-(\d+)/i
                );

            if (match) {

                const number =
                    Number(match[1]);

                if (
                    Number.isFinite(number) &&
                    number > highest
                ) {

                    highest = number;
                }
            }
        }
    );


    return (
        "EMP-" +
        String(highest + 1).padStart(4, "0")
    );
}


/* =========================================================
   LOAD EMPLOYEES
   ========================================================= */

async function loadEmployees() {

    const supabase =
        getEmployeeSupabaseClient();

    if (!supabase) {

        showMessage(
            "Supabase is not available.",
            "error"
        );

        return false;
    }


    if (!currentHotelId) {
        currentHotelId = getStoredHotelId();
    }


    if (!currentHotelId) {

        employees = [];

        renderEmployees();
        updateEmployeeStatistics();
        populatePayrollEmployeeSelect();

        return false;
    }


    try {

        const result =
            await supabase
                .from("employees")
                .select("*")
                .eq(
                    "hotel_id",
                    currentHotelId
                )
                .order(
                    "id",
                    {
                        ascending: true
                    }
                );


        if (result.error) {

            console.error(
                "Employee load error:",
                result.error
            );

            showMessage(
                result.error.message ||
                "Unable to load employees.",
                "error"
            );

            return false;
        }


        employees =
            result.data || [];


        renderEmployees();
        updateEmployeeStatistics();
        populatePayrollEmployeeSelect();

        return true;

    } catch (error) {

        console.error(
            "loadEmployees:",
            error
        );

        showMessage(
            error.message ||
            "Unable to load employees.",
            "error"
        );

        return false;
    }
}


/* =========================================================
   RENDER EMPLOYEES
   ========================================================= */

function renderEmployees() {

    const tbody =
        $("employeeTableBody");

    if (!tbody) {
        return;
    }


    tbody.innerHTML = "";


    if (!employees.length) {

        tbody.innerHTML = `
            <tr>
                <td colspan="11"
                    style="text-align:center;padding:20px;">
                    No employees found.
                </td>
            </tr>
        `;

        return;
    }


    const search =
        String(
            valueOf("employeeSearch")
        )
            .trim()
            .toLowerCase();


    const filter =
        valueOf("employeeFilter") ||
        "all";


    const filtered =
        employees.filter(
            employee => {

                const status =
                    String(
                        employee.status || ""
                    )
                        .trim()
                        .toLowerCase();


                if (
                    filter === "active" &&
                    status !== "active"
                ) {
                    return false;
                }


                if (
                    filter === "inactive" &&
                    status !== "inactive"
                ) {
                    return false;
                }


                if (!search) {
                    return true;
                }


                const searchable = [
                    employee.employee_number,
                    employee.full_name,
                    employee.national_id,
                    employee.phone,
                    employee.email,
                    employee.position,
                    employee.department
                ]
                    .join(" ")
                    .toLowerCase();


                return searchable.includes(search);
            }
        );


    if (!filtered.length) {

        tbody.innerHTML = `
            <tr>
                <td colspan="11"
                    style="text-align:center;padding:20px;">
                    No matching employees found.
                </td>
            </tr>
        `;

        return;
    }


    filtered.forEach(
        (employee, index) => {

            const row =
                document.createElement("tr");


            row.innerHTML = `

                <td>${index + 1}</td>

                <td>
                    ${escapeHtml(
                        employee.employee_number || "-"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        employee.full_name || "-"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        employee.national_id || "-"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        employee.phone || "-"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        employee.email || "-"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        employee.position || "-"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        employee.department || "-"
                    )}
                </td>

                <td>
                    KSh ${money(employee.salary)}
                </td>

                <td>
                    ${escapeHtml(
                        employee.status || "-"
                    )}
                </td>

                <td>

                    <button
                        type="button"
                        class="btn btn-sm btn-primary"
                        data-action="edit-employee"
                        data-id="${employee.id}">
                        Edit
                    </button>

                    <button
                        type="button"
                        class="btn btn-sm btn-danger"
                        data-action="delete-employee"
                        data-id="${employee.id}">
                        Delete
                    </button>

                    <button
                        type="button"
                        class="btn btn-sm btn-warning"
                        data-action="permanent-delete-employee"
                        data-id="${employee.id}"
                        title="Permanently delete employee and payroll history">
                        Permanent Delete
                    </button>

                </td>

            `;


            tbody.appendChild(row);
        }
    );
}


/* =========================================================
   EMPLOYEE STATISTICS
   ========================================================= */

function updateEmployeeStatistics() {

    const total =
        employees.length;


    const active =
        employees.filter(
            employee =>
                String(
                    employee.status || ""
                )
                    .trim()
                    .toLowerCase() ===
                "active"
        ).length;


    const inactive =
        total - active;


    const gross =
        employees.reduce(
            (sum, employee) =>
                sum +
                safeNumber(
                    employee.salary
                ),
            0
        );


    setText(
        "totalEmployees",
        total
    );

    setText(
        "activeEmployees",
        active
    );

    setText(
        "inactiveEmployees",
        inactive
    );

    setText(
        "monthlyGrossPayroll",
        "KSh " + money(gross)
    );

    setText(
        "totalPayroll",
        "KSh " + money(gross)
    );
}


/* =========================================================
   EMPLOYEE MODAL
   ========================================================= */

function openEmployeeModal(employee = null) {

    const modal =
        $("employeeModal");

    if (!modal) {

        showMessage(
            "Employee modal was not found.",
            "error"
        );

        return;
    }


    editingEmployeeId =
        employee?.id || null;


    if (employee) {

        setValue(
            "employeeNumber",
            employee.employee_number || ""
        );

        setValue(
            "employeeName",
            employee.full_name || ""
        );

        setValue(
            "employeeNationalId",
            employee.national_id || ""
        );

        setValue(
            "employeePhone",
            employee.phone || ""
        );

        setValue(
            "employeeEmail",
            employee.email || ""
        );

        setValue(
            "employeePosition",
            employee.position || ""
        );

        setValue(
            "employeeDepartment",
            employee.department || ""
        );

        setValue(
            "employeeEmploymentDate",
            employee.employment_date || ""
        );

        setValue(
            "employeePaymentMethod",
            employee.payment_method || "Cash"
        );

        setValue(
            "employeeSalary",
            employee.salary ?? ""
        );

        setValue(
            "employeeStatus",
            employee.status || "Active"
        );

    } else {

        setValue(
            "employeeNumber",
            generateEmployeeNumber()
        );

        setValue(
            "employeeName",
            ""
        );

        setValue(
            "employeeNationalId",
            ""
        );

        setValue(
            "employeePhone",
            ""
        );

        setValue(
            "employeeEmail",
            ""
        );

        setValue(
            "employeePosition",
            ""
        );

        setValue(
            "employeeDepartment",
            ""
        );

        setValue(
            "employeeEmploymentDate",
            todayISO()
        );

        setValue(
            "employeePaymentMethod",
            "Cash"
        );

        setValue(
            "employeeSalary",
            ""
        );

        setValue(
            "employeeStatus",
            "Active"
        );
    }


    setText(
        "employeeModalTitle",
        employee
            ? "Edit Employee"
            : "Add Employee"
    );


    modal.style.display = "flex";
    modal.classList.add("show");
}


function closeEmployeeModal() {

    const modal =
        $("employeeModal");

    if (!modal) {
        return;
    }

    modal.style.display = "none";
    modal.classList.remove("show");

    editingEmployeeId = null;
}


/* =========================================================
   SAVE EMPLOYEE
   ========================================================= */

async function saveEmployee() {

    if (employeeSaveInProgress) {
        return;
    }


    const supabase =
        getEmployeeSupabaseClient();

    if (!supabase) {

        showMessage(
            "Supabase is not available.",
            "error"
        );

        return;
    }


    if (!currentHotelId) {
        currentHotelId = getStoredHotelId();
    }


    if (!currentHotelId) {

        showMessage(
            "Hotel could not be determined.",
            "error"
        );

        return;
    }


    const employeeNumber =
        valueOf("employeeNumber").trim() ||
        generateEmployeeNumber();


    const fullName =
        valueOf("employeeName").trim();


    const salary =
        safeNumber(
            valueOf("employeeSalary")
        );


    if (!fullName) {

        showMessage(
            "Employee full name is required.",
            "error"
        );

        return;
    }


    if (salary < 0) {

        showMessage(
            "Gross salary cannot be negative.",
            "error"
        );

        return;
    }


    const duplicate =
        employees.find(
            employee =>
                String(
                    employee.employee_number || ""
                )
                    .toLowerCase() ===
                employeeNumber.toLowerCase()
                &&
                String(employee.id) !==
                String(editingEmployeeId || "")
        );


    if (duplicate) {

        showMessage(
            "Employee Number already exists.",
            "error"
        );

        return;
    }


    const payload = {

        employee_number:
            employeeNumber,

        full_name:
            fullName,

        national_id:
            valueOf(
                "employeeNationalId"
            ).trim(),

        phone:
            valueOf(
                "employeePhone"
            ).trim(),

        email:
            valueOf(
                "employeeEmail"
            ).trim(),

        position:
            valueOf(
                "employeePosition"
            ).trim(),

        department:
            valueOf(
                "employeeDepartment"
            ).trim(),

        employment_date:
            valueOf(
                "employeeEmploymentDate"
            ) || null,

        payment_method:
            valueOf(
                "employeePaymentMethod"
            ) || "Cash",

        salary:
            salary,

        status:
            valueOf(
                "employeeStatus"
            ) || "Active",

        hotel_id:
            currentHotelId
    };


    employeeSaveInProgress = true;


    try {

        let result;


        if (editingEmployeeId) {

            result =
                await supabase
                    .from("employees")
                    .update(payload)
                    .eq(
                        "id",
                        editingEmployeeId
                    )
                    .eq(
                        "hotel_id",
                        currentHotelId
                    );

        } else {

            result =
                await supabase
                    .from("employees")
                    .insert(payload);
        }


        if (result.error) {

            console.error(
                "Employee save error:",
                result.error
            );

            showMessage(
                result.error.message ||
                "Employee could not be saved.",
                "error"
            );

            return;
        }


        const editing =
            Boolean(editingEmployeeId);


        closeEmployeeModal();


        showMessage(
            editing
                ? "Employee updated successfully."
                : "Employee added successfully.",
            "success"
        );


        await loadEmployees();


    } catch (error) {

        console.error(
            "saveEmployee:",
            error
        );

        showMessage(
            error.message ||
            "Unable to save employee.",
            "error"
        );

    } finally {

        employeeSaveInProgress = false;
    }
}


/* =========================================================
   EDIT EMPLOYEE
   ========================================================= */

function editEmployee(id) {

    const employee =
        employees.find(
            item =>
                String(item.id) ===
                String(id)
        );


    if (!employee) {

        showMessage(
            "Employee not found.",
            "error"
        );

        return;
    }


    openEmployeeModal(employee);
}


/* =========================================================
   NORMAL DELETE EMPLOYEE
   =========================================================

   IMPORTANT FIX:

   DO NOT use:

       .delete().select("id")

   because Supabase RLS/SELECT policies can make
   the returned deleted-row data misleading.

   We now:

   1. Check payroll
   2. Delete employee WITHOUT select()
   3. Verify employee separately
   4. Refresh the employee list
   ========================================================= */

async function deleteEmployee(id) {

    const supabase =
        getEmployeeSupabaseClient();


    if (!supabase) {

        showMessage(
            "Supabase is not available.",
            "error"
        );

        return;
    }


    if (!currentHotelId) {
        currentHotelId =
            getStoredHotelId();
    }


    if (!currentHotelId) {

        showMessage(
            "Hotel could not be determined.",
            "error"
        );

        return;
    }


    const employee =
        employees.find(
            item =>
                String(item.id) ===
                String(id)
        );


    if (!employee) {

        showMessage(
            "Employee not found.",
            "error"
        );

        return;
    }


    const employeeName =
        employee.full_name ||
        employee.employee_number ||
        "this employee";


    const confirmed =
        window.confirm(
            "Delete employee " +
            employeeName +
            "?"
        );


    if (!confirmed) {
        return;
    }


    try {

        /* =====================================================
           CHECK PAYROLL HISTORY
           ===================================================== */

        const payrollCheck =
            await supabase
                .from("payroll_records")
                .select("id")
                .eq(
                    "employee_id",
                    employee.id
                )
                .eq(
                    "hotel_id",
                    currentHotelId
                )
                .limit(1);


        if (payrollCheck.error) {

            console.error(
                "Payroll history check failed:",
                payrollCheck.error
            );

            showMessage(
                payrollCheck.error.message ||
                "Unable to check employee payroll history. Employee was not deleted.",
                "error"
            );

            return;
        }


        if (
            payrollCheck.data &&
            payrollCheck.data.length > 0
        ) {

            showMessage(
                "This employee cannot be deleted because payroll records already exist. Use Permanent Delete if you intentionally want to remove the payroll history too.",
                "error"
            );

            return;
        }


        /* =====================================================
           DELETE EMPLOYEE
           ===================================================== */

        const deleteResult =
            await supabase
                .from("employees")
                .delete()
                .eq(
                    "id",
                    employee.id
                )
                .eq(
                    "hotel_id",
                    currentHotelId
                );


        /* =====================================================
           CHECK DATABASE ERROR
           ===================================================== */

        if (deleteResult.error) {

            console.error(
                "Employee delete error:",
                deleteResult.error
            );

            showMessage(
                deleteResult.error.message ||
                "Employee could not be deleted.",
                "error"
            );

            return;
        }


        /* =====================================================
           VERIFY EMPLOYEE REALLY DISAPPEARED
           ===================================================== */

        const verifyEmployee =
            await supabase
                .from("employees")
                .select("id")
                .eq(
                    "id",
                    employee.id
                )
                .eq(
                    "hotel_id",
                    currentHotelId
                )
                .limit(1);


        if (verifyEmployee.error) {

            console.error(
                "Employee deletion verification failed:",
                verifyEmployee.error
            );

            showMessage(
                "The deletion request completed, but the employee could not be verified. Please refresh the page and check the employee record.",
                "error"
            );

            return;
        }


        if (
            verifyEmployee.data &&
            verifyEmployee.data.length > 0
        ) {

            console.error(
                "Employee still exists after delete.",
                {
                    employeeId:
                        employee.id,

                    hotelId:
                        currentHotelId
                }
            );

            showMessage(
                "The employee was NOT deleted. Your Supabase DELETE/RLS policy is likely preventing deletion.",
                "error"
            );

            return;
        }


        /* =====================================================
           UPDATE LOCAL STATE
           ===================================================== */

        employees =
            employees.filter(
                item =>
                    String(item.id) !==
                    String(employee.id)
            );


        renderEmployees();

        updateEmployeeStatistics();

        populatePayrollEmployeeSelect();


        showMessage(
            "Employee deleted successfully.",
            "success"
        );


        /* =====================================================
           FINAL DATABASE RELOAD
           ===================================================== */

        await loadEmployees();


    } catch (error) {

        console.error(
            "deleteEmployee:",
            error
        );

        showMessage(
            error.message ||
            "Unable to delete employee.",
            "error"
        );
    }
}


/* =========================================================
   PERMANENT DELETE EMPLOYEE
   =========================================================

   IMPORTANT:

   This function permanently removes:

   1. Payroll records belonging to employee
   2. Employee record

   This action cannot be undone.

   DELETE statements do NOT use .select().

   Every DELETE is followed by an independent
   verification query.
   ========================================================= */

async function permanentlyDeleteEmployee(id) {

    const supabase =
        getEmployeeSupabaseClient();


    if (!supabase) {

        showMessage(
            "Supabase is not available.",
            "error"
        );

        return;
    }


    if (!currentHotelId) {
        currentHotelId =
            getStoredHotelId();
    }


    if (!currentHotelId) {

        showMessage(
            "Hotel could not be determined.",
            "error"
        );

        return;
    }


    const employee =
        employees.find(
            item =>
                String(item.id) ===
                String(id)
        );


    if (!employee) {

        showMessage(
            "Employee not found.",
            "error"
        );

        return;
    }


    const employeeName =
        employee.full_name ||
        employee.employee_number ||
        "this employee";


    /* =====================================================
       FIRST CONFIRMATION
       ===================================================== */

    const firstConfirm =
        window.confirm(
            "WARNING!\n\n" +
            "You are about to permanently delete:\n\n" +
            "Employee: " +
            employeeName +
            "\nEmployee Number: " +
            (
                employee.employee_number ||
                "-"
            ) +
            "\n\n" +
            "This action will also delete ALL payroll records belonging to this employee.\n\n" +
            "This cannot be undone.\n\n" +
            "Do you want to continue?"
        );


    if (!firstConfirm) {
        return;
    }


    /* =====================================================
       SECOND CONFIRMATION
       ===================================================== */

    const secondConfirm =
        window.confirm(
            "FINAL CONFIRMATION\n\n" +
            "Permanently delete " +
            employeeName +
            " and all of their payroll history?\n\n" +
            "Press OK only if you are absolutely sure."
        );


    if (!secondConfirm) {
        return;
    }


    try {

        /* =====================================================
           STEP 1 — CHECK PAYROLL RECORDS
           ===================================================== */

        const payrollCheck =
            await supabase
                .from("payroll_records")
                .select("id")
                .eq(
                    "employee_id",
                    employee.id
                )
                .eq(
                    "hotel_id",
                    currentHotelId
                );


        if (payrollCheck.error) {

            console.error(
                "Permanent delete payroll lookup error:",
                payrollCheck.error
            );

            showMessage(
                payrollCheck.error.message ||
                "Unable to check payroll history. Employee was not deleted.",
                "error"
            );

            return;
        }


        const payrollRecordsToDelete =
            payrollCheck.data || [];


        /* =====================================================
           STEP 2 — DELETE PAYROLL RECORDS
           ===================================================== */

        if (
            payrollRecordsToDelete.length > 0
        ) {

            /*
               IMPORTANT:
               No .select("id") here.
            */

            const payrollDelete =
                await supabase
                    .from("payroll_records")
                    .delete()
                    .eq(
                        "employee_id",
                        employee.id
                    )
                    .eq(
                        "hotel_id",
                        currentHotelId
                    );


            if (payrollDelete.error) {

                console.error(
                    "Permanent payroll delete error:",
                    payrollDelete.error
                );

                showMessage(
                    payrollDelete.error.message ||
                    "Payroll records could not be deleted. Employee was NOT deleted.",
                    "error"
                );

                return;
            }


            /* =================================================
               VERIFY PAYROLL RECORDS
               ================================================= */

            const payrollVerify =
                await supabase
                    .from("payroll_records")
                    .select("id")
                    .eq(
                        "employee_id",
                        employee.id
                    )
                    .eq(
                        "hotel_id",
                        currentHotelId
                    )
                    .limit(1);


            if (payrollVerify.error) {

                console.error(
                    "Payroll deletion verification error:",
                    payrollVerify.error
                );

                showMessage(
                    "Payroll deletion could not be verified. Employee was NOT deleted.",
                    "error"
                );

                return;
            }


            if (
                payrollVerify.data &&
                payrollVerify.data.length > 0
            ) {

                showMessage(
                    "Payroll records still exist. Employee was NOT deleted.",
                    "error"
                );

                return;
            }
        }


        /* =====================================================
           STEP 3 — DELETE EMPLOYEE
           =====================================================

           IMPORTANT:
           No .select("id") here.
        */

        const employeeDelete =
            await supabase
                .from("employees")
                .delete()
                .eq(
                    "id",
                    employee.id
                )
                .eq(
                    "hotel_id",
                    currentHotelId
                );


        if (employeeDelete.error) {

            console.error(
                "Permanent employee delete error:",
                employeeDelete.error
            );

            showMessage(
                employeeDelete.error.message ||
                "Employee could not be deleted. Check the employees DELETE/RLS policy.",
                "error"
            );

            return;
        }


        /* =====================================================
           STEP 4 — VERIFY EMPLOYEE
           ===================================================== */

        const employeeVerify =
            await supabase
                .from("employees")
                .select("id")
                .eq(
                    "id",
                    employee.id
                )
                .eq(
                    "hotel_id",
                    currentHotelId
                )
                .limit(1);


        if (employeeVerify.error) {

            console.error(
                "Employee deletion verification error:",
                employeeVerify.error
            );

            showMessage(
                "Employee deletion could not be fully verified. Please refresh the page and check the database.",
                "error"
            );

            return;
        }


        if (
            employeeVerify.data &&
            employeeVerify.data.length > 0
        ) {

            console.error(
                "Employee still exists after permanent delete.",
                {
                    employeeId:
                        employee.id,

                    hotelId:
                        currentHotelId
                }
            );

            showMessage(
                "The employee still exists in the database. Your Supabase DELETE/RLS policy is preventing the deletion.",
                "error"
            );

            return;
        }


        /* =====================================================
           STEP 5 — UPDATE LOCAL STATE
           ===================================================== */

        employees =
            employees.filter(
                item =>
                    String(item.id) !==
                    String(employee.id)
            );


        payrollRecords =
            payrollRecords.filter(
                record =>
                    String(record.employee_id) !==
                    String(employee.id)
            );


        renderEmployees();

        updateEmployeeStatistics();

        populatePayrollEmployeeSelect();

        renderPayroll();


        /* =====================================================
           STEP 6 — FINAL RELOAD
           ===================================================== */

        await loadEmployees();

        await loadPayroll();


        showMessage(
            "Employee and all payroll history were permanently deleted.",
            "success"
        );


    } catch (error) {

        console.error(
            "permanentlyDeleteEmployee:",
            error
        );

        showMessage(
            error.message ||
            "Unable to permanently delete employee.",
            "error"
        );
    }
}


/* =========================================================
   PAYROLL EMPLOYEE SELECT
   ========================================================= */

function populatePayrollEmployeeSelect() {

    const select =
        $("payrollEmployee");

    if (!select) {
        return;
    }


    const currentValue =
        select.value;


    select.innerHTML = `
        <option value="">
            Select Employee
        </option>
    `;


    employees.forEach(
        employee => {

            const option =
                document.createElement("option");

            option.value =
                employee.id;

            option.textContent =
                (
                    employee.employee_number ||
                    "-"
                ) +
                " - " +
                (
                    employee.full_name ||
                    "-"
                );

            select.appendChild(option);
        }
    );


    if (
        currentValue &&
        employees.some(
            employee =>
                String(employee.id) ===
                String(currentValue)
        )
    ) {

        select.value =
            currentValue;
    }
}


/* =========================================================
   PAYROLL EMPLOYEE CHANGE
   ========================================================= */

function handlePayrollEmployeeChange() {

    const employeeId =
        valueOf("payrollEmployee");


    if (!employeeId) {

        setValue(
            "payrollGrossSalary",
            ""
        );

        calculatePayrollTotals();

        return;
    }


    const employee =
        employees.find(
            item =>
                String(item.id) ===
                String(employeeId)
        );


    if (!employee) {
        return;
    }


    setValue(
        "payrollEmployeeNumber",
        employee.employee_number || ""
    );


    setValue(
        "payrollGrossSalary",
        employee.salary ?? 0
    );


    calculatePayrollTotals();
}


/* =========================================================
   NEW PAYROLL
   ========================================================= */

function openNewPayrollModal() {

    const modal =
        $("payrollModal");


    if (!modal) {

        showMessage(
            "Payroll modal was not found.",
            "error"
        );

        return;
    }


    editingPayrollId = null;


    populatePayrollEmployeeSelect();


    setValue(
        "payrollRecordId",
        ""
    );


    setValue(
        "payrollEmployee",
        ""
    );


    setValue(
        "payrollFormMonth",
        currentPayrollMonth()
            .substring(0, 7)
    );


    setValue(
        "payrollEmployeeNumber",
        ""
    );


    setValue(
        "payrollGrossSalary",
        ""
    );


    setValue(
        "payrollSha",
        "0"
    );

    setValue(
        "payrollNssf",
        "0"
    );

    setValue(
        "payrollPaye",
        "0"
    );

    setValue(
        "payrollSalaryAdvance",
        "0"
    );

    setValue(
        "payrollFines",
        "0"
    );

    setValue(
        "otherDeduction1Name",
        getDeductionName(
            "other_deduction_1"
        )
    );

    setValue(
        "otherDeduction1",
        "0"
    );

    setValue(
        "otherDeduction2Name",
        getDeductionName(
            "other_deduction_2"
        )
    );

    setValue(
        "otherDeduction2",
        "0"
    );

    setValue(
        "otherDeduction3Name",
        getDeductionName(
            "other_deduction_3"
        )
    );

    setValue(
        "otherDeduction3",
        "0"
    );


    setValue(
        "payrollPaymentStatus",
        "Pending"
    );

    setValue(
        "payrollPaymentDate",
        ""
    );

    setValue(
        "payrollNotes",
        ""
    );


    calculatePayrollTotals();


    setText(
        "payrollModalTitle",
        "Process Payroll"
    );


    modal.style.display = "flex";
    modal.classList.add("show");
}


/* =========================================================
   CLOSE PAYROLL
   ========================================================= */

function closePayrollModal() {

    const modal =
        $("payrollModal");

    if (!modal) {
        return;
    }

    modal.style.display = "none";
    modal.classList.remove("show");

    editingPayrollId = null;
}


/* =========================================================
   CALCULATE PAYROLL
   ========================================================= */

function calculatePayrollTotals() {

    const gross =
        Math.max(
            0,
            safeNumber(
                valueOf(
                    "payrollGrossSalary"
                )
            )
        );


    const amounts = [
        valueOf("payrollSha"),
        valueOf("payrollNssf"),
        valueOf("payrollPaye"),
        valueOf("payrollSalaryAdvance"),
        valueOf("payrollFines"),
        valueOf("otherDeduction1"),
        valueOf("otherDeduction2"),
        valueOf("otherDeduction3")
    ];


    const totalDeductions =
        amounts.reduce(
            (
                total,
                amount
            ) =>
                total +
                Math.max(
                    0,
                    safeNumber(amount)
                ),
            0
        );


    const net =
        gross -
        totalDeductions;


    setText(
        "calculatedGross",
        "KSh " +
        money(gross)
    );


    setText(
        "calculatedDeductions",
        "KSh " +
        money(totalDeductions)
    );


    setText(
        "calculatedNet",
        "KSh " +
        money(net)
    );


    return {
        gross,
        totalDeductions,
        net
    };
}


/* =========================================================
   SAVE PAYROLL
   ========================================================= */

async function savePayroll() {

    if (payrollSaveInProgress) {
        return;
    }


    const supabase =
        getEmployeeSupabaseClient();


    if (!supabase) {

        showMessage(
            "Supabase is not available.",
            "error"
        );

        return;
    }


    if (!currentHotelId) {
        currentHotelId = getStoredHotelId();
    }


    if (!currentHotelId) {

        showMessage(
            "Hotel could not be determined.",
            "error"
        );

        return;
    }


    const employeeId =
        valueOf("payrollEmployee");


    if (!employeeId) {

        showMessage(
            "Please select an employee.",
            "error"
        );

        return;
    }


    const employee =
        employees.find(
            item =>
                String(item.id) ===
                String(employeeId)
        );


    if (!employee) {

        showMessage(
            "Selected employee was not found.",
            "error"
        );

        return;
    }


    if (!editingPayrollId) {

        setValue(
            "payrollGrossSalary",
            employee.salary ?? 0
        );
    }


    const payrollMonth =
        normalizePayrollMonth(
            valueOf("payrollFormMonth")
        );


    const totals =
        calculatePayrollTotals();


    if (
        totals.totalDeductions >
        totals.gross
    ) {

        showMessage(
            "Total deductions cannot be greater than gross salary.",
            "error"
        );

        return;
    }


    if (!editingPayrollId) {

        try {

            const duplicate =
                await supabase
                    .from("payroll_records")
                    .select("id")
                    .eq(
                        "hotel_id",
                        currentHotelId
                    )
                    .eq(
                        "employee_id",
                        employeeId
                    )
                    .eq(
                        "payroll_month",
                        payrollMonth
                    )
                    .limit(1);


            if (
                !duplicate.error &&
                duplicate.data?.length
            ) {

                showMessage(
                    "Payroll for this employee and month already exists.",
                    "error"
                );

                return;
            }

        } catch (error) {

            console.warn(
                "Duplicate payroll check:",
                error
            );
        }
    }


    const payload = {

        hotel_id:
            currentHotelId,

        employee_id:
            employeeId,

        payroll_month:
            payrollMonth,

        gross_salary:
            totals.gross,

        sha:
            safeNumber(
                valueOf("payrollSha")
            ),

        nssf:
            safeNumber(
                valueOf("payrollNssf")
            ),

        paye:
            safeNumber(
                valueOf("payrollPaye")
            ),

        salary_advance:
            safeNumber(
                valueOf(
                    "payrollSalaryAdvance"
                )
            ),

        fines:
            safeNumber(
                valueOf("payrollFines")
            ),

        other_deduction_1:
            safeNumber(
                valueOf("otherDeduction1")
            ),

        other_deduction_1_name:
            valueOf(
                "otherDeduction1Name"
            ).trim() ||
            getDeductionName(
                "other_deduction_1"
            ),

        other_deduction_2:
            safeNumber(
                valueOf("otherDeduction2")
            ),

        other_deduction_2_name:
            valueOf(
                "otherDeduction2Name"
            ).trim() ||
            getDeductionName(
                "other_deduction_2"
            ),

        other_deduction_3:
            safeNumber(
                valueOf("otherDeduction3")
            ),

        other_deduction_3_name:
            valueOf(
                "otherDeduction3Name"
            ).trim() ||
            getDeductionName(
                "other_deduction_3"
            ),

        total_deductions:
            totals.totalDeductions,

        basic_salary:
            totals.net,

        payment_status:
            valueOf(
                "payrollPaymentStatus"
            ) ||
            "Pending",

        payment_date:
            valueOf(
                "payrollPaymentDate"
            ) || null,

        notes:
            valueOf(
                "payrollNotes"
            ).trim()
    };


    payrollSaveInProgress = true;


    try {

        let result;


        if (editingPayrollId) {

            result =
                await supabase
                    .from("payroll_records")
                    .update(payload)
                    .eq(
                        "id",
                        editingPayrollId
                    )
                    .eq(
                        "hotel_id",
                        currentHotelId
                    );

        } else {

            result =
                await supabase
                    .from("payroll_records")
                    .insert(payload);
        }


        if (result.error) {

            console.error(
                "Payroll save error:",
                result.error
            );


            showMessage(
                result.error.message ||
                "Payroll could not be saved.",
                "error"
            );

            return;
        }


        const editing =
            Boolean(editingPayrollId);


        closePayrollModal();


        showMessage(
            editing
                ? "Payroll updated successfully."
                : "Payroll processed successfully.",
            "success"
        );


        await loadPayroll();


    } catch (error) {

        console.error(
            "savePayroll:",
            error
        );

        showMessage(
            error.message ||
            "Unable to save payroll.",
            "error"
        );

    } finally {

        payrollSaveInProgress = false;
    }
}


/* =========================================================
   LOAD PAYROLL
   ========================================================= */

async function loadPayroll() {

    const supabase =
        getEmployeeSupabaseClient();


    if (!supabase) {

        showMessage(
            "Supabase is not available.",
            "error"
        );

        return false;
    }


    if (!currentHotelId) {
        currentHotelId = getStoredHotelId();
    }


    if (!currentHotelId) {

        payrollRecords = [];

        renderPayroll();

        return false;
    }


    try {

        const result =
            await supabase
                .from("payroll_records")
                .select("*")
                .eq(
                    "hotel_id",
                    currentHotelId
                )
                .order(
                    "payroll_month",
                    {
                        ascending: false
                    }
                );


        if (result.error) {

            console.error(
                "Payroll load error:",
                result.error
            );

            showMessage(
                result.error.message ||
                "Unable to load payroll.",
                "error"
            );

            return false;
        }


        payrollRecords =
            result.data || [];


        renderPayroll();

        return true;


    } catch (error) {

        console.error(
            "loadPayroll:",
            error
        );

        showMessage(
            error.message ||
            "Unable to load payroll.",
            "error"
        );

        return false;
    }
}


/* =========================================================
   EMPLOYEE FOR PAYROLL
   ========================================================= */

function getEmployeeForPayroll(record) {

    return (
        employees.find(
            employee =>
                String(employee.id) ===
                String(record.employee_id)
        ) ||
        null
    );
}


/* =========================================================
   RENDER PAYROLL
   ========================================================= */

function renderPayroll() {

    const tbody =
        $("payrollTableBody");

    if (!tbody) {
        return;
    }


    tbody.innerHTML = "";


    const selectedMonth =
        normalizePayrollMonth(
            valueOf("payrollMonth")
        );


    const filtered =
        payrollRecords.filter(
            record =>
                normalizePayrollMonth(
                    record.payroll_month
                ) === selectedMonth
        );


    if (!filtered.length) {

        tbody.innerHTML = `
            <tr>
                <td colspan="8"
                    style="text-align:center;padding:20px;">
                    No payroll records for
                    ${escapeHtml(
                        formatPayrollMonth(
                            selectedMonth
                        )
                    )}.
                </td>
            </tr>
        `;

        return;
    }


    filtered.forEach(
        (record, index) => {

            const employee =
                getEmployeeForPayroll(record);


            const row =
                document.createElement("tr");


            row.innerHTML = `

                <td>${index + 1}</td>

                <td>
                    ${escapeHtml(
                        employee?.employee_number || "-"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        employee?.full_name || "-"
                    )}
                </td>

                <td>
                    KSh ${money(
                        record.gross_salary
                    )}
                </td>

                <td>
                    KSh ${money(
                        record.total_deductions
                    )}
                </td>

                <td>
                    KSh ${money(
                        record.basic_salary
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        record.payment_status ||
                        "Pending"
                    )}
                </td>

                <td>

                    <button
                        type="button"
                        class="btn btn-sm btn-primary"
                        data-action="edit-payroll"
                        data-id="${record.id}">
                        Edit
                    </button>

                    <button
                        type="button"
                        class="btn btn-sm btn-secondary"
                        data-action="view-payslip"
                        data-id="${record.id}">
                        Payslip
                    </button>

                    <button
                        type="button"
                        class="btn btn-sm btn-danger"
                        data-action="delete-payroll"
                        data-id="${record.id}">
                        Delete
                    </button>

                </td>

            `;


            tbody.appendChild(row);
        }
    );
}


/* =========================================================
   EDIT PAYROLL
   ========================================================= */

function editPayroll(id) {

    const record =
        payrollRecords.find(
            item =>
                String(item.id) ===
                String(id)
        );


    if (!record) {

        showMessage(
            "Payroll record not found.",
            "error"
        );

        return;
    }


    const modal =
        $("payrollModal");


    if (!modal) {

        showMessage(
            "Payroll modal was not found.",
            "error"
        );

        return;
    }


    const employee =
        getEmployeeForPayroll(record);


    editingPayrollId =
        record.id;


    populatePayrollEmployeeSelect();


    setValue(
        "payrollRecordId",
        record.id
    );


    setValue(
        "payrollEmployee",
        record.employee_id
    );


    setValue(
        "payrollFormMonth",
        normalizePayrollMonth(
            record.payroll_month
        ).substring(0, 7)
    );


    setValue(
        "payrollEmployeeNumber",
        employee?.employee_number || ""
    );


    setValue(
        "payrollGrossSalary",
        record.gross_salary
    );


    setValue(
        "payrollSha",
        record.sha ?? 0
    );


    setValue(
        "payrollNssf",
        record.nssf ?? 0
    );


    setValue(
        "payrollPaye",
        record.paye ?? 0
    );


    setValue(
        "payrollSalaryAdvance",
        record.salary_advance ?? 0
    );


    setValue(
        "payrollFines",
        record.fines ?? 0
    );


    setValue(
        "otherDeduction1Name",
        record.other_deduction_1_name ||
        getDeductionName(
            "other_deduction_1"
        )
    );


    setValue(
        "otherDeduction1",
        record.other_deduction_1 ?? 0
    );


    setValue(
        "otherDeduction2Name",
        record.other_deduction_2_name ||
        getDeductionName(
            "other_deduction_2"
        )
    );


    setValue(
        "otherDeduction2",
        record.other_deduction_2 ?? 0
    );


    setValue(
        "otherDeduction3Name",
        record.other_deduction_3_name ||
        getDeductionName(
            "other_deduction_3"
        )
    );


    setValue(
        "otherDeduction3",
        record.other_deduction_3 ?? 0
    );


    setValue(
        "payrollPaymentStatus",
        record.payment_status ||
        "Pending"
    );


    setValue(
        "payrollPaymentDate",
        record.payment_date || ""
    );


    setValue(
        "payrollNotes",
        record.notes || ""
    );


    calculatePayrollTotals();


    setText(
        "payrollModalTitle",
        "Edit Payroll"
    );


    modal.style.display = "flex";
    modal.classList.add("show");
}


/* =========================================================
   DELETE PAYROLL
   =========================================================

   IMPORTANT FIX:

   DELETE does not use .select("id").

   After DELETE, a separate SELECT verifies the
   payroll record is actually gone.
   ========================================================= */

async function deletePayroll(id) {

    const supabase =
        getEmployeeSupabaseClient();


    if (!supabase) {

        showMessage(
            "Supabase is not available.",
            "error"
        );

        return;
    }


    if (!currentHotelId) {
        currentHotelId = getStoredHotelId();
    }


    if (!currentHotelId) {

        showMessage(
            "Hotel could not be determined.",
            "error"
        );

        return;
    }


    const record =
        payrollRecords.find(
            item =>
                String(item.id) ===
                String(id)
        );


    const employee =
        record
            ? getEmployeeForPayroll(record)
            : null;


    const confirmed =
        window.confirm(
            record
                ? (
                    "Delete payroll for " +
                    (
                        employee?.full_name ||
                        "this employee"
                    ) +
                    " for " +
                    formatPayrollMonth(
                        record.payroll_month
                    ) +
                    "?"
                )
                : "Delete this payroll record?"
        );


    if (!confirmed) {
        return;
    }


    try {

        /* =====================================================
           DELETE WITHOUT .select()
           ===================================================== */

        const result =
            await supabase
                .from("payroll_records")
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

            console.error(
                "Payroll delete error:",
                result.error
            );

            showMessage(
                result.error.message ||
                "Payroll could not be deleted.",
                "error"
            );

            return;
        }


        /* =====================================================
           VERIFY
           ===================================================== */

        const verify =
            await supabase
                .from("payroll_records")
                .select("id")
                .eq(
                    "id",
                    id
                )
                .eq(
                    "hotel_id",
                    currentHotelId
                )
                .limit(1);


        if (verify.error) {

            console.error(
                "Payroll deletion verification error:",
                verify.error
            );

            showMessage(
                "Payroll deletion could not be verified.",
                "error"
            );

            return;
        }


        if (
            verify.data &&
            verify.data.length > 0
        ) {

            showMessage(
                "Payroll was NOT deleted. Your Supabase DELETE/RLS policy may be preventing the operation.",
                "error"
            );

            return;
        }


        showMessage(
            "Payroll deleted successfully.",
            "success"
        );


        await loadPayroll();


    } catch (error) {

        console.error(
            "deletePayroll:",
            error
        );

        showMessage(
            error.message ||
            "Unable to delete payroll.",
            "error"
        );
    }
}


/* =========================================================
   PAYSLIP
   ========================================================= */

function getPayslipNumber(record, employee) {

    const month =
        normalizePayrollMonth(
            record.payroll_month
        )
            .substring(0, 7)
            .replace("-", "");


    const employeeNumber =
        employee?.employee_number ||
        (
            "EMP-" +
            String(
                record.employee_id
            ).padStart(4, "0")
        );


    return (
        "PAY-" +
        month +
        "-" +
        employeeNumber
    );
}


/* =========================================================
   VIEW PAYSLIP
   ========================================================= */

function viewPayslip(id) {

    const record =
        payrollRecords.find(
            item =>
                String(item.id) ===
                String(id)
        );


    if (!record) {

        showMessage(
            "Payroll record not found.",
            "error"
        );

        return;
    }


    renderPayslip(record);


    const modal =
        $("payslipModal");


    if (modal) {

        modal.style.display = "flex";
        modal.classList.add("show");
    }
}


/* =========================================================
   RENDER PAYSLIP
   ========================================================= */

function renderPayslip(record) {

    const employee =
        getEmployeeForPayroll(record) || {};


    const hotelName =
        currentHotel?.hotel_name ||
        currentHotel?.name ||
        "EDU TECH HOTEL";


    const hotelLocation =
        currentHotel?.location ||
        currentHotel?.address ||
        "";


    const hotelPhone =
        currentHotel?.phone ||
        currentHotel?.phone_number ||
        "";


    const payslipNumber =
        getPayslipNumber(
            record,
            employee
        );


    setText(
        "payslipHotelName",
        hotelName
    );

    setText(
        "payslipHotelLocation",
        hotelLocation
    );

    setText(
        "payslipHotelPhone",
        hotelPhone
    );


    setText(
        "payslipMonth",
        formatPayrollMonth(
            record.payroll_month
        )
    );


    setText(
        "payslipEmployeeNumber",
        employee.employee_number || "-"
    );

    setText(
        "payslipEmployeeName",
        employee.full_name || "-"
    );

    setText(
        "payslipNationalId",
        employee.national_id || "-"
    );

    setText(
        "payslipPosition",
        employee.position || "-"
    );

    setText(
        "payslipDepartment",
        employee.department || "-"
    );

    setText(
        "payslipPaymentMethod",
        employee.payment_method || "-"
    );


    setText(
        "payslipGross",
        "KSh " +
        money(record.gross_salary)
    );


    setText(
        "payslipSha",
        "KSh " +
        money(record.sha)
    );


    setText(
        "payslipNssf",
        "KSh " +
        money(record.nssf)
    );


    setText(
        "payslipPaye",
        "KSh " +
        money(record.paye)
    );


    setText(
        "payslipAdvance",
        "KSh " +
        money(record.salary_advance)
    );


    setText(
        "payslipFines",
        "KSh " +
        money(record.fines)
    );


    setText(
        "payslipOther1Label",
        record.other_deduction_1_name ||
        "Other Deduction 1"
    );


    setText(
        "payslipOther1",
        "KSh " +
        money(record.other_deduction_1)
    );


    setText(
        "payslipOther2Label",
        record.other_deduction_2_name ||
        "Other Deduction 2"
    );


    setText(
        "payslipOther2",
        "KSh " +
        money(record.other_deduction_2)
    );


    setText(
        "payslipOther3Label",
        record.other_deduction_3_name ||
        "Other Deduction 3"
    );


    setText(
        "payslipOther3",
        "KSh " +
        money(record.other_deduction_3)
    );


    setText(
        "payslipTotalDeductions",
        "KSh " +
        money(record.total_deductions)
    );


    setText(
        "payslipNet",
        "KSh " +
        money(record.basic_salary)
    );


    setText(
        "payslipStatus",
        record.payment_status ||
        "Pending"
    );


    setText(
        "payslipPaymentDate",
        record.payment_date
            ? formatDate(record.payment_date)
            : "-"
    );


    setText(
        "payslipNotes",
        record.notes || "-"
    );


    const otherRows = [
        [
            "payslipOther1Row",
            record.other_deduction_1
        ],
        [
            "payslipOther2Row",
            record.other_deduction_2
        ],
        [
            "payslipOther3Row",
            record.other_deduction_3
        ]
    ];


    otherRows.forEach(
        ([id, amount]) => {

            const row = $(id);

            if (!row) {
                return;
            }

            row.style.display =
                safeNumber(amount) > 0
                    ? ""
                    : "none";
        }
    );


    const printArea =
        $("payslipPrintArea");


    if (printArea) {

        printArea.dataset.payslipNumber =
            payslipNumber;
    }
}


/* =========================================================
   CLOSE PAYSLIP
   ========================================================= */

function closePayslipModal() {

    const modal =
        $("payslipModal");

    if (!modal) {
        return;
    }

    modal.style.display = "none";
    modal.classList.remove("show");
}


/* =========================================================
   PRINT PAYSLIP
   ========================================================= */

function printPayslip() {

    const content =
        $("payslipPrintArea");


    if (!content) {

        showMessage(
            "Payslip print area was not found.",
            "error"
        );

        return;
    }


    const printWindow =
        window.open(
            "",
            "_blank",
            "width=900,height=900"
        );


    if (!printWindow) {

        showMessage(
            "Please allow pop-ups to print the payslip.",
            "error"
        );

        return;
    }


    printWindow.document.write(`
        <!DOCTYPE html>

        <html>

        <head>

            <title>Employee Payslip</title>

            <style>

                body {
                    margin:0;
                    padding:20px;
                    font-family:Arial,sans-serif;
                    background:#fff;
                }

                @media print {

                    body {
                        padding:0;
                    }
                }

            </style>

        </head>

        <body>

            ${content.outerHTML}

            <script>
                window.onload = function () {
                    window.print();
                };
            <\/script>

        </body>

        </html>
    `);


    printWindow.document.close();
}


/* =========================================================
   SAVE PAYSLIP PDF
   ========================================================= */

async function savePayslipPDF() {

    const content =
        $("payslipPrintArea");


    if (!content) {

        showMessage(
            "Payslip print area was not found.",
            "error"
        );

        return;
    }


    try {

        const jsPDFClass =
            window.jspdf?.jsPDF ||
            window.jsPDF;


        if (!jsPDFClass) {

            showMessage(
                "PDF library is not available. Use Print and choose Save as PDF.",
                "error"
            );

            return;
        }


        const pdf =
            new jsPDFClass(
                "p",
                "mm",
                "a4"
            );


        const lines =
            content.innerText
                .split("\n")
                .map(
                    line =>
                        line.trim()
                )
                .filter(
                    line =>
                        line !== ""
                );


        let y = 15;


        pdf.setFontSize(16);

        pdf.text(
            "EMPLOYEE PAYSLIP",
            105,
            y,
            {
                align: "center"
            }
        );


        y += 10;

        pdf.setFontSize(10);


        for (const line of lines) {

            const wrapped =
                pdf.splitTextToSize(
                    line,
                    180
                );


            for (const wrappedLine of wrapped) {

                if (y > 280) {

                    pdf.addPage();

                    y = 15;
                }


                pdf.text(
                    wrappedLine,
                    15,
                    y
                );

                y += 5;
            }
        }


        pdf.save(
            "employee-payslip.pdf"
        );


        showMessage(
            "Payslip PDF saved successfully.",
            "success"
        );


    } catch (error) {

        console.error(
            "Payslip PDF:",
            error
        );

        showMessage(
            "Unable to create PDF. Use Print and choose Save as PDF.",
            "error"
        );
    }
}


/* =========================================================
   PRINT EMPLOYEES
   ========================================================= */

function printEmployees() {

    const tbody =
        $("employeeTableBody");


    if (!tbody) {

        showMessage(
            "Employee table not found.",
            "error"
        );

        return;
    }


    const table =
        tbody.closest("table");


    if (!table) {

        showMessage(
            "Employee table not found.",
            "error"
        );

        return;
    }


    const cloned =
        table.cloneNode(true);


    cloned
        .querySelectorAll("button")
        .forEach(
            button =>
                button.remove()
        );


    const printWindow =
        window.open(
            "",
            "_blank",
            "width=1200,height=900"
        );


    if (!printWindow) {

        showMessage(
            "Please allow pop-ups to print.",
            "error"
        );

        return;
    }


    printWindow.document.write(`
        <!DOCTYPE html>

        <html>

        <head>

            <title>Employee Report</title>

            <style>

                body {
                    font-family:Arial,sans-serif;
                    padding:25px;
                }

                h1,
                h2 {
                    text-align:center;
                }

                table {
                    width:100%;
                    border-collapse:collapse;
                    margin-top:20px;
                }

                th,
                td {
                    border:1px solid #ccc;
                    padding:8px;
                    text-align:left;
                }

                @media print {

                    body {
                        padding:0;
                    }
                }

            </style>

        </head>

        <body>

            <h1>
                ${escapeHtml(
                    currentHotel?.hotel_name ||
                    currentHotel?.name ||
                    "Hotel"
                )}
            </h1>

            <h2>
                Employee Report
            </h2>

            ${cloned.outerHTML}

            <script>
                window.onload = function () {
                    window.print();
                };
            <\/script>

        </body>

        </html>
    `);


    printWindow.document.close();
}


/* =========================================================
   EMPLOYEE PDF
   ========================================================= */

async function saveEmployeeReportPDF() {

    try {

        const jsPDFClass =
            window.jspdf?.jsPDF ||
            window.jsPDF;


        if (!jsPDFClass) {

            showMessage(
                "PDF library is not available.",
                "error"
            );

            return;
        }


        const pdf =
            new jsPDFClass(
                "l",
                "mm",
                "a4"
            );


        const hotelName =
            currentHotel?.hotel_name ||
            currentHotel?.name ||
            "Hotel";


        pdf.setFontSize(18);

        pdf.text(
            hotelName,
            148,
            15,
            {
                align: "center"
            }
        );


        pdf.setFontSize(13);

        pdf.text(
            "EMPLOYEE REPORT",
            148,
            23,
            {
                align: "center"
            }
        );


        const headers = [
            "#",
            "Employee No.",
            "Name",
            "National ID",
            "Phone",
            "Email",
            "Position",
            "Department",
            "Salary",
            "Status"
        ];


        const x = [
            8,
            15,
            42,
            82,
            107,
            132,
            165,
            195,
            235,
            265
        ];


        let y = 35;


        pdf.setFontSize(8);


        headers.forEach(
            (
                header,
                index
            ) => {

                pdf.text(
                    header,
                    x[index],
                    y
                );
            }
        );


        y += 7;


        employees.forEach(
            (
                employee,
                index
            ) => {

                if (y > 195) {

                    pdf.addPage();

                    y = 20;
                }


                const values = [

                    String(index + 1),

                    employee.employee_number || "-",

                    employee.full_name || "-",

                    employee.national_id || "-",

                    employee.phone || "-",

                    employee.email || "-",

                    employee.position || "-",

                    employee.department || "-",

                    "KSh " +
                    money(employee.salary),

                    employee.status || "-"
                ];


                values.forEach(
                    (
                        value,
                        columnIndex
                    ) => {

                        const width =
                            columnIndex === 2
                                ? 35
                                : 25;


                        const wrapped =
                            pdf.splitTextToSize(
                                String(value),
                                width
                            );


                        pdf.text(
                            wrapped[0],
                            x[columnIndex],
                            y
                        );
                    }
                );


                y += 6;
            }
        );


        pdf.save(
            "employee-report.pdf"
        );


        showMessage(
            "Employee report PDF saved successfully.",
            "success"
        );


    } catch (error) {

        console.error(
            "Employee PDF:",
            error
        );

        showMessage(
            "Unable to create employee PDF.",
            "error"
        );
    }
}


/* =========================================================
   BUTTON HANDLERS
   ========================================================= */

function setupStaticButtons() {

    const addEmployeeButton =
        $("newEmployeeButton");

    if (addEmployeeButton) {

        addEmployeeButton.addEventListener(
            "click",
            function(event) {

                event.preventDefault();

                openEmployeeModal();
            }
        );
    }


    const printEmployeesButton =
        $("printEmployeesButton");

    if (printEmployeesButton) {

        printEmployeesButton.addEventListener(
            "click",
            function(event) {

                event.preventDefault();

                printEmployees();
            }
        );
    }


    const employeePdfButton =
        $("downloadEmployeePDFButton");

    if (employeePdfButton) {

        employeePdfButton.addEventListener(
            "click",
            function(event) {

                event.preventDefault();

                saveEmployeeReportPDF();
            }
        );
    }


    const closeEmployeeButton =
        $("closeEmployeeButton");

    if (closeEmployeeButton) {

        closeEmployeeButton.addEventListener(
            "click",
            function(event) {

                event.preventDefault();

                closeEmployeeModal();
            }
        );
    }


    const cancelEmployeeButton =
        $("cancelEmployeeButton");

    if (cancelEmployeeButton) {

        cancelEmployeeButton.addEventListener(
            "click",
            function(event) {

                event.preventDefault();

                closeEmployeeModal();
            }
        );
    }


    const loadPayrollButton =
        $("loadPayrollButton");

    if (loadPayrollButton) {

        loadPayrollButton.addEventListener(
            "click",
            async function(event) {

                event.preventDefault();

                await loadPayroll();
            }
        );
    }


    const newPayrollButton =
        $("newPayrollButton");

    if (newPayrollButton) {

        newPayrollButton.addEventListener(
            "click",
            function(event) {

                event.preventDefault();

                openNewPayrollModal();
            }
        );
    }


    const closePayrollButton =
        $("closePayrollButton");

    if (closePayrollButton) {

        closePayrollButton.addEventListener(
            "click",
            function(event) {

                event.preventDefault();

                closePayrollModal();
            }
        );
    }


    const cancelPayrollButton =
        $("cancelPayrollButton");

    if (cancelPayrollButton) {

        cancelPayrollButton.addEventListener(
            "click",
            function(event) {

                event.preventDefault();

                closePayrollModal();
            }
        );
    }


    const printPayslipButton =
        $("printPayslipButton");

    if (printPayslipButton) {

        printPayslipButton.addEventListener(
            "click",
            function(event) {

                event.preventDefault();

                printPayslip();
            }
        );
    }


    const downloadPayslipPDFButton =
        $("downloadPayslipPDFButton");

    if (downloadPayslipPDFButton) {

        downloadPayslipPDFButton.addEventListener(
            "click",
            function(event) {

                event.preventDefault();

                savePayslipPDF();
            }
        );
    }


    const closePayslipButton =
        $("closePayslipButton");

    if (closePayslipButton) {

        closePayslipButton.addEventListener(
            "click",
            function(event) {

                event.preventDefault();

                closePayslipModal();
            }
        );
    }


    const closePayslipButton2 =
        $("closePayslipButton2");

    if (closePayslipButton2) {

        closePayslipButton2.addEventListener(
            "click",
            function(event) {

                event.preventDefault();

                closePayslipModal();
            }
        );
    }


    const saveEmployeeButton =
        $("saveEmployeeButton");

    if (saveEmployeeButton) {

        saveEmployeeButton.addEventListener(
            "click",
            async function(event) {

                event.preventDefault();

                await saveEmployee();
            }
        );
    }


    const savePayrollButton =
        $("savePayrollButton");

    if (savePayrollButton) {

        savePayrollButton.addEventListener(
            "click",
            async function(event) {

                event.preventDefault();

                await savePayroll();
            }
        );
    }
}


/* =========================================================
   FORM EVENTS
   ========================================================= */

function setupForms() {

    const employeeForm =
        $("employeeForm");

    if (employeeForm) {

        employeeForm.addEventListener(
            "submit",
            async function(event) {

                event.preventDefault();

                await saveEmployee();
            }
        );
    }


    const payrollForm =
        $("payrollForm");

    if (payrollForm) {

        payrollForm.addEventListener(
            "submit",
            async function(event) {

                event.preventDefault();

                await savePayroll();
            }
        );
    }
}


/* =========================================================
   INPUT / CHANGE EVENTS
   ========================================================= */

function setupInputEvents() {

    const payrollEmployee =
        $("payrollEmployee");

    if (payrollEmployee) {

        payrollEmployee.addEventListener(
            "change",
            handlePayrollEmployeeChange
        );
    }


    const payrollMonth =
        $("payrollMonth");

    if (payrollMonth) {

        payrollMonth.addEventListener(
            "change",
            function() {

                renderPayroll();
            }
        );
    }


    const employeeSearch =
        $("employeeSearch");

    if (employeeSearch) {

        employeeSearch.addEventListener(
            "input",
            function() {

                renderEmployees();
            }
        );
    }


    const employeeFilter =
        $("employeeFilter");

    if (employeeFilter) {

        employeeFilter.addEventListener(
            "change",
            function() {

                renderEmployees();
            }
        );
    }


    const payrollInputs = [
        "payrollGrossSalary",
        "payrollSha",
        "payrollNssf",
        "payrollPaye",
        "payrollSalaryAdvance",
        "payrollFines",
        "otherDeduction1",
        "otherDeduction2",
        "otherDeduction3"
    ];


    payrollInputs.forEach(
        id => {

            const element = $(id);

            if (!element) {
                return;
            }

            element.addEventListener(
                "input",
                calculatePayrollTotals
            );

            element.addEventListener(
                "change",
                calculatePayrollTotals
            );
        }
    );
}


/* =========================================================
   DYNAMIC EMPLOYEE/PAYROLL BUTTONS
   ========================================================= */

function setupDynamicTableButtons() {

    const employeeTableBody =
        $("employeeTableBody");


    if (employeeTableBody) {

        employeeTableBody.addEventListener(
            "click",
            async function(event) {

                const button =
                    event.target.closest(
                        "button[data-action]"
                    );


                if (!button) {
                    return;
                }


                const action =
                    button.dataset.action;


                const id =
                    button.dataset.id;


                if (
                    action ===
                    "edit-employee"
                ) {

                    editEmployee(id);

                    return;
                }


                if (
                    action ===
                    "delete-employee"
                ) {

                    await deleteEmployee(id);

                    return;
                }


                if (
                    action ===
                    "permanent-delete-employee"
                ) {

                    await permanentlyDeleteEmployee(id);

                    return;
                }
            }
        );
    }


    const payrollTableBody =
        $("payrollTableBody");


    if (payrollTableBody) {

        payrollTableBody.addEventListener(
            "click",
            async function(event) {

                const button =
                    event.target.closest(
                        "button[data-action]"
                    );


                if (!button) {
                    return;
                }


                const action =
                    button.dataset.action;


                const id =
                    button.dataset.id;


                if (
                    action ===
                    "edit-payroll"
                ) {

                    editPayroll(id);

                    return;
                }


                if (
                    action ===
                    "view-payslip"
                ) {

                    viewPayslip(id);

                    return;
                }


                if (
                    action ===
                    "delete-payroll"
                ) {

                    await deletePayroll(id);

                    return;
                }
            }
        );
    }
}


/* =========================================================
   MODAL OUTSIDE CLICK
   ========================================================= */

function setupModalOutsideClick() {

    const employeeModal =
        $("employeeModal");

    if (employeeModal) {

        employeeModal.addEventListener(
            "click",
            function(event) {

                if (
                    event.target ===
                    employeeModal
                ) {

                    closeEmployeeModal();
                }
            }
        );
    }


    const payrollModal =
        $("payrollModal");

    if (payrollModal) {

        payrollModal.addEventListener(
            "click",
            function(event) {

                if (
                    event.target ===
                    payrollModal
                ) {

                    closePayrollModal();
                }
            }
        );
    }


    const payslipModal =
        $("payslipModal");

    if (payslipModal) {

        payslipModal.addEventListener(
            "click",
            function(event) {

                if (
                    event.target ===
                    payslipModal
                ) {

                    closePayslipModal();
                }
            }
        );
    }
}


/* =========================================================
   INITIALIZE
   ========================================================= */

async function initEmployeesModule() {

    if (employeesModuleInitialized) {
        return;
    }


    employeesModuleInitialized = true;


    /*
       Install buttons FIRST.
       This means the UI remains responsive even
       while Supabase is loading.
    */

    setupStaticButtons();

    setupForms();

    setupInputEvents();

    setupDynamicTableButtons();

    setupModalOutsideClick();


    try {

        const resolved =
            await resolveCurrentUser();


        if (!resolved) {

            renderEmployees();
            updateEmployeeStatistics();
            populatePayrollEmployeeSelect();
            renderPayroll();

            return;
        }


        await loadDeductionSettings();

        await loadEmployees();

        await loadPayroll();

        updateEmployeeHeader();

        calculatePayrollTotals();


    } catch (error) {

        console.error(
            "Employees module initialization:",
            error
        );

        showMessage(
            error.message ||
            "Employees module initialization failed.",
            "error"
        );
    }
}


/* =========================================================
   PUBLIC API
   ========================================================= */

window.openEmployeeModal =
    openEmployeeModal;

window.closeEmployeeModal =
    closeEmployeeModal;

window.saveEmployee =
    saveEmployee;

window.editEmployee =
    editEmployee;

window.deleteEmployee =
    deleteEmployee;

window.permanentlyDeleteEmployee =
    permanentlyDeleteEmployee;


window.openNewPayrollModal =
    openNewPayrollModal;

window.closePayrollModal =
    closePayrollModal;

window.savePayroll =
    savePayroll;

window.editPayroll =
    editPayroll;

window.deletePayroll =
    deletePayroll;


window.viewPayslip =
    viewPayslip;

window.closePayslipModal =
    closePayslipModal;

window.printPayslip =
    printPayslip;

window.savePayslipPDF =
    savePayslipPDF;


window.printEmployees =
    printEmployees;

window.saveEmployeeReportPDF =
    saveEmployeeReportPDF;


window.loadEmployees =
    loadEmployees;

window.loadPayroll =
    loadPayroll;

window.calculatePayrollTotals =
    calculatePayrollTotals;


/* =========================================================
   START
   ========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initEmployeesModule,
        {
            once: true
        }
    );

} else {

    initEmployeesModule();
}


/* =========================================================
   END
   ========================================================= */