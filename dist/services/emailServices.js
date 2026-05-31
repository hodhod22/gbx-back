"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
// backend/src/services/emailService.ts
const resend_1 = require("resend");
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
let resend = null;
if (IS_PRODUCTION && RESEND_API_KEY) {
    resend = new resend_1.Resend(RESEND_API_KEY);
}
async function sendEmail(to, subject, html) {
    if (!resend) {
        // Mock-läge för utveckling (eller om Resend saknas)
        console.log(`
╔══════════════════════════════════════════════════════════╗
║ 📧 MOCK EMAIL (development mode)                        ║
╠══════════════════════════════════════════════════════════╣
║ To:      ${to}
║ Subject: ${subject}
╠══════════════════════════════════════════════════════════╣
║ HTML: ${html.substring(0, 500)}${html.length > 500 ? "..." : ""}
╚══════════════════════════════════════════════════════════╝
    `);
        return;
    }
    try {
        const { data, error } = await resend.emails.send({
            from: EMAIL_FROM,
            to: [to],
            subject,
            html,
        });
        if (error) {
            console.error("Resend error:", error);
            throw new Error(error.message);
        }
        console.log(`✅ Email sent to ${to}, id: ${data?.id}`);
    }
    catch (err) {
        console.error("Failed to send email:", err);
        throw new Error("Email delivery failed");
    }
}
//# sourceMappingURL=emailServices.js.map