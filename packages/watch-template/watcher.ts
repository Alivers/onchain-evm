import { debounce } from "lodash";
import {
  Chain,
  createPublicClient,
  http,
  PublicClient,
  SocketClosedError,
  Transport,
  WatchEventReturnType,
  webSocket,
  WebSocketRequestError,
} from "viem";
import { mainnet } from "viem/chains";

export interface WatcherOptions {
  chain: Chain;
  rpcURL?: string;
  socketURL?: string;
}

export class Watcher {
  public chain: Chain;
  public transport: Transport;
  public client: PublicClient;

  public cancelWatching: () => void;

  constructor(
    options: WatcherOptions = {
      chain: mainnet,
      rpcURL: mainnet.rpcUrls.default.http[0],
      socketURL: undefined,
    }
  ) {
    this.chain = options.chain;
    this.transport = options.socketURL
      ? webSocket(options.socketURL)
      : http(options.rpcURL);
    this.client = createPublicClient({
      chain: this.chain,
      transport: this.transport,
    });

    console.log("Watcher instantiated");
  }

  public watch() {
    this.cancelWatching = this.watchEvent();
  }

  watchEvent = () => {
    console.log("Implement me!");
    return () => {};
  };

  public tryWatching = debounce(async () => {
    this.watch();
  }, 1000);

  onError = (error: Error) => {
    console.error(error);
    if (
      error.name === SocketClosedError.name ||
      error.name === WebSocketRequestError.name
    ) {
      this.cancelWatching();
      this.tryWatching();
    }
  };
}
