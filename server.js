const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./database");

const app = express();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "parking-management-secret-key";

const TOTAL_SLOTS = 8;

// Middleware
app.use(cors());
app.use(express.json());

// Serve frontend files from the same repository
app.use(express.static(__dirname));

// ==========================================
// DATABASE INITIALIZATION
// ==========================================

async function initializeDatabase() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password TEXT NOT NULL
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id SERIAL PRIMARY KEY,
        vehiclenumber VARCHAR(50) UNIQUE NOT NULL,
        ownername VARCHAR(150) NOT NULL,
        vehicletype VARCHAR(50) NOT NULL,
        slotnumber VARCHAR(10) NOT NULL,
        entrytime VARCHAR(20) NOT NULL,
        entrydate TIMESTAMP NOT NULL
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS history (
        id SERIAL PRIMARY KEY,
        vehiclenumber VARCHAR(50) NOT NULL,
        ownername VARCHAR(150) NOT NULL,
        vehicletype VARCHAR(50) NOT NULL,
        slotnumber VARCHAR(10) NOT NULL,
        entrytime VARCHAR(20) NOT NULL,
        exittime VARCHAR(20) NOT NULL,
        duration INTEGER NOT NULL,
        fee NUMERIC(10,2) NOT NULL,
        exitdate TIMESTAMP NOT NULL
      )
    `);

    // Create default admin if it doesn't exist
    const adminCheck = await db.query(
      "SELECT id FROM admins WHERE username = $1",
      ["admin"],
    );

    if (adminCheck.rows.length === 0) {
      const hashedPassword = await bcrypt.hash("1234", 10);

      await db.query(
        "INSERT INTO admins (username, password) VALUES ($1, $2)",
        ["admin", hashedPassword],
      );

      console.log("Default admin created.");
    }

    console.log("Database initialized successfully.");
  } catch (error) {
    console.error("Database initialization error:", error);
  }
}

// ==========================================
// AUTHENTICATION MIDDLEWARE
// ==========================================

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "Authentication required.",
    });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      message: "Invalid token.",
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(403).json({
      message: "Invalid or expired token.",
    });
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

    const result = await db.query("SELECT * FROM admins WHERE username = $1", [
      username,
    ]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: "Invalid username or password.",
      });
    }

    const admin = result.rows[0];

    const passwordMatch = await bcrypt.compare(password, admin.password);

    if (!passwordMatch) {
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
        expiresIn: "7d",
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
// GET ACTIVE VEHICLES
// ==========================================

app.get("/api/vehicles", authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        id,
        vehiclenumber AS "vehicleNumber",
        ownername AS "ownerName",
        vehicletype AS "vehicleType",
        slotnumber AS "slotNumber",
        entrytime AS "entryTime",
        entrydate AS "entryDate"
      FROM vehicles
      ORDER BY id ASC
    `);

    res.json({
      vehicles: result.rows,
    });
  } catch (error) {
    console.error("Vehicles error:", error);

    res.status(500).json({
      message: "Unable to load vehicles.",
    });
  }
});

// ==========================================
// VEHICLE ENTRY
// ==========================================

app.post("/api/entry", authenticateToken, async (req, res) => {
  try {
    const { vehicleNumber, ownerName, vehicleType, entryTime } = req.body;

    if (!vehicleNumber || !ownerName || !vehicleType || !entryTime) {
      return res.status(400).json({
        message: "Please fill all vehicle details.",
      });
    }

    const cleanVehicleNumber = vehicleNumber.trim().toUpperCase();

    // Check whether vehicle is already parked
    const existingVehicle = await db.query(
      `
      SELECT id
      FROM vehicles
      WHERE vehiclenumber = $1
      `,
      [cleanVehicleNumber],
    );

    if (existingVehicle.rows.length > 0) {
      return res.status(400).json({
        message: "This vehicle is already parked.",
      });
    }

    // Find first available slot
    const occupiedResult = await db.query("SELECT slotnumber FROM vehicles");

    const occupiedSlots = occupiedResult.rows.map((row) => row.slotnumber);

    let assignedSlot = null;

    for (let i = 1; i <= TOTAL_SLOTS; i++) {
      const slot = "P0" + i;

      if (!occupiedSlots.includes(slot)) {
        assignedSlot = slot;
        break;
      }
    }

    if (!assignedSlot) {
      return res.status(400).json({
        message: "Parking is full.",
      });
    }

    await db.query(
      `
      INSERT INTO vehicles
      (
        vehiclenumber,
        ownername,
        vehicletype,
        slotnumber,
        entrytime,
        entrydate
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      `,
      [
        cleanVehicleNumber,
        ownerName.trim(),
        vehicleType,
        assignedSlot,
        entryTime,
      ],
    );

    const vehicleResult = await db.query(
      `
      SELECT
        id,
        vehiclenumber AS "vehicleNumber",
        ownername AS "ownerName",
        vehicletype AS "vehicleType",
        slotnumber AS "slotNumber",
        entrytime AS "entryTime",
        entrydate AS "entryDate"
      FROM vehicles
      WHERE vehiclenumber = $1
      `,
      [cleanVehicleNumber],
    );

    res.json({
      message: "Vehicle parked successfully.",
      vehicle: vehicleResult.rows[0],
    });
  } catch (error) {
    console.error("Vehicle entry error:", error);

    res.status(500).json({
      message: "Unable to park vehicle.",
    });
  }
});

