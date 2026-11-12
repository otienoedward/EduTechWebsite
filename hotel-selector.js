document.addEventListener("DOMContentLoaded", async function () {

    const db = window.supabaseClient;

    if (!db) {
        console.error("Supabase client is not available.");
        return;
    }

    try {

        // Get logged-in user
        const {
            data: userData,
            error: userError
        } = await db.auth.getUser();

        if (userError || !userData?.user) {
            console.log("No logged-in user.");
            return;
        }

        const userId = userData.user.id;

        // Get user profile
        const {
            data: profile,
            error: profileError
        } = await db
            .from("profiles")
            .select("id, full_name, role, hotel_id")
            .eq("id", userId)
            .maybeSingle();

        if (profileError) {
            console.error("Profile error:", profileError);
            return;
        }

        if (!profile) {
            console.error("User profile not found.");
            return;
        }

        const role = String(profile.role || "")
            .trim()
            .toLowerCase()
            .replace(/[\s-]+/g, "_");

        // Only System Owner gets the hotel selector
        if (role !== "system_owner") {
            return;
        }

        // Find the System Owner dashboard heading
        const headings = Array.from(
            document.querySelectorAll("h1, h2, h3, h4, h5, h6")
        );

        let dashboardHeading = headings.find(function (heading) {
            return heading.textContent
                .toLowerCase()
                .includes("system owner dashboard");
        });

        if (!dashboardHeading) {
            dashboardHeading = headings.find(function (heading) {
                return heading.textContent
                    .toLowerCase()
                    .includes("dashboard");
            });
        }

        if (!dashboardHeading) {
            console.warn("Dashboard heading not found.");
            return;
        }

        // Prevent duplicate selector
        if (document.getElementById("systemOwnerHotelSelector")) {
            return;
        }

        // Create selector container
        const container = document.createElement("div");

        container.id = "systemOwnerHotelSelector";

        container.style.margin = "20px 0";
        container.style.padding = "18px";
        container.style.border = "1px solid #ddd";
        container.style.borderRadius = "10px";
        container.style.background = "#ffffff";
        container.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)";

        container.innerHTML = `
            <div style="
                font-size:18px;
                font-weight:700;
                margin-bottom:10px;
            ">
                Select a Hotel to Manage
            </div>

            <div style="
                font-size:14px;
                color:#666;
                margin-bottom:10px;
            ">
                System Owner can select any active hotel without changing
                the System Owner role.
            </div>

            <select
                id="systemOwnerHotelSelect"
                style="
                    width:100%;
                    max-width:500px;
                    padding:11px;
                    border:1px solid #ccc;
                    border-radius:6px;
                    font-size:15px;
                    background:#fff;
                    cursor:pointer;
                "
            >
                <option value="">
                    No hotel selected
                </option>
            </select>

            <div
                id="selectedHotelMessage"
                style="
                    margin-top:10px;
                    font-size:14px;
                    font-weight:600;
                "
            ></div>
        `;

        // Put selector immediately after dashboard heading
        dashboardHeading.insertAdjacentElement(
            "afterend",
            container
        );

        const select =
            document.getElementById(
                "systemOwnerHotelSelect"
            );

        const message =
            document.getElementById(
                "selectedHotelMessage"
            );

        // Load active hotels
        const {
            data: hotels,
            error: hotelsError
        } = await db
            .from("hotels")
            .select(`
                id,
                hotel_name,
                location,
                status
            `)
            .eq("status", "active")
            .order("id");

        if (hotelsError) {
            console.error(
                "Could not load hotels:",
                hotelsError
            );

            message.textContent =
                "Unable to load hotels.";

            message.style.color = "red";

            return;
        }

        if (!hotels || hotels.length === 0) {

            message.textContent =
                "No active hotels found.";

            message.style.color = "red";

            return;
        }

        // Add hotels to selector
        hotels.forEach(function (hotel) {

            const option =
                document.createElement("option");

            option.value = hotel.id;

            option.textContent =
                `${hotel.hotel_name} — ${hotel.location}`;

            select.appendChild(option);

        });

        // Restore previously selected hotel
        const savedHotelId =
            sessionStorage.getItem(
                "activeHotelId"
            );

        if (savedHotelId) {

            const exists =
                hotels.some(function (hotel) {
                    return String(hotel.id) ===
                        String(savedHotelId);
                });

            if (exists) {

                select.value =
                    String(savedHotelId);

                const savedHotel =
                    hotels.find(function (hotel) {
                        return String(hotel.id) ===
                            String(savedHotelId);
                    });

                if (savedHotel) {

                    message.textContent =
                        `Currently managing: ${savedHotel.hotel_name}`;

                    message.style.color = "green";

                }
            }
        }

        // Hotel selection
        select.addEventListener(
            "change",
            async function () {

                const hotelId =
                    this.value;

                if (!hotelId) {

                    sessionStorage.removeItem(
                        "activeHotelId"
                    );

                    sessionStorage.removeItem(
                        "activeHotelName"
                    );

                    sessionStorage.removeItem(
                        "hotelId"
                    );

                    sessionStorage.removeItem(
                        "hotelName"
                    );

                    message.textContent =
                        "No hotel selected.";

                    message.style.color =
                        "#666";

                    return;
                }

                const selectedHotel =
                    hotels.find(function (hotel) {
                        return String(hotel.id) ===
                            String(hotelId);
                    });

                if (!selectedHotel) {
                    return;
                }

                // Save active hotel
                sessionStorage.setItem(
                    "activeHotelId",
                    String(selectedHotel.id)
                );

                sessionStorage.setItem(
                    "activeHotelName",
                    selectedHotel.hotel_name
                );

                // Also maintain compatibility
                // with existing dashboard modules
                sessionStorage.setItem(
                    "hotelId",
                    String(selectedHotel.id)
                );

                sessionStorage.setItem(
                    "hotelName",
                    selectedHotel.hotel_name
                );

                message.textContent =
                    `Managing: ${selectedHotel.hotel_name}`;

                message.style.color =
                    "green";

                /*
                 * Reload the dashboard so all existing
                 * dashboard functions use the selected
                 * hotel.
                 */
                setTimeout(function () {
                    window.location.reload();
                }, 500);

            }
        );

    } catch (error) {

        console.error(
            "Hotel selector error:",
            error
        );

    }

});