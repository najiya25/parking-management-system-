const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const db = require("./database");

const app = express();
const PORT = 3000;

const JWT_SECRET = "parking-system-secret-key";

app.use(cors());
app.use(express.json());

// Serve your frontend files
app.use(express.static(path.join(__dirname, "..")));

// ======================================================
// CREATE DEFAULT ADMIN
// Username: admin
// Password: 1234
// ======================================================

bcrypt.hash("1234", 10, (err, hashedPassword) => {
  if (err) {
    console.error("Error creating admin password:", err);
    return;
  }

  db.run(
    `INSERT OR IGNORE INTO admins (username, password)
         VALUES (?, ?)`,
    ["admin", hashedPassword],
    (error) => {
      if (error) {
        console.error("Error creating admin:", error);
      } else {
        console.log("Default admin account ready.");
      }
    },
  );
});

// ======================================================
// AUTHENTICATION MIDDLEWARE
// ======================================================

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "Access denied. Please login.",
    });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      message: "Invalid token.",
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        message: "Token expired or invalid.",
      });
    }

    req.user = user;
    next();
  });
}

// ======================================================
// LOGIN
// ======================================================

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      message: "Username and password are required.",
    });
  }

  db.get(
    `SELECT * FROM admins WHERE username = ?`,
    [username],
    async (err, admin) => {
      if (err) {
        console.error(err);

        return res.status(500).json({
          message: "Database error.",
        });
      }

      if (!admin) {
        return res.status(401).json({
          message: "Invalid username or password!",
        });
      }

      const passwordMatch = await bcrypt.compare(password, admin.password);

      if (!passwordMatch) {
        return res.status(401).json({
          message: "Invalid username or password!",
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
        message: "Login successful!",
        token: token,
        username: admin.username,
      });
    },
  );
});

// ======================================================
// GET ALL ACTIVE VEHICLES
// ======================================================

app.get("/api/vehicles", authenticateToken, (req, res) => {
  db.all(
    `SELECT *
         FROM vehicles
         ORDER BY id DESC`,
    [],
    (err, rows) => {
      if (err) {
        console.error(err);

        return res.status(500).json({
          message: "Database error.",
        });
      }

      res.json(rows);
    },
  );
});

// ======================================================
// VEHICLE ENTRY
// ======================================================

app.post("/api/vehicles/entry", authenticateToken, (req, res) => {
  let { vehicleNumber, ownerName, vehicleType, entryTime } = req.body;

  if (!vehicleNumber || !ownerName || !vehicleType || !entryTime) {
    return res.status(400).json({
      message: "All vehicle details are required.",
    });
  }

  vehicleNumber = vehicleNumber.trim().toUpperCase();

  // Check whether vehicle is already inside
  db.get(
    `SELECT *
         FROM vehicles
         WHERE vehicleNumber = ?`,
    [vehicleNumber],
    (err, existingVehicle) => {
      if (err) {
        console.error(err);

        return res.status(500).json({
          message: "Database error.",
        });
      }

      if (existingVehicle) {
        return res.status(400).json({
          message: "This vehicle is already inside the parking area.",
        });
      }

      // Find an available parking slot
      db.get(
        `SELECT slotNumber
                 FROM (
                     SELECT 'P01' AS slotNumber
                     UNION ALL SELECT 'P02'
                     UNION ALL SELECT 'P03'
                     UNION ALL SELECT 'P04'
                     UNION ALL SELECT 'P05'
                     UNION ALL SELECT 'P06'
                     UNION ALL SELECT 'P07'
                     UNION ALL SELECT 'P08'
                 )
                 WHERE slotNumber NOT IN (
                     SELECT slotNumber FROM vehicles
                 )
                 LIMIT 1`,
        [],
        (slotError, slot) => {
          if (slotError) {
            console.error(slotError);

            return res.status(500).json({
              message: "Unable to find parking slot.",
            });
          }

          if (!slot) {
            return res.status(400).json({
              message: "Parking is full. No slots available.",
            });
          }

          const entryDate = new Date().toISOString();

          db.run(
            `INSERT INTO vehicles
                        (
                            vehicleNumber,
                            ownerName,
                            vehicleType,
                            slotNumber,
                            entryTime,
                            entryDate
                        )
                        VALUES (?, ?, ?, ?, ?, ?)`,
            [
              vehicleNumber,
              ownerName,
              vehicleType,
              slot.slotNumber,
              entryTime,
              entryDate,
            ],
            function (insertError) {
              if (insertError) {
                console.error(insertError);

                return res.status(500).json({
                  message: "Unable to save vehicle.",
                });
              }

              res.json({
                message: "Vehicle entry recorded successfully.",
                vehicle: {
                  id: this.lastID,
                  vehicleNumber: vehicleNumber,
                  ownerName: ownerName,
                  vehicleType: vehicleType,
                  slotNumber: slot.slotNumber,
                  entryTime: entryTime,
                },
              });
            },
          );
        },
      );
    },
  );
});

// ======================================================
// SEARCH VEHICLE
// ======================================================

app.get(
  "/api/vehicles/search/:vehicleNumber",
  authenticateToken,
  (req, res) => {
    const vehicleNumber = req.params.vehicleNumber.trim().toUpperCase();

    db.get(
      `SELECT *
             FROM vehicles
             WHERE vehicleNumber = ?`,
      [vehicleNumber],
      (err, vehicle) => {
        if (err) {
          console.error(err);

          return res.status(500).json({
            message: "Database error.",
          });
        }

        if (!vehicle) {
          return res.status(404).json({
            message: "Vehicle not found.",
          });
        }

        // Important:
        // script.js expects data.vehicle
        res.json({
          vehicle: vehicle,
        });
      },
    );
  },
);

