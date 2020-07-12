import React, { useState } from "react";
import { Button } from "antd-mobile";
import { CoinSymbolsContainer, CoinContainer } from "./containers";
import { StringListContainer } from "../../containers";

export default function Container() {
  return (
    <>
      <CoinSymbolsContainer instanceId="default">
        <TopList />
      </CoinSymbolsContainer>
    </>
  );
}

function TopList() {
  const topSymbols =
    StringListContainer.useInstanceById("topCoinsSymbol").useState() || [];
  console.log("topSymbols", topSymbols);
  debugger;
  return (
    <>
      {topSymbols.map((symbol) => (
        <CoinContainer instanceId={symbol}>
          <CoinInfo />
        </CoinContainer>
      ))}
    </>
  );
}

function CoinInfo() {
  const state = CoinContainer.useInstanceFromContext().useState();
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
