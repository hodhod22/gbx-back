import { Router } from "express";
import { register, login, getMe } from "../controllers/authController";
import { authenticate } from "../middleware/auth"; // Lägg till denna rad
import { changePassword,updateProfile } from './../controllers/authController';
import { requestEmailChange,verifyEmail } from './../controllers/emailController';
import {updateLanguage} from './../controllers/stripeController'
const router = Router();
router.put("/update-language", authenticate, updateLanguage);
router.post("/change-password", authenticate, changePassword);
router.post("/request-email-change", authenticate, requestEmailChange);
router.get("/verify-email", verifyEmail);
router.post("/register", register);
router.post("/login", login);
router.get("/me", getMe);

router.put("/update-profile", authenticate, updateProfile);
export default router;
