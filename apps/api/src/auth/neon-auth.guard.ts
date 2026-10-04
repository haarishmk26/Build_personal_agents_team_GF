import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { IS_PUBLIC } from "./public.decorator.js";

type RequestWithUser = Request & { user?: { id: string; email?: string } };

@Injectable()
export class NeonAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = request.headers.get?.("authorization")?.replace(/^Bearer\s+/i, "") ?? (request.headers as Record<string, string | undefined>).authorization?.replace(/^Bearer\s+/i, "");
    if (!token) throw new UnauthorizedException("A Neon Auth bearer token is required.");
    const jwksUrl = process.env.NEON_AUTH_JWKS_URL;
    if (!jwksUrl) throw new UnauthorizedException("Neon Auth is not configured on this service.");
    try {
      const { payload } = await jwtVerify(token, createRemoteJWKSet(new URL(jwksUrl)));
      if (!payload.sub) throw new Error("Token has no subject");
      request.user = { id: payload.sub, email: typeof payload.email === "string" ? payload.email : undefined };
      return true;
    } catch {
      throw new UnauthorizedException("Neon Auth token is invalid or expired.");
    }
  }
}