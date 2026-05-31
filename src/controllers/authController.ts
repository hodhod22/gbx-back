// backend/src/controllers/authController.ts
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { pool } from "../config/database";
import { AuthRequest } from "../middleware/auth";

async function generateUniqueGbxId(): Promise<string> {
  let unique = false;
  let gbxId = "";
  while (!unique) {
    gbxId = crypto.randomBytes(4).toString("hex");
    const existing = await pool.query(
      "SELECT id FROM users WHERE gbx_id = $1",
      [gbxId],
    );
    if (existing.rows.length === 0) unique = true;
  }
  return gbxId;
}

export const register = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [
      email.toLowerCase(),
    ]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const gbxId = await generateUniqueGbxId();
    const isAdmin = email.toLowerCase() === process.env.ADMIN_EMAIL || false;

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, is_admin, gbx_id) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, name, email, is_admin, gbx_id`,
      [name, email.toLowerCase(), hashedPassword, isAdmin, gbxId],
    );

    const user = result.rows[0];
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        isAdmin: user.is_admin,
        gbxId: user.gbx_id,
      },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" },
    );

    await pool.query(
      `INSERT INTO gbx_balances (user_id, balance) VALUES ($1, 0)`,
      [user.id],
    );

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
  } catch (error: any) {
    console.error("Registration error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const login = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, password } = req.body;
    const result = await pool.query(
      "SELECT id, name, email, password_hash, is_admin, gbx_id FROM users WHERE email = $1",
      [email.toLowerCase()],
    );
    const user = result.rows[0];
    if (!user)
      return res.status(401).json({ error: "Invalid email or password" });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ error: "Invalid email or password" });
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        isAdmin: user.is_admin,
        gbxId: user.gbx_id,
      },
      process.env.JWT_SECRET || "ditt-hemliga-jwt-lösenord",
      { expiresIn: "7d" },
    );
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
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getMe = async (req: Request, res: Response): Promise<Response> => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token provided" });
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "ditt-hemliga-jwt-lösenord",
    ) as any;
    const result = await pool.query(
      "SELECT id, name, email, is_admin, gbx_id, language FROM users WHERE id = $1",
      [decoded.userId],
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "User not found" });
    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

export const updateProfile = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });
  try {
    await pool.query("UPDATE users SET name = $1 WHERE id = $2", [
      name,
      userId,
    ]);
    return res.json({ success: true, message: "Profile updated" });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const changePassword = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ error: "Current password and new password are required" });
  }

  const result = await pool.query(
    "SELECT password_hash FROM users WHERE id = $1",
    [userId],
  );
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: "User not found" });

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid)
    return res.status(401).json({ error: "Current password is incorrect" });

  const hashed = await bcrypt.hash(newPassword, 10);
  await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
    hashed,
    userId,
  ]);

  return res.json({ success: true, message: "Password changed successfully" });
};

export const updateLanguage = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { language } = req.body;
  if (!language || typeof language !== "string") {
    return res.status(400).json({ error: "Language is required" });
  }

  try {
    await pool.query("UPDATE users SET language = $1 WHERE id = $2", [
      language,
      userId,
    ]);
    return res.json({ success: true });
  } catch (error) {
    console.error("Update language error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
