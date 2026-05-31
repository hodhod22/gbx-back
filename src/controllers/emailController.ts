// backend/src/controllers/emailController.ts
import { Request, Response } from "express";
import crypto from "crypto";
import { Resend } from "resend";
import { pool } from "../config/database";
import { AuthRequest } from "../middleware/auth";

// Hämta miljövariabler
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@poolbeferest.com";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// Initiera Resend-klient endast i produktion (eller om nyckel finns)
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  // Mock-läge: om vi inte är i produktion ELLER om Resend inte är initierat (ingen nyckel)
  if (!IS_PRODUCTION || !resend) {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║ 📧 MOCK EMAIL (utvecklingsläge)                          ║
╠══════════════════════════════════════════════════════════╣
║ To:      ${to}
║ Subject: ${subject}
╠══════════════════════════════════════════════════════════╣
║ HTML: ${html}
╚══════════════════════════════════════════════════════════╝
    `);
    return;
  }

  // Produktionsläge – skicka riktigt mejl via Resend
  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [to],
      subject,
      html,
    });
    if (error) throw new Error(error.message);
    console.log(`✅ Email sent to ${to} – ID: ${data?.id}`);
  } catch (err) {
    console.error("Resend error:", err);
    throw new Error("Email delivery failed");
  }
}

// Begär e-poständring
export const requestEmailChange = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { newEmail } = req.body;
  if (!newEmail || typeof newEmail !== "string") {
    return res.status(400).json({ error: "New email is required" });
  }

  // Kontrollera att e-posten inte redan används
  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [
    newEmail,
  ]);
  if (existing.rows.length > 0) {
    return res.status(400).json({ error: "Email already in use" });
  }

  // Spara den nya adressen i pending_email
  await pool.query("UPDATE users SET pending_email = $1 WHERE id = $2", [
    newEmail,
    userId,
  ]);

  // Skapa verifieringstoken (giltig 24h)
  const token = crypto.randomBytes(32).toString("hex");
  await pool.query(
    `INSERT INTO email_verification_tokens (user_id, token, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '1 day')`,
    [userId, token],
  );

  // Bygg verifieringslänk – direkt till backend-API:et (som omdirigerar till frontend)
  const backendUrl = process.env.BACKEND_URL || "http://localhost:4000";
  const verifyLink = `${backendUrl}/api/auth/verify-email?token=${token}`;
  const html = `<p>Klicka på länken för att verifiera din nya e-postadress: <a href="${verifyLink}">${verifyLink}</a></p>`;

  await sendEmail(newEmail, "Verifiera din nya e-postadress", html);

  return res.json({
    message: "Verifieringslänk skickad till din nya e-postadress.",
  });
};

// Verifiera e-post via token
export const verifyEmail = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { token } = req.query;
  if (!token) {
    res.status(400).json({ error: "Missing token" });
    return;
  }

  try {
    const tokenResult = await pool.query(
      `SELECT user_id FROM email_verification_tokens WHERE token = $1 AND expires_at > NOW()`,
      [token],
    );
    if (tokenResult.rows.length === 0) {
      res.status(400).json({ error: "Invalid or expired token" });
      return;
    }

    const userId = tokenResult.rows[0].user_id;
    const pendingRes = await pool.query(
      "SELECT pending_email FROM users WHERE id = $1",
      [userId],
    );
    const newEmail = pendingRes.rows[0]?.pending_email;
    if (!newEmail) {
      res.status(400).json({ error: "No pending email change" });
      return;
    }

    // Uppdatera användarens e-post och rensa pending_email
    await pool.query(
      "UPDATE users SET email = $1, pending_email = NULL WHERE id = $2",
      [newEmail, userId],
    );
    await pool.query(
      "DELETE FROM email_verification_tokens WHERE user_id = $1",
      [userId],
    );

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    res.redirect(`${frontendUrl}/settings?emailVerified=true`);
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
