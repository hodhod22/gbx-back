import { Request, Response } from "express";
export declare const getOrCreateStripeAccount: (userId: number, email: string) => Promise<string>;
export declare const checkStripeAccountStatus: (req: Request, res: Response) => Promise<Response>;
export declare const getMaxPayout: (req: Request, res: Response) => Promise<Response>;
export declare const requestPayout: (req: Request, res: Response) => Promise<Response>;
export declare const getOnboardingLink: (req: Request, res: Response) => Promise<Response>;
export declare const handlePayoutWebhook: (event: any) => Promise<void>;
//# sourceMappingURL=payoutController.d.ts.map