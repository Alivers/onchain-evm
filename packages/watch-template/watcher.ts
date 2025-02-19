import { debounce } from "lodash";
import {
  Chain,
  createPublicClient,
  http,
  HttpTransport,
  PublicClient,
  SocketClosedError,
  webSocket,
  WebSocketRequestError,
  WebSocketTransport,
} from "viem";
import { mainnet } from "viem/chains";

export interface WatcherOptions {
  chain: Chain;
  rpcURL?: string;
  socketURL?: string;
  maxRetries?: number;
}

export abstract class Watcher {
  public readonly chain: Chain;
  public readonly transport: WebSocketTransport | HttpTransport;
  public client: PublicClient;

  private readonly options: WatcherOptions;

  private retryCount = 0;

  private cancelWatching: () => void = () => {};

  constructor(
    options: WatcherOptions = {
      chain: mainnet,
      rpcURL: mainnet.rpcUrls.default.http[0],
      socketURL: undefined,
    }
  ) {
    this.options = options;

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

  protected abstract watchEvent(): () => void;

  private get maxRetries() {
    return this.options.maxRetries ?? 5;
  }

  public tryWatching = debounce(async () => {
    if (this.retryCount >= this.maxRetries) {
      console.error(`Max retry attempts (${this.maxRetries}) reached`);
      return;
    }

    if (this.client.transport.type === "WebSocketTransport") {
      const client = await (
        this.client.transport as Record<
          string,
          any
        > as ReturnType<WebSocketTransport>["value"]
      )?.getRpcClient();

      // Check if we need to reconnect
      if (!client?.socket || client.socket.readyState !== WebSocket.OPEN) {
        this.retryCount++;
        console.log(
          `Reconnect attempt ${this.retryCount}/${this.maxRetries}...`
        );

        // Clean up and recreate connection
        this.cancelWatching();
        client?.socket?.close();
        this.client = createPublicClient({
          chain: this.chain,
          transport: this.transport,
        });

        this.tryWatching();
        return;
      }

      // Socket is open, reset retry count and watch
      this.retryCount = 0;
      this.watch();
    } else {
      // For HTTP transport, just watch
      this.watch();
    }
  }, 1000);

  public onError = (error: Error) => {
    if (
      error.name === SocketClosedError.name ||
      error.name === WebSocketRequestError.name
    ) {
      console.error("Error occurred: ", error);
      this.cancelWatching();
      this.tryWatching();
    } else {
      console.error("Unknown error: ", error);
    }
  };
}
