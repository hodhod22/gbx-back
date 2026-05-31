"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePayoutWebhook = exports.getOnboardingLink = exports.requestPayout = exports.getMaxPayout = exports.checkStripeAccountStatus = exports.getOrCreateStripeAccount = void 0;
const stripe_1 = __importDefault(require("stripe"));
const auth_1 = require("../middleware/auth");
const gbxPriceService_1 = require("../services/gbxPriceService");
const database_1 = require("../config/database");
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey)
    throw new Error("STRIPE_SECRET_KEY missing");
const stripe = new stripe_1.default(stripeSecretKey);
// ============ GET OR CREATE STRIPE ACCOUNT ============
const getOrCreateStripeAccount = async (userId, email) => {
    const userRes = await database_1.pool.query("SELECT stripe_account_id FROM users WHERE id = $1", [userId]);
    let stripeAccountId = userRes.rows[0]?.stripe_account_id;
    if (!stripeAccountId) {
        const account = await stripe.accounts.create({
            type: "express",
            country: "SE",
            email: email,
            capabilities: { transfers: { requested: true } },
        });
        stripeAccountId = account.id;
        await database_1.pool.query("UPDATE users SET stripe_account_id = $1 WHERE id = $2", [
            stripeAccountId,
            userId,
        ]);
        console.log(`Created Stripe Connect account for user ${userId}: ${stripeAccountId}`);
    }
    return stripeAccountId;
};
exports.getOrCreateStripeAccount = getOrCreateStripeAccount;
// ============ CHECK IF USER HAS CONNECTED BANK ACCOUNT ============
const checkStripeAccountStatus = async (req, res) => {
    const userId = (0, auth_1.getUserIdFromToken)(req);
    if (!userId)
        return res.status(401).json({ error: "Unauthorized" });
    const userRes = await database_1.pool.query("SELECT stripe_account_id FROM users WHERE id = $1", [userId]);
    const stripeAccountId = userRes.rows[0]?.stripe_account_id;
    if (!stripeAccountId) {
        return res.json({ hasConnectedAccount: false, isOnboarded: false });
    }
    try {
        const account = await stripe.accounts.retrieve(stripeAccountId);
        const isOnboarded = account.charges_enabled && account.payouts_enabled;
        return res.json({
            hasConnectedAccount: true,
            isOnboarded: isOnboarded,
        });
    }
    catch (error) {
        console.error("Error checking account status:", error);
        return res.json({ hasConnectedAccount: true, isOnboarded: false });
    }
};
exports.checkStripeAccountStatus = checkStripeAccountStatus;
// ============ GET MAX PAYOUT ============
const getMaxPayout = async (req, res) => {
    const userId = (0, auth_1.getUserIdFromToken)(req);
    if (!userId)
        return res.status(401).json({ error: "Unauthorized" });
    const balanceRes = await database_1.pool.query("SELECT balance FROM gbx_balances WHERE user_id = $1", [userId]);
    const balance = parseFloat(balanceRes.rows[0]?.balance || 0);
    if (balance <= 0) {
        return res.json({
            maxNetSek: 0,
            bruttoSek: 0,
            fees: { percent: 0.003, fixedSek: 0 },
        });
    }
    const gbxPriceSEK = await (0, gbxPriceService_1.getCurrentGbxSEK)();
    const totalBruttoSek = balance * gbxPriceSEK;
    // Fast avgift i SEK (ingen USD-konvertering)
    const fixedFeeSek = 0.25;
    const percentFee = 0.003;
    let maxNetSek = totalBruttoSek * (1 - percentFee) - fixedFeeSek;
    if (maxNetSek < 0)
        maxNetSek = 0;
    if (maxNetSek < 100)
        maxNetSek = 0;
    return res.json({
        maxNetSek,
        bruttoSek: totalBruttoSek,
        fees: { percent: percentFee * 100, fixedSek: fixedFeeSek },
        gbxPriceSEK,
    });
};
exports.getMaxPayout = getMaxPayout;
// ============ REQUEST PAYOUT ============
const requestPayout = async (req, res) => {
    const userId = (0, auth_1.getUserIdFromToken)(req);
    if (!userId)
        return res.status(401).json({ error: "Unauthorized" });
    const { netAmountSek, method, isInstant } = req.body;
    if (!netAmountSek || netAmountSek <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
    }
    const userRes = await database_1.pool.query("SELECT stripe_account_id, email FROM users WHERE id = $1", [userId]);
    let stripeAccountId = userRes.rows[0]?.stripe_account_id;
    const email = userRes.rows[0]?.email;
    if (!stripeAccountId) {
        stripeAccountId = await (0, exports.getOrCreateStripeAccount)(userId, email);
    }
    try {
        const account = await stripe.accounts.retrieve(stripeAccountId);
        if (!account.charges_enabled || !account.payouts_enabled) {
            return res.status(400).json({
                error: "Please complete bank account onboarding first",
                onboardingRequired: true,
            });
        }
    }
    catch (error) {
        console.error("Error retrieving account:", error);
        return res.status(400).json({
            error: "Bank account not properly configured",
            onboardingRequired: true,
        });
    }
    const balanceRes = await database_1.pool.query("SELECT balance, COALESCE(reserved, 0) as reserved FROM gbx_balances WHERE user_id = $1", [userId]);
    const balance = parseFloat(balanceRes.rows[0]?.balance || 0);
    const reserved = parseFloat(balanceRes.rows[0]?.reserved || 0);
    const available = balance - reserved;
    if (available <= 0) {
        return res.status(400).json({ error: "Insufficient balance" });
    }
    const gbxPriceSEK = await (0, gbxPriceService_1.getCurrentGbxSEK)();
    let fixedFeeSek = 0.25;
    let percentFee = 0.003;
    if (isInstant) {
        percentFee = 0.01;
        fixedFeeSek = 0.5;
    }
    const bruttoSek = (netAmountSek + fixedFeeSek) / (1 - percentFee);
    const requiredGbx = bruttoSek / gbxPriceSEK;
    if (requiredGbx > available) {
        return res.status(400).json({ error: "Insufficient balance" });
    }
    const client = await database_1.pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("UPDATE gbx_balances SET balance = balance - $1, reserved = reserved + $1 WHERE user_id = $2", [requiredGbx, userId]);
        await stripe.transfers.create({
            amount: Math.round(bruttoSek * 100),
            currency: "sek",
            destination: stripeAccountId,
        });
        const payoutOptions = {
            amount: Math.round(bruttoSek * 100),
            currency: "sek",
        };
        if (isInstant)
            payoutOptions.method = "instant";
        const payout = await stripe.payouts.create(payoutOptions, {
            stripeAccount: stripeAccountId,
        });
        const methodName = method || "card";
        await client.query(`INSERT INTO payouts (user_id, payout_id, amount_brutto_sek, amount_net_sek, gbx_amount, status, method)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6)`, [userId, payout.id, bruttoSek, netAmountSek, requiredGbx, methodName]);
        await client.query("COMMIT");
        return res.json({
            success: true,
            payoutId: payout.id,
            amountNet: netAmountSek,
            estimatedDays: isInstant ? "30 minutes" : "2-7 business days",
        });
    }
    catch (err) {
        await client.query("ROLLBACK");
        console.error("Payout error:", err);
        return res.status(500).json({ error: err.message || "Payout failed" });
    }
    finally {
        client.release();
    }
};
exports.requestPayout = requestPayout;
// ============ GET ONBOARDING LINK ============
const getOnboardingLink = async (req, res) => {
    const userId = (0, auth_1.getUserIdFromToken)(req);
    if (!userId)
        return res.status(401).json({ error: "Unauthorized" });
    const userRes = await database_1.pool.query("SELECT email FROM users WHERE id = $1", [
        userId,
    ]);
    const email = userRes.rows[0]?.email;
    if (!email)
        return res.status(400).json({ error: "User email not found" });
    const stripeAccountId = await (0, exports.getOrCreateStripeAccount)(userId, email);
    const origin = req.headers.origin || process.env.FRONTEND_URL || "http://localhost:3000";
    const accountLink = await stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: `${origin}/dashboard/withdraw?onboarding=refresh`,
        return_url: `${origin}/dashboard/withdraw?onboarding=success`,
        type: "account_onboarding",
    });
    return res.json({ url: accountLink.url });
};
exports.getOnboardingLink = getOnboardingLink;
// ============ WEBHOOK HANDLER ============
const handlePayoutWebhook = async (event) => {
    const payout = event.data.object;
    if (event.type === "payout.paid") {
        await database_1.pool.query(`UPDATE payouts SET status = 'completed', completed_at = NOW() WHERE payout_id = $1`, [payout.id]);
        const payoutRes = await database_1.pool.query("SELECT user_id, gbx_amount FROM payouts WHERE payout_id = $1", [payout.id]);
        if (payoutRes.rows.length > 0) {
            const { user_id, gbx_amount } = payoutRes.rows[0];
            await database_1.pool.query("UPDATE gbx_balances SET reserved = reserved - $1 WHERE user_id = $2", [gbx_amount, user_id]);
            console.log(`Payout ${payout.id} completed for user ${user_id}`);
        }
    }
    else if (event.type === "payout.failed") {
        const payoutRes = await database_1.pool.query("SELECT user_id, gbx_amount FROM payouts WHERE payout_id = $1", [payout.id]);
        if (payoutRes.rows.length > 0) {
            const { user_id, gbx_amount } = payoutRes.rows[0];
            await database_1.pool.query("UPDATE gbx_balances SET balance = balance + $1, reserved = reserved - $1 WHERE user_id = $2", [gbx_amount, user_id]);
            console.log(`Payout ${payout.id} failed for user ${user_id}`);
        }
        await database_1.pool.query(`UPDATE payouts SET status = 'failed' WHERE payout_id = $1`, [payout.id]);
    }
};
exports.handlePayoutWebhook = handlePayoutWebhook;
//# sourceMappingURL=payoutController.js.map