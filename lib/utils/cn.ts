type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | Record<string, boolean>
  | ClassValue[];

function pushClass(acc: string[], value: ClassValue): void {
  if (!value) return;
  if (typeof value === "string" || typeof value === "number") {
    acc.push(String(value));
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => pushClass(acc, item));
    return;
  }
  if (typeof value === "object") {
    Object.entries(value).forEach(([key, enabled]) => {
      if (enabled) acc.push(key);
    });
  }
}

export function cn(...inputs: ClassValue[]): string {
  const classes: string[] = [];
  inputs.forEach((input) => pushClass(classes, input));
  return classes.join(" ");
}
