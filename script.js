// ==========================================
// PARKING MANAGEMENT SYSTEM
// BACKEND CONNECTED VERSION
// ==========================================

// ==========================================
// CHECK LOGIN
// ==========================================

const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "login.html";
}

// ==========================================
// API HELPER
// ==========================================

async function apiRequest(url, options = {}) {
  const requestOptions = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + localStorage.getItem("token"),
      ...(options.headers || {}),
    },
  };

  const response = await fetch(url, requestOptions);

  // If login token is invalid or expired
  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem("token");

    window.location.href = "login.html";

    return null;
  }

  const data = await response.json();

  return data;
}

// ==========================================
// DASHBOARD NAVIGATION
// ==========================================

function showDashboard(dashboardId) {
  const dashboards = document.querySelectorAll(".dashboard-section");

  dashboards.forEach(function (dashboard) {
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

  if (clickedButton) {
    clickedButton.classList.add("active-nav");
  }

  // Refresh data whenever a dashboard is opened

  if (dashboardId === "mainDashboard") {
    updateDashboard();
  }

  if (dashboardId === "slotDashboard") {
    updateSlots();
  }

  if (dashboardId === "reportDashboard") {
    updateReport();
  }

  if (dashboardId === "historyDashboard") {
    updateHistory();
  }
}

// ==========================================
// VEHICLE ENTRY
// ==========================================

async function vehicleEntry() {
  const vehicleNumber = document
    .getElementById("vehicleNumber")
    .value.trim()
    .toUpperCase();

  const ownerName = document.getElementById("ownerName").value.trim();

  const vehicleType = document.getElementById("vehicleType").value;

  const entryTime = document.getElementById("entryTime").value;

  const message = document.getElementById("entryMessage");

  const assignedSlotBox = document.getElementById("assignedSlot");

  // Check empty fields

  if (
    vehicleNumber === "" ||
    ownerName === "" ||
    vehicleType === "" ||
    entryTime === ""
  ) {
    message.innerHTML = "Please fill all details.";

    return;
  }

  try {
    // Send vehicle to backend

    const data = await apiRequest("/api/vehicles/entry", {
      method: "POST",

      body: JSON.stringify({
        vehicleNumber: vehicleNumber,
        ownerName: ownerName,
        vehicleType: vehicleType,
        entryTime: entryTime,
      }),
    });

    if (!data) {
      return;
    }

    // If backend returns an error

    if (data.message && !data.vehicle) {
      message.innerHTML = data.message;

      return;
    }

    // Get assigned slot

    const assignedSlot = data.vehicle
      ? data.vehicle.slotNumber
      : data.slotNumber;

    assignedSlotBox.innerHTML = "Assigned Slot: " + assignedSlot;

    message.innerHTML = "Vehicle parked successfully in " + assignedSlot + ".";

    // Hide assigned slot after 3 seconds

    setTimeout(function () {
      assignedSlotBox.innerHTML = "Assigned Slot: —";
    }, 3000);

    // Clear fields

    document.getElementById("vehicleNumber").value = "";

    document.getElementById("ownerName").value = "";

    document.getElementById("vehicleType").value = "";

    document.getElementById("entryTime").value = "";

    // Update dashboard

    updateDashboard();

    updateSlots();

    updateReport();

    updateHistory();
  } catch (error) {
    console.error(error);

    message.innerHTML = "Unable to connect to the server.";
  }
}

// ==========================================
// SEARCH VEHICLE
// ==========================================

async function searchVehicle() {
  const searchNumber = document
    .getElementById("searchVehicle")
    .value.trim()
    .toUpperCase();

  const result = document.getElementById("searchResult");

  if (searchNumber === "") {
    result.innerHTML = "Please enter a vehicle number.";

    return;
  }

  try {
    const data = await apiRequest(
      "/api/vehicles/search/" + encodeURIComponent(searchNumber),
    );

    if (!data) {
      return;
    }

    // Vehicle not found

    if (!data.vehicle) {
      result.innerHTML = data.message || "Vehicle not found.";

      return;
    }

    const vehicle = data.vehicle;

    result.innerHTML = `

            <div class="vehicle-info">

                <p>
                    <strong>Vehicle Number:</strong>
                    ${vehicle.vehicleNumber}
                </p>

                <p>
                    <strong>Owner Name:</strong>
                    ${vehicle.ownerName}
                </p>

                <p>
                    <strong>Vehicle Type:</strong>
                    ${vehicle.vehicleType}
                </p>

                <p>
                    <strong>Parking Slot:</strong>
                    ${vehicle.slotNumber}
                </p>

                <p>
                    <strong>Entry Time:</strong>
                    ${vehicle.entryTime}
                </p>

            </div>

        `;
  } catch (error) {
    console.error(error);

    result.innerHTML = "Unable to connect to the server.";
  }
}

// ==========================================
// VEHICLE EXIT
// ==========================================

async function vehicleExit() {
  const exitVehicle = document
    .getElementById("exitVehicle")
    .value.trim()
    .toUpperCase();

  const exitTime = document.getElementById("exitTime").value;

  const result = document.getElementById("exitResult");

  if (exitVehicle === "" || exitTime === "") {
    result.innerHTML = "Please enter vehicle number and exit time.";

    return;
  }

  try {
    // Send exit information to backend

    const data = await apiRequest("/api/vehicles/exit", {
      method: "POST",

      body: JSON.stringify({
        vehicleNumber: exitVehicle,
        exitTime: exitTime,
      }),
    });

    if (!data) {
      return;
    }

    // Vehicle not found

    if (!data.vehicle) {
      result.innerHTML = data.message || "Vehicle not found.";

      return;
    }

    const vehicle = data.vehicle;

    const hours = data.hours || data.duration || 1;

    const fee = data.fee || 0;

    result.innerHTML = `

            <div class="vehicle-info">

                <p>
                    <strong>Vehicle Number:</strong>
                    ${vehicle.vehicleNumber}
                </p>

                <p>
                    <strong>Parking Slot:</strong>
                    ${vehicle.slotNumber}
                </p>

                <p>
                    <strong>Parking Duration:</strong>
                    ${hours} hour(s)
                </p>

                <p>
                    <strong>Parking Fee:</strong>
                    ₹${fee}
                </p>

                <p>
                    <strong>Status:</strong>
                    Vehicle exited successfully.
                </p>

            </div>

        `;

    // Clear fields

    document.getElementById("exitVehicle").value = "";

    document.getElementById("exitTime").value = "";

    // Update all sections

    updateDashboard();

    updateSlots();

    updateReport();

    updateHistory();
  } catch (error) {
    console.error(error);

    result.innerHTML = "Unable to connect to the server.";
  }
}

// ==========================================
// UPDATE DASHBOARD
// ==========================================

async function updateDashboard() {
  try {
    const data = await apiRequest("/api/vehicles");

    if (!data) {
      return;
    }

    const vehicles = data.vehicles || data || [];

    const totalSlots = 8;

    const occupiedSlots = vehicles.length;

    const availableSlots = totalSlots - occupiedSlots;

    const stats = document.querySelectorAll(".stat h3");

    if (stats.length >= 3) {
      stats[0].innerText = totalSlots;

      stats[1].innerText = occupiedSlots;

      stats[2].innerText = availableSlots;
    }
  } catch (error) {
    console.error("Dashboard error:", error);
  }
}

// ==========================================
// UPDATE PARKING SLOTS
// ==========================================

async function updateSlots() {
  try {
    const data = await apiRequest("/api/vehicles");

    if (!data) {
      return;
    }

    const vehicles = data.vehicles || data || [];

    for (let i = 1; i <= 8; i++) {
      const slotId = "P0" + i;

      const slot = document.getElementById(slotId);

      if (!slot) {
        continue;
      }

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
  } catch (error) {
    console.error("Slot update error:", error);
  }
}

// ==========================================
// UPDATE PARKING REPORT
// ==========================================

async function updateReport() {
  try {
    const data = await apiRequest("/api/report");

    if (!data) {
      return;
    }

    const totalSlots = 8;

    // Depending on backend response

    const occupiedSlots =
      data.occupiedSlots !== undefined
        ? data.occupiedSlots
        : data.occupied || 0;

    const availableSlots =
      data.availableSlots !== undefined
        ? data.availableSlots
        : totalSlots - occupiedSlots;

    const todayVehicles =
      data.todayVehicles !== undefined ? data.todayVehicles : 0;

    const collection =
      data.totalCollection !== undefined
        ? data.totalCollection
        : data.collection || 0;

    const reportNumbers = document.querySelectorAll("#reportDashboard p");

    if (reportNumbers.length >= 5) {
      reportNumbers[0].innerText = "Total Slots: " + totalSlots;

      reportNumbers[1].innerText = "Occupied Slots: " + occupiedSlots;

      reportNumbers[2].innerText = "Available Slots: " + availableSlots;

      reportNumbers[3].innerText = "Today's Vehicles: " + todayVehicles;

      reportNumbers[4].innerText = "Total Collection: ₹" + collection;
    }
  } catch (error) {
    console.error("Report error:", error);
  }
}

// ==========================================
// UPDATE PARKING HISTORY
// ==========================================

async function updateHistory() {
  const historyList = document.getElementById("historyList");

  if (!historyList) {
    return;
  }

  try {
    const data = await apiRequest("/api/history");

    if (!data) {
      return;
    }

    const history = data.history || data || [];

    if (history.length === 0) {
      historyList.innerHTML = "<p>No vehicle history available.</p>";

      return;
    }

    historyList.innerHTML = "";

    history
      .slice()
      .reverse()
      .forEach(function (vehicle) {
        historyList.innerHTML += `

                    <div class="vehicle-info">

                        <p>
                            <strong>
                                Vehicle Number:
                            </strong>
                            ${vehicle.vehicleNumber}
                        </p>

                        <p>
                            <strong>
                                Owner Name:
                            </strong>
                            ${vehicle.ownerName}
                        </p>

                        <p>
                            <strong>
                                Vehicle Type:
                            </strong>
                            ${vehicle.vehicleType}
                        </p>

                        <p>
                            <strong>
                                Parking Slot:
                            </strong>
                            ${vehicle.slotNumber}
                        </p>

                        <p>
                            <strong>
                                Entry Time:
                            </strong>
                            ${vehicle.entryTime}
                        </p>

                        <p>
                            <strong>
                                Exit Time:
                            </strong>
                            ${vehicle.exitTime}
                        </p>

                        <p>
                            <strong>
                                Parking Fee:
                            </strong>
                            ₹${vehicle.fee}
                        </p>

                    </div>

                `;
      });
  } catch (error) {
    console.error("History error:", error);

    historyList.innerHTML = "<p>Unable to load parking history.</p>";
  }
}

// ==========================================
// LOGOUT
// ==========================================

function logout() {
  const confirmLogout = confirm("Are you sure you want to logout?");

  if (confirmLogout) {
    localStorage.removeItem("token");

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
