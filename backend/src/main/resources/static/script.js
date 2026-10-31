// ==========================================
// PARKING MANAGEMENT SYSTEM
// BACKEND CONNECTED VERSION
// ==========================================

const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "login.html";
}

let currentHistoryFilter = "ALL";
let allHistoryRecords = [];

function normalizeVehicleNumber(value) {
  const number = value.trim().toUpperCase().replace(/[\s-]/g, "");
  const match = number.match(
    /^([A-Z]{2})([0-9]{1,2})([A-Z]{1,3})([0-9]{1,4})$/,
  );

  if (!match) return null;

  return `${match[1]}-${match[2]}-${match[3]}-${match[4]}`;
}

// ==========================================
// API HELPER
// ==========================================

async function apiRequest(url, options = {}) {
  try {
    const requestOptions = {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token"),
        ...(options.headers || {}),
      },
    };

    const response = await fetch(url, requestOptions);

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("token");
      window.location.href = "login.html";
      return null;
    }

    const data = await response.json();

    if (!response.ok) {
      console.error("API error:", data);
      return data;
    }

    return data;
  } catch (error) {
    console.error("Connection error:", error);
    return null;
  }
}

// ==========================================
// DASHBOARD NAVIGATION
// ==========================================

function showDashboard(dashboardId) {
  document.querySelectorAll(".dashboard-section").forEach(function (dashboard) {
    dashboard.classList.remove("active-dashboard");
  });

  const selectedDashboard = document.getElementById(dashboardId);

  if (selectedDashboard) {
    selectedDashboard.classList.add("active-dashboard");
  }

  const navButtons = document.querySelectorAll(".dashboard-nav button");

  navButtons.forEach(function (button) {
    button.classList.remove("active-nav");
  });

  const clickedButton = Array.from(navButtons).find(function (button) {
    return (
      button.getAttribute("onclick") === "showDashboard('" + dashboardId + "')"
    );
  });

  if (clickedButton) clickedButton.classList.add("active-nav");

  if (dashboardId === "mainDashboard") updateDashboard();
  if (dashboardId === "slotDashboard") updateSlots();
  if (dashboardId === "reportDashboard") updateReport();
  if (dashboardId === "historyDashboard") updateHistory();
}

// ==========================================
// VEHICLE ENTRY
// ==========================================

async function vehicleEntry() {
  const vehicleNumber = normalizeVehicleNumber(
    document.getElementById("vehicleNumber").value,
  );

  const ownerName = document.getElementById("ownerName").value.trim();
  const vehicleType = document.getElementById("vehicleType").value;
  const entryTime = document.getElementById("entryTime").value;

  const message = document.getElementById("entryMessage");
  const assignedSlotBox = document.getElementById("assignedSlot");

  if (!vehicleNumber) {
    message.innerHTML = "Invalid vehicle number. Example: KL-01-AB-1234.";
    return;
  }

  if (!ownerName || !vehicleType || !entryTime) {
    message.innerHTML = "Please fill all details.";
    return;
  }

  const data = await apiRequest("/api/entry", {
    method: "POST",
    body: JSON.stringify({
      vehicleNumber,
      ownerName,
      vehicleType,
      entryTime,
    }),
  });

  if (!data) {
    message.innerHTML = "Unable to connect to server.";
    return;
  }

  if (!data.vehicle) {
    message.innerHTML = data.message || "Unable to park vehicle.";
    return;
  }

  assignedSlotBox.innerHTML = "Assigned Slot: " + data.vehicle.slotNumber;
  message.innerHTML = data.message || "Vehicle parked successfully.";

  document.getElementById("vehicleNumber").value = "";
  document.getElementById("ownerName").value = "";
  document.getElementById("vehicleType").value = "";
  document.getElementById("entryTime").value = "";

  updateDashboard();
  updateSlots();
  updateReport();

  setTimeout(function () {
    assignedSlotBox.innerHTML = "Assigned Slot: —";
  }, 3000);
}

// ==========================================
// VEHICLE SEARCH
// ==========================================

