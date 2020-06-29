import { NamedExoticComponent } from "react";
import { Action, Reducer } from "redux";

type SameType<T> = {
  [key: string]: T;
};
type AnyStateReducer<Payload> = (state: any, action: Action<Payload>) => any;
type AnyActionReducer<State> = (state: State, action: Action<string>) => State;
type AnyReducer = (state: any, action: Action<string>) => any;

export interface ActionWithPayload<Payload> {
  type: string;
  payload: Payload;
}
type AnyActionCreator = (
  ...args: any[]
) => ActionWithPayload<any> | Action<string>;
type ActionsMap = SameType<AnyActionCreator>;

type ActionMethod<ActionCreator> = ActionCreator extends (
  ...args: any[]
) => ActionWithPayload<infer Payload>
  ? (payload: Payload) => void
  : ActionCreator extends (...args: any[]) => Action<string>
  ? () => void
  : never;
interface WrapTV<Payload> {
  currentTarget: {
    value: Payload;
  };
}
type ActionMethodTV<ActionCreator> = ActionCreator extends (
  ...args: any[]
) => ActionWithPayload<infer Payload>
  ? (payload: WrapTV<Payload>) => void
  : never;
interface WrapTC<Payload> {
  currentTarget: {
    value: Payload;
  };
}
type ActionMethodTC<ActionCreator> = ActionCreator extends (
  ...args: any[]
) => ActionWithPayload<infer Payload>
  ? (payload: WrapTC<Payload>) => void
  : never;
type ActionsToMethods<Actions extends ActionsMap> = {
  [P in keyof Actions]: ActionMethod<Actions[P]>;
};
type ActionsToMethodsCTV<Actions extends ActionsMap> = {
  [P in keyof Actions]: ActionMethodTV<Actions[P]>;
};
type ActionsToMethodsCTC<Actions extends ActionsMap> = {
  [P in keyof Actions]: ActionMethodTC<Actions[P]>;
};
type ActionMethodNullary<ActionCreator> = ActionCreator extends (
  ...args: any[]
) => ActionWithPayload<any>
  ? never // excludes actions with payload
  : ActionCreator extends (...args: any[]) => Action<string>
  ? () => void
  : never;
type ActionsToMethodsNullary<Actions extends ActionsMap> = {
  [P in keyof Actions]: ActionMethodNullary<Actions[P]>;
};

interface UseStateOptions {
  suspense: boolean;
}
interface UseDeriveStateFunction<State> {
  <T>(operator: OperatorFunction<State, T>, options?: UseStateOptions): T;
}

export interface ContainerProviderProps<State = any> {
  initialState?: State;
  instanceId: string;
  children: React.ReactNode;
  persist?: boolean;
}
interface ContainerContext<State> {
  instanceId: string;
  state$: StateObservable<State>;
  action$: ActionsObservable<Action<string>>;
  dispatch: (action: Action<string>) => void;
}
type UseSelector = <T>(
  selector: (state: State) => T,
  options?: UseStateOptions
) => T | string;
interface InstanceContext<State = any, Actions extends ActionsMap = {}> {
  useState: (options?: UseStateOptions) => State;
  useSelector: UseSelector;
  state: State;
  getters: {};
  state$: StateObservable<State>;
  action$: ActionsObservable<Action<string>>;
  dispatch: (action: Action<string>) => void;
  dispatcher: ActionsToMethods<Actions>;
  nullaryDispatcher: ActionsToMethodsNullary<Actions>;
  currentTargetValueDispatcher: ActionsToMethodsCTV<Actions>;
  currentTargetCheckedDispatcher: ActionsToMethodsCTC<Actions>;
  useAttachEpic: (epic: Epic<Action<string>, Action<string>, State>) => void;
}
interface Container<State = any, Actions extends ActionsMap = {}> {
  name: string;
  ac?: Actions;
  actions: Actions;
  reducer: Reducer<State, Action<string>>;
  epic?: Epic<Action<string>>;
  Provider: NamedExoticComponent<ContainerProviderProps<State>>;
  useInstance: (instanceId?: string) => InstanceContext<State, Actions>;
  getInstance: (instanceId: string) => InstanceContext<State, Actions>;
}

export interface Selector<State = any, RootState = any> {
  (state: State, rootState: RootState): any;
}
export interface CreateContainerOptions<Actions, State> {
  name: string;
  ac?: Actions;
  actions: Actions;
  reducer: Reducer<State, Action<string>>;
  epic?: Epic<Action<string>>;
  getters?: SameType<Selector<State>>;
}
export interface CreateContainer {
  <State = any, Actions extends ActionsMap = any>(
    options: CreateContainerOptions<Actions, State>
  ): Container<State, Actions>;
}
