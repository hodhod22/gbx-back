"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGbxPriceSEK = exports.transferGbx = exports.getTransactions = exports.getBalance = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../config/database");
const gbxPriceService_1 = require("../services/gbxPriceService");
// ============ BALANCE ============
const getBalance = async (req, res) => {
    const userId = req.user?.id;
    if (!userId)
        return res.status(401).json({ error: "Unauthorized" });
    const result = await database_1.pool.query("SELECT balance FROM gbx_balances WHERE user_id = $1", [userId]);
    const balance = result.rows.length ? parseFloat(result.rows[0].balance) : 0;
    return res.json({ balance });
};
exports.getBalance = getBalance;
// ============ TRANSACTIONS ============
const getTransactions = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    try {
        const transfersQuery = `
      SELECT 
        id,
        sender_id,
        recipient_id,
        amount,
        status,
        created_at,
        'transfer' as category,
        CASE 
          WHEN sender_id = $1 THEN 'sent'
          WHEN recipient_id = $1 THEN 'received'
        END as direction,
        CASE 
          WHEN sender_id = $1 THEN (SELECT name FROM users WHERE id = recipient_id)
          WHEN recipient_id = $1 THEN (SELECT name FROM users WHERE id = sender_id)
        END as counterparty_name
      FROM gbx_transactions
      WHERE sender_id = $1 OR recipient_id = $1
    `;
        const depositsQuery = `
      SELECT 
        session_id as id,
        user_id,
        amount as gbx_amount,
        status,
        completed_at as created_at,
        'deposit' as category,
        'buy' as direction,
        NULL as counterparty_name
      FROM stripe_sessions
      WHERE user_id = $1 AND status = 'completed'
    `;
        const withdrawalsQuery = `
      SELECT 
        id::text,
        user_id,
        gbx_amount as amount,
        status,
        created_at,
        'withdrawal' as category,
        'sell' as direction,
        NULL as counterparty_name
      FROM payouts
      WHERE user_id = $1
    `;
        const [transfers, deposits, withdrawals] = await Promise.all([
            database_1.pool.query(transfersQuery, [userId]),
            database_1.pool.query(depositsQuery, [userId]),
            database_1.pool.query(withdrawalsQuery, [userId]),
        ]);
        const allTx = [
            ...transfers.rows.map((row) => ({
                id: `transfer_${row.id}`,
                type: row.direction === "sent" ? "transfer_sent" : "transfer_received",
                amount: parseFloat(row.amount),
                counterparty_name: row.counterparty_name,
                status: row.status,
                created_at: row.created_at,
            })),
            ...deposits.rows.map((row) => ({
                id: `deposit_${row.id}`,
                type: "deposit",
                amount: parseFloat(row.gbx_amount),
                counterparty_name: null,
                status: "completed",
                created_at: row.created_at,
            })),
            ...withdrawals.rows.map((row) => ({
                id: `withdrawal_${row.id}`,
                type: "withdrawal",
                amount: parseFloat(row.amount),
                counterparty_name: null,
                status: row.status,
                created_at: row.created_at,
            })),
        ];
        allTx.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const paginated = allTx.slice(offset, offset + limit);
        res.json({ transactions: paginated });
    }
    catch (error) {
        console.error("Transactions error:", error);
        res.status(500).json({ error: "Failed to fetch transactions" });
    }
};
exports.getTransactions = getTransactions;
// ============ TRANSFER GBX (INTERNAL) ============
const transferGbx = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token)
            return res.status(401).json({ error: "No token provided" });
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || "ditt-hemliga-jwt-lösenord");
        const senderId = decoded.userId;
        // Ingen pending-kontroll längre – borttagen
        const { recipientGbxId, amount } = req.body;
        if (!recipientGbxId || !amount || amount <= 0) {
            return res.status(400).json({ error: "Invalid recipient or amount" });
        }
        const recipientRes = await database_1.pool.query("SELECT id, name FROM users WHERE gbx_id = $1", [recipientGbxId]);
        if (recipientRes.rows.length === 0)
            return res.status(404).json({ error: "Recipient not found" });
        const recipientId = recipientRes.rows[0].id;
        const recipientName = recipientRes.rows[0].name;
        if (senderId === recipientId)
            return res.status(400).json({ error: "You cannot send GBX to yourself" });
        const client = await database_1.pool.connect();
        try {
            await client.query("BEGIN");
            const senderBalanceRes = await client.query("SELECT balance FROM gbx_balances WHERE user_id = $1 FOR UPDATE", [senderId]);
            if (senderBalanceRes.rows.length === 0)
                throw new Error("Sender balance not found");
            const senderBalance = parseFloat(senderBalanceRes.rows[0].balance);
            if (senderBalance < amount)
                throw new Error("Insufficient GBX balance");
            await client.query("UPDATE gbx_balances SET balance = balance - $1 WHERE user_id = $2", [amount, senderId]);
            await client.query("UPDATE gbx_balances SET balance = balance + $1 WHERE user_id = $2", [amount, recipientId]);
            await client.query(`INSERT INTO gbx_transactions (sender_id, recipient_id, amount, status, created_at)
         VALUES ($1, $2, $3, 'completed', NOW())`, [senderId, recipientId, amount]);
            await client.query("COMMIT");
            return res.json({
                success: true,
                message: `Sent ${amount} GBX to ${recipientName} (${recipientGbxId})`,
            });
        }
        catch (err) {
            await client.query("ROLLBACK");
            throw err;
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error("Transfer error:", error);
        return res
            .status(500)
            .json({ error: error.message || "Internal server error" });
    }
};
exports.transferGbx = transferGbx;
// ============ GBX PRICE IN SEK ============
const getGbxPriceSEK = async (req, res) => {
    try {
        const price = await (0, gbxPriceService_1.getCurrentGbxSEK)();
        res.json({ currency: "SEK", price_per_gbx: price });
    }
    catch (error) {
        console.error("Error fetching GBX price:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getGbxPriceSEK = getGbxPriceSEK;
//# sourceMappingURL=gbxController.js.map