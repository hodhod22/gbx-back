export async function fetchCurrencyRates(): Promise<Record<string, number>> {
  const rates: Record<string, number> = {};
  try {
    const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
    if (!res.ok) throw new Error("API request failed");
    const data = (await res.json()) as { rates: Record<string, number> };

    const currencies = [
      "USD",
      "EUR",
      "GBP",
      "SEK",
      "NOK",
      "JPY",
      "CNY",
      "CAD",
      "AUD",
      "NZD",
      "CHF",
      "SGD",
      "KRW",
      "DKK",
      "PLN",
      "CZK",
      "HKD",
      "ILS",
      "MXN",
      "TRY",
    ];

    for (const c of currencies) {
      if (c === "USD") {
        rates[c] = 1;
      } else {
        const unitsPerUsd = data.rates[c];
        if (unitsPerUsd && unitsPerUsd > 0) {
          rates[c] = 1 / unitsPerUsd; // USD per enhet
        } else {
          rates[c] = 0;
        }
      }
    }
  } catch (error) {
    console.error("Currency API error, using fallback:", error);
    // fallback med ungefärliga värden
    return {
      USD: 1,
      EUR: 0.93,
      GBP: 0.79,
      SEK: 0.096,
      NOK: 0.108,
      JPY: 0.0064,
      CNY: 0.147,
      CAD: 0.73,
      AUD: 0.725,
      NZD: 0.59,
      CHF: 1.28,
      SGD: 0.78,
      KRW: 0.00066,
      DKK: 0.157,
      PLN: 0.274,
      CZK: 0.048,
      HKD: 0.128,
      ILS: 0.274,
      MXN: 0.054,
      TRY: 0.029,
    };
  }
  return rates;
}
