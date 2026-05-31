import { Router } from "express";
import {
  getBalance,
  getTransactions,
  transferGbx,
  getGbxPriceSEK,
  
} from "../controllers/gbxController";
import { getMaxPayout } from "./../controllers/payoutController";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/transactions", authenticate, getTransactions);
router.get("/balance", authenticate, getBalance);
router.post("/transfer", authenticate, transferGbx);
router.get("/price/SEK", getGbxPriceSEK);
router.get("/max-payout", authenticate, getMaxPayout);
export default router;