async function searchVehicle() {
  const searchNumber = normalizeVehicleNumber(
    document.getElementById("searchVehicle").value,
  );

  const result = document.getElementById("searchResult");

  if (!searchNumber) {
    result.innerHTML = "Invalid vehicle number. Example: KL-01-AB-1234.";
    return;
  }

  const data = await apiRequest(
    "/api/search/" + encodeURIComponent(searchNumber),
  );

  if (!data) {
    result.innerHTML = "Unable to connect to server.";
    return;
  }

  if (!data.vehicle) {
    result.innerHTML = data.message || "Vehicle not found.";
    return;
  }

  const vehicle = data.vehicle;

  result.innerHTML = `
    <div class="vehicle-info">
      <h3>Vehicle Details</h3>
      <p><strong>Vehicle Number:</strong> ${vehicle.vehicleNumber || "—"}</p>
      <p><strong>Owner Name:</strong> ${vehicle.ownerName || "—"}</p>
      <p><strong>Vehicle Type:</strong> ${vehicle.vehicleType || "—"}</p>
      <p><strong>Parking Slot:</strong> ${vehicle.slotNumber || "—"}</p>
      <p><strong>Entry Time:</strong> ${vehicle.entryTime || "—"}</p>
    </div>
  `;
}

// ==========================================
// VEHICLE EXIT - FEE PREVIEW
// ==========================================

async function vehicleExit() {
  const exitVehicle = normalizeVehicleNumber(
    document.getElementById("exitVehicle").value,
  );

  const exitTime = document.getElementById("exitTime").value;
  const result = document.getElementById("exitResult");

  if (!exitVehicle) {
    result.innerHTML = "Enter a valid vehicle number, e.g. KL-01-AB-1234.";
    return;
  }

  if (!exitTime) {
    result.innerHTML = "Please enter the exit time.";
    return;
  }

  result.innerHTML = "<p>Calculating parking fee...</p>";

  const data = await apiRequest("/api/exit/preview", {
    method: "POST",
    body: JSON.stringify({
      vehicleNumber: exitVehicle,
      exitTime,
    }),
  });

  if (!data) {
    result.innerHTML = "<p>Unable to connect to server.</p>";
    return;
  }

  if (!data.vehicle) {
    result.innerHTML = `<p>${data.message || "Vehicle not found."}</p>`;
    return;
  }

  const vehicle = data.vehicle;

  window.pendingExit = {
    vehicleNumber: exitVehicle,
    exitTime,
    fee: Number(data.fee || 0),
    duration: Number(data.duration || 1),
  };

  result.innerHTML = `
    <div class="vehicle-info">
      <h3>Parking Details</h3>
      <p><strong>Vehicle Number:</strong> ${vehicle.vehicleNumber}</p>
      <p><strong>Owner:</strong> ${vehicle.ownerName || "—"}</p>
      <p><strong>Parking Slot:</strong> ${vehicle.slotNumber || "—"}</p>
      <p><strong>Duration:</strong> ${window.pendingExit.duration} hour(s)</p>
      <p><strong>Parking Fee:</strong> ₹${window.pendingExit.fee.toFixed(2)}</p>

      <hr>

      <h3>Select Payment Method</h3>

      <label><input type="radio" name="paymentMethod" value="UPI"> UPI</label>
      <br>
      <label><input type="radio" name="paymentMethod" value="CARD"> Card</label>
      <br>
      <label><input type="radio" name="paymentMethod" value="CASH"> Cash</label>

      <p style="margin-top:10px;">
        <strong>Demo:</strong> No real money is transferred.
        Payment status must be recorded manually.
      </p>

      <button type="button" onclick="savePaymentAttempt('PENDING')">
        Save as Pending
      </button>

      <button type="button" onclick="savePaymentAttempt('FAILED')">
        Mark as Failed
      </button>

      <button type="button" onclick="confirmVehiclePayment()">
        Confirm Payment
      </button>

      <p id="paymentMessage"></p>
    </div>
  `;
}

// ==========================================
// GET SELECTED PAYMENT METHOD
// ==========================================

function getSelectedPaymentMethod() {
  const selected = document.querySelector(
    'input[name="paymentMethod"]:checked',
  );

  return selected ? selected.value : null;
}

// ==========================================
// SAVE PENDING OR FAILED PAYMENT
// ==========================================

