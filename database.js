const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Keep the database inside the backend folder
const databasePath = path.join(__dirname, "parking.db");

const db = new sqlite3.Database(databasePath, (err) => {
  if (err) {
    console.error("Database connection failed:", err.message);
  } else {
    console.log("Connected to parking database.");
  }
});

db.serialize(() => {
  // ==================================================
  // ADMIN TABLE
  // ==================================================

  db.run(`
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    `);

  // ==================================================
  // ACTIVE VEHICLES TABLE
  // ==================================================

  db.run(`
        CREATE TABLE IF NOT EXISTS vehicles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            vehicleNumber TEXT UNIQUE NOT NULL,

            ownerName TEXT NOT NULL,

            vehicleType TEXT NOT NULL,

            slotNumber TEXT UNIQUE NOT NULL,

            entryTime TEXT NOT NULL,

            entryDate TEXT NOT NULL
        )
    `);

  // ==================================================
  // PARKING HISTORY TABLE
  // ==================================================

  db.run(`
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            vehicleNumber TEXT NOT NULL,

            ownerName TEXT NOT NULL,

            vehicleType TEXT NOT NULL,

            slotNumber TEXT NOT NULL,

            entryTime TEXT NOT NULL,

            exitTime TEXT NOT NULL,

            duration INTEGER NOT NULL,

            fee INTEGER NOT NULL,

            exitDate TEXT NOT NULL
        )
    `);
});

module.exports = db;
