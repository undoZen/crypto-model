import { createModelContainer } from "model-container";
function replace(ids, newIds) {
  ids.splice.apply(ids, [0, ids.length].concat(newIds));
}
export default createModelContainer("ids", []).defineActions({
  initialize: {
    reducer: (state, action) => {
      if (Array.isArray(action?.meta?.initialState)) {
        replace(state, action?.meta?.initialState);
      }
    },
  },
  replace: {
    createWithPayload: (ids: string[]) => ids,
    reducer: (state, action) => {
      replace(state, action.payload);
    },
  },
  append: {
    createWithPayload: (id: string) => id,
    reducer: (state, action) => {
      state.push(action.payload);
    },
  },
  remove: {
    createWithPayload: (id: string) => id,
    reducer: (state, action) => {
      const id = action.payload;
      const index = state.indexOf(id);
      if (index > -1) {
        state.splice(index, 1);
      }
    },
  },
  appendAfter: {
    createWithPayload: ({
      after,
      newId,
    }: {
      after: string;
      newId: unknown;
    }) => ({ after, newId }),
    reducer: (state, action) => {
      const { after, newId } = action.payload;
      const index = state.indexOf(after);
      if (index > -1) {
        state.splice(index + 1, 0, newId);
      } else {
        state.push(newId);
      }
    },
  },
  insertBefore: {
    createWithPayload: ({
      before,
      newId,
    }: {
      before: string;
      newId: unknown;
    }) => ({ before, newId }),
    reducer: (state, action) => {
      const { before, newId } = action.payload;
      const index = state.indexOf(before);
      if (index > -1) {
        state.splice(index, 0, newId);
      } else {
        state.push(newId);
      }
    },
  },
});
