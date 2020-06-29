import produce from "immer";
import { get, identity, mapValues, memoize } from "lodash-es";
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
import createSagaMiddleware from "redux-saga";
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
const { composeWithDevTools } = _rde; // must be fixed later

export const ModelContainerContext = createContext(null);
export const useRootSelector = createSelectorHook(ModelContainerContext);

const modelReducers = {};
const ensureNamespace = action("ENSURE_NAMESPACE", payload<string>());
export const init = action(
  "INITIALIZE_INSTANCE",
  payload<{ instanceId: string; initialState?: any }>()
);
export const destroy = action("DESTROY_INSTANCE", payload<string>());
export const unmount = action("ALL_COMPONENTS_UNMOUNTED", payload<string>());
const instanceAction = action(
  "INSTANCE_ACTION",
  (namespace: string, instanceId: string, action: any) => ({
    payload: {
      namespace,
      instanceId,
      action,
    },
  })
);
const composeEnhancers = composeWithDevTools({
  actionSanitizer: (action: Action<any>, id: number) => {
    if (guard(instanceAction)(action)) {
      return {
        ...action.payload.action,
        type: `[${action.payload.namespace}|${action.payload.instanceId}]${action.payload.action.type}`,
      };
    }
    if (guard(ensureNamespace)(action)) {
      return {
        ...action,
        type: `[${action.payload}]${action.type}`,
      };
    }
    return action;
  },
});

const sageMiddleware = createSagaMiddleware();
export const runSaga = sageMiddleware.run;

interface RootState {
  [key: string]: { [key: string]: any };
}
export const store = createStore(
  reducer(
    {},
    on(ensureNamespace, (rootState: RootState, { payload }) => {
      rootState[payload] = rootState[payload] || {};
    }),
    on(instanceAction, (rootState: RootState, { payload }) => {
      const { namespace, instanceId, action } = payload;
      if (!namespace || !instanceId) {
        return;
      }
      const modelNamespacedState = rootState[namespace] || {};
      const reducer = modelReducers[namespace] || identity;
      rootState[namespace] = produce(modelNamespacedState, (state) => {
        if (guard(init)(action)) {
          // debugger;
          state[instanceId] = reducer(action.payload.initialState, action);
        } else if (guard(destroy)(action)) {
          delete state[instanceId];
        } else {
          if (!(instanceId in state)) {
            state[instanceId] = reducer(undefined, init({ instanceId }));
          }
          state[instanceId] = reducer(state[instanceId], action);
        }
      });
    })
  ),
  composeEnhancers(applyMiddleware(sageMiddleware))
);

export interface Props extends HTMLAttributes<HTMLDivElement> {
  children?: ReactChild;
}

const epicActionCache = {};
const instanceComponentCount = {};
export const filterNamespacedAction = (namespace) =>
  pipe(
    filter((action: Action<any>) => guard(instanceAction)(action)),
    filter(
      ({ payload }: ReturnType<typeof instanceAction>) =>
        payload.namespace === namespace
    ),
    map(({ payload }) => payload.action)
  );
export const filterInstanceAction = (namespace, instanceId) =>
  pipe(
    filter((action: Action<any>) => guard(instanceAction)(action)),
    filter(
      ({ payload }: ReturnType<typeof instanceAction>) =>
        payload.namespace === namespace && payload.instanceId === instanceId
    ),
    map(({ payload }) => payload.action)
  );

export const defineModelContainer: CreateContainer = <
  Actions extends ActionsMap,
  State = any
