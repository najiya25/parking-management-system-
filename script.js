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

  // Refresh required data

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

  if (
    vehicleNumber === "" ||
    ownerName === "" ||
    vehicleType === "" ||
    entryTime === ""
  ) {
    message.innerHTML = "Please fill all details.";

    return;
  }

  const data = await apiRequest("/api/entry", {
    method: "POST",

    body: JSON.stringify({
      vehicleNumber: vehicleNumber,

      ownerName: ownerName,

      vehicleType: vehicleType,

      entryTime: entryTime,
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

  const assignedSlot = data.vehicle.slotNumber;

  assignedSlotBox.innerHTML = "Assigned Slot: " + assignedSlot;

  message.innerHTML = data.message || "Vehicle parked successfully.";

  // Clear fields

  document.getElementById("vehicleNumber").value = "";

  document.getElementById("ownerName").value = "";

  document.getElementById("vehicleType").value = "";

  document.getElementById("entryTime").value = "";

  // Refresh everything

  updateDashboard();

  updateSlots();

  updateReport();

  updateParkedVehicles();

  setTimeout(function () {
    assignedSlotBox.innerHTML = "Assigned Slot: —";
  }, 3000);
}

// ==========================================
// VEHICLE SEARCH
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

        </div>

    `;
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

  const data = await apiRequest("/api/exit", {
    method: "POST",

    body: JSON.stringify({
      vehicleNumber: exitVehicle,

      exitTime: exitTime,
    }),
  });

  if (!data) {
    result.innerHTML = "Unable to connect to server.";

    return;
  }

  if (!data.vehicle) {
    result.innerHTML = data.message || "Vehicle not found.";

    return;
  }

  const vehicle = data.vehicle;

  const hours = data.duration || 1;

  const fee = data.fee || 0;

  result.innerHTML = `

        <div class="vehicle-info">

            <p>
                <strong>
                    Vehicle Number:
                </strong>

                ${vehicle.vehicleNumber}
            </p>

            <p>
                <strong>
                    Parking Slot:
                </strong>

                ${vehicle.slotNumber}
            </p>

            <p>
                <strong>
                    Duration:
                </strong>

                ${hours} hour(s)
            </p>

            <p>
                <strong>
                    Parking Fee:
                </strong>

                ₹${fee}
            </p>

        </div>

    `;

  document.getElementById("exitVehicle").value = "";

  document.getElementById("exitTime").value = "";

  // Refresh data

  updateDashboard();

  updateSlots();

  updateReport();

  updateHistory();

  updateParkedVehicles();
}

// ==========================================
// UPDATE MAIN DASHBOARD
// ==========================================

async function updateDashboard() {
  try {
    const data = await apiRequest("/api/vehicles");

    if (!data) {
      return;
    }

    let vehicles = [];

    if (Array.isArray(data)) {
      vehicles = data;
    } else if (Array.isArray(data.vehicles)) {
      vehicles = data.vehicles;
    }

    const totalSlots = 8;

    const occupiedSlots = vehicles.length;

    const availableSlots = Math.max(0, totalSlots - occupiedSlots);

    console.log("Vehicles:", vehicles);

    console.log("Occupied:", occupiedSlots);

    console.log("Available:", availableSlots);

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

    let vehicles = [];

    if (Array.isArray(data)) {
      vehicles = data;
    } else if (Array.isArray(data.vehicles)) {
      vehicles = data.vehicles;
    }

    // Update 8 parking slots

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

    // Update currently parked vehicles

    updateParkedVehicles(vehicles);
  } catch (error) {
    console.error("Slot update error:", error);
  }
}

// ==========================================
// CURRENTLY PARKED VEHICLES
// ==========================================

function updateParkedVehicles(vehicles) {
  const parkedList = document.getElementById("parkedVehiclesList");

  if (!parkedList) {
    return;
  }

  // No vehicles

  if (!vehicles || vehicles.length === 0) {
    parkedList.innerHTML = `

            <p class="no-vehicles">
                No vehicles are currently parked.
            </p>

        `;

    return;
  }

  // Show parked vehicles

  parkedList.innerHTML = vehicles
    .map(function (vehicle) {
      return `

                    <div class="parked-vehicle">

                        <div>
                            🚗
                            <strong>
                                ${vehicle.vehicleNumber}
                            </strong>
                        </div>

                        <div>
                            👤
                            ${vehicle.ownerName}
                        </div>

                        <div>
                            🅿️
                            <strong>
                                ${vehicle.slotNumber}
                            </strong>
                        </div>

                        <div>
                            🕐
                            ${vehicle.entryTime}
                        </div>

                    </div>

                `;
    })
    .join("");
}

// ==========================================
// UPDATE REPORT
// ==========================================

async function updateReport() {
  try {
    const data = await apiRequest("/api/report");

    if (!data) {
      return;
    }

    const totalSlots = Number(data.totalSlots || 8);

    const occupiedSlots = Number(data.occupiedSlots || data.occupied || 0);

    const availableSlots = Math.max(0, totalSlots - occupiedSlots);

    const todayVehicles = Number(data.todayVehicles || 0);

    const collection = Number(data.totalCollection || data.collection || 0);

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
// UPDATE HISTORY
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

    let history = [];

    if (Array.isArray(data)) {
      history = data;
    } else if (Array.isArray(data.history)) {
      history = data.history;
    }

    if (history.length === 0) {
      historyList.innerHTML = "<p>No vehicle history available.</p>";

      return;
    }

    historyList.innerHTML = "";

    history.forEach(function (vehicle) {
      historyList.innerHTML += `

                    <div class="vehicle-info">

                        <p>
                            <strong>
                                Vehicle Number:
                            </strong>

                            ${vehicle.vehicleNumber || "—"}
                        </p>

                        <p>
                            <strong>
                                Owner Name:
                            </strong>

                            ${vehicle.ownerName || "—"}
                        </p>

                        <p>
                            <strong>
                                Vehicle Type:
                            </strong>

                            ${vehicle.vehicleType || "—"}
                        </p>

                        <p>
                            <strong>
                                Parking Slot:
                            </strong>

                            ${vehicle.slotNumber || "—"}
                        </p>

                        <p>
                            <strong>
                                Entry Time:
                            </strong>

                            ${vehicle.entryTime || "—"}
                        </p>

                        <p>
                            <strong>
                                Exit Time:
                            </strong>

                            ${vehicle.exitTime || "—"}
                        </p>

                        <p>
                            <strong>
                                Duration:
                            </strong>

                            ${vehicle.duration || 0}
                            hour(s)
                        </p>

                        <p>
                            <strong>
                                Parking Fee:
                            </strong>

                            ₹${Number(vehicle.fee || 0)}
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
