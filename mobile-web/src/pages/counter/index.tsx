import React, { useCallback } from "react";
import { CounterModel } from "./containers";

export default function Wrapper() {
  return (
    <CounterModel instanceId="default">
      <Counter />
    </CounterModel>
  );
}
function Counter() {
  const {
    incr,
    decr,
    reset,
    cancel,
  } = CounterModel.useInstanceFromContext().dispatcher;

  const count = CounterModel.useInstanceFromContext().useSelector(
    CounterModel.getters.count
  );
  const countdown = CounterModel.useInstanceFromContext().useSelector(
    CounterModel.getters.countdown
  );

  const incInProgress = countdown > 0;

  const handleIncLaterClicked = useCallback(
    function handleIncLaterClicked() {
      console.log("incInProgress", incInProgress);
      if (incInProgress) {
        cancel();
      } else {
        reset(5);
      }
    },
    [incInProgress]
  );

  return (
    <div className="Counter">
      {" "}
      <h2>Current count : {count}</h2>
      <button onClick={decr}>Decrement</button>
      <button onClick={incr}>Increment</button>
      <button onClick={handleIncLaterClicked}>
        {incInProgress ? "Cancel future increment" : "Increment after 5s"}
      </button>
      <hr />
      <div style={{ display: incInProgress ? "block" : "none" }}>
        {`Will increment after ${countdown}s ...`}
      </div>
    </div>
  );
}
