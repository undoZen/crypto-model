import request from "axios";
import { StringListContainer, StringMapContainer } from "../../containers";
import { transform, map, sortBy, toPairs, forEach } from "lodash-es";
import { createModelContainer } from "model-container";

export const CoinContainer = createModelContainer(
  "coinBySymbol",
  {} as Coin
).defineActions({
  update: {
    createWithPayload: (coin: Coin) => coin,
    reducer: (state, action) => {
      Object.assign(state, action.payload);
    },
  },
});

export const CoinSymbolsContainer = StringListContainer.extend(
  "coinList",
  []
).defineActions({
  mounted: {
    saga: ({ call, put, actions }) => {
      console.log(1);
      return function* () {
        console.log(2);
        let response;
        response = yield call(
          request,
          "https://api.coingecko.com/api/v3/coins/list"
        );
        console.log(3);
        console.log(response);
        yield put(actions.replace(response.data.map(({ symbol }) => symbol)));
        const symbolMapToName = transform(
          response.data,
          (result, { symbol, name }) => {
            result[symbol] = name;
          }
        );
        const symbolMapToId = transform(
          response.data,
          (result, { symbol, id }) => {
            result[symbol] = id;
          }
        );
        const idMapToSymbol = transform(
          response.data,
          (result, { symbol, id }) => {
            result[id] = symbol;
          }
        );
        yield StringMapContainer.putTo(
          "symbolToId",
          StringMapContainer.actions.replace(symbolMapToId)
        );
        response = yield call(
          request,
          "https://api.coingecko.com/api/v3/global"
        );
        console.log(response);
        const mcTop = response.data.data.market_cap_percentage;
        const topSymbol = map(sortBy(toPairs(mcTop), 1).reverse(), "0");
        console.log(topSymbol);

        response = yield call(request, {
          url: "https://api.coingecko.com/api/v3/simple/price",
          method: "GET",
          params: {
            ids: topSymbol.map((symbol) => symbolMapToId[symbol]).join(","),
            vs_currencies: ["btc", "usd"].join(","),
          },
        });
        console.log(response);
        const priceById = response.data;

        yield StringListContainer.putTo(
          "topCoinsSymbol",
          StringListContainer.actions.replace(topSymbol)
        );
        for (const symbol of topSymbol) {
          const id = symbolMapToId[symbol];
          const coin = {
            id,
            symbol,
            name: symbolMapToName[symbol],
            usd: priceById[id].usd,
            btc: priceById[id].btc,
            marketCapPercentage: mcTop[symbol],
          };
          console.log("coin", coin);
          yield CoinContainer.putTo(symbol, CoinContainer.actions.update(coin));
        }
      };
    },
  },
});

interface Coin {
  id: string;
  symbol: string;
  name: string;
  usd: number;
  btc: number;
  marketCapPercentage: number;
}
