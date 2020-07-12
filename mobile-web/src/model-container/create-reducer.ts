import { Reducer } from "react";
import { Reducer as ReduxReducer } from "redux";
import { Action, On, Reducer as TsActionReducer } from "ts-action";

type InitialHandlers<S> = {
  [key: string]: (state: S, action: Action<string>) => S;
};
type CreateReducer<S> = TsActionReducer<S> &
  Readonly<{
    handlers: InitialHandlers<S>;
    handle: (on: On<S>) => CreateReducer<S>;
    extend: (handlers: InitialHandlers<S>) => CreateReducer<S>;
    defaultReducer?: Reducer<S, Action<string>>;
    replaceDefaultReducer: (
      reducer: Reducer<S, Action<string>>
    ) => CreateReducer<S>;
  }>;
export function createReducer<S>(
  initialState: S,
  defaultReducer: Reducer<S, Action<string>>
): CreateReducer<S>;
export function createReducer<S>(
  initialState: S,
  initialHandlers: InitialHandlers<S>,
  defaultReducer: Reducer<S, Action<string>>
): CreateReducer<S>;
export function createReducer<S>(
  initialState: S,
  initialHandlers: InitialHandlers<S>
): CreateReducer<S>;
export function createReducer<S>(initialState: S): CreateReducer<S>;
export function createReducer<S>(
  initialState: S,
  initialHandlers?: InitialHandlers<S> | Reducer<S, Action<string>>,
  defaultReducer?: Reducer<S, Action<string>>
): CreateReducer<S> {
  if (typeof initialHandlers === "function") {
    defaultReducer = initialHandlers;
    initialHandlers = {};
  }
  const handlers: InitialHandlers<S> = {
    ...initialHandlers,
  };

  const rootReducer: Reducer<S, Action<string>> = (
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

  const replaceInitialState: CreateReducer<S>["replaceDefaultReducer"] = (
    initialState
  ) => {
    return createReducer(initialState, handlers, defaultReducer);
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
      replaceInitialState,
    })
  );
}
