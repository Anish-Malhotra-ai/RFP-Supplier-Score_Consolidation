export const normalizeString = (str: string | undefined | null) => {
  if (!str) return "";
  return str.trim().toLowerCase();
};