async function savePaymentAttempt(status) {
  const pendingExit = window.pendingExit;
  const paymentMessage = document.getElementById("paymentMessage");

  if (!pendingExit) {
    alert("Please calculate the parking fee first.");
    return;
  }

  const paymentMethod = getSelectedPaymentMethod();

  if (!paymentMethod) {
    paymentMessage.innerHTML = "Please select a payment method.";
    return;
  }

  const message =
    status === "PENDING"
      ? "Save this payment as Pending?"
      : "Mark this payment as Failed?";

  if (!confirm(message)) return;

  paymentMessage.innerHTML = "Saving payment record...";

  const data = await apiRequest("/api/exit/attempt", {
    method: "POST",
    body: JSON.stringify({
      vehicleNumber: pendingExit.vehicleNumber,
      exitTime: pendingExit.exitTime,
      fee: pendingExit.fee,
      duration: pendingExit.duration,
      paymentMethod,
      paymentStatus: status,
    }),
  });

  if (!data) {
    paymentMessage.innerHTML = "Unable to connect to server.";
    return;
  }

  if (data.message) {
    paymentMessage.innerHTML = data.message;
  } else {
    paymentMessage.innerHTML = "Payment attempt saved.";
  }

  // The vehicle remains parked for Pending and Failed payments.
  updateHistory();
  updateDashboard();
  updateSlots();
  updateReport();
}

// ==========================================
// CONFIRM PAYMENT
// ==========================================

async function confirmVehiclePayment(
  historyId = null,
  vehicleNumber = null,
  exitTime = null,
  savedMethod = null,
) {
  let pendingExit = window.pendingExit;

  if (historyId) {
    const promptedTime = prompt(
      "Enter the exit time (HH:MM) for this payment:",
    );

    if (!promptedTime) return;

    pendingExit = {
      vehicleNumber,
      exitTime: promptedTime,
    };
  }

  if (!pendingExit) {
    alert("Please calculate the parking fee first.");
    return;
  }

  const paymentMessage = document.getElementById("paymentMessage");
  const paymentMethod = historyId ? savedMethod : getSelectedPaymentMethod();

  if (!paymentMethod) {
    if (paymentMessage) {
      paymentMessage.innerHTML = "Please select a payment method.";
    } else {
      alert("Payment method is missing.");
    }
    return;
  }

  if (
    !confirm(
      "Confirm that the " + paymentMethod + " payment has been received?",
    )
  ) {
    return;
  }

  if (paymentMessage) paymentMessage.innerHTML = "Recording payment...";

  const requestBody = {
    vehicleNumber: pendingExit.vehicleNumber,
    exitTime: pendingExit.exitTime,
    paymentMethod,
  };

  if (historyId) {
    requestBody.historyId = historyId;
  }

  const data = await apiRequest("/api/exit/confirm", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });

  if (!data) {
    if (paymentMessage) {
      paymentMessage.innerHTML = "Unable to connect to server.";
    }
    return;
  }

  if (!data.vehicle) {
    if (paymentMessage) {
      paymentMessage.innerHTML = data.message || "Payment confirmation failed.";
    } else {
      alert(data.message || "Payment confirmation failed.");
    }
    return;
  }

  const vehicle = data.vehicle;

  if (!historyId) {
    document.getElementById("exitResult").innerHTML = `
      <div class="vehicle-info">
        <h3>Payment Receipt</h3>
        <p><strong>Vehicle Number:</strong> ${vehicle.vehicleNumber}</p>
        <p><strong>Owner:</strong> ${vehicle.ownerName || "—"}</p>
        <p><strong>Parking Slot:</strong> ${vehicle.slotNumber || "—"}</p>
        <p><strong>Duration:</strong> ${data.duration || pendingExit.duration} hour(s)</p>
        <p><strong>Amount Paid:</strong> ₹${Number(data.fee || pendingExit.fee).toFixed(2)}</p>
        <p><strong>Payment Method:</strong> ${data.paymentMethod || paymentMethod}</p>
        <p><strong>Payment Status:</strong> ${data.paymentStatus || "Paid"}</p>
        <h3>Vehicle Exit Completed!</h3>
        <button type="button" onclick="window.print()">Print Receipt</button>
      </div>
    `;

    document.getElementById("exitVehicle").value = "";
    document.getElementById("exitTime").value = "";
    window.pendingExit = null;
  } else {
    alert("Payment confirmed and vehicle exit completed.");
  }

  updateDashboard();
  updateSlots();
  updateReport();
  updateHistory();
}

// ==========================================
// UPDATE MAIN DASHBOARD
// ==========================================

