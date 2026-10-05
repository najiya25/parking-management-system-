// ==========================================
// LOGIN PROTECTION
// ==========================================

if (localStorage.getItem("isLoggedIn") !== "true") {
  window.location.href = "login.html";
}
// ==========================================
// SEPARATE DASHBOARD NAVIGATION
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
}

// ==========================================
// PARKING MANAGEMENT SYSTEM
// ==========================================

let vehicles = JSON.parse(localStorage.getItem("parkingVehicles")) || [];

let collection = Number(localStorage.getItem("parkingCollection")) || 0;

let todayVehicles = Number(localStorage.getItem("todayVehicles")) || 0;

let history = JSON.parse(localStorage.getItem("parkingHistory")) || [];

// ==========================================
// SAVE DATA
// ==========================================

function saveData() {
  localStorage.setItem("parkingVehicles", JSON.stringify(vehicles));

  localStorage.setItem("parkingCollection", collection);

  localStorage.setItem("todayVehicles", todayVehicles);

  localStorage.setItem("parkingHistory", JSON.stringify(history));
}

// ==========================================
// VEHICLE ENTRY
// ==========================================

function vehicleEntry() {
  let vehicleNumber = document
    .getElementById("vehicleNumber")
    .value.trim()
    .toUpperCase();

  let ownerName = document.getElementById("ownerName").value.trim();

  let vehicleType = document.getElementById("vehicleType").value;

  let entryTime = document.getElementById("entryTime").value;

  let message = document.getElementById("entryMessage");

  let assignedSlotBox = document.getElementById("assignedSlot");

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

  // Check duplicate vehicle

  let existingVehicle = vehicles.find(
    (vehicle) => vehicle.vehicleNumber === vehicleNumber,
  );

  if (existingVehicle) {
    message.innerHTML = "Vehicle is already parked.";

    return;
  }

  // Find first available slot

  let availableSlot = null;

  for (let i = 1; i <= 8; i++) {
    let slot = "P0" + i;

    let occupied = vehicles.some((vehicle) => vehicle.slotNumber === slot);

    if (!occupied) {
      availableSlot = slot;

      break;
    }
  }

  // No slot available

  if (!availableSlot) {
    message.innerHTML = "No parking slot available.";

    return;
  }

  // Create vehicle

  let vehicle = {
    vehicleNumber: vehicleNumber,

    ownerName: ownerName,

    vehicleType: vehicleType,

    slotNumber: availableSlot,

    entryTime: entryTime,
  };

  // Add vehicle

  vehicles.push(vehicle);

  todayVehicles++;

  saveData();

  // Show assigned slot

  assignedSlotBox.innerHTML = "Assigned Slot: " + availableSlot;

  message.innerHTML = "Vehicle parked successfully in " + availableSlot + ".";

  // Hide assigned slot after 3 seconds

  setTimeout(function () {
    assignedSlotBox.innerHTML = "Assigned Slot: —";
  }, 3000);

  // Clear input fields

  document.getElementById("vehicleNumber").value = "";

  document.getElementById("ownerName").value = "";

  document.getElementById("vehicleType").value = "";

  document.getElementById("entryTime").value = "";

  // Update screen

  updateDashboard();

  updateSlots();

  updateReport();
}

// ==========================================
// VEHICLE SEARCH
// ==========================================

function searchVehicle() {
  let searchNumber = document
    .getElementById("searchVehicle")
    .value.trim()
    .toUpperCase();

  let result = document.getElementById("searchResult");

  if (searchNumber === "") {
    result.innerHTML = "Please enter a vehicle number.";

    return;
  }

  let vehicle = vehicles.find(
    (vehicle) => vehicle.vehicleNumber === searchNumber,
  );

  if (!vehicle) {
    result.innerHTML = "Vehicle not found.";

    return;
  }

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
}

// ==========================================
// VEHICLE EXIT
// ==========================================

