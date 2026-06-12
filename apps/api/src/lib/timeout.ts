export function withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    label: string,
    options: { prefix?: string } = {},
): Promise<T> {
    let timerId: ReturnType<typeof setTimeout>;
    const prefix = options.prefix ? `[${options.prefix}] ` : "";
    const timeoutPromise = new Promise<never>((_, reject) => {
        timerId = setTimeout(
            () => reject(new Error(`${prefix}Timeout after ${ms}ms: ${label}`)),
            ms,
        );
    });
    return Promise.race([promise.finally(() => clearTimeout(timerId)), timeoutPromise]);
}
