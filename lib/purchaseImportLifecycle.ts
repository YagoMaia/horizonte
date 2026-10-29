// Failed resets keep imports paused until the user retries the reset.
export const IMPORT_RESET_KEY = '@horizonte:purchase_import_reset';
let paused = false;
let resetHandler: (() => Promise<void>) | undefined;
export const isPurchaseImportPaused = () => paused;
export function registerImportResetHandler(handler: () => Promise<void>) {
  resetHandler = handler;
  return () => { if (resetHandler === handler) resetHandler = undefined; };
}
export async function withPurchaseImportPaused<T>(operation: () => Promise<T>) {
  paused = true;
  await resetHandler?.();
  const result = await operation();
  paused = false;
  return result;
}
