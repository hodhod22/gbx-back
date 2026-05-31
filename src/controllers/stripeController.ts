// backend/src/controllers/stripeController.ts
import { Request, Response } from "express";
import Stripe from "stripe";
import { pool } from "../config/database";
import { getUserIdFromToken } from "../middleware/auth";
import { getCurrentGbxSEK } from "../services/gbxPriceService";
import { handlePayoutWebhook } from "./payoutController";
import { AuthRequest } from './../middleware/auth';
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) console.error("STRIPE_SECRET_KEY missing");
const stripe = new Stripe(stripeSecretKey!);
const MINIMUM_AMOUNT_SEK = 3;

const CARD_FEE_PERCENT = 0.025; // 2.5%
const CARD_FEE_FIXED_SEK = 3; // 3 SEK
const PLATFORM_FEE_PERCENT = 0.0005; // 0.05%

async function calculateNetGbx(sekAmount: number): Promise<number> {
  const gbxPriceSEK = await getCurrentGbxSEK();
  const stripeFee = sekAmount * CARD_FEE_PERCENT + CARD_FEE_FIXED_SEK;
  const platformFee = sekAmount * PLATFORM_FEE_PERCENT;
  const netSek = sekAmount - stripeFee - platformFee;
  if (netSek < 0) {
    console.error(`Net amount negative: ${netSek} SEK from ${sekAmount}`);
    return 0;
  }
  return netSek / gbxPriceSEK;
}

// Mappa våra språk till Stripe-accepterad locale
function mapToStripeLocale(
  lang: string,
): Stripe.Checkout.SessionCreateParams.Locale | undefined {
  const mapping: Record<string, string> = {
    sv: "sv",
    en: "en",
    es: "es",
    ru: "ru",
    ar: "ar",
    zh: "zh",
    // persiska (fa) stöds inte – return undefined
  };
  const locale = mapping[lang];
  if (!locale) return undefined;
  // Type assertion – Stripe accepterar dessa strängar
  return locale as Stripe.Checkout.SessionCreateParams.Locale;
}

