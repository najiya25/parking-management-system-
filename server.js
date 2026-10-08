const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

const db = require("./database");

const app = express();

const PORT = process.env.PORT || 3000;

const JWT_SECRET = process.env.JWT_SECRET || "parking-system-secret-key";

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(cors());
app.use(express.json());

// ==========================================
// SERVE FRONTEND
// ==========================================

// Your index.html, login.html, script.js and
// style.css are in the same folder as server.js.

app.use(express.static(__dirname));

// ==========================================
// DEFAULT ADMIN
// ==========================================

const defaultUsername = "admin";
const defaultPassword = "1234";

// Create default admin if it doesn't exist
async function createDefaultAdmin() {
  try {
    const existingAdmin = await db.query(
      "SELECT id FROM admins WHERE username = $1",
      [defaultUsername],
    );

    if (existingAdmin.rows.length === 0) {
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      await db.query(
        `
        INSERT INTO admins (username, password)
        VALUES ($1, $2)
        `,
        [defaultUsername, hashedPassword],
      );

      console.log("Default admin created.");
    } else {
      console.log("Default admin already exists.");
    }
  } catch (error) {
    console.error("Admin creation error:", error);
  }
}

// ==========================================
// LOGIN
// ==========================================

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        message: "Username and password are required.",
      });
    }

    const result = await db.query(
      `
      SELECT *
      FROM admins
      WHERE username = $1
      `,
      [username],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: "Invalid username or password.",
      });
    }

    const admin = result.rows[0];

    const validPassword = await bcrypt.compare(password, admin.password);

    if (!validPassword) {
      return res.status(401).json({
        message: "Invalid username or password.",
      });
    }

    const token = jwt.sign(
      {
        id: admin.id,
        username: admin.username,
      },
      JWT_SECRET,
      {
        expiresIn: "8h",
      },
    );

    res.json({
      message: "Login successful.",
      token: token,
      username: admin.username,
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      message: "Server error during login.",
    });
  }
});

// ==========================================
// AUTHENTICATION
// ==========================================

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "Authentication required.",
    });
  }

  const parts = authHeader.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({
      message: "Invalid authorization format.",
    });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    req.admin = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token.",
    });
  }
}

// ==========================================
// GET ALL CURRENTLY PARKED VEHICLES
// ==========================================

app.get("/api/vehicles", authenticate, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        id,
        "vehicleNumber",
        "ownerName",
        "vehicleType",
        "slotNumber",
        "entryTime",
        "entryDate"
      FROM vehicles
      ORDER BY id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Vehicles error:", error);

    res.status(500).json({
      message: "Database error.",
    });
  }
});

// ==========================================
// VEHICLE ENTRY
// ==========================================

app.post("/api/vehicles/entry", authenticate, async (req, res) => {
  try {
    const { vehicleNumber, ownerName, vehicleType, entryTime } = req.body;

    if (!vehicleNumber || !ownerName || !vehicleType || !entryTime) {
      return res.status(400).json({
        message: "Please fill all details.",
      });
    }

    const number = vehicleNumber.trim().toUpperCase();

    // ==========================================
    // CHECK DUPLICATE VEHICLE
    // ==========================================

    const existingVehicle = await db.query(
      `
        SELECT *
        FROM vehicles
        WHERE "vehicleNumber" = $1
        `,
      [number],
    );

    if (existingVehicle.rows.length > 0) {
      return res.status(400).json({
        message: "Vehicle is already parked.",
      });
    }

    // ==========================================
    // FIND AVAILABLE SLOT
    // ==========================================

    const occupiedResult = await db.query(`
        SELECT "slotNumber"
        FROM vehicles
      `);

    const occupiedSlots = occupiedResult.rows.map(
      (vehicle) => vehicle.slotNumber,
    );

    let availableSlot = null;

    for (let i = 1; i <= 8; i++) {
      const slot = "P0" + i;

      if (!occupiedSlots.includes(slot)) {
        availableSlot = slot;
        break;
      }
    }

    // ==========================================
    // NO SLOT AVAILABLE
    // ==========================================

    if (!availableSlot) {
      return res.status(400).json({
        message: "No parking slot available.",
      });
    }

    // ==========================================
    // SAVE VEHICLE
    // ==========================================

    const result = await db.query(
      `
        INSERT INTO vehicles
        (
          "vehicleNumber",
          "ownerName",
          "vehicleType",
          "slotNumber",
          "entryTime",
          "entryDate"
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING
          id,
          "vehicleNumber",
          "ownerName",
          "vehicleType",
          "slotNumber",
          "entryTime",
          "entryDate"
        `,
      [number, ownerName, vehicleType, availableSlot, entryTime],
    );

    // ==========================================
    // RESPONSE
    // ==========================================

    res.json({
      message: "Vehicle parked successfully.",

      vehicle: result.rows[0],
    });
  } catch (error) {
    console.error("Vehicle entry error:", error);

    res.status(500).json({
      message: "Could not save vehicle.",
    });
  }
});

