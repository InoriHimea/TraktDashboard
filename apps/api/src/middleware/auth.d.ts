export declare function signToken(userId: number): Promise<string>;
export declare function verifyToken(token: string): Promise<number | null>;
export declare const authMiddleware: import("hono").MiddlewareHandler<any, string, {}, Response | (Response & import("hono").TypedResponse<{
    error: string;
}, 401, "json">)>;
//# sourceMappingURL=auth.d.ts.map