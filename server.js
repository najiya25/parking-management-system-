const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

const db = require("./database");

const app = express();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "parking-system-secret-key";

app.use(cors());
app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, "..")));

// =====================================================
// CREATE DEFAULT ADMIN
// =====================================================

async function createDefaultAdmin() {
  try {
    const defaultUsername = "admin";
    const defaultPassword = "1234";

    const existingAdmin = await db.query(
      "SELECT * FROM admins WHERE username = $1",
      [defaultUsername],
    );

    if (existingAdmin.rows.length === 0) {
      const hash = await bcrypt.hash(defaultPassword, 10);

      await db.query(
        `
        INSERT INTO admins (username, password)
        VALUES ($1, $2)
        `,
        [defaultUsername, hash],
      );

      console.log("Default admin created.");
    } else {
      console.log("Default admin already exists.");
    }
  } catch (error) {
    console.error("Error creating default admin:", error);
  }
}

// =====================================================
// LOGIN
// =====================================================

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
      message: "Database error.",
    });
  }
});

// =====================================================
// AUTHENTICATION MIDDLEWARE
// =====================================================

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "Authentication required.",
    });
  }

  const token = authHeader.split(" ")[1];

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

// =====================================================
// GET ALL PARKED VEHICLES
// =====================================================

app.get("/api/vehicles", authenticate, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM vehicles ORDER BY id DESC");

    res.json(result.rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Database error.",
    });
  }
});

// =====================================================
// VEHICLE ENTRY
// =====================================================

app.post("/api/vehicles/entry", authenticate, async (req, res) => {
  try {
    const { vehicleNumber, ownerName, vehicleType, entryTime } = req.body;

    if (!vehicleNumber || !ownerName || !vehicleType || !entryTime) {
      return res.status(400).json({
        message: "Please fill all details.",
      });
    }

    const number = vehicleNumber.trim().toUpperCase();

    // Check duplicate vehicle
    const existing = await db.query(
      `
      SELECT *
      FROM vehicles
      WHERE vehicleNumber = $1
      `,
      [number],
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        message: "Vehicle is already parked.",
      });
    }

    // Find occupied slots
    const occupiedResult = await db.query("SELECT slotNumber FROM vehicles");

    const occupied = occupiedResult.rows.map((vehicle) => vehicle.slotnumber);

    let availableSlot = null;

    for (let i = 1; i <= 8; i++) {
      const slot = "P0" + i;

      if (!occupied.includes(slot)) {
        availableSlot = slot;
        break;
      }
    }

    if (!availableSlot) {
      return res.status(400).json({
        message: "No parking slot available.",
      });
    }

    const entryDate = new Date();

    const result = await db.query(
      `
      INSERT INTO vehicles
      (
        vehicleNumber,
        ownerName,
        vehicleType,
        slotNumber,
        entryTime,
        entryDate
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
      `,
      [number, ownerName, vehicleType, availableSlot, entryTime, entryDate],
    );

    res.json({
      message: "Vehicle parked successfully.",

      vehicle: {
        id: result.rows[0].id,
        vehicleNumber: number,
        ownerName,
        vehicleType,
        slotNumber: availableSlot,
        entryTime,
      },
    });
  } catch (error) {
    console.error("Vehicle entry error:", error);

    res.status(500).json({
      message: "Could not save vehicle.",
    });
  }
});

// =====================================================
// SEARCH VEHICLE
// =====================================================

