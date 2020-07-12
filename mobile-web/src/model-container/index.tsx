import produce from "immer";
import { forEach, get, identity, mapValues, values } from "lodash-es";
import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  Component,
  Context,
} from "react";
import {
  createSelectorHook,
  Provider,
  ReactReduxContextValue,
} from "react-redux";
import { Action, applyMiddleware, createStore } from "redux";
import createSagaMiddleware, { stdChannel } from "redux-saga";
import {
  call,
  fork,
  put,
  select,
  take,
  takeEvery,
  takeLatest,
  takeLeading,
} from "redux-saga/effects";
import { guard } from "ts-action";
import { on } from "ts-action-immer";
import { createAction } from "./create-action";
import { createReducer } from "./create-reducer";
import {
  ActionsToMethods,
  ActionsToMethodsCTC,
  ActionsToMethodsCTV,
  ContainerProviderProps,
  Selector,
  UseStateOptions,
} from "./internal.types";
import _rde from "redux-devtools-extension";
const { composeWithDevTools } = _rde; // must be fixed later
export { createAction, createReducer };

export const ModelContainerContext = createContext<
  ReactReduxContextValue<RootState>
>(null!);
export const useRootSelector = createSelectorHook(ModelContainerContext);

export const initialize = createAction(
  "initialize",
  (payload: unknown) => payload
);
const composeEnhancers = composeWithDevTools({
  actionSanitizer: (action: Action<any>, id: number) => {
    return {
      ...action,
      type: `${action.type} (${action?.meta?.modelName}|${action?.meta?.instanceId})`,
    };
  },
});

const sagaChannel = stdChannel();
const sageMiddleware = createSagaMiddleware({ channel: sagaChannel });
export const runSaga = sageMiddleware.run;

interface RootState {
  [key: string]: { [key: string]: any };
}
export const store = createStore(
  createReducer(
    {} as RootState,
    produce((rootState, action) => {
      if (!rootState) {
        return {};
      }
      const namespace = action?.meta?.modelName;
      const instanceId = action?.meta?.instanceId;
      if (!namespace || !instanceId) {
        return;
      }
      const modelNamespacedState = rootState[namespace] || {};
      const reducer = modelReducers[namespace] || identity;
      // console.log('reducer', modelReducers, reducer);
      rootState[namespace] = produce(modelNamespacedState, (state) => {
        if (guard(initialize)(action)) {
          // debugger;
          state[instanceId] = reducer(
            state[instanceId] || action?.meta?.initialState,
            action
          );
        } else {
          if (!(instanceId in state)) {
            state[instanceId] = reducer(undefined, initialize({ instanceId }));
          }
          state[instanceId] = reducer(state[instanceId], action);
        }
      });
    })
  ),
  composeEnhancers(applyMiddleware(sageMiddleware))
);

export function ModelContainerProvider({ children }: { children: Component }) {
  return (
    <Provider
      store={store}
      context={
        ModelContainerContext as Context<ReactReduxContextValue<RootState>>
      }
    >
      {children}
    </Provider>
  );
}

const modelReducers = {};
const modelReducerHandlers = {};
const modelActionCreators = {};

