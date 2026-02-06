import "ws";

declare module "ws" {
    export interface WebSocket{
        isAlive?: boolean;
        subscriptions: Set<string>;
    }
}