// ======================================================
// VEHICLE EXIT
// ======================================================

app.post("/api/vehicles/exit", authenticateToken, (req, res) => {
  let { vehicleNumber, exitTime } = req.body;

  if (!vehicleNumber || !exitTime) {
    return res.status(400).json({
      message: "Vehicle number and exit time are required.",
    });
  }

  vehicleNumber = vehicleNumber.trim().toUpperCase();

  db.get(
    `SELECT *
         FROM vehicles
         WHERE vehicleNumber = ?`,
    [vehicleNumber],
    (err, vehicle) => {
      if (err) {
        console.error(err);

        return res.status(500).json({
          message: "Database error.",
        });
      }

      if (!vehicle) {
        return res.status(404).json({
          message: "Vehicle not found or already exited.",
        });
      }

      // Convert HH:MM into minutes
      const convertToMinutes = (time) => {
        const parts = time.split(":");

        const hours = parseInt(parts[0]);
        const minutes = parseInt(parts[1]);

        return hours * 60 + minutes;
      };

      let entryMinutes = convertToMinutes(vehicle.entryTime);

      let exitMinutes = convertToMinutes(exitTime);

      // If exit time is after midnight
      if (exitMinutes < entryMinutes) {
        exitMinutes += 24 * 60;
      }

      let durationMinutes = exitMinutes - entryMinutes;

      // Minimum 1 minute
      if (durationMinutes < 1) {
        durationMinutes = 1;
      }

      // Convert duration into hours
      const durationHours = Math.ceil(durationMinutes / 60);

      // Parking rates
      const rates = {
        Car: 20,
        Bike: 10,
        Auto: 15,
        Van: 25,
      };

      const rate = rates[vehicle.vehicleType] || 20;

      const fee = durationHours * rate;

      const exitDate = new Date().toISOString();

      // Save vehicle in history
      db.run(
        `INSERT INTO history
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
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          vehicle.vehicleNumber,
          vehicle.ownerName,
          vehicle.vehicleType,
          vehicle.slotNumber,
          vehicle.entryTime,
          exitTime,
          durationHours,
          fee,
          exitDate,
        ],
        function (historyError) {
          if (historyError) {
            console.error(historyError);

            return res.status(500).json({
              message: "Unable to save exit history.",
            });
          }

          // Remove vehicle from active parking
          db.run(
            `DELETE FROM vehicles
                         WHERE id = ?`,
            [vehicle.id],
            function (deleteError) {
              if (deleteError) {
                console.error(deleteError);

                return res.status(500).json({
                  message: "Vehicle exit could not be completed.",
                });
              }

              // Important:
              // script.js expects data.vehicle
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

                duration: durationHours,
                fee: fee,
              });
            },
          );
        },
      );
    },
  );
});

// ======================================================
// GET PARKING SLOTS
// ======================================================

app.get("/api/slots", authenticateToken, (req, res) => {
  db.all(
    `SELECT slotNumber
         FROM vehicles`,
    [],
    (err, occupiedRows) => {
      if (err) {
        console.error(err);

        return res.status(500).json({
          message: "Database error.",
        });
      }

      const occupiedSlots = occupiedRows.map((row) => row.slotNumber);

      const slots = [];

      for (let i = 1; i <= 8; i++) {
        const slotNumber = "P" + String(i).padStart(2, "0");

        slots.push({
          slotNumber: slotNumber,
          status: occupiedSlots.includes(slotNumber) ? "Occupied" : "Available",
        });
      }

      res.json(slots);
    },
  );
});

// ======================================================
// GET PARKING HISTORY
// ======================================================

app.get("/api/history", authenticateToken, (req, res) => {
  db.all(
    `SELECT *
         FROM history
         ORDER BY id DESC`,
    [],
    (err, rows) => {
      if (err) {
        console.error(err);

        return res.status(500).json({
          message: "Database error.",
        });
      }

      res.json(rows);
    },
  );
});

// ======================================================
// PARKING REPORT
// ======================================================

app.get("/api/report", authenticateToken, (req, res) => {
  db.get(
    `SELECT COUNT(*) AS occupiedSlots
         FROM vehicles`,
    [],
    (err, occupiedResult) => {
      if (err) {
        console.error(err);

        return res.status(500).json({
          message: "Database error.",
        });
      }

      db.get(
        `SELECT COUNT(*) AS todayVehicles
                 FROM history
                 WHERE DATE(exitDate) = DATE('now')`,
        [],
        (todayErr, todayResult) => {
          if (todayErr) {
            console.error(todayErr);

            return res.status(500).json({
              message: "Database error.",
            });
          }

          db.get(
            `SELECT COALESCE(SUM(fee), 0)
                         AS totalCollection
                         FROM history`,
            [],
            (collectionErr, collectionResult) => {
              if (collectionErr) {
                console.error(collectionErr);

                return res.status(500).json({
                  message: "Database error.",
                });
              }

              const totalSlots = 8;

              const occupiedSlots = occupiedResult.occupiedSlots;

              const availableSlots = totalSlots - occupiedSlots;

              res.json({
                totalSlots: totalSlots,
                occupiedSlots: occupiedSlots,
                availableSlots: availableSlots,
                todayVehicles: todayResult.todayVehicles,
                totalCollection: collectionResult.totalCollection,
              });
            },
          );
        },
      );
    },
  );
});

// ======================================================
// START SERVER
// ======================================================

app.listen(PORT, () => {
  console.log("----------------------------------------");
  console.log("Parking Management System Backend");
  console.log("----------------------------------------");
  console.log(`Server running at: http://localhost:${PORT}`);
  console.log(`Login page: http://localhost:${PORT}/login.html`);
  console.log("----------------------------------------");
});
