"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middleware/auth"); // Lägg till denna rad
const authController_2 = require("./../controllers/authController");
const emailController_1 = require("./../controllers/emailController");
const stripeController_1 = require("./../controllers/stripeController");
const router = (0, express_1.Router)();
router.put("/update-language", auth_1.authenticate, stripeController_1.updateLanguage);
router.post("/change-password", auth_1.authenticate, authController_2.changePassword);
router.post("/request-email-change", auth_1.authenticate, emailController_1.requestEmailChange);
router.get("/verify-email", emailController_1.verifyEmail);
router.post("/register", authController_1.register);
router.post("/login", authController_1.login);
router.get("/me", authController_1.getMe);
router.put("/update-profile", auth_1.authenticate, authController_2.updateProfile);
exports.default = router;
//# sourceMappingURL=authRoutes.js.map