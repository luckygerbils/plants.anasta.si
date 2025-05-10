type CompareFn<T> = (a: T, b: T) => number;

interface LocaleComparable<T> {
  localeCompare: (this: T, other: T) => number,
}

export function localeCompare<T extends LocaleComparable<T>>(a: T, b: T) {
  return a.localeCompare(b);
}

export function numberCompare<T extends number>(a: T, b: T) {
  return a - b;
}

export function dateCompare<T extends string>(a: T, b: T) {
  return comparing((d: T) => +new Date(d), numberCompare)(a, b);
}

export function explicit<T>(order: T[]) {
  return comparing<T, number>(t => order.indexOf(t), numberCompare);
}

export function nullsFirst<T>(compareFn: CompareFn<NonNullable<T>>) {
  return (a: T, b: T) => {
    if (a == null) {
      return (b == null) ? 0 : -1;
    } else if (b == null) {
      return 1;
    } else {
      return compareFn(a, b);
    }
  };
}

export function nullsLast<T>(compareFn: CompareFn<NonNullable<T>>) {
  return (a: T, b: T) => {
    if (a == null) {
      return (b == null) ? 0 : 1;
    } else if (b == null) {
      return -1;
    } else {
      return compareFn(a, b);
    }
  };
}

export function comparing<T, S>(keyExtractor: (a: T) => S, compareFn: CompareFn<S>) {
  return (a: T, b: T) => compareFn(keyExtractor(a), keyExtractor(b));
}

export function reversed<T>(compareFn: CompareFn<T>) {
  return (a: T, b: T) => -1 * compareFn(a, b);
}