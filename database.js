const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password TEXT NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id SERIAL PRIMARY KEY,
        vehicleNumber VARCHAR(50) UNIQUE NOT NULL,
        ownerName VARCHAR(150) NOT NULL,
        vehicleType VARCHAR(50) NOT NULL,
        slotNumber VARCHAR(10) NOT NULL,
        entryTime VARCHAR(20) NOT NULL,
        entryDate TIMESTAMP NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS history (
        id SERIAL PRIMARY KEY,
        vehicleNumber VARCHAR(50) NOT NULL,
        ownerName VARCHAR(150) NOT NULL,
        vehicleType VARCHAR(50) NOT NULL,
        slotNumber VARCHAR(10) NOT NULL,
        entryTime VARCHAR(20) NOT NULL,
        exitTime VARCHAR(20) NOT NULL,
        duration INTEGER NOT NULL,
        fee NUMERIC(10, 2) NOT NULL,
        exitDate TIMESTAMP NOT NULL
      )
    `);

    console.log("PostgreSQL database initialized successfully.");
  } catch (error) {
    console.error("Database initialization error:", error);
  }
}

initializeDatabase();

module.exports = pool;
