import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
export declare const register: (req: Request, res: Response) => Promise<Response>;
export declare const login: (req: Request, res: Response) => Promise<Response>;
export declare const getMe: (req: Request, res: Response) => Promise<Response>;
export declare const updateProfile: (req: AuthRequest, res: Response) => Promise<Response>;
export declare const changePassword: (req: AuthRequest, res: Response) => Promise<Response>;
export declare const updateLanguage: (req: AuthRequest, res: Response) => Promise<Response>;
//# sourceMappingURL=authController.d.ts.map