const sagaRunCacheMap = {};
const instanceComponentCount = {};
const EMPTY: unique symbol = Symbol();
export const createModelContainer = (
  modelName: string,
  initialState: { [key: string]: any }
) => {
  let reducer = createReducer(initialState);
  modelReducers[modelName] = reducer;
  console.log("cmc", modelReducers);
  let Context = React.createContext<string | typeof EMPTY>(EMPTY);

  const extend = (_modelName, initialState) => {
    modelName = _modelName;
    modelReducers[modelName] = reducer = reducer.replaceInitialState(
      initialState
    );
    Context = React.createContext<string | typeof EMPTY>(EMPTY);
    return getContext();
  };

  function decorateAction(instanceId) {
    return (action) => ({
      ...action,
      meta: {
        ...action.meta,
        modelName,
        instanceId,
      },
    });
  }
  function dispatchTo(instanceId: string) {
    return (action: Action<string>) => {
      store.dispatch(decorateAction(instanceId)(action));
    };
  }

  function useRunSaga(instanceId: string, saga, cacheRef?, runMore?) {
    if (!saga || typeof saga !== "function") {
      return;
    }
    const defaultCacheRef = useRef(null);
    // const useHook = !!cacheRef ? useMemo : useLayoutEffect;
    cacheRef = cacheRef || defaultCacheRef;

    let sagaRun = cacheRef.current;
    useLayoutEffect(() => {
      if (sagaRun && saga !== sagaRun.saga) {
        if (sagaRun.task?.isRunning?.()) {
          console.log("cancel saga", instanceId);
          sagaRun.task.cancel();
        }
      }
      if (!sagaRun || saga !== sagaRun.saga) {
        // debugger;
        sagaRun = cacheRef.current = {
          task: runSaga(saga),
          saga,
        };
      }
      console.log("saga run");
      let runMoreCallback;
      if (typeof runMore === "function") {
        runMoreCallback = runMore();
      }
      return () => {
        if (typeof sagaRun?.task?.cancel === "function") {
          // debugger;
          sagaRun.task.cancel();
        }
        if (typeof runMoreCallback === "function") {
          runMoreCallback();
        }
      };
    }, [instanceId]);
  }

  let hasSaga = false;
  const sagaRunCache =
    sagaRunCacheMap[modelName] ||
    (sagaRunCacheMap[modelName] = new Map<string, { current: unknown }>());
  let sagas = {};
  let actions = {};
  let getters = {};

  const getDefaultActionDecorator = ({
    instanceId,
    initialState,
    initializePayload,
  }) => (type: string) => {
    const action = decorateAction(instanceId)(
      typeof actions[type] === "function" ? actions[type]() : { type }
    );
    if (type === "initialize" && initialState) {
      return {
        ...action,
        payload: initializePayload ? initializePayload : action.payload,
        meta: { ...action.meta, ...(initialState ? { initialState } : {}) },
      };
    }
    return action;
  };

  function ensureInstance(props) {
    const { instanceId } = props;
    const getDefaultAction = getDefaultActionDecorator(props);
    const modelNamespacedState = store.getState()[modelName] || {};
    console.log(
      "ensureInstance",
      instanceId,
      instanceId in modelNamespacedState
    );
    if (!(instanceId in modelNamespacedState)) {
      console.log("initialize action", getDefaultAction("initialize"));
      dispatchTo(instanceId)(getDefaultAction("initialize"));
    }
  }
  function useRunDefaultSaga(props) {
    const { instanceId } = props;
    const getDefaultAction = getDefaultActionDecorator(props);
    let cacheRef = sagaRunCache.get(instanceId);
    if (!cacheRef) {
      cacheRef = { current: null };
      sagaRunCache.set(instanceId, cacheRef);
    }
    let justInited;
    console.log("store.getState()", store.getState(), "justInited", justInited);
    useLayoutEffect(() => {
      justInited = getDefaultAction("mounted");
    }, []);

    console.log("hasSaga", hasSaga);
    useRunSaga(instanceId, hasSaga && getSaga(instanceId), cacheRef, () => {
      console.log("111 justInited", justInited);
      if (justInited) {
        sagaChannel.put(justInited);
      }
    });
  }

  function Provider(props: ContainerProviderProps<State>) {
    const { instanceId } = props;
    ensureInstance(props);
    useRunDefaultSaga(props);
    return (
      <Context.Provider value={instanceId}>{props.children}</Context.Provider>
    );
  }
  function getGetters(instanceId: string) {
    return mapValues(getters, (selector) => (...args: any[]) => {
      const state = store.getState();
      return selector(get(state, [modelName, instanceId]), state, ...args);
    });
  }
  function getGuards(instanceId: string) {
    return mapValues(actions, (actionCreator) => (action) =>
      action?.meta?.modelName === modelName &&
      action?.meta?.instanceId === instanceId &&
      guard(actionCreator)(action)
    );
  }
  function getDispatcher(dispatch) {
    return mapValues(actions, (action) => (payload: any) =>
      dispatch(action(payload))
    );
  }
  function getNullaryDispatcher(dispatcher): ActionsToMethods<Actions> {
    return mapValues(dispatcher, (da) => () => da());
  }
  function getCurrentTargetValueDispatcher(
    dispatcher
  ): ActionsToMethodsCTV<Actions> {
    return mapValues(dispatcher, (da) => (payload) =>
      da(payload.currentTarget.value)
    );
  }
  function getCurrentTargetCheckedDispatcher(
    dispatcher
  ): ActionsToMethodsCTC<Actions> {
    return mapValues(dispatcher, (da) => (payload) =>
      da(payload.currentTarget.checked)
    );
  }
  function getTargetValueDispatcher(dispatcher): ActionsToMethodsCTV<Actions> {
    return mapValues(dispatcher, (da) => (payload) => da(payload.target.value));
  }
  function getTargetCheckedDispatcher(
    dispatcher
  ): ActionsToMethodsCTC<Actions> {
    return mapValues(dispatcher, (da) => (payload) => {
      console.log(11123, payload);
      return da(payload.target.checked);
    });
  }

  function useState(instanceId: string) {
    return useRootSelector((state) => get(state, [modelName, instanceId]));
  }
  function useSelector(instanceId: string, selector: Selector | string) {
    return useRootSelector((state) => {
      if (typeof selector === "string") {
        selector = getters[selector];
      }
      return selector(get(state, [modelName, instanceId]), state);
    });
  }

  function useInstanceFromContext() {
    const instanceId = useContext(Context);
    if (!instanceId === EMPTY) {
      throw new Error(
        "useInstanceFromContext() must be used under <SomeModelContainer instanceId={instanceId}>"
      );
    }
    return getInstance(instanceId);
  }
  function useInstanceById(
    instanceId: string,
    initialState: any,
    initializePayload: any
  ) {
    if (!instanceId) {
      throw new Error("`instanceId` prop for useInstanceById() is required");
    }
    ensureInstance({ instanceId, initialState, initializePayload });
    // useRunDefaultSaga({ instanceId });
    return getInstance(instanceId);
  }
  function getInstance(instanceId: string) {
    console.log("getInstance:", instanceId);
    const dispatch = dispatchTo(instanceId);
    return {
      dispatch,

      get state() {
        return get(store.getState(), [modelName, instanceId]);
      },
      get getters() {
        return getGetters(instanceId);
      },
      get guards() {
        return getGuards(instanceId);
      },
      get dispatcher() {
        return getDispatcher(dispatch);
      },
      get nullaryDispatcher() {
        return getNullaryDispatcher(getDispatcher(dispatch));
      },
      get currentTargetValueDispatcher() {
        return getCurrentTargetValueDispatcher(getDispatcher(dispatch));
      },
      get currentTargetCheckedDispatcher() {
        return getCurrentTargetCheckedDispatcher(getDispatcher(dispatch));
      },
      get targetValueDispatcher() {
        return getTargetValueDispatcher(getDispatcher(dispatch));
      },
      get targetCheckedDispatcher() {
        return getTargetCheckedDispatcher(getDispatcher(dispatch));
      },

      useState(options?: UseStateOptions) {
        return useState(instanceId);
      },
      useSelector(selector: Selector, options?: UseStateOptions) {
        return useSelector(instanceId, selector);
      },
      useRunSaga: (saga) => {
        useRunSaga(instanceId, saga);
      },
    };
  }

  function getContext() {
    return Object.assign(Provider, {
      extend,
      modelName,

      actions,
      getters,

      dispatchTo,
      useInstanceById,
      useInstanceFromContext,
      getInstance,
      defineActions,
      defineGetters,
      // useContextInstance,
      putTo,
      selectFrom,
    });
  }

  function putTo(instanceId, action) {
    return put({
      ...action,
      meta: {
        modelName,
        instanceId,
      },
    });
  }
  function selectFrom(instanceId, selector) {
    return select((state) => selector(get(state, [modelName, instanceId])));
  }

  function defineActions(_actions) {
    forEach(_actions, (options, type) => {
      const actionCreator =
        typeof options.createWithPayload === "function"
          ? createAction(type, options.createWithPayload)
          : createAction(type);
      actions = {
        ...actions,
        [type]: actionCreator,
      };
      if (typeof options.saga === "function") {
        hasSaga = true;
        sagas = {
          ...sagas,
          [type]: function* (instanceId) {
            yield (
              {
                latest: takeLatest,
                leading: takeLeading,
                every: takeEvery,
              }[options.sagaTakeType] || takeLatest
            )(
              (action) =>
                action?.meta?.modelName === modelName &&
                action?.meta?.instanceId === instanceId &&
                guard(actionCreator)(action),
              options.saga({
                actions: mapValues(actions, (actionCreator) => (...args) =>
                  decorateAction(instanceId)(actionCreator(...args))
                ),
                getters,
                guards: getGuards(instanceId),
                select: (selector) =>
                  selector
                    ? select((state) =>
                        selector(get(state, [modelName, instanceId]))
                      )
                    : select((state) => get(state, [modelName, instanceId])),
                take: (pattern) => take(pattern),
                put: (action) =>
                  put({
                    ...action,
                    meta: {
                      modelName,
                      instanceId,
                    },
                  }),
                call: call,
              })
            );
          },
        };
      }
      if (typeof options.reducer === "function") {
        modelReducers[modelName] = reducer = reducer.handle(
          on(actionCreator, options.reducer)
        );
      }
    });
    return getContext();
  }
  function defineGetters(_getters) {
    forEach(_getters, (getter, name) => {
      getters = {
        ...getters,
        [name]: getter,
      };
    });
    return getContext();
  }
  function getSaga(instanceId) {
    return function* () {
      for (const saga of values(sagas)) {
        yield fork(saga, instanceId);
      }
    };
  }
  return getContext();
};
