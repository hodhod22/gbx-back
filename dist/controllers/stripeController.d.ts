import { Request, Response } from "express";
import { AuthRequest } from './../middleware/auth';
export declare const createCheckoutSession: (req: Request, res: Response) => Promise<Response>;
export declare const verifySession: (req: Request, res: Response) => Promise<Response>;
export declare const stripeWebhook: (req: Request, res: Response) => Promise<Response>;
export declare const testStripe: (req: Request, res: Response) => Promise<Response>;
export declare const updateLanguage: (req: AuthRequest, res: Response) => Promise<Response>;
//# sourceMappingURL=stripeController.d.ts.map