// Type stub for @walletconnect/ethereum-provider
// Install with: npm install @walletconnect/ethereum-provider
declare module "@walletconnect/ethereum-provider" {
  export class EthereumProvider {
    static init(opts: {
      projectId: string;
      chains: number[];
      showQrModal?: boolean;
      metadata?: {
        name: string;
        description: string;
        url: string;
        icons: string[];
      };
    }): Promise<EthereumProvider>;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    on(event: string, handler: (...args: any[]) => void): void;
    removeListener(event: string, handler: (...args: any[]) => void): void;
  }
}
