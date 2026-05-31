"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const gbxController_1 = require("../controllers/gbxController");
const payoutController_1 = require("./../controllers/payoutController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get("/transactions", auth_1.authenticate, gbxController_1.getTransactions);
router.get("/balance", auth_1.authenticate, gbxController_1.getBalance);
router.post("/transfer", auth_1.authenticate, gbxController_1.transferGbx);
router.get("/price/SEK", gbxController_1.getGbxPriceSEK);
router.get("/max-payout", auth_1.authenticate, payoutController_1.getMaxPayout);
exports.default = router;
//# sourceMappingURL=gbxRoutes.js.map