import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn(
    "⚠️ DATABASE_URL not set, falling back to local development config",
  );
}

// För säkerhets skull, maskera lösenord i loggar
const maskedUrl = databaseUrl
  ? databaseUrl.replace(/:[^:@]*@/, ":****@")
  : "not set";
console.log(`🔌 Connecting to database: ${maskedUrl}`);
console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV || "development"}`);

/* const pool = new Pool(
  databaseUrl
    ? {
        connectionString: databaseUrl,
        ssl: isProduction ? { rejectUnauthorized: false } : false,
      }
    : {
        user: "postgres",
        host: "localhost",
        database: "payment_bridge",
        password: "1496",
        port: 5432,
      },
); */
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});
// Test connection (optional)
pool.connect((err, client, release) => {
  if (err) {
    console.error("❌ Database error:", err.message);
    console.error("DATABASE_URL set?", !!databaseUrl);
    if (
      err.message.includes("ENOTFOUND") ||
      err.message.includes("getaddrinfo")
    ) {
      console.error(
        "💡 Hint: Check that your DATABASE_URL uses the correct hostname. For Render, use the internal URL (starting with postgresql://...render.com)",
      );
    }
  } else {
    console.log("✅ Database connected");
    if (client) {
      client.query("SELECT current_database()", (queryErr, res) => {
        if (!queryErr) {
          console.log("📌 Current database:", res?.rows[0]?.current_database);
        }
        release();
      });
    } else {
      release?.();
    }
  }
});

export { pool };
//postgresql://hodhod212:nOyT6qNwQGpilQuhq78fDQ5rAT7O9mej@dpg-d89ch7mq1p3s73fo05b0-a/payment_bridge