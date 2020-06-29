import { delay, race } from "redux-saga/effects";
import { createModelContainer } from "../../../model-container";

export const CounterModel = createModelContainer("counter", {
  count: 0,
  countdown: 0,
})
  .defineGetters({
    count: ({ count }) => count,
    countdown: ({ countdown }) => countdown,
  })
  .defineActions({
    incr: {
      reducer: (state, action) => {
        state.count = state.count + 1;
      },
    },
    decr: {
      reducer: (state, action) => {
        state.count = state.count - 1;
      },
    },
    reset: {
      createWithPayload: (n: number) => n,
      reducer: (state, action) => {
        state.countdown = action.payload;
      },
      saga: ({ put, call, take, select, actions, getters, guards }) => {
        console.log("sagasaga");
        function* incLater() {
          let countdown = yield select(getters.countdown);
          console.log(countdown);
          while (countdown > 0) {
            yield delay(1000);
            yield put(actions.countdown());
            countdown = yield select(getters.countdown);
            console.log(countdown);
          }

          yield put(actions.incr());
        }
        return function* () {
          yield race([call(incLater), take(guards.cancel)]);
        };
      },
    },
    countdown: {
      reducer: (state, action) => {
        state.countdown -= 1;
      },
    },
    cancel: {
      reducer: (state, action) => {
        state.countdown = 0;
      },
    },
  });
