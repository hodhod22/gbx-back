"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const gbxRoutes_1 = __importDefault(require("./routes/gbxRoutes"));
const stripeRoutes_1 = __importDefault(require("./routes/stripeRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const stripeController_1 = require("./controllers/stripeController");
const payoutRoutes_1 = __importDefault(require("./routes/payoutRoutes"));
const database_1 = require("./config/database");
const feesRoutes_1 = __importDefault(require("./routes/feesRoutes"));
const app = (0, express_1.default)();
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
        const result = await database_1.pool.query("SELECT COUNT(*) FROM users");
        res.json({ users: result.rows[0].count });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.post("/api/stripe/webhook", express_1.default.raw({ type: "application/json" }), stripeController_1.stripeWebhook);
const allowedOrigins = [
    "http://localhost:3000", // lokal utveckling (frontend)
    "http://localhost:5173", // om du använder Vite
    "https://www.poolbeferest.com",
    "https://poolbeferest.com",
    "https://gbx-front-f1ywygwe2-hodhod22s-projects.vercel.app", // tillfällig Vercel-domän (valfritt)
];
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        // Tillåt förfrågningar utan origin (t.ex. från Postman eller mobila appar)
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true, // viktigt om du använder cookies/sessions
}));
app.use(express_1.default.json());
// Routes
app.use("/api/auth", authRoutes_1.default);
app.use("/api/gbx", gbxRoutes_1.default);
app.use("/api/stripe", stripeRoutes_1.default);
app.use("/api/users", userRoutes_1.default);
app.use("/api/gbx", payoutRoutes_1.default);
app.use("/api/fees", feesRoutes_1.default);
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
        const schema = {};
        const { pool } = await Promise.resolve().then(() => __importStar(require("./config/database")));
        for (const table of tables) {
            const result = await pool.query(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`, [table]);
            schema[table] = result.rows;
        }
        return res.json(schema);
    }
    catch (error) {
        return res.status(500).json({ error: String(error) });
    }
});
// Lägg detta ALLRA LÄNGST NER i din app.ts, efter alla routes och middleware
// och före export default app
// Global error handler - måste ha 4 parametrar med any-typer
app.use((err, req, res, next) => {
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
exports.default = app;
//# sourceMappingURL=app.js.map