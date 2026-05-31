"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateLanguage = exports.changePassword = exports.updateProfile = exports.getMe = exports.login = exports.register = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const database_1 = require("../config/database");
async function generateUniqueGbxId() {
    let unique = false;
    let gbxId = "";
    while (!unique) {
        gbxId = crypto_1.default.randomBytes(4).toString("hex");
        const existing = await database_1.pool.query("SELECT id FROM users WHERE gbx_id = $1", [gbxId]);
        if (existing.rows.length === 0)
            unique = true;
    }
    return gbxId;
}
const register = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: "All fields are required" });
        }
        const existing = await database_1.pool.query("SELECT id FROM users WHERE email = $1", [
            email.toLowerCase(),
        ]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: "User already exists" });
        }
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        const gbxId = await generateUniqueGbxId();
        const isAdmin = email.toLowerCase() === process.env.ADMIN_EMAIL || false;
        const result = await database_1.pool.query(`INSERT INTO users (name, email, password_hash, is_admin, gbx_id) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, name, email, is_admin, gbx_id`, [name, email.toLowerCase(), hashedPassword, isAdmin, gbxId]);
        const user = result.rows[0];
        const token = jsonwebtoken_1.default.sign({
            userId: user.id,
            email: user.email,
            isAdmin: user.is_admin,
            gbxId: user.gbx_id,
        }, process.env.JWT_SECRET || "your-secret-key", { expiresIn: "7d" });
        await database_1.pool.query(`INSERT INTO gbx_balances (user_id, balance) VALUES ($1, 0)`, [user.id]);
        return res.json({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                isAdmin: user.is_admin,
                gbxId: user.gbx_id,
            },
        });
    }
    catch (error) {
        console.error("Registration error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await database_1.pool.query("SELECT id, name, email, password_hash, is_admin, gbx_id FROM users WHERE email = $1", [email.toLowerCase()]);
        const user = result.rows[0];
        if (!user)
            return res.status(401).json({ error: "Invalid email or password" });
        const valid = await bcrypt_1.default.compare(password, user.password_hash);
        if (!valid)
            return res.status(401).json({ error: "Invalid email or password" });
        const token = jsonwebtoken_1.default.sign({
            userId: user.id,
            email: user.email,
            isAdmin: user.is_admin,
            gbxId: user.gbx_id,
        }, process.env.JWT_SECRET || "ditt-hemliga-jwt-lösenord", { expiresIn: "7d" });
        return res.json({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                isAdmin: user.is_admin,
                gbxId: user.gbx_id,
            },
        });
    }
    catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};
exports.login = login;
const getMe = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token)
            return res.status(401).json({ error: "No token provided" });
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || "ditt-hemliga-jwt-lösenord");
        const result = await database_1.pool.query("SELECT id, name, email, is_admin, gbx_id, language FROM users WHERE id = $1", [decoded.userId]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: "User not found" });
        return res.json(result.rows[0]);
    }
    catch (error) {
        return res.status(401).json({ error: "Invalid token" });
    }
};
exports.getMe = getMe;
const updateProfile = async (req, res) => {
    const userId = req.user?.id;
    if (!userId)
        return res.status(401).json({ error: "Unauthorized" });
    const { name } = req.body;
    if (!name)
        return res.status(400).json({ error: "Name is required" });
    try {
        await database_1.pool.query("UPDATE users SET name = $1 WHERE id = $2", [
            name,
            userId,
        ]);
        return res.json({ success: true, message: "Profile updated" });
    }
    catch (error) {
        console.error("Update profile error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};
exports.updateProfile = updateProfile;
const changePassword = async (req, res) => {
    const userId = req.user?.id;
    if (!userId)
        return res.status(401).json({ error: "Unauthorized" });
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        return res
            .status(400)
            .json({ error: "Current password and new password are required" });
    }
    const result = await database_1.pool.query("SELECT password_hash FROM users WHERE id = $1", [userId]);
    const user = result.rows[0];
    if (!user)
        return res.status(404).json({ error: "User not found" });
    const valid = await bcrypt_1.default.compare(currentPassword, user.password_hash);
    if (!valid)
        return res.status(401).json({ error: "Current password is incorrect" });
    const hashed = await bcrypt_1.default.hash(newPassword, 10);
    await database_1.pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
        hashed,
        userId,
    ]);
    return res.json({ success: true, message: "Password changed successfully" });
};
exports.changePassword = changePassword;
const updateLanguage = async (req, res) => {
    const userId = req.user?.id;
    if (!userId)
        return res.status(401).json({ error: "Unauthorized" });
    const { language } = req.body;
    if (!language || typeof language !== "string") {
        return res.status(400).json({ error: "Language is required" });
    }
    try {
        await database_1.pool.query("UPDATE users SET language = $1 WHERE id = $2", [
            language,
            userId,
        ]);
        return res.json({ success: true });
    }
    catch (error) {
        console.error("Update language error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};
exports.updateLanguage = updateLanguage;
//# sourceMappingURL=authController.js.map