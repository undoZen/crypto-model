import React, { useState } from "react";
import { Button } from "antd-mobile";
import "./counter.css";

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div className="Counter">
      <header className="Counter-header">
        <p>Hello Vite + React!</p>
        <p>
          <Button onClick={() => setCount((count) => count + 1)}>
            count is: {count}
          </Button>
        </p>
        <p>
          Edit <code>App.jsx</code> and save to test HMR updates.
        </p>
        <a
          className="Counter-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}