function vehicleExit() {
  let exitVehicle = document
    .getElementById("exitVehicle")
    .value.trim()
    .toUpperCase();

  let exitTime = document.getElementById("exitTime").value;

  let result = document.getElementById("exitResult");

  if (exitVehicle === "" || exitTime === "") {
    result.innerHTML = "Please enter vehicle number and exit time.";

    return;
  }

  // Find vehicle

  let index = vehicles.findIndex(
    (vehicle) => vehicle.vehicleNumber === exitVehicle,
  );

  if (index === -1) {
    result.innerHTML = "Vehicle not found.";

    return;
  }

  let vehicle = vehicles[index];

  // Calculate duration

  let entry = convertToMinutes(vehicle.entryTime);

  let exit = convertToMinutes(exitTime);

  let duration = exit - entry;

  // If exit is next day

  if (duration < 0) {
    duration += 24 * 60;
  }

  // Minimum 1 hour

  let hours = Math.ceil(duration / 60);

  if (hours < 1) {
    hours = 1;
  }

  // Parking rate

  let rate = 0;

  if (vehicle.vehicleType === "Car") {
    rate = 20;
  } else if (vehicle.vehicleType === "Bike") {
    rate = 10;
  } else if (vehicle.vehicleType === "Auto") {
    rate = 15;
  } else if (vehicle.vehicleType === "Van") {
    rate = 25;
  }

  // Calculate fee

  let fee = hours * rate;

  collection += fee;

  // Add vehicle to history

  history.push({
    vehicleNumber: vehicle.vehicleNumber,

    ownerName: vehicle.ownerName,

    vehicleType: vehicle.vehicleType,

    slotNumber: vehicle.slotNumber,

    entryTime: vehicle.entryTime,

    exitTime: exitTime,

    fee: fee,
  });

  // Remove vehicle

  vehicles.splice(index, 1);

  saveData();

  // Show exit result

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

  // Clear exit fields

  document.getElementById("exitVehicle").value = "";

  document.getElementById("exitTime").value = "";

  // Update screen

  updateDashboard();

  updateSlots();

  updateReport();

  updateHistory();
}

// ==========================================
// CONVERT TIME INTO MINUTES
// ==========================================

function convertToMinutes(time) {
  let parts = time.split(":");

  let hour = parseInt(parts[0]);

  let minute = parseInt(parts[1]);

  return hour * 60 + minute;
}

// ==========================================
// UPDATE DASHBOARD
// ==========================================

function updateDashboard() {
  let totalSlots = 8;

  let occupiedSlots = vehicles.length;

  let availableSlots = totalSlots - occupiedSlots;

  let stats = document.querySelectorAll(".stat h3");

  if (stats.length >= 3) {
    stats[0].innerText = totalSlots;

    stats[1].innerText = occupiedSlots;

    stats[2].innerText = availableSlots;
  }
}

// ==========================================
// UPDATE PARKING SLOTS
// ==========================================

function updateSlots() {
  for (let i = 1; i <= 8; i++) {
    let slotId = "P0" + i;

    let slot = document.getElementById(slotId);

    if (!slot) {
      continue;
    }

    let occupied = vehicles.some((vehicle) => vehicle.slotNumber === slotId);

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
}

// ==========================================
// UPDATE REPORT
// ==========================================

function updateReport() {
  let totalSlots = 8;

  let occupiedSlots = vehicles.length;

  let availableSlots = totalSlots - occupiedSlots;

  let reportNumbers = document.querySelectorAll("#reportDashboard p");

  if (reportNumbers.length >= 5) {
    reportNumbers[0].innerText = "Total Slots: " + totalSlots;

    reportNumbers[1].innerText = "Occupied Slots: " + occupiedSlots;

    reportNumbers[2].innerText = "Available Slots: " + availableSlots;

    reportNumbers[3].innerText = "Today's Vehicles: " + todayVehicles;

    reportNumbers[4].innerText = "Total Collection: ₹" + collection;
  }
}

// ==========================================
// UPDATE HISTORY
// ==========================================

function updateHistory() {
  let historyList = document.getElementById("historyList");

  if (!historyList) {
    return;
  }

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

                    <p>
                        <strong>Exit Time:</strong>
                        ${vehicle.exitTime}
                    </p>

                    <p>
                        <strong>Parking Fee:</strong>
                        ₹${vehicle.fee}
                    </p>

                </div>

            `;
    });
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
// ==========================================
// LOGOUT
// ==========================================

function logout() {
  let confirmLogout = confirm("Are you sure you want to logout?");

  if (confirmLogout) {
    localStorage.removeItem("isLoggedIn");
    window.location.href = "login.html";
  }
}
