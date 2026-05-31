import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
export declare const requestEmailChange: (req: AuthRequest, res: Response) => Promise<Response>;
export declare const verifyEmail: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=emailController.d.ts.map