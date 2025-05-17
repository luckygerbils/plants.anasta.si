import { Beta } from "./beta";
import { Prod } from "./prod";

export * from "./beta";
export * from "./prod";

export type AppInstance = typeof ALL_INSTANCES[number];
export const ALL_INSTANCES = [ Beta, Prod ] as const;