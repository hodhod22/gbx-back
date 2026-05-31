"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const port = process.env.PORT || 4000;
// Global promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
    console.error('=== UNHANDLED REJECTION ===');
    console.error('Reason:', reason);
    console.error('Promise:', promise);
});
// Global uncaught exception handler
process.on('uncaughtException', (error) => {
    console.error('=== UNCAUGHT EXCEPTION ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
});
app_1.default.listen(port, () => {
    console.log(`💰 Payment Bridge API running on http://localhost:${port}`);
    console.log(`📍 Health: http://localhost:${port}/api/health`);
    console.log(`📍 Register: POST http://localhost:${port}/api/auth/register`);
    console.log(`📍 Login: POST http://localhost:${port}/api/auth/login`);
    console.log(`📍 GBX Transfer: POST http://localhost:${port}/api/gbx/transfer`);
    console.log(`📍 Lookup user by GBX-ID: GET http://localhost:${port}/api/users/by-gbx-id/:gbxId`);
});
//# sourceMappingURL=index.js.map