// ==========================================
// SEARCH VEHICLE
// ==========================================

app.get(
  "/api/vehicles/search/:vehicleNumber",
  authenticate,
  async (req, res) => {
    try {
      const number = req.params.vehicleNumber.trim().toUpperCase();

      const result = await db.query(
        `
        SELECT
          id,
          "vehicleNumber",
          "ownerName",
          "vehicleType",
          "slotNumber",
          "entryTime",
          "entryDate"
        FROM vehicles
        WHERE "vehicleNumber" = $1
        `,
        [number],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: "Vehicle not found.",
        });
      }

      res.json({
        vehicle: result.rows[0],
      });
    } catch (error) {
      console.error("Vehicle search error:", error);

      res.status(500).json({
        message: "Database error.",
      });
    }
  },
);

// ==========================================
// VEHICLE EXIT
// ==========================================

app.post("/api/vehicles/exit", authenticate, async (req, res) => {
  try {
    const { vehicleNumber, exitTime } = req.body;

    if (!vehicleNumber || !exitTime) {
      return res.status(400).json({
        message: "Vehicle number and exit time are required.",
      });
    }

    const number = vehicleNumber.trim().toUpperCase();

    // ==========================================
    // FIND VEHICLE
    // ==========================================

    const vehicleResult = await db.query(
      `
        SELECT
          id,
          "vehicleNumber",
          "ownerName",
          "vehicleType",
          "slotNumber",
          "entryTime",
          "entryDate"
        FROM vehicles
        WHERE "vehicleNumber" = $1
        `,
      [number],
    );

    if (vehicleResult.rows.length === 0) {
      return res.status(404).json({
        message: "Vehicle not found.",
      });
    }

    const vehicle = vehicleResult.rows[0];

    // ==========================================
    // CALCULATE DURATION
    // ==========================================

    const entryMinutes = convertToMinutes(vehicle.entryTime);

    const exitMinutes = convertToMinutes(exitTime);

    let durationMinutes = exitMinutes - entryMinutes;

    // Vehicle stayed overnight
    if (durationMinutes < 0) {
      durationMinutes += 24 * 60;
    }

    let hours = Math.ceil(durationMinutes / 60);

    // Minimum 1 hour
    if (hours < 1) {
      hours = 1;
    }

    // ==========================================
    // CALCULATE FEE
    // ==========================================

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

    const fee = hours * rate;

    // ==========================================
    // SAVE HISTORY
    // ==========================================

    await db.query(
      `
        INSERT INTO history
        (
          "vehicleNumber",
          "ownerName",
          "vehicleType",
          "slotNumber",
          "entryTime",
          "exitTime",
          "duration",
          "fee",
          "exitDate"
        )
        VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        `,
      [
        vehicle.vehicleNumber,
        vehicle.ownerName,
        vehicle.vehicleType,
        vehicle.slotNumber,
        vehicle.entryTime,
        exitTime,
        hours,
        fee,
      ],
    );

    // ==========================================
    // REMOVE VEHICLE FROM ACTIVE PARKING
    // ==========================================

    await db.query(
      `
        DELETE FROM vehicles
        WHERE id = $1
        `,
      [vehicle.id],
    );

    // ==========================================
    // SEND COMPLETE RESPONSE
    // ==========================================

    res.json({
      message: "Vehicle exited successfully.",

      vehicle: {
        vehicleNumber: vehicle.vehicleNumber,
        ownerName: vehicle.ownerName,
        vehicleType: vehicle.vehicleType,
        slotNumber: vehicle.slotNumber,
        entryTime: vehicle.entryTime,
        exitTime: exitTime,
      },

      duration: hours,

      fee: fee,
    });
  } catch (error) {
    console.error("Vehicle exit error:", error);

    res.status(500).json({
      message: "Could not process vehicle exit.",
    });
  }
});

