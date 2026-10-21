// Globals the page shares with the iPhone app and the smoke test
interface Window {
  App: import("./core/base").AppApi;
  MONEY_NATIVE?: boolean;
  MONEY_CHECK_HTML?: boolean;
  MONEY_NATIVE_TABS?: boolean;
  webkit?: any;
  parseHandler?: (src: string) => any[];
}