// ==========================================
// SEARCH VEHICLE
// ==========================================

app.get("/api/search/:vehicleNumber", authenticateToken, async (req, res) => {
  try {
    const vehicleNumber = req.params.vehicleNumber.trim().toUpperCase();

    const result = await db.query(
      `
      SELECT
        id,
        vehiclenumber AS "vehicleNumber",
        ownername AS "ownerName",
        vehicletype AS "vehicleType",
        slotnumber AS "slotNumber",
        entrytime AS "entryTime",
        entrydate AS "entryDate"
      FROM vehicles
      WHERE vehiclenumber = $1
      `,
      [vehicleNumber],
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
    console.error("Search error:", error);

    res.status(500).json({
      message: "Unable to search vehicle.",
    });
  }
});

// ==========================================
// VEHICLE EXIT
// ==========================================

app.post("/api/exit", authenticateToken, async (req, res) => {
  try {
    const { vehicleNumber, exitTime } = req.body;

    if (!vehicleNumber || !exitTime) {
      return res.status(400).json({
        message: "Vehicle number and exit time are required.",
      });
    }

    const cleanVehicleNumber = vehicleNumber.trim().toUpperCase();

    const result = await db.query(
      `
      SELECT
        id,
        vehiclenumber AS "vehicleNumber",
        ownername AS "ownerName",
        vehicletype AS "vehicleType",
        slotnumber AS "slotNumber",
        entrytime AS "entryTime",
        entrydate AS "entryDate"
      FROM vehicles
      WHERE vehiclenumber = $1
      `,
      [cleanVehicleNumber],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Vehicle not found.",
      });
    }

    const vehicle = result.rows[0];

    // Convert HH:MM into minutes
    function convertToMinutes(time) {
      const parts = time.split(":");

      const hours = Number(parts[0]);
      const minutes = Number(parts[1]);

      return hours * 60 + minutes;
    }

    let entryMinutes = convertToMinutes(vehicle.entryTime);

    let exitMinutes = convertToMinutes(exitTime);

    let durationMinutes = exitMinutes - entryMinutes;

    // Vehicle exited after midnight
    if (durationMinutes < 0) {
      durationMinutes += 24 * 60;
    }

    let hours = Math.ceil(durationMinutes / 60);

    if (hours < 1) {
      hours = 1;
    }

    // Parking rates
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

    // Save to history
    await db.query(
      `
      INSERT INTO history
      (
        vehiclenumber,
        ownername,
        vehicletype,
        slotnumber,
        entrytime,
        exittime,
        duration,
        fee,
        exitdate
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

    // Remove from active parking
    await db.query(
      `
      DELETE FROM vehicles
      WHERE vehiclenumber = $1
      `,
      [cleanVehicleNumber],
    );

    res.json({
      message: "Vehicle exited successfully.",
      vehicle: vehicle,
      duration: hours,
      fee: fee,
    });
  } catch (error) {
    console.error("Vehicle exit error:", error);

    res.status(500).json({
      message: "Unable to process vehicle exit.",
    });
  }
});

// ==========================================
// PARKING HISTORY
// ==========================================

app.get("/api/history", authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        id,
        vehiclenumber AS "vehicleNumber",
        ownername AS "ownerName",
        vehicletype AS "vehicleType",
        slotnumber AS "slotNumber",
        entrytime AS "entryTime",
        exittime AS "exitTime",
        duration,
        fee,
        exitdate AS "exitDate"
      FROM history
      ORDER BY id DESC
    `);

    res.json({
      history: result.rows,
    });
  } catch (error) {
    console.error("History error:", error);

    res.status(500).json({
      message: "Unable to load history.",
    });
  }
});

// ==========================================
// PARKING REPORT
// ==========================================

app.get("/api/report", authenticateToken, async (req, res) => {
  try {
    const activeResult = await db.query(
      "SELECT COUNT(*) AS count FROM vehicles",
    );

    const todayResult = await db.query(`
      SELECT COUNT(*) AS count
      FROM history
      WHERE DATE(exitdate) = CURRENT_DATE
    `);

    const collectionResult = await db.query(`
      SELECT COALESCE(SUM(fee), 0) AS total
      FROM history
      WHERE DATE(exitdate) = CURRENT_DATE
    `);

    const occupiedSlots = Number(activeResult.rows[0].count);

    const availableSlots = Math.max(0, TOTAL_SLOTS - occupiedSlots);

    const todayVehicles = Number(todayResult.rows[0].count);

    const totalCollection = Number(collectionResult.rows[0].total);

    res.json({
      totalSlots: TOTAL_SLOTS,
      occupiedSlots: occupiedSlots,
      availableSlots: availableSlots,
      todayVehicles: todayVehicles,
      totalCollection: totalCollection,
    });
  } catch (error) {
    console.error("Report error:", error);

    res.status(500).json({
      message: "Unable to load report.",
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
// START SERVER
// ==========================================

initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Parking Management System running on port ${PORT}`);
  });
});
