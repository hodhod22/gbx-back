import { Request, Response, NextFunction } from "express";
export interface AuthRequest extends Request {
    user?: {
        id: number;
    };
}
export declare function getUserIdFromToken(req: Request): number | null;
export declare const authenticate: (req: AuthRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map