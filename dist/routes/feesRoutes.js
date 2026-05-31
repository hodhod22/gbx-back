"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/routes/feesRoutes.ts
const express_1 = require("express");
const feesController_1 = require("../controllers/feesController");
const router = (0, express_1.Router)();
router.get("/", feesController_1.getFees);
exports.default = router;
//# sourceMappingURL=feesRoutes.js.map