>(
  options: CreateContainerOptions<Actions, State>
): Container<State, Actions> => {
  const { name } = options;
  if (!options.ac) {
    options.ac = {};
  }
  options.getters = options.getters || {};
  modelReducers[name] = options.reducer;
  type R = AnyStateReducer<State>;
  const icc =
    instanceComponentCount[name] || (instanceComponentCount[name] = {});
  const epicInitedCache =
    epicActionCache[name] ||
    (epicActionCache[name] = new Map<string, { current: EpicInited<State> }>());
  const Context = React.createContext<string | typeof EMPTY>(EMPTY);
  if (!store.getState()[name]) {
    store.dispatch(ensureNamespace(name));
  }

  function dispatchTo(instanceId: string) {
    return (action: Action<string>) => {
      store.dispatch(instanceAction(name, instanceId, action));
    };
  }

  const streamCache = {};
  interface StreamCached {
    state$: StateObservable<State>;
    action$: ActionsObservable<Action<string>>;
  }
  const getStreamCache = memoize(
    (instanceId: string): StreamCached => {
      console.log("init get stream cache", instanceId);
      const action$ = _action$.pipe(filterInstanceAction(name, instanceId));
      action$.ofType = (types) => action$.pipe(ofType(types));
      return {
        action$,
        state$: _state$.pipe(pluck(name, instanceId)),
      };
    }
  );

  function useAttachEpicTo(instanceId: string, epic, cacheRef?) {
    const defaultCacheRef = useRef(null);
    const useHook = !!cacheRef ? useMemo : useLayoutEffect;
    cacheRef = cacheRef || defaultCacheRef;
    const { action$, state$ } = getStreamCache(instanceId);

    let epicInited = cacheRef.current;
    function action$FromEpic(epic) {
      return epic(action$, state$, {
        rootState$: _state$,
        rootAction$: _action$,
      }).pipe(map(instanceAction.bind(null, name, instanceId)));
    }
    useHook(() => {
      if (epicInited && epic !== epicInited.epic && epicInited.end$) {
        console.log("epic end");
        epicInited.epic = epic;
        epicInited.action$$.next(action$FromEpic(epic));
      }
      if (!epicInited) {
        // debugger;
        epicInited = cacheRef.current = {
          action$$: new Subject<ActionsObservable<Action<string>>>(),
          end$: new Subject<null>(),
          epic,
        };
        // debugger;
        actions$$.next(
          epicInited.action$$.pipe(
            switchMap(identity),
            tap((x) => {
              console.log(name, "action", x);
            })
          )
        );
        action$
          .pipe(
            ofType(unmount),
            tap((x) => {
              console.log(name, instanceId, "unmounted", x);
            }),
            take(1)
          )
          .subscribe(() => {
            epicInited.action$$.next(empty());
            epicInited.action$$.complete();
            cacheRef.current = null;
          });
        epicInited.action$$.next(action$FromEpic(epic));
      }
    }, [instanceId]);
  }

  function Provider(props: ContainerProviderProps<State>) {
    const { instanceId, initialState } = props;

    let cacheRef = epicInitedCache.get(instanceId);
    if (!cacheRef) {
      cacheRef = { current: null };
      epicInitedCache.set(instanceId, cacheRef);
    }
    // debugger;
    if (typeof options.epic === "function") {
      useAttachEpicTo(instanceId, options.epic, cacheRef);
    }
    if (!(instanceId in get(store.getState(), [name]))) {
      // debugger;
      dispatchTo(instanceId)(init({ instanceId, initialState }));
    }
    useRegisterRelatedComponent(instanceId, props.persist);
    return (
      <Context.Provider value={instanceId}>{props.children}</Context.Provider>
    );
  }
  function useRegisterRelatedComponent(
    instanceId: string,
    persist: boolean = false
  ) {
    useLayoutEffect(() => {
      // console.log("ule", name, instanceId, icc[instanceId]);
      const count = icc[instanceId] || 0;
      icc[instanceId] = count + 1;
      // console.log("ulea", name, instanceId, icc[instanceId]);
      return () => {
        // console.log("ulec", name, instanceId, icc[instanceId]);
        icc[instanceId] = (icc[instanceId] || 0) - 1;
        // console.log("ulecm", name, instanceId, icc[instanceId]);
        setTimeout(() => {
          if (instanceId in icc && icc[instanceId] <= 0) {
            dispatchTo(instanceId)(unmount(instanceId));
            if (!persist) {
              dispatchTo(instanceId)(destroy(instanceId));
            }
            delete icc[instanceId];
          }
        }, 0);
      };
    }, [instanceId]);
  }
  Provider.displayName = name + "ModelContainerProvider";
  function useState$() {
    const ctx = useContext(Context);
    if (ctx === EMPTY) {
      throw new Error("Component must be wrapped with <Container.Provider>");
    }
    return ctx.state$;
  }
  function useAction$() {
    const ctx = useContext(Context);
    if (ctx === EMPTY) {
      throw new Error("Component must be wrapped with <Container.Provider>");
    }
    return ctx.action$;
  }
  function useDispatch() {
    const ctx = useContext(Context);
    if (ctx === EMPTY) {
      throw new Error("Component must be wrapped with <Container.Provider>");
    }
    return ctx.dispatch;
  }
  function getGetters(instanceId: string) {
    return mapValues(options.getters, (selector) => (...args: any[]) => {
      const state = store.getState();
      return selector(get(state, [name, instanceId]), state, ...args);
    });
  }
  function getDispatcher(dispatch) {
    return mapValues(options.actions, (action) => (payload: any) =>
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
    return useRootSelector((state) => get(state, [name, instanceId]));
  }
  function useSelector(instanceId: string, selector: Selector | string) {
    return useRootSelector((state) => {
      if (typeof selector === "string") {
        selector = options.getters[selector];
      }
      return selector(get(state, [name, instanceId]), state);
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
    const { action$, state$ } = getStreamCache(instanceId);
    const dispatch = dispatchTo(instanceId);
    return {
      action$,
      state$,
      dispatch,

      get state() {
        return get(store.getState(), [name, instanceId]);
      },
      get getters() {
        return getGetters(instanceId);
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
      useAttachEpic: (epic) => {
        useAttachEpicTo(instanceId, epic);
      },
    };
  }

  return {
    name,
    ac: options.ac,
    actions: options.actions,
    reducer: options.reducer,
    epic: options.epic,
    Provider,
    dispatchTo,
    useInstance,
    getInstance,
    getters: options.getters,
    // useContextInstance,
  };
};

export function ModelContainerProvider({ children }) {
  return (
    <Provider store={store} context={ModelContainerContext}>
      {children}
    </Provider>
  );
}
