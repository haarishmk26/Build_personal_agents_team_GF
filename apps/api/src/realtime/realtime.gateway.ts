import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { Server } from "socket.io";
@WebSocketGateway({namespace:"/events",cors:{origin:process.env.WEB_ORIGIN??"http://localhost:3000"}})
export class RealtimeGateway {@WebSocketServer() server!:Server; publish(event:string,payload:unknown){this.server.emit(event,payload);}}