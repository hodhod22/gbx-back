"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
exports.getUserIdFromToken = getUserIdFromToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function getUserIdFromToken(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader)
        return null;
    const token = authHeader.split(" ")[1];
    if (!token)
        return null;
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || "ditt-hemliga-jwt-lösenord");
        return decoded.userId;
    }
    catch {
        return null;
    }
}
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).json({ error: "No token provided" });
        return;
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
        res.status(401).json({ error: "Invalid token format" });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || "ditt-hemliga-jwt-lösenord");
        req.user = { id: decoded.userId };
        next();
    }
    catch (err) {
        res.status(401).json({ error: "Invalid token" });
    }
};
exports.authenticate = authenticate;
//# sourceMappingURL=auth.js.map