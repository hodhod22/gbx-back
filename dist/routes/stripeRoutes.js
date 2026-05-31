"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const stripeController_1 = require("../controllers/stripeController");
const router = (0, express_1.Router)();
router.get("/test", stripeController_1.testStripe);
router.post("/create-checkout-session", stripeController_1.createCheckoutSession);
router.get("/verify-session", stripeController_1.verifySession);
// Webhook must be raw body, so we define it separately in app.ts or here with express.raw
// We'll handle webhook in app.ts to keep raw body middleware.
exports.default = router;
//# sourceMappingURL=stripeRoutes.js.map