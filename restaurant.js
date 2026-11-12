/* EDU TECH HOTEL MANAGEMENT SYSTEM - RESTAURANT MODULE */
"use strict";

(() => {
  let db = null;
  let hotel = null;
  let menu = [];
  let orders = [];
  let guests = [];
  let rooms = [];
  let editingMenuId = null;
  let editingOrderId = null;

  const $ = id => document.getElementById(id);

  const num = v =>
    Number.isFinite(Number(v))
      ? Number(v)
      : 0;

  const money = v =>
    new Intl.NumberFormat("en-KE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num(v));

  const esc = v =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  function errorText(e) {
    return (
      e?.message ||
      e?.details ||
      e?.hint ||
      String(e || "Unknown error")
    );
  }

  function message(text, type = "info") {
    let box = $("restaurantMessage");

    if (!box) {
      box = document.createElement("div");

      box.id = "restaurantMessage";

      Object.assign(
        box.style,
        {
          position: "fixed",
          top: "20px",
          right: "20px",
          zIndex: "99999",
          maxWidth: "430px",
          padding: "14px 18px",
          borderRadius: "8px",
          fontWeight: "600",
          boxShadow: "0 8px 25px rgba(0,0,0,.2)"
        }
      );

      document.body.appendChild(box);
    }

    box.textContent = text;

    box.style.background =
      type === "success"
        ? "#198754"
        : type === "error"
        ? "#dc3545"
        : type === "warning"
        ? "#ffc107"
        : "#0d6efd";

    box.style.color =
      type === "warning"
        ? "#000"
        : "#fff";

    clearTimeout(box._timer);

    box._timer = setTimeout(
      () => box.remove(),
      5000
    );
  }

  function getDb() {
    if (window.supabaseClient) {
      return window.supabaseClient;
    }

    throw new Error(
      "Supabase client is not available. Check supabase.js."
    );
  }

  function stored(...keys) {
    for (const key of keys) {
      const s =
        sessionStorage.getItem(key);

      if (s) {
        return s;
      }

      const l =
        localStorage.getItem(key);

      if (l) {
        return l;
      }
    }

    return null;
  }

  async function currentHotel() {

    const storedId =
      Number(
        stored(
          "hotelId",
          "hotel_id"
        )
      );

    if (storedId) {

      const r =
        await db
          .from("hotels")
          .select("*")
          .eq("id", storedId)
          .maybeSingle();

      if (r.error) {
        throw new Error(
          "Unable to load hotel: " +
          r.error.message
        );
      }

      if (r.data) {
        hotel = r.data;
        return hotel;
      }
    }

    const user =
      (
        await db.auth.getUser()
      ).data?.user;

    if (!user) {
      throw new Error(
        "No authenticated user was found."
      );
    }

    const p =
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

    if (p.error) {
      throw new Error(
        "Unable to load profile: " +
        p.error.message
      );
    }

    if (!p.data) {
      throw new Error(
        "User profile was not found."
      );
    }

    if (p.data.is_active === false) {
      throw new Error(
        "Your user account is inactive."
      );
    }

    if (!p.data.hotel_id) {
      throw new Error(
        "No hotel is assigned to this user."
      );
    }

    const h =
      await db
        .from("hotels")
        .select("*")
        .eq(
          "id",
          p.data.hotel_id
        )
        .maybeSingle();

    if (h.error) {
      throw new Error(
        "Unable to load hotel: " +
        h.error.message
      );
    }

    if (!h.data) {
      throw new Error(
        "Assigned hotel was not found."
      );
    }

    hotel = h.data;

    return hotel;
  }

  function hotelName() {
    return (
      hotel?.hotel_name ||
      hotel?.name ||
      "Hotel"
    );
  }

  function displayHotel() {

    [
      "hotelName",
      "currentHotelName",
      "hotel_name",
      "restaurantHotelName"
    ].forEach(
      id => {
        if ($(id)) {
          $(id).textContent =
            hotelName();
        }
      }
    );
  }

  /* =========================================================
     MENU
  ========================================================= */

  async function loadMenu() {

    const r =
      await db
        .from("restaurant_menu")
        .select(
          "id,created_at,item_name,category,description,unit_price,status,hotel_id"
        )
        .eq(
          "hotel_id",
          hotel.id
        )
        .order(
          "id",
          {
            ascending: false
          }
        );

    if (r.error) {
      throw new Error(
        "Unable to load menu: " +
        r.error.message
      );
    }

    menu =
      r.data || [];

    renderMenu();

    populateMenuSelect();

    updateSummary();
  }

  function menuIsActive(item) {
    return (
      item?.status === "available" ||
      item?.status === "active"
    );
  }

  function renderMenu() {

    const body =
      $("menuTableBody");

    if (!body) {
      return;
    }

    const q =
      (
        $("menuSearch")?.value ||
        ""
      )
        .trim()
        .toLowerCase();

    const rows =
      menu.filter(
        x =>
          !q ||
          [
            x.item_name,
            x.category,
            x.description,
            x.status
          ]
            .join(" ")
            .toLowerCase()
            .includes(q)
      );

    if (!rows.length) {

      body.innerHTML = `
        <tr>
          <td
            colspan="7"
            style="text-align:center;padding:25px"
          >
            No menu items found.
          </td>
        </tr>
      `;

      return;
    }

    body.innerHTML =
      rows
        .map(
          x => `
            <tr>

              <td>
                ${esc(x.item_name)}
              </td>

              <td>
                ${esc(x.category)}
              </td>

              <td>
                ${esc(x.description || "")}
              </td>

              <td>
                KSh ${money(x.unit_price)}
              </td>

              <td>
                ${
                  menuIsActive(x)
                    ? "Active"
                    : "Inactive"
                }
              </td>

              <td>
                ${
                  x.created_at
                    ? new Date(
                        x.created_at
                      ).toLocaleDateString(
                        "en-KE"
                      )
                    : ""
                }
              </td>

              <td>

                <button
                  type="button"
                  data-menu-edit="${x.id}"
                >
                  Edit
                </button>

                <button
                  type="button"
                  data-menu-delete="${x.id}"
                >
                  Delete
                </button>

              </td>

            </tr>
          `
        )
        .join("");
  }

  function openMenu(item = null) {

    editingMenuId =
      item
        ? Number(item.id)
        : null;

    if ($("menuId")) {
      $("menuId").value =
        item?.id || "";
    }

    if ($("menuItemName")) {
      $("menuItemName").value =
        item?.item_name || "";
    }

    if ($("menuCategory")) {
      $("menuCategory").value =
        item?.category || "";
    }

    if ($("menuUnitPrice")) {
      $("menuUnitPrice").value =
        item?.unit_price ?? "";
    }

    if ($("menuStatus")) {
      $("menuStatus").value =
        item &&
        (
          item.status === "unavailable" ||
          item.status === "inactive"
        )
          ? "inactive"
          : "active";
    }

    if ($("menuDescription")) {
      $("menuDescription").value =
        item?.description || "";
    }

    if ($("menuModal")) {
      $("menuModal").style.display =
        "flex";
    }
  }

  function closeMenu() {

    if ($("menuModal")) {
      $("menuModal").style.display =
        "none";
    }

    editingMenuId = null;
  }

  async function saveMenu(e) {

    e?.preventDefault();

    const button =
      e?.submitter;

    const wasEditing =
      Boolean(editingMenuId);

    try {

      const item_name =
        $("menuItemName")
          ?.value
          .trim();

      const category =
        $("menuCategory")
          ?.value
          .trim();

      const description =
        $("menuDescription")
          ?.value
          .trim() || null;

      const unit_price =
        num(
          $("menuUnitPrice")
            ?.value
        );

      /*
       * HTML uses:
       * active / inactive
       *
       * Database uses:
       * available / unavailable
       */

      const status =
        $("menuStatus")
          ?.value === "inactive"
          ? "unavailable"
          : "available";

      if (!item_name) {
        throw new Error(
          "Please enter the menu item name."
        );
      }

      if (!category) {
        throw new Error(
          "Please enter the menu category."
        );
      }

      if (unit_price < 0) {
        throw new Error(
          "Unit price cannot be negative."
        );
      }

      if (button) {

        button.disabled = true;

        button.dataset.old =
          button.textContent;

        button.textContent =
          wasEditing
            ? "Updating..."
            : "Saving...";
      }

      const payload = {
        item_name,
        category,
        description,
        unit_price,
        status,
        hotel_id: hotel.id
      };

      const r =
        wasEditing
          ? await db
              .from("restaurant_menu")
              .update(payload)
              .eq(
                "id",
                editingMenuId
              )
              .eq(
                "hotel_id",
                hotel.id
              )
              .select("*")
              .single()

          : await db
              .from("restaurant_menu")
              .insert(payload)
              .select("*")
              .single();

      if (r.error) {
        throw new Error(
          "Unable to save menu item: " +
          r.error.message
        );
      }

      closeMenu();

      await loadMenu();

      message(
        wasEditing
          ? "Menu item updated successfully."
          : "Menu item saved successfully.",
        "success"
      );

    } catch (e2) {

      message(
        errorText(e2),
        "error"
      );

    } finally {

      if (button) {

        button.disabled = false;

        button.textContent =
          button.dataset.old ||
          button.textContent;

        delete button.dataset.old;
      }
    }
  }

  async function deleteMenu(id) {

    const item =
      menu.find(
        x =>
          Number(x.id) ===
          Number(id)
      );

    if (!item) {
      return;
    }

    if (
      !confirm(
        `Delete "${item.item_name}" from the menu?`
      )
    ) {
      return;
    }

    const r =
      await db
        .from("restaurant_menu")
        .delete()
        .eq(
          "id",
          id
        )
        .eq(
          "hotel_id",
          hotel.id
        );

    if (r.error) {

      message(
        "Unable to delete menu item: " +
        r.error.message,
        "error"
      );

      return;
    }

    await loadMenu();

    message(
      "Menu item deleted successfully.",
      "success"
    );
  }

  /* =========================================================
     GUESTS
  ========================================================= */

  async function loadGuests() {

    const r =
      await db
        .from("guests")
        .select(
          'id,"full name",phone,email,status,hotel_id'
        )
        .eq(
          "hotel_id",
          hotel.id
        )
        .order(
          "id",
          {
            ascending: false
          }
        );

    if (r.error) {
      guests = [];
      return;
    }

    guests =
      r.data || [];

    populateGuests();
  }

  function guestName(g) {

    return (
      g?.["full name"] ||
      `Guest #${g?.id || ""}`
    );
  }

  function populateGuests() {

    const s =
      $("orderGuest");

    if (!s) {
      return;
    }

    const old =
      s.value;

    s.innerHTML =
      '<option value="">Select guest</option>';

    guests.forEach(
      g => {

        const o =
          document.createElement(
            "option"
          );

        o.value =
          g.id;

        o.textContent =
          guestName(g);

        s.appendChild(o);
      }
    );

    s.value =
      old;
  }

  /* =========================================================
     ROOMS
  ========================================================= */

  async function loadRooms() {

    const r =
      await db
        .from("rooms")
        .select(
          "id,room_number,room_type,price,status,guest_id,hotel_id"
        )
        .eq(
          "hotel_id",
          hotel.id
        )
        .order(
          "room_number",
          {
            ascending: true
          }
        );

    if (r.error) {
      rooms = [];
      return;
    }

    rooms =
      r.data || [];

    populateRooms();
  }

  function populateRooms() {

    const s =
      $("orderRoom");

    if (!s) {
      return;
    }

    const old =
      s.value;

    s.innerHTML =
      '<option value="">Select room</option>';

    rooms.forEach(
      r => {

        const o =
          document.createElement(
            "option"
          );

        o.value =
          r.id;

        o.textContent =
          `${r.room_number}${
            r.room_type
              ? " - " +
                r.room_type
              : ""
          }`;

        s.appendChild(o);
      }
    );

    s.value =
      old;
  }

  /* =========================================================
     MENU SELECT FOR ORDERS
  ========================================================= */

  function populateMenuSelect() {

    const s =
      $("orderMenuItem");

    if (!s) {
      return;
    }

    const old =
      s.value;

    s.innerHTML =
      '<option value="">Select menu item</option>';

    menu
      .filter(
        x =>
          x.status === "available" ||
          x.status === "active"
      )
      .forEach(
        x => {

          const o =
            document.createElement(
              "option"
            );

          o.value =
            x.id;

          o.dataset.price =
            x.unit_price;

          o.textContent =
            `${x.item_name} - KSh ${money(
              x.unit_price
            )}`;

          s.appendChild(o);
        }
      );

    s.value =
      old;

    updateOrderTotal();
  }

  function updateOrderTotal() {

    const s =
      $("orderMenuItem");

    const q =
      num(
        $("orderQuantity")
          ?.value || 1
      );

    const o =
      s?.options[
        s.selectedIndex
      ];

    const p =
      num(
        o?.dataset.price ||
        $("orderUnitPrice")
          ?.value
      );

    if ($("orderUnitPrice")) {

      $("orderUnitPrice").value =
        p || "";
    }

    if ($("orderTotalPreview")) {

      $("orderTotalPreview")
        .textContent =
        `KSh ${money(
          p * q
        )}`;
    }
  }

  /* =========================================================
     ORDERS
  ========================================================= */

  async function loadOrders() {

    const r =
      await db
        .from("restaurant_orders")
        .select(
          "id,created_at,item_name,quantity,unit_price,total,status,order_date,notes,hotel_id,reservation_id,guest_id,room_id"
        )
        .eq(
          "hotel_id",
          hotel.id
        )
        .order(
          "id",
          {
            ascending: false
          }
        );

    if (r.error) {

      throw new Error(
        "Unable to load restaurant orders: " +
        r.error.message
      );
    }

    orders =
      r.data || [];

    renderOrders();

    updateSummary();
  }

  function renderOrders() {

    const body =
      $("ordersTableBody");

    if (!body) {
      return;
    }

    const q =
      (
        $("orderSearch")
          ?.value || ""
      )
        .trim()
        .toLowerCase();

    const rows =
      orders.filter(
        x =>
          !q ||
          [
            x.id,
            x.item_name,
            x.status,
            x.notes,
            guestName(
              guests.find(
                g =>
                  Number(g.id) ===
                  Number(x.guest_id)
              )
            ),
            rooms.find(
              r =>
                Number(r.id) ===
                Number(x.room_id)
            )?.room_number
          ]
            .join(" ")
            .toLowerCase()
            .includes(q)
      );

    if (!rows.length) {

      body.innerHTML = `
        <tr>
          <td
            colspan="9"
            style="text-align:center;padding:25px"
          >
            No restaurant orders found.
          </td>
        </tr>
      `;

      return;
    }

    body.innerHTML =
      rows
        .map(
          x => {

            const g =
              guests.find(
                v =>
                  Number(v.id) ===
                  Number(x.guest_id)
              );

            const r =
              rooms.find(
                v =>
                  Number(v.id) ===
                  Number(x.room_id)
              );

            return `
              <tr>

                <td>
                  ${x.id}
                </td>

                <td>
                  ${esc(x.item_name)}
                </td>

                <td>
                  ${x.quantity}
                </td>

                <td>
                  KSh ${money(
                    x.unit_price
                  )}
                </td>

                <td>
                  KSh ${money(
                    x.total
                  )}
                </td>

                <td>
                  ${esc(
                    guestName(g) ||
                    "-"
                  )}
                </td>

                <td>
                  ${esc(
                    r?.room_number ||
                    "-"
                  )}
                </td>

                <td>
                  ${esc(
                    String(
                      x.status || ""
                    ).replace(
                      /_/g,
                      " "
                    )
                  )}
                </td>

                <td>

                  <button
                    type="button"
                    data-order-view="${x.id}"
                  >
                    View
                  </button>

                  <button
                    type="button"
                    data-order-edit="${x.id}"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    data-order-delete="${x.id}"
                  >
                    Delete
                  </button>

                </td>

              </tr>
            `;
          }
        )
        .join("");
  }

  function openOrder(order = null) {

    editingOrderId =
      order
        ? Number(order.id)
        : null;

    if ($("orderId")) {
      $("orderId").value =
        order?.id || "";
    }

    if ($("orderGuest")) {
      $("orderGuest").value =
        order?.guest_id || "";
    }

    if ($("orderRoom")) {
      $("orderRoom").value =
        order?.room_id || "";
    }

    if ($("orderQuantity")) {
      $("orderQuantity").value =
        order?.quantity || 1;
    }

    if ($("orderStatus")) {
      $("orderStatus").value =
        order?.status ||
        "pending";
    }

    if ($("orderNotes")) {
      $("orderNotes").value =
        order?.notes || "";
    }

    if ($("orderMenuItem")) {

      const m =
        menu.find(
          x =>
            x.item_name ===
            order?.item_name
        );

      $("orderMenuItem").value =
        m?.id || "";
    }

    updateOrderTotal();

    if ($("orderModal")) {
      $("orderModal").style.display =
        "flex";
    }
  }

  function closeOrder() {

    if ($("orderModal")) {
      $("orderModal").style.display =
        "none";
    }

    editingOrderId =
      null;
  }

  /* =========================================================
     FINANCIAL LEDGER VERIFICATION
     
     IMPORTANT:
     financial_transactions DOES NOT have debit/credit columns.
     
     We only use:
     - hotel_id
     - reference_number
     - is_reversal
     
     The financial engine creates the actual accounting entries.
  ========================================================= */

  async function existingLedger(orderId) {

    const prefix =
      `REST-${orderId}`;

    const r =
      await db
        .from("financial_transactions")
        .select("*")
        .eq(
          "hotel_id",
          hotel.id
        )
        .like(
          "reference_number",
          `${prefix}-%`
        )
        .eq(
          "is_reversal",
          false
        );

    if (r.error) {

      throw new Error(
        "Unable to verify restaurant ledger: " +
        r.error.message
      );
    }

    return r.data || [];
  }

  /* =========================================================
     POST RESTAURANT SALE TO FINANCIAL ENGINE
     
     IMPORTANT:
     Keep the existing financial engine call.
     Do not create debit/credit columns here.
  ========================================================= */

  async function postRestaurant(order) {

    const old =
      await existingLedger(
        order.id
      );

    /*
     * If the ledger already contains
     * the restaurant transaction, do
     * not post it again.
     */

    if (old.length) {
      return old;
    }

    const engine =
      window.EDUTECH_FINANCIAL_ENGINE;

    if (
      !engine ||
      typeof engine.postRestaurantSale !==
        "function"
    ) {

      throw new Error(
        "The financial engine restaurant posting function is not available."
      );
    }

    /*
     * IMPORTANT:
     * This is the existing function
     * signature used by the system.
     */

    const result =
      await engine.postRestaurantSale({

        hotelId:
          hotel.id,

        orderId:
          order.id,

        itemName:
          order.item_name,

        quantity:
          order.quantity,

        unitPrice:
          order.unit_price,

        total:
          order.total,

        orderDate:
          order.order_date,

        guestId:
          order.guest_id ||
          null,

        roomId:
          order.room_id ||
          null,

        reservationId:
          order.reservation_id ||
          null,

        notes:
          order.notes ||
          ""
      });

    /*
     * Verify the result using the
     * actual financial_transactions
     * columns.
     */

    const verified =
      await existingLedger(
        order.id
      );

    if (!verified.length) {

      throw new Error(
        "Restaurant order saved, but no financial ledger entry was created."
      );
    }

    return {
      result,
      transactions:
        verified
    };
  }

  /* =========================================================
     SAVE ORDER
  ========================================================= */

  async function saveOrder(e) {

    e?.preventDefault();

    const button =
      e?.submitter;

    try {

      const menuId =
        Number(
          $("orderMenuItem")
            ?.value
        );

      const item =
        menu.find(
          x =>
            Number(x.id) ===
            menuId
        );

      if (!item) {

        throw new Error(
          "Please select a menu item."
        );
      }

      const quantity =
        Math.max(
          1,
          Math.floor(
            num(
              $("orderQuantity")
                ?.value || 1
            )
          )
        );

      const unitPrice =
        num(
          $("orderUnitPrice")
            ?.value
        );

      const total =
        quantity *
        unitPrice;

      if (unitPrice < 0) {

        throw new Error(
          "Unit price cannot be negative."
        );
      }

      if (button) {

        button.disabled =
          true;

        button.dataset.old =
          button.textContent;

        button.textContent =
          editingOrderId
            ? "Updating..."
            : "Saving...";
      }

      const wasEditing =
        Boolean(
          editingOrderId
        );

      const payload = {

        item_name:
          item.item_name,

        quantity,

        unit_price:
          unitPrice,

        total,

        status:
          $("orderStatus")
            ?.value ||
          "pending",

        order_date:
          new Date().toISOString(),

        notes:
          $("orderNotes")
            ?.value
            .trim() ||
          null,

        hotel_id:
          hotel.id,

        reservation_id:
          null,

        guest_id:
          $("orderGuest")
            ?.value
            ? Number(
                $("orderGuest").value
              )
            : null,

        room_id:
          $("orderRoom")
            ?.value
            ? Number(
                $("orderRoom").value
              )
            : null
      };

      if (wasEditing) {

        const old =
          orders.find(
            x =>
              Number(x.id) ===
              Number(
                editingOrderId
              )
          );

        payload.reservation_id =
          old?.reservation_id ||
          null;
      }

      const r =
        wasEditing

          ? await db
              .from(
                "restaurant_orders"
              )
              .update(
                payload
              )
              .eq(
                "id",
                editingOrderId
              )
              .eq(
                "hotel_id",
                hotel.id
              )
              .select("*")
              .single()

          : await db
              .from(
                "restaurant_orders"
              )
              .insert(
                payload
              )
              .select("*")
              .single();

      if (r.error) {

        throw new Error(
          "Unable to save restaurant order: " +
          r.error.message
        );
      }

      /*
       * Close the modal only after
       * the database operation succeeds.
       */

      closeOrder();

      await loadOrders();

      /*
       * IMPORTANT:
       * Only a NEW order is posted
       * to the financial ledger.
       *
       * Editing an existing order does
       * not create another financial
       * transaction.
       */

      if (!wasEditing) {

        try {

          await postRestaurant(
            r.data
          );

          message(
            "Restaurant order saved and posted to financial ledger.",
            "success"
          );

        } catch (fe) {

          message(
            "Order saved, but financial posting failed: " +
            errorText(fe),
            "warning"
          );
        }

      } else {

        message(
          "Restaurant order updated successfully.",
          "success"
        );
      }

    } catch (e2) {

      message(
        errorText(e2),
        "error"
      );

    } finally {

      if (button) {

        button.disabled =
          false;

        button.textContent =
          button.dataset.old ||
          button.textContent;

        delete button.dataset.old;
      }
    }
  }

  /* =========================================================
     DELETE ORDER
  ========================================================= */

  async function deleteOrder(id) {

    const order =
      orders.find(
        x =>
          Number(x.id) ===
          Number(id)
      );

    if (!order) {
      return;
    }

    if (
      !confirm(
        `Delete restaurant order #${id}?`
      )
    ) {
      return;
    }

    try {

      /*
       * Never delete an order that
       * already has a financial entry.
       */

      if (
        (
          await existingLedger(id)
        ).length
      ) {

        throw new Error(
          "This order has a financial ledger entry. Do not delete it; use the financial reversal process instead."
        );
      }

      const r =
        await db
          .from(
            "restaurant_orders"
          )
          .delete()
          .eq(
            "id",
            id
          )
          .eq(
            "hotel_id",
            hotel.id
          );

      if (r.error) {

        throw new Error(
          "Unable to delete order: " +
          r.error.message
        );
      }

      await loadOrders();

      message(
        "Restaurant order deleted successfully.",
        "success"
      );

    } catch (e) {

      message(
        errorText(e),
        "error"
      );
    }
  }

  /* =========================================================
     SUMMARY
  ========================================================= */

  function updateSummary() {

    const today =
      new Date()
        .toISOString()
        .slice(0, 10);

    const todayRows =
      orders.filter(
        x =>
          String(
            x.order_date || ""
          ).slice(0, 10) ===
          today
      );

    const sales =
      todayRows
        .filter(
          x =>
            String(
              x.status || ""
            ).toLowerCase() !==
            "cancelled"
        )
        .reduce(
          (s, x) =>
            s +
            num(x.total),
          0
        );

    const pending =
      orders.filter(
        x =>
          [
            "pending",
            "preparing"
          ].includes(
            String(
              x.status || ""
            ).toLowerCase()
          )
      ).length;

    if ($("menuCount")) {

      $("menuCount")
        .textContent =
        menu.filter(
          x =>
            x.status ===
              "available" ||
            x.status ===
              "active"
        ).length;
    }

    if ($("todayOrders")) {

      $("todayOrders")
        .textContent =
        todayRows.length;
    }

    if ($("todaySales")) {

      $("todaySales")
        .textContent =
        `KSh ${money(
          sales
        )}`;
    }

    if ($("pendingOrders")) {

      $("pendingOrders")
        .textContent =
        pending;
    }
  }

  /* =========================================================
     VIEW ORDER
  ========================================================= */

  function viewOrder(id) {

    const o =
      orders.find(
        x =>
          Number(x.id) ===
          Number(id)
      );

    if (!o) {
      return;
    }

    const g =
      guests.find(
        x =>
          Number(x.id) ===
          Number(o.guest_id)
      );

    const r =
      rooms.find(
        x =>
          Number(x.id) ===
          Number(o.room_id)
      );

    if ($("viewOrderModal")) {

      $("viewOrderModal")
        .dataset.orderId =
        o.id;
    }

    if ($("viewOrderContent")) {

      $("viewOrderContent")
        .innerHTML = `

          <div
            style="
              padding:20px;
            "
          >

            <h2>
              Restaurant Order #${o.id}
            </h2>

            <hr>

            <p>
              <b>Hotel:</b>
              ${esc(
                hotelName()
              )}
            </p>

            <p>
              <b>Item:</b>
              ${esc(
                o.item_name
              )}
            </p>

            <p>
              <b>Quantity:</b>
              ${o.quantity}
            </p>

            <p>
              <b>Unit Price:</b>
              KSh ${money(
                o.unit_price
              )}
            </p>

            <p>
              <b>Total:</b>
              KSh ${money(
                o.total
              )}
            </p>

            <p>
              <b>Guest:</b>
              ${esc(
                guestName(g) ||
                "-"
              )}
            </p>

            <p>
              <b>Room:</b>
              ${esc(
                r?.room_number ||
                "-"
              )}
            </p>

            <p>
              <b>Status:</b>
              ${esc(
                o.status ||
                ""
              )}
            </p>

            <p>
              <b>Notes:</b>
              ${esc(
                o.notes ||
                "-"
              )}
            </p>

          </div>

        `;
    }

    if ($("viewOrderModal")) {

      $("viewOrderModal")
        .style.display =
        "flex";
    }
  }

  function closeView() {

    if ($("viewOrderModal")) {

      $("viewOrderModal")
        .style.display =
        "none";
    }
  }

  /* =========================================================
     PRINT ORDER
  ========================================================= */

  function printOrder(id) {

    const o =
      orders.find(
        x =>
          Number(x.id) ===
          Number(id)
      );

    if (!o) {
      return;
    }

    const g =
      guests.find(
        x =>
          Number(x.id) ===
          Number(o.guest_id)
      );

    const r =
      rooms.find(
        x =>
          Number(x.id) ===
          Number(o.room_id)
      );

    const p =
      $("restaurantPrintDocument");

    if (!p) {

      window.print();

      return;
    }

    p.innerHTML = `

      <div
        style="
          max-width:760px;
          margin:auto;
          padding:30px;
          font-family:Arial;
        "
      >

        <h1
          style="
            text-align:center;
          "
        >
          ${esc(
            hotelName()
          )}
        </h1>

        <h2
          style="
            text-align:center;
          "
        >
          RESTAURANT ORDER
        </h2>

        <p
          style="
            text-align:center;
          "
        >
          Order #${o.id}
        </p>

        <hr>

        <p>
          <b>Item:</b>
          ${esc(
            o.item_name
          )}
        </p>

        <p>
          <b>Quantity:</b>
          ${o.quantity}
        </p>

        <p>
          <b>Unit Price:</b>
          KSh ${money(
            o.unit_price
          )}
        </p>

        <p>
          <b>Total:</b>
          KSh ${money(
            o.total
          )}
        </p>

        <p>
          <b>Guest:</b>
          ${esc(
            guestName(g) ||
            "-"
          )}
        </p>

        <p>
          <b>Room:</b>
          ${esc(
            r?.room_number ||
            "-"
          )}
        </p>

        <p>
          <b>Status:</b>
          ${esc(
            o.status ||
            ""
          )}
        </p>

        <hr>

        <p
          style="
            text-align:center;
          "
        >
          Thank you for choosing
          ${esc(
            hotelName()
          )}.
        </p>

      </div>
    `;

    p.style.display =
      "block";

    window.print();

    setTimeout(
      () => {
        p.style.display =
          "none";
      },
      1000
    );
  }

  /* =========================================================
     EVENTS
  ========================================================= */

  function bind() {

    $("newMenuItemBtn")
      ?.addEventListener(
        "click",
        () =>
          openMenu()
      );

    $("closeMenuModal")
      ?.addEventListener(
        "click",
        closeMenu
      );

    $("cancelMenuModal")
      ?.addEventListener(
        "click",
        closeMenu
      );

    $("menuForm")
      ?.addEventListener(
        "submit",
        saveMenu
      );

    $("menuSearch")
      ?.addEventListener(
        "input",
        renderMenu
      );

    $("menuTableBody")
      ?.addEventListener(
        "click",
        e => {

          const b =
            e.target.closest(
              "button"
            );

          if (!b) {
            return;
          }

          if (
            b.dataset.menuEdit
          ) {

            openMenu(
              menu.find(
                x =>
                  Number(x.id) ===
                  Number(
                    b.dataset.menuEdit
                  )
              )
            );
          }

          if (
            b.dataset.menuDelete
          ) {

            deleteMenu(
              b.dataset.menuDelete
            );
          }
        }
      );

    $("newOrderBtn")
      ?.addEventListener(
        "click",
        () =>
          openOrder()
      );

    $("closeOrderModal")
      ?.addEventListener(
        "click",
        closeOrder
      );

    $("cancelOrderModal")
      ?.addEventListener(
        "click",
        closeOrder
      );

    $("orderForm")
      ?.addEventListener(
        "submit",
        saveOrder
      );

    $("orderMenuItem")
      ?.addEventListener(
        "change",
        updateOrderTotal
      );

    $("orderQuantity")
      ?.addEventListener(
        "input",
        updateOrderTotal
      );

    $("orderSearch")
      ?.addEventListener(
        "input",
        renderOrders
      );

    $("ordersTableBody")
      ?.addEventListener(
        "click",
        e => {

          const b =
            e.target.closest(
              "button"
            );

          if (!b) {
            return;
          }

          if (
            b.dataset.orderView
          ) {

            viewOrder(
              b.dataset.orderView
            );
          }

          if (
            b.dataset.orderEdit
          ) {

            openOrder(
              orders.find(
                x =>
                  Number(x.id) ===
                  Number(
                    b.dataset.orderEdit
                  )
              )
            );
          }

          if (
            b.dataset.orderDelete
          ) {

            deleteOrder(
              b.dataset.orderDelete
            );
          }
        }
      );

    $("closeViewOrderModal")
      ?.addEventListener(
        "click",
        closeView
      );

    $("cancelViewOrderModal")
      ?.addEventListener(
        "click",
        closeView
      );

    $("printOrderBtn")
      ?.addEventListener(
        "click",
        () =>
          printOrder(
            $("viewOrderModal")
              ?.dataset
              .orderId
          )
      );

    [
      "menuModal",
      "orderModal",
      "viewOrderModal"
    ].forEach(
      id => {

        $(id)?.addEventListener(
          "click",
          e => {

            if (
              e.target ===
              $(id)
            ) {

              $(id).style.display =
                "none";
            }
          }
        );
      }
    );
  }

  /* =========================================================
     INITIALIZATION
  ========================================================= */

  async function init() {

    try {

      db =
        getDb();

      await currentHotel();

      displayHotel();

      bind();

      await Promise.all(
        [
          loadGuests(),
          loadRooms()
        ]
      );

      await loadMenu();

      await loadOrders();

      console.log(
        "Restaurant module loaded successfully."
      );

    } catch (e) {

      console.error(e);

      message(
        errorText(e),
        "error"
      );
    }
  }

  /* =========================================================
     PUBLIC API
  ========================================================= */

  window.EDUTECH_RESTAURANT = {

    reload:
      async () => {

        await loadGuests();

        await loadRooms();

        await loadMenu();

        await loadOrders();
      },

    postRestaurantFinancialEntry:
      postRestaurant
  };

  /* =========================================================
     START
  ========================================================= */

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