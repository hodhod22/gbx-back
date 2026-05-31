import { pool } from "../config/database";
import { fetchCurrencyRates } from "./currencyRateService";
import { fetchMetalPrices } from "./metalPriceService";

// Hämta aktuellt värde av 1 GBX i USD
export async function getCurrentGbxUSD(): Promise<number> {
  const basketRes = await pool.query(
    "SELECT asset_code, asset_type, fixed_quantity, weight_percent FROM gbx_basket",
  );
  const currencyRates = await fetchCurrencyRates();
  const metalPrices = await fetchMetalPrices();

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
    } else if (row.asset_type === "metal") {
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
      if (currentPrice === 0) continue;
    } else continue;

    const valueInUSD = fixedQty * currentPrice;
    totalWeightedValue += weight * valueInUSD;
  }

  const gbxUSD = totalWeightedValue / 100;
  console.log("Metal prices:", metalPrices);
  console.log("Currency sample SEK:", currencyRates["SEK"]);
  return gbxUSD;
}

// Hämta aktuellt värde av 1 GBX i SEK
export async function getCurrentGbxSEK(): Promise<number> {
  const gbxUSD = await getCurrentGbxUSD();
  const currencyRates = await fetchCurrencyRates();
  const sekPerUsd = 1 / currencyRates["SEK"];
  const gbxSEK = gbxUSD * sekPerUsd;
  console.log(`[GBX] Current GBX/SEK: ${gbxSEK}`);
  return gbxSEK;
}
