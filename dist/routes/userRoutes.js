"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const router = (0, express_1.Router)();
router.get("/by-gbx-id/:gbxId", async (req, res) => {
    try {
        const { gbxId } = req.params;
        if (!gbxId)
            return res.status(400).json({ error: "GBX-ID is required" });
        const result = await database_1.pool.query("SELECT id, name, email, gbx_id FROM users WHERE gbx_id = $1", [gbxId]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: "User not found" });
        const user = result.rows[0];
        return res.json({ id: user.id, name: user.name, gbxId: user.gbx_id });
    }
    catch (error) {
        console.error("Lookup error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});
exports.default = router;
//# sourceMappingURL=userRoutes.js.map