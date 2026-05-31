import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
export declare const getBalance: (req: AuthRequest, res: Response) => Promise<Response>;
export declare const getTransactions: (req: AuthRequest, res: Response) => Promise<void>;
export declare const transferGbx: (req: Request, res: Response) => Promise<Response>;
export declare const getGbxPriceSEK: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=gbxController.d.ts.map