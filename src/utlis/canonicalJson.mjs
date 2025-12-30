export function canonicalJson(obj) {
  if (!obj || typeof obj !== "object") return "";

  const sorted = Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = obj[key];
      return acc;
    }, {});

  return JSON.stringify(sorted);
}