// ============ CREATE CHECKOUT SESSION ============
export const createCheckoutSession = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const sekAmount = parseFloat(req.body.amount);
  if (isNaN(sekAmount) || sekAmount <= 0) {
    return res.status(400).json({ error: "Ange ett giltigt belopp i SEK" });
  }
  if (sekAmount < MINIMUM_AMOUNT_SEK) {
    return res.status(400).json({
      error: `Minsta köpbelopp är ${MINIMUM_AMOUNT_SEK} SEK.`,
    });
  }

  // Hämta användarens språk från databasen
  const langResult = await pool.query(
    "SELECT language FROM users WHERE id = $1",
    [userId],
  );
  const userLanguage = langResult.rows[0]?.language || "sv";
  const locale = mapToStripeLocale(userLanguage);

  try {
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "sek",
            product_data: { name: "GBX" },
            unit_amount: Math.round(sekAmount * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL}/buy/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/buy/payment`,
      locale: locale,
      metadata: {
        userId: userId.toString(),
        sekAmount: sekAmount.toString(),
      },
    });

    await pool.query(
      `INSERT INTO stripe_sessions (session_id, user_id, amount, status) VALUES ($1, $2, $3, 'pending')`,
      [session.id, userId, 0],
    );

    return res.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error("Stripe checkout error:", error);
    if (
      error.type === "StripeInvalidRequestError" &&
      error.code === "amount_too_small"
    ) {
      return res
        .status(400)
        .json({ error: `Minsta belopp är ${MINIMUM_AMOUNT_SEK} SEK` });
    }
    return res.status(500).json({ error: "Kunde inte skapa betalning" });
  }
};

// ============ VERIFY SESSION ============
export const verifySession = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const sessionId = req.query.session_id as string;
  if (!sessionId) return res.status(400).json({ error: "Missing session_id" });

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return res.status(400).json({ error: "Payment not completed" });
    }

    const existing = await pool.query(
      "SELECT id, status FROM stripe_sessions WHERE session_id = $1",
      [sessionId],
    );
    if (existing.rows.length > 0 && existing.rows[0].status === "completed") {
      return res.json({ success: true, message: "Already processed" });
    }

    const userId = session.metadata?.userId
      ? parseInt(session.metadata.userId)
      : null;
    const sekAmount = session.metadata?.sekAmount
      ? parseFloat(session.metadata.sekAmount)
      : null;
    if (!userId || !sekAmount) {
      return res.status(400).json({ error: "Invalid session metadata" });
    }

    const netGbx = await calculateNetGbx(sekAmount);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "UPDATE gbx_balances SET balance = balance + $1 WHERE user_id = $2",
        [netGbx, userId],
      );
      await client.query(
        `INSERT INTO gbx_transactions (sender_id, recipient_id, amount, status, created_at)
         VALUES ($1, NULL, $2, 'completed', NOW())`,
        [userId, netGbx],
      );
      await client.query(
        `UPDATE stripe_sessions SET status = 'completed', completed_at = NOW(), amount = $1 WHERE session_id = $2`,
        [netGbx, sessionId],
      );
      await client.query("COMMIT");
      return res.json({
        success: true,
        message: `Added ${netGbx} GBX to user ${userId}`,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Verify-session DB error:", err);
      return res.status(500).json({ error: "Database error" });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Stripe verify error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ============ STRIPE WEBHOOK ============
export const stripeWebhook = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET missing");
    return res.status(500).send("Webhook secret not configured");
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    const error = err as Error;
    console.error("Webhook signature verification failed:", error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    if (!session.metadata) {
      console.error("Missing metadata in Stripe session");
      return res.status(200).send("OK");
    }

    const userId = parseInt(session.metadata.userId);
    const sekAmount = parseFloat(session.metadata.sekAmount);
    if (isNaN(userId) || isNaN(sekAmount)) {
      console.error("Invalid metadata in Stripe session");
      return res.status(200).send("OK");
    }

    const netGbx = await calculateNetGbx(sekAmount);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query(
        "SELECT id FROM stripe_sessions WHERE session_id = $1 AND status = 'completed'",
        [session.id],
      );
      if (existing.rows.length === 0) {
        await client.query(
          "UPDATE gbx_balances SET balance = balance + $1 WHERE user_id = $2",
          [netGbx, userId],
        );
        await client.query(
          "UPDATE stripe_sessions SET status = 'completed', completed_at = NOW(), amount = $1 WHERE session_id = $2",
          [netGbx, session.id],
        );
        await client.query(
          `INSERT INTO gbx_transactions (sender_id, recipient_id, amount, status, created_at)
           VALUES ($1, NULL, $2, 'completed', NOW())`,
          [userId, netGbx],
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Webhook DB error:", err);
    } finally {
      client.release();
    }
  }

  if (event.type === "payout.paid" || event.type === "payout.failed") {
    await handlePayoutWebhook(event);
  }

  return res.json({ received: true });
};

// ============ TEST-ENDPOINT ============
export const testStripe = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const session = await stripe.checkout.sessions.create({
      success_url: "http://localhost:3000/success",
      cancel_url: "http://localhost:3000/cancel",
      line_items: [
        {
          price_data: {
            currency: "sek",
            product_data: { name: "Test Product" },
            unit_amount: 1000,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
    });
    return res.json({ success: true, url: session.url });
  } catch (error: any) {
    console.error("Test Stripe error:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const updateLanguage = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { language } = req.body;
  if (!language || typeof language !== "string") {
    return res.status(400).json({ error: "Language is required" });
  }

  // Validera att språket är ett av de som stöds
  const supported = ["sv", "en", "es", "ru", "fa", "ar", "zh"];
  if (!supported.includes(language)) {
    return res.status(400).json({ error: "Unsupported language" });
  }

  await pool.query("UPDATE users SET language = $1 WHERE id = $2", [
    language,
    userId,
  ]);
  return res.json({ success: true, language });
};