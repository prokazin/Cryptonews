// Прокси для крипто-календаря (CoinMarketCap или Coingecko)
export default async function handler(req, res) {
  const url = 'https://api.coingecko.com/api/v3/events';
  const response = await fetch(url);
  const data = await response.json();
  res.json(data);
}
