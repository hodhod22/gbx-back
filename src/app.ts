import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes";
import gbxRoutes from "./routes/gbxRoutes";
import stripeRoutes from "./routes/stripeRoutes";

import userRoutes from "./routes/userRoutes";
import { stripeWebhook } from "./controllers/stripeController";
import payoutRoutes from "./routes/payoutRoutes";
import { pool } from "./config/database";
import feesRoutes from "./routes/feesRoutes";

const app = express();
// Webhook must be raw body
// Lägg till detta före dina andra routes
app.get("/api/debug-env", (req, res) => {
  res.json({
    node_env: process.env.NODE_ENV,
    database_url_exists: !!process.env.DATABASE_URL,
    jwt_secret_exists: !!process.env.JWT_SECRET,
    port: process.env.PORT,
  });
});

app.get("/api/debug-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT COUNT(*) FROM users");
    res.json({ users: result.rows[0].count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook,
);

const allowedOrigins = [
  "http://localhost:3000", // lokal utveckling (frontend)
  "http://localhost:5173", // om du använder Vite
  "https://www.poolbeferest.com",
  "https://poolbeferest.com",
  "https://gbx-front-f1ywygwe2-hodhod22s-projects.vercel.app", // tillfällig Vercel-domän (valfritt)
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Tillåt förfrågningar utan origin (t.ex. från Postman eller mobila appar)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // viktigt om du använder cookies/sessions
  }),
);
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/gbx", gbxRoutes);
app.use("/api/stripe", stripeRoutes);

app.use("/api/users", userRoutes);
app.use("/api/gbx", payoutRoutes);
app.use("/api/fees", feesRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Payment Bridge API is running!" });
});

// Schema endpoint (optional)
app.get("/api/schema", async (req, res) => {
  try {
    const tables = [
      "users",
      "gbx_balances",
      "gbx_transactions",
      "crisis_events",
      "currency_rate_snapshots",
      "metal_price_snapshots",
      "gbx_historical_rates",
    ];
    const schema: any = {};
    const { pool } = await import("./config/database");
    for (const table of tables) {
      const result = await pool.query(
        `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
        [table],
      );
      schema[table] = result.rows;
    }
    return res.json(schema);
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

// Lägg detta ALLRA LÄNGST NER i din app.ts, efter alla routes och middleware
// och före export default app

// Global error handler - måste ha 4 parametrar med any-typer
app.use((err: any, req: any, res: any, next: any) => {
  console.error("=== GLOBAL ERROR HANDLER ===");
  console.error("Error message:", err.message);
  console.error("Error stack:", err.stack);
  console.error("Request URL:", req.url);
  console.error("Request method:", req.method);
  
  if (req.body) {
    console.error("Request body:", JSON.stringify(req.body));
  }
  
  res.status(500).json({ 
    error: "Internal server error",
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

export default app;

