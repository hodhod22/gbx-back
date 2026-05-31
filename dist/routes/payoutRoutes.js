"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const payoutController_1 = require("../controllers/payoutController");
const router = (0, express_1.Router)();
router.get("/max-payout", payoutController_1.getMaxPayout);
router.post("/request-payout", payoutController_1.requestPayout);
router.get("/onboarding-link", payoutController_1.getOnboardingLink);
router.get("/check-stripe-status", payoutController_1.checkStripeAccountStatus); // ← Lägg till denna rad
exports.default = router;
//# sourceMappingURL=payoutRoutes.js.map