async function updateDashboard() {
  const data = await apiRequest("/api/vehicles");

  if (!data) return;

  let vehicles = [];

  if (Array.isArray(data)) {
    vehicles = data;
  } else if (Array.isArray(data.vehicles)) {
    vehicles = data.vehicles;
  }

  const totalSlots = 8;
  const occupiedSlots = vehicles.length;
  const availableSlots = Math.max(0, totalSlots - occupiedSlots);

  const stats = document.querySelectorAll(".stat h3");

  if (stats.length >= 3) {
    stats[0].innerText = totalSlots;
    stats[1].innerText = occupiedSlots;
    stats[2].innerText = availableSlots;
  }
}

// ==========================================
// UPDATE PARKING SLOTS
// ==========================================

async function updateSlots() {
  const data = await apiRequest("/api/vehicles");

  if (!data) return;

  let vehicles = [];

  if (Array.isArray(data)) {
    vehicles = data;
  } else if (Array.isArray(data.vehicles)) {
    vehicles = data.vehicles;
  }

  for (let i = 1; i <= 8; i++) {
    const slotId = "P0" + i;
    const slot = document.getElementById(slotId);

    if (!slot) continue;

    const occupied = vehicles.some(function (vehicle) {
      return vehicle.slotNumber === slotId;
    });

    if (occupied) {
      slot.classList.remove("available");
      slot.classList.add("occupied");
      slot.innerText = slotId + " - Occupied";
    } else {
      slot.classList.remove("occupied");
      slot.classList.add("available");
      slot.innerText = slotId + " - Available";
    }
  }

  updateParkedVehicles(vehicles);
}

// ==========================================
// CURRENTLY PARKED VEHICLES
// ==========================================

function updateParkedVehicles(vehicles) {
  const parkedList = document.getElementById("parkedVehiclesList");

  if (!parkedList) return;

  if (!vehicles || vehicles.length === 0) {
    parkedList.innerHTML =
      '<p class="no-vehicles">No vehicles are currently parked.</p>';
    return;
  }

  parkedList.innerHTML = vehicles
    .map(function (vehicle) {
      return `
      <div class="parked-vehicle">
        <div>🚗 <strong>${vehicle.vehicleNumber || "—"}</strong></div>
        <div>👤 ${vehicle.ownerName || "—"}</div>
        <div>🅿️ <strong>${vehicle.slotNumber || "—"}</strong></div>
        <div>🕐 ${vehicle.entryTime || "—"}</div>
      </div>
    `;
    })
    .join("");
}

// ==========================================
// UPDATE REPORT
// ==========================================

async function updateReport() {
  const data = await apiRequest("/api/report");

  if (!data) return;

  const totalSlots = Number(data.totalSlots ?? 8);
  const occupiedSlots = Number(data.occupiedSlots ?? data.occupied ?? 0);
  const availableSlots = Math.max(0, totalSlots - occupiedSlots);
  const todayVehicles = Number(data.todayVehicles ?? 0);
  const collection = Number(data.totalCollection ?? data.collection ?? 0);

  const reportNumbers = document.querySelectorAll("#reportDashboard p");

  if (reportNumbers.length >= 5) {
    reportNumbers[0].innerText = "Total Slots: " + totalSlots;
    reportNumbers[1].innerText = "Occupied Slots: " + occupiedSlots;
    reportNumbers[2].innerText = "Available Slots: " + availableSlots;
    reportNumbers[3].innerText = "Today's Vehicles: " + todayVehicles;
    reportNumbers[4].innerText = "Total Collection: ₹" + collection.toFixed(2);
  }

  const dailyBox = document.getElementById("dailyRevenue");
  const monthlyBox = document.getElementById("monthlyRevenue");

  if (dailyBox) {
    dailyBox.innerHTML =
      "<h3>Daily Payment Revenue</h3><p>₹" +
      Number(data.dailyRevenue ?? 0).toFixed(2) +
      "</p>";
  }

  if (monthlyBox) {
    monthlyBox.innerHTML =
      "<h3>Monthly Payment Revenue</h3><p>₹" +
      Number(data.monthlyRevenue ?? 0).toFixed(2) +
      "</p>";
  }
}

// ==========================================
// HISTORY DATE FORMATTING
// ==========================================

