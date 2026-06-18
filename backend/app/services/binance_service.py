import aiohttp
import asyncio
from typing import Optional
import logging

logger = logging.getLogger(__name__)

BINANCE_BASE_URL = "https://api.binance.com/api/v3"


async def get_current_price(symbol: str) -> Optional[float]:
    """Fetch live price from Binance REST API."""
    url = f"{BINANCE_BASE_URL}/ticker/price"
    params = {"symbol": symbol.upper()}
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=5)) as response:
                if response.status == 200:
                    data = await response.json()
                    return float(data["price"])
                else:
                    logger.warning(f"Binance API returned {response.status} for {symbol}")
                    return None
    except Exception as e:
        logger.error(f"Failed to fetch price for {symbol}: {e}")
        return None


async def get_prices_bulk(symbols: list[str]) -> dict[str, Optional[float]]:
    """Fetch prices for multiple symbols concurrently."""
    tasks = [get_current_price(s) for s in symbols]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    prices = {}
    for symbol, result in zip(symbols, results):
        if isinstance(result, Exception) or result is None:
            prices[symbol] = None
        else:
            prices[symbol] = result
    return prices
