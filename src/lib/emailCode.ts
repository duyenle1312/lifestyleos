export const EMAIL_CODE_LENGTH = 6;

const COMPLETE_CODE = new RegExp(`^\\d{${EMAIL_CODE_LENGTH}}$`);

/** Keeps only digits (so pasted "123 456" or "123-456" work) and truncates to the code length. */
export function sanitizeEmailCode(input: string): string {
  return input.replace(/\D/g, "").slice(0, EMAIL_CODE_LENGTH);
}

/** True only when the code is exactly EMAIL_CODE_LENGTH digits. */
export function isCompleteEmailCode(code: string): boolean {
  return COMPLETE_CODE.test(code);
}
