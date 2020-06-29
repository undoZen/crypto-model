import { ActionCreator, Creator, Typed } from "ts-action";
import { mapValues } from "lodash-es";
export declare type FunctionWithParametersType<
  P extends unknown[],
  R = void
> = (...args: P) => R;
export declare type ParametersType<T> = T extends (...args: infer U) => unknown
  ? U
  : never;
function defineType<T extends string>(type: T, creator: Creator) {
  return Object.defineProperty(creator, "type", {
    value: type,
    writable: false,
  });
}
interface PayloadCreator {
  (...args: any[]): any;
  name: string;
}
type PCSReturn<PC extends Creator, S extends string> = Typed<
  FunctionWithParametersType<
    ParametersType<PC>,
    Typed<{ payload: ReturnType<PC>; error?: boolean; meta?: unknown }, S>
  >,
  S
>;
interface CreateAction {
  <PC extends PayloadCreator | string>(
    payloadCreator: PC
  ): PC extends PayloadCreator
    ? PCSReturn<PC, PC["name"]>
    : PC extends string
    ? ActionCreator<PC, () => Typed<{}, PC>>
    : never;
  <PC extends PayloadCreator, S extends string>(
    type: S,
    payloadCreator: PC
  ): PCSReturn<PC, S>;
}
export const createAction: CreateAction = (
  typeOrPayloadCreator: PayloadCreator | string,
  payloadCreator?: PayloadCreator
) => {
  if (typeof typeOrPayloadCreator === "string") {
    if (typeof payloadCreator === "function") {
      return defineTypeWithPayloadCreator(typeOrPayloadCreator, payloadCreator);
    }
    return defineType(typeOrPayloadCreator, () => ({
      type: typeOrPayloadCreator,
    }));
  }
  if (typeof typeOrPayloadCreator.name !== "string") {
    throw new Error(
      "you must define payload creator in a way that it have a .name property."
    );
  }
  return defineTypeWithPayloadCreator(
    typeOrPayloadCreator.name,
    typeOrPayloadCreator
  );
  function defineTypeWithPayloadCreator(
    type: string,
    payloadCreator: PayloadCreator
  ) {
    return defineType(type, (...args: unknown[]) => {
      const payload = payloadCreator(...args);
      if (payload instanceof Error) {
        return {
          payload,
          type,
          error: true,
        } as const;
      }
      return {
        payload,
        type,
      } as const;
    });
  }
};
