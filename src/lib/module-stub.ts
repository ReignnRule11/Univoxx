import { notImplemented } from "./errors";

export function moduleNotImplemented(moduleName: string): never {
  throw notImplemented(`${moduleName} is not implemented in the foundation release`);
}