function formatHistoryDateTime(dateValue, timeFallback) {
  if (dateValue) {
    const date = new Date(dateValue);

    if (!isNaN(date.getTime())) {
      return {
        date: date.toLocaleDateString("en-IN"),
        time: date.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
      };
    }
  }

  if (timeFallback) {
    const time = new Date("1970-01-01T" + timeFallback);

    if (!isNaN(time.getTime())) {
      return {
        date: "—",
        time: time.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
      };
    }
  }

  return { date: "—", time: "—" };
}

// ==========================================
// HISTORY FILTERS
// ==========================================

function filterHistory(filter) {
  currentHistoryFilter = filter;
  displayHistory();
}

function getHistoryStatus(record) {
  const status = String(record.paymentStatus || "PENDING")
    .trim()
    .toUpperCase();

  if (status === "PAID" || status === "CONFIRMED") {
    return "CONFIRMED";
  }

  if (status === "FAILED") return "FAILED";

  return "PENDING";
}

// ==========================================
// DISPLAY HISTORY
// ==========================================

function displayHistory() {
  const historyList = document.getElementById("historyList");

  if (!historyList) return;

  const filteredHistory = allHistoryRecords.filter(function (record) {
    if (currentHistoryFilter === "ALL") return true;

    return getHistoryStatus(record) === currentHistoryFilter;
  });

  if (filteredHistory.length === 0) {
    historyList.innerHTML =
      "<p>No " +
      currentHistoryFilter.toLowerCase() +
      " payment records found.</p>";
    return;
  }

  historyList.innerHTML = filteredHistory
    .map(function (vehicle) {
      const entry = formatHistoryDateTime(vehicle.entryDate, vehicle.entryTime);

      const exit = formatHistoryDateTime(vehicle.exitDate, vehicle.exitTime);

      const status = getHistoryStatus(vehicle);
      const historyId = vehicle.id ?? vehicle.historyId;

      const confirmButton =
        status !== "CONFIRMED" && historyId != null
          ? `<button type="button"
             onclick="confirmVehiclePayment(${Number(historyId)},
               '${vehicle.vehicleNumber}',
               null,
               '${vehicle.paymentMethod || ""}')">
             Confirm Payment
           </button>`
          : "";

      return `
      <div class="vehicle-info">
        <h3>Vehicle Parking Record</h3>

        <p><strong>Vehicle Number:</strong> ${vehicle.vehicleNumber || "—"}</p>
        <p><strong>Owner Name:</strong> ${vehicle.ownerName || "—"}</p>
        <p><strong>Vehicle Type:</strong> ${vehicle.vehicleType || "—"}</p>
        <p><strong>Parking Slot:</strong> ${vehicle.slotNumber || "—"}</p>

        <hr>

        <p><strong>Entry Date:</strong> ${entry.date}</p>
        <p><strong>Entry Time:</strong> ${entry.time}</p>
        <p><strong>Exit Date:</strong> ${exit.date}</p>
        <p><strong>Exit Time:</strong> ${exit.time}</p>

        <hr>

        <p><strong>Duration:</strong> ${vehicle.duration ?? "—"} hour(s)</p>
        <p><strong>Parking Fee:</strong> ₹${Number(vehicle.fee || 0).toFixed(2)}</p>
        <p><strong>Payment Method:</strong> ${vehicle.paymentMethod || "—"}</p>
        <p><strong>Payment Status:</strong> ${status}</p>

        ${confirmButton}
      </div>
    `;
    })
    .join("");
}

// ==========================================
// LOAD HISTORY FROM BACKEND
// ==========================================

async function updateHistory() {
  const historyList = document.getElementById("historyList");

  if (!historyList) return;

  historyList.innerHTML = "<p>Loading parking history...</p>";

  const data = await apiRequest("/api/history");

  if (!data) {
    historyList.innerHTML = "<p>Unable to load parking history.</p>";
    return;
  }

  if (Array.isArray(data)) {
    allHistoryRecords = data;
  } else if (Array.isArray(data.history)) {
    allHistoryRecords = data.history;
  } else {
    allHistoryRecords = [];
  }

  displayHistory();
}

// ==========================================
// LOGOUT
// ==========================================

function logout() {
  if (confirm("Are you sure you want to logout?")) {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    window.location.href = "login.html";
  }
}

// ==========================================
// LOAD DATA WHEN PAGE OPENS
// ==========================================

window.onload = function () {
  updateDashboard();
  updateSlots();
  updateReport();
  updateHistory();
  showDashboard("mainDashboard");
};
