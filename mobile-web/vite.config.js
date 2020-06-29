// @ts-check
const reactPlugin = require("vite-plugin-react");

/**
 * @type { import('vite').UserConfig }
 */
const config = {
  alias: {
    "model-container": "/src/model-container",
  },
  jsx: "react",
  plugins: [reactPlugin],
};

module.exports = config;
