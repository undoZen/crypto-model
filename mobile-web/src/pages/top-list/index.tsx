import React, { useState } from "react";
import { Button } from "antd-mobile";
import { CoinSymbolsContainer, CoinContainer } from "./containers";
import { StringListContainer } from "../../containers";

export default function Container() {
  return (
    <>
      <CoinSymbolsContainer.Provider instanceId="default">
        <TopList />
      </CoinSymbolsContainer.Provider>
    </>
  );
}

function TopList() {
  const topSymbols =
    StringListContainer.useInstance("topCoinsSymbol").useState() || [];
  console.log("topSymbols", topSymbols);
  return (
    <>
      {topSymbols.map((symbol) => (
        <CoinContainer.Provider instanceId={symbol}>
          <CoinInfo />
        </CoinContainer.Provider>
      ))}
    </>
  );
}

function CoinInfo() {
  const state = CoinContainer.useInstance().useState();
  return (
    <div style={{ margin: "10px 5px" }}>
      name: {state.name}
      <br />
      symbol: {state.symbol}
      <br />
      price usd: {state.usd}
      <br />
      price btc: {state.btc}
      <br />
    </div>
  );
}
