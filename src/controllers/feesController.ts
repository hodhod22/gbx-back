// backend/src/controllers/feesController.ts
import { Request, Response } from "express";

const FEE_DATA = [
  {
    id: "card",
    name: "Kortbetalning (Visa/Mastercard)",
    stripe_percent: 2.5,
    stripe_fixed: 3,
    currency: "SEK",
    platform_percent: 0.05,
  },
];

export const getFees = async (req: Request, res: Response) => {
  try {
    const methods = FEE_DATA.map((m) => ({
      id: m.id,
      name: m.name,
      stripe_percent: m.stripe_percent,
      stripe_fixed: m.stripe_fixed,
      platform_percent: m.platform_percent,
      total_percent: m.stripe_percent + m.platform_percent,
      total_fixed: m.stripe_fixed,
      currency: m.currency,
    }));
    res.json({ success: true, methods });
  } catch (error) {
    console.error("Error fetching fees:", error);
    res.status(500).json({ success: false, error: "Failed to fetch fees" });
  }
};
