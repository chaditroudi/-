import { it } from "vitest";
import { runWithFactory, type FactoryContext } from "../db/factory-context.js";

/** Explicit context for direct service tests; HTTP tests obtain theirs through authentication. */
export const testInFactory = (scope: FactoryContext) =>
  (name: string, work: () => unknown | Promise<unknown>, timeout?: number) => it(name, () => runWithFactory(scope, work), timeout);
