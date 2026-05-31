import { Router } from "express";
import express from "express";
import {
  createCheckoutSession,
  verifySession,
  stripeWebhook,testStripe
} from "../controllers/stripeController";

const router = Router();
router.get("/test", testStripe);
router.post("/create-checkout-session", createCheckoutSession);
router.get("/verify-session", verifySession);
// Webhook must be raw body, so we define it separately in app.ts or here with express.raw
// We'll handle webhook in app.ts to keep raw body middleware.

export default router;
