import { Router } from "express";
import {
  getMaxPayout,
  requestPayout,
  getOnboardingLink,
  checkStripeAccountStatus, // ← Lägg till denna import
} from "../controllers/payoutController";

const router = Router();
router.get("/max-payout", getMaxPayout);
router.post("/request-payout", requestPayout);
router.get("/onboarding-link", getOnboardingLink);
router.get("/check-stripe-status", checkStripeAccountStatus);   // ← Lägg till denna rad
export default router;
