export function nonNull<T>(t: T, message: string): NonNullable<T> {
    if (t == null) {
        throw new Error(message);
    }
    return t;
}