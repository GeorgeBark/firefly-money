// Globals the page shares with the iPhone app and the smoke test
interface Window {
  App: any;
  MONEY_NATIVE?: boolean;
  MONEY_NATIVE_TABS?: boolean;
  webkit?: any;
  parseHandler?: (src: string) => any[];
}
