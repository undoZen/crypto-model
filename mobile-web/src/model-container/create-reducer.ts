import { Action, On, Reducer } from "ts-action";

type InitialHandlers<S> = {
  [key: string]: (state: S, action: Action<string>) => S;
};
type CreateReducer<S> = Reducer<S> &
  Readonly<{
    handlers: InitialHandlers<S>;
    handle: (on: On<S>) => CreateReducer<S>;
    extend: (handlers: InitialHandlers<S>) => CreateReducer<S>;
    defaultReducer?: Reducer<S>;
    replaceDefaultReducer: (reducer: Reducer<S>) => CreateReducer<S>;
  }>;
export function createReducer<S>(
  initialState: S,
  initialHandlers: InitialHandlers<S>,
  defaultReducer: Reducer<S>
);
export function createReducer<S>(
  initialState: S,
  initialHandlers: InitialHandlers<S>
);
export function createReducer<S>(initialState: S): CreateReducer<S>;
export function createReducer<S>(
  initialState: S,
  initialHandlers?: InitialHandlers<S>,
  defaultReducer?: Reducer<S>
): CreateReducer<S> {
  const handlers: InitialHandlers<S> = {
    ...initialHandlers,
  };

  const rootReducer: Reducer<S> = (
    state = initialState,
    action: Action<string>
  ) => {
    if (handlers.hasOwnProperty(action.type)) {
      const reducer = handlers[action.type];
      if (typeof reducer !== "function") {
        throw Error(
          `Reducer under "${action.type}" key is not a valid reducer`
        );
      }
      return reducer(state, action);
    } else if (typeof defaultReducer === "function") {
      return defaultReducer(state, action);
    } else {
      return state;
    }
  };

  const extend: CreateReducer<S>["extend"] = (handlers) =>
    createReducer(
      initialState,
      { ...initialHandlers, ...handlers },
      defaultReducer
    );

  const handle: CreateReducer<S>["handle"] = ({ types, reducer }: On<S>) => {
    const handlers = types.reduce(
      (handlers, type) => ({ ...handlers, [type]: reducer }),
      {}
    );
    return extend(handlers);
  };

  const replaceDefaultReducer: CreateReducer<S>["replaceDefaultReducer"] = (
    defaultReducer
  ) => {
    return createReducer(initialState, handlers, defaultReducer);
  };

  return Object.freeze(
    Object.assign(rootReducer, {
      handlers,
      handle,
      extend,
      defaultReducer,
      replaceDefaultReducer,
    })
  );
}