app.get(
  "/api/vehicles/search/:vehicleNumber",
  authenticate,
  async (req, res) => {
    try {
      const number = req.params.vehicleNumber.trim().toUpperCase();

      const result = await db.query(
        `
        SELECT *
        FROM vehicles
        WHERE vehicleNumber = $1
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
      console.error(error);

      res.status(500).json({
        message: "Database error.",
      });
    }
  },
);

// =====================================================
// VEHICLE EXIT
// =====================================================

app.post("/api/vehicles/exit", authenticate, async (req, res) => {
  try {
    const { vehicleNumber, exitTime } = req.body;

    if (!vehicleNumber || !exitTime) {
      return res.status(400).json({
        message: "Vehicle number and exit time are required.",
      });
    }

    const number = vehicleNumber.trim().toUpperCase();

    const result = await db.query(
      `
      SELECT *
      FROM vehicles
      WHERE vehicleNumber = $1
      `,
      [number],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Vehicle not found.",
      });
    }

    const vehicle = result.rows[0];

    const entryMinutes = convertToMinutes(vehicle.entrytime);

    const exitMinutes = convertToMinutes(exitTime);

    let duration = exitMinutes - entryMinutes;

    // Vehicle exited next day
    if (duration < 0) {
      duration += 24 * 60;
    }

    let hours = Math.ceil(duration / 60);

    if (hours < 1) {
      hours = 1;
    }

    let rate = 0;

    if (vehicle.vehicletype === "Car") {
      rate = 20;
    } else if (vehicle.vehicletype === "Bike") {
      rate = 10;
    } else if (vehicle.vehicletype === "Auto") {
      rate = 15;
    } else if (vehicle.vehicletype === "Van") {
      rate = 25;
    }

    const fee = hours * rate;

    const exitDate = new Date();

    // Save history
    await db.query(
      `
      INSERT INTO history
      (
        vehicleNumber,
        ownerName,
        vehicleType,
        slotNumber,
        entryTime,
        exitTime,
        duration,
        fee,
        exitDate
      )
      VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        vehicle.vehiclenumber,
        vehicle.ownername,
        vehicle.vehicletype,
        vehicle.slotnumber,
        vehicle.entrytime,
        exitTime,
        hours,
        fee,
        exitDate,
      ],
    );

    // Remove from active vehicles
    await db.query(
      `
      DELETE FROM vehicles
      WHERE id = $1
      `,
      [vehicle.id],
    );

    res.json({
      message: "Vehicle exited successfully.",

      vehicle: {
        vehicleNumber: vehicle.vehiclenumber,
        ownerName: vehicle.ownername,
        vehicleType: vehicle.vehicletype,
        slotNumber: vehicle.slotnumber,
        entryTime: vehicle.entrytime,
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

// =====================================================
// SLOT STATUS
// =====================================================

app.get("/api/slots", authenticate, async (req, res) => {
  try {
    const result = await db.query("SELECT slotNumber FROM vehicles");

    const occupied = result.rows.map((vehicle) => vehicle.slotnumber);

    const slots = [];

    for (let i = 1; i <= 8; i++) {
      const slot = "P0" + i;

      slots.push({
        slotNumber: slot,
        status: occupied.includes(slot) ? "Occupied" : "Available",
      });
    }

    res.json(slots);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Database error.",
    });
  }
});

// =====================================================
// PARKING HISTORY
// =====================================================

app.get("/api/history", authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT *
      FROM history
      ORDER BY id DESC
      `,
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Database error.",
    });
  }
});

// =====================================================
// REPORT
// =====================================================

app.get("/api/report", authenticate, async (req, res) => {
  try {
    const totalSlots = 8;

    const occupiedResult = await db.query(
      `
      SELECT COUNT(*) AS occupied
      FROM vehicles
      `,
    );

    const occupied = Number(occupiedResult.rows[0].occupied);

    const available = totalSlots - occupied;

    const todayResult = await db.query(
      `
      SELECT COUNT(*) AS todayVehicles
      FROM history
      WHERE DATE(exitDate) = CURRENT_DATE
      `,
    );

    const collectionResult = await db.query(
      `
      SELECT COALESCE(SUM(fee), 0) AS collection
      FROM history
      `,
    );

    res.json({
      totalSlots: totalSlots,

      occupiedSlots: occupied,

      availableSlots: available,

      todayVehicles: Number(todayResult.rows[0].todayvehicles),

      totalCollection: Number(collectionResult.rows[0].collection),
    });
  } catch (error) {
    console.error("Report error:", error);

    res.status(500).json({
      message: "Database error.",
    });
  }
});

// =====================================================
// TIME CONVERTER
// =====================================================

function convertToMinutes(time) {
  const parts = time.split(":");

  const hour = parseInt(parts[0]);

  const minute = parseInt(parts[1]);

  return hour * 60 + minute;
}

// =====================================================
// START SERVER
// =====================================================

async function startServer() {
  try {
    // Wait briefly for database initialization
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await createDefaultAdmin();

    app.listen(PORT, () => {
      console.log(`Parking server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
  }
}

startServer();
