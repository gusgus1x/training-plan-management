export const isValidThaiNationalId = (value: string) => {
  return /^\d{13}$/.test(value);
};
