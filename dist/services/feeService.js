"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStripeFeeForMethod = getStripeFeeForMethod;
// backend/src/services/feeService.ts
const stripe_1 = __importDefault(require("stripe"));
const currencyRateService_1 = require("../services/currencyRateService"); // ← LÄGG TILL DENNA RAD
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY);
// Statisk fallback-tabell över Stripe-avgifter (uppdatera vid behov)
const STATIC_FEES = {
    card: { percent: 0.025, fixed: 3, currency: "sek" },
    swish: { percent: 0.005, fixed: 2, currency: "sek" },
    revolut_pay: { percent: 0.01, fixed: 0, currency: "sek" },
    alipay: { percent: 0.01, fixed: 0, currency: "sek" },
    wechat_pay: { percent: 0.01, fixed: 0, currency: "sek" },
    ideal: { percent: 0, fixed: 2.9, currency: "eur" },
    klarna: { percent: 0.02, fixed: 1.5, currency: "sek" },
    sepa_debit: { percent: 0, fixed: 3.5, currency: "eur" },
    upi: { percent: 0, fixed: 0, currency: "inr" },
    mpesa: { percent: 0.02, fixed: 0, currency: "kes" },
};
async function getStripeFeeForMethod(paymentMethodType, amountSek) {
    try {
        // Försök hämta från Stripe API (kräver payment_method_configurations)
        // OBS: Detta kräver att du har en aktiv konfiguration. Om det inte fungerar, använd statisk tabell.
        const configs = await stripe.paymentMethodConfigurations.list({
            limit: 100,
        });
        for (const config of configs.data) {
            const methods = config.payment_methods || {};
            if (methods[paymentMethodType]) {
                const pricing = methods[paymentMethodType]?.pricing;
                if (pricing?.type === "flat_percentage") {
                    const percent = pricing.percentage || 0;
                    const fixedAmount = pricing.amount || 0;
                    const currency = pricing.currency;
                    // Konvertera fast avgift till SEK om det inte redan är SEK
                    let fixedSek = fixedAmount / 100;
                    if (currency !== "sek") {
                        const rates = await (0, currencyRateService_1.fetchCurrencyRates)();
                        fixedSek = fixedSek * (1 / rates["SEK"]);
                    }
                    return { percent: percent, fixedSek };
                }
            }
        }
    }
    catch (error) {
        console.error("Failed to fetch Stripe fee from API, using static fallback", error);
    }
    // Fallback till statisk tabell
    const fee = STATIC_FEES[paymentMethodType];
    if (!fee) {
        // Default för okända metoder – sätt en säker avgift (t.ex. 3% + 3 SEK)
        return { percent: 0.03, fixedSek: 3 };
    }
    let fixedSek = fee.fixed;
    if (fee.currency !== "sek") {
        const rates = await (0, currencyRateService_1.fetchCurrencyRates)();
        fixedSek = fixedSek * (1 / rates["SEK"]);
    }
    return { percent: fee.percent, fixedSek };
}
//# sourceMappingURL=feeService.js.map