import { createModelContainer } from "model-container";
export default createModelContainer(
  "stringMap",
  {} as { [key: string]: string }
).defineActions({
  initialize: {
    reducer: (state, action) => {
      if (action?.meta?.initialState) {
        return Object.assign({}, action?.meta?.initialState);
      }
    },
  },
  replace: {
    createWithPayload: (newMap) => newMap,
    reducer: (state, action) => {
      return Object.assign({}, action.payload);
    },
  },
  add: {
    createWithPayload: ({ key, value }: { key: string; value: string }) => ({
      key,
      value,
    }),
    reducer: (state, action) => {
      const { key, value } = action.payload;
      state[key] = value;
    },
  },
  remove: {
    createWithPayload: (key: string) => key,
    reducer: (state, action) => {
      delete state[action.payload];
    },
  },
});