// ==========================================
// PARKING SLOT STATUS
// ==========================================

app.get("/api/slots", authenticate, async (req, res) => {
  try {
    const result = await db.query(`
        SELECT "slotNumber"
        FROM vehicles
      `);

    const occupiedSlots = result.rows.map((vehicle) => vehicle.slotNumber);

    const slots = [];

    for (let i = 1; i <= 8; i++) {
      const slot = "P0" + i;

      slots.push({
        slotNumber: slot,

        status: occupiedSlots.includes(slot) ? "Occupied" : "Available",
      });
    }

    res.json(slots);
  } catch (error) {
    console.error("Slot error:", error);

    res.status(500).json({
      message: "Database error.",
    });
  }
});

// ==========================================
// PARKING HISTORY
// ==========================================

app.get("/api/history", authenticate, async (req, res) => {
  try {
    const result = await db.query(`
        SELECT
          id,
          "vehicleNumber",
          "ownerName",
          "vehicleType",
          "slotNumber",
          "entryTime",
          "exitTime",
          "duration",
          "fee",
          "exitDate"
        FROM history
        ORDER BY id DESC
      `);

    res.json(result.rows);
  } catch (error) {
    console.error("History error:", error);

    res.status(500).json({
      message: "Database error.",
    });
  }
});

// ==========================================
// PARKING REPORT
// ==========================================

app.get("/api/report", authenticate, async (req, res) => {
  try {
    const totalSlots = 8;

    // ==========================================
    // OCCUPIED SLOTS
    // ==========================================

    const occupiedResult = await db.query(`
        SELECT COUNT(*)::int AS occupied
        FROM vehicles
      `);

    const occupiedSlots = occupiedResult.rows[0].occupied;

    const availableSlots = totalSlots - occupiedSlots;

    // ==========================================
    // TODAY'S EXITED VEHICLES
    // ==========================================

    const todayResult = await db.query(`
        SELECT COUNT(*)::int AS "todayVehicles"
        FROM history
        WHERE DATE("exitDate") = CURRENT_DATE
      `);

    const todayVehicles = todayResult.rows[0].todayVehicles;

    // ==========================================
    // TOTAL COLLECTION
    // ==========================================

    const collectionResult = await db.query(`
        SELECT
          COALESCE(SUM("fee"), 0)::numeric AS collection
        FROM history
      `);

    const totalCollection = Number(collectionResult.rows[0].collection);

    // ==========================================
    // RESPONSE
    // ==========================================

    res.json({
      totalSlots: totalSlots,

      occupiedSlots: occupiedSlots,

      availableSlots: availableSlots,

      todayVehicles: todayVehicles,

      totalCollection: totalCollection,
    });
  } catch (error) {
    console.error("Report error:", error);

    res.status(500).json({
      message: "Database error.",
    });
  }
});

// ==========================================
// HOME PAGE
// ==========================================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

// ==========================================
// TIME CONVERTER
// ==========================================

function convertToMinutes(time) {
  if (!time || !time.includes(":")) {
    return 0;
  }

  const parts = time.split(":");

  const hour = parseInt(parts[0], 10) || 0;

  const minute = parseInt(parts[1], 10) || 0;

  return hour * 60 + minute;
}

// ==========================================
// START SERVER
// ==========================================

async function startServer() {
  try {
    // Test database connection
    await db.query("SELECT 1");

    console.log("PostgreSQL connection successful.");

    await createDefaultAdmin();

    app.listen(PORT, () => {
      console.log(`Parking server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Unable to start server:", error);
  }
}

startServer();
