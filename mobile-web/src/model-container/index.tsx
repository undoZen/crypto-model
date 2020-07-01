import produce from "immer";
import {
  get,
  identity,
  mapValues,
  memoize,
  initial,
  forEach,
  values,
} from "lodash-es";
import React, {
  createContext,
  FC,
  HTMLAttributes,
  ReactChild,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { createSelectorHook, Provider } from "react-redux";
import { Action, applyMiddleware, createStore } from "redux";
import _rde from "redux-devtools-extension";
// export { createAction, createActions, createReducer };
import createSagaMiddleware, { stdChannel } from "redux-saga";
import { action, guard, payload, reducer } from "ts-action";
import { on } from "ts-action-immer";
import {
  ActionsMap,
  ActionsToMethods,
  ActionsToMethodsCTC,
  ActionsToMethodsCTV,
  AnyStateReducer,
  Container,
  ContainerProviderProps,
  CreateContainer,
  CreateContainerOptions,
  Selector,
  UseStateOptions,
} from "./internal.types";
import { createAction } from "./create-action";
import { createReducer } from "./create-reducer";
import {
  takeLatest,
  takeLeading,
  takeEvery,
  fork,
  put,
  call,
  take,
  select,
} from "redux-saga/effects";
const { composeWithDevTools } = _rde; // must be fixed later

export const ModelContainerContext = createContext(null);
export const useRootSelector = createSelectorHook(ModelContainerContext);

export const initialize = createAction(
  "initialize",
  (payload: unknown) => payload
);
const composeEnhancers = composeWithDevTools({});

const sagaChannel = stdChannel();
const sageMiddleware = createSagaMiddleware({ channel: sagaChannel });
export const runSaga = sageMiddleware.run;

interface RootState {
  [key: string]: { [key: string]: any };
}
export const store = createStore(
  produce((rootState, action) => {
    const namespace = action?.meta?.modelName;
    const instanceId = action?.meta?.instanceId;
    if (!namespace || !instanceId) {
      return;
    }
    const modelNamespacedState = rootState[namespace] || {};
    const reducer = modelReducers[namespace] || identity;
    console.log("reducer", modelReducers, reducer);
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
  }),
  {},
  composeEnhancers(applyMiddleware(sageMiddleware))
);

export function ModelContainerProvider({ children }) {
  return (
    <Provider store={store} context={ModelContainerContext}>
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
export const createModelContainer = (modelName, initialState) => {
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

  function Provider(props: ContainerProviderProps<State>) {
    const { instanceId, initialState } = props;

    let cacheRef = sagaRunCache.get(instanceId);
    if (!cacheRef) {
      cacheRef = { current: null };
      sagaRunCache.set(instanceId, cacheRef);
    }
    let justInited;
    const modelNamespacedState = store.getState()[modelName] || {};
    console.log(
      "store.getState()",
      store.getState(),
      "justInited",
      justInited,
      instanceId in modelNamespacedState
    );
    if (!(instanceId in modelNamespacedState)) {
      dispatchTo(instanceId)(
        (justInited = decorateAction(instanceId)(
          typeof actions.initialize === "function"
            ? actions.initialize()
            : { type: "initialize" }
        ))
      );
    }
    useLayoutEffect(() => {
      justInited = decorateAction(instanceId)(
        typeof actions.mounted === "function"
          ? actions.mounted()
          : { type: "mounted" }
      );
    }, []);

    console.log("hasSaga", hasSaga);
    useRunSaga(instanceId, hasSaga && getSaga(instanceId), cacheRef, () => {
      console.log("111 justInited", justInited);
      if (justInited) {
        sagaChannel.put(justInited);
      }
    });
    return (
      <Context.Provider value={instanceId}>{props.children}</Context.Provider>
    );
  }

  Provider.displayName = modelName + "ModelContainerProvider";
  function useDispatch() {
    const ctx = useContext(Context);
    if (ctx === EMPTY) {
      throw new Error("Component must be wrapped with <Container.Provider>");
    }
    return ctx.dispatch;
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
      da(payload.currentTarget.value)
    );
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

  function useInstance(instanceId?: string) {
    const ctx = useContext(Context);
    if (!instanceId) {
      if (ctx === EMPTY) {
        throw new Error(
          "Either provide a `instanceId` to useInstance() or use it under <SomeModelContainer.Provider instanceId={instanceId}>"
        );
      }
      instanceId = ctx;
    }
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

  return getContext();
  function getContext() {
    return {
      extend,
      modelName,

      actions,
      getters,

      Provider,
      dispatchTo,
      useInstance,
      getInstance,
      defineActions,
      defineGetters,
      // useContextInstance,
      putTo,
      selectFrom,
    };
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
                  select((state) =>
                    selector(get(state, [modelName, instanceId]))
                  ),
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
};
