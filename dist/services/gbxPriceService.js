"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentGbxUSD = getCurrentGbxUSD;
exports.getCurrentGbxSEK = getCurrentGbxSEK;
const database_1 = require("../config/database");
const currencyRateService_1 = require("./currencyRateService");
const metalPriceService_1 = require("./metalPriceService");
// Hämta aktuellt värde av 1 GBX i USD
async function getCurrentGbxUSD() {
    const basketRes = await database_1.pool.query("SELECT asset_code, asset_type, fixed_quantity, weight_percent FROM gbx_basket");
    const currencyRates = await (0, currencyRateService_1.fetchCurrencyRates)();
    const metalPrices = await (0, metalPriceService_1.fetchMetalPrices)();
    let totalWeightedValue = 0;
    for (const row of basketRes.rows) {
        const weight = row.weight_percent;
        const fixedQty = parseFloat(row.fixed_quantity);
        let currentPrice = 0;
        if (row.asset_type === "currency") {
            currentPrice = currencyRates[row.asset_code];
            if (currentPrice === undefined) {
                console.warn(`Missing currency rate for ${row.asset_code}, skipping`);
                continue;
            }
        }
        else if (row.asset_type === "metal") {
            switch (row.asset_code) {
                case "GOLD":
                    currentPrice = metalPrices.gold_usd_per_gram;
                    break;
                case "SILVER":
                    currentPrice = metalPrices.silver_usd_per_gram;
                    break;
                case "PLATINUM":
                    currentPrice = metalPrices.platinum_usd_per_gram;
                    break;
                default:
                    continue;
            }
            if (currentPrice === 0)
                continue;
        }
        else
            continue;
        const valueInUSD = fixedQty * currentPrice;
        totalWeightedValue += weight * valueInUSD;
    }
    const gbxUSD = totalWeightedValue / 100;
    console.log("Metal prices:", metalPrices);
    console.log("Currency sample SEK:", currencyRates["SEK"]);
    return gbxUSD;
}
// Hämta aktuellt värde av 1 GBX i SEK
async function getCurrentGbxSEK() {
    const gbxUSD = await getCurrentGbxUSD();
    const currencyRates = await (0, currencyRateService_1.fetchCurrencyRates)();
    const sekPerUsd = 1 / currencyRates["SEK"];
    const gbxSEK = gbxUSD * sekPerUsd;
    console.log(`[GBX] Current GBX/SEK: ${gbxSEK}`);
    return gbxSEK;
}
//# sourceMappingURL=gbxPriceService.js.map