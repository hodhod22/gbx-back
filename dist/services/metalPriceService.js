"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchMetalPrices = fetchMetalPrices;
async function fetchMetalPrices() {
    try {
        const res = await fetch("https://www.live-rates.com/rates");
        if (res.ok) {
            const data = (await res.json());
            let gold = 0, platinum = 0, silver = 0;
            for (const item of data) {
                if (item.currency === "GOLD")
                    gold = item.rate / 31.1035;
                if (item.currency === "PLATINUM")
                    platinum = item.rate / 31.1035;
                if (item.currency === "SILVER")
                    silver = item.rate / 31.1035;
            }
            if (gold && platinum && silver) {
                console.log("Metal prices from API:", { gold, platinum, silver });
                return {
                    gold_usd_per_gram: gold,
                    platinum_usd_per_gram: platinum,
                    silver_usd_per_gram: silver,
                };
            }
        }
    }
    catch (e) {
        console.error("Metal API error, using fallback:", e);
    }
    // Fallback
    return {
        gold_usd_per_gram: 65.5,
        platinum_usd_per_gram: 29.8,
        silver_usd_per_gram: 0.82,
    };
}
//# sourceMappingURL=metalPriceService.js.map