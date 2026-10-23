export const MAX_TEXT_LENGTH = 5000;

export type TaskInputResult =
  | { valid: true; text: string }
  | { valid: false; error: string };

export function validateTaskInput(value: unknown): TaskInputResult {
  if (typeof value !== "string") {
    return {
      valid: false,
      error: "O campo text deve ser uma string.",
    };
  }

  const text = value.trim();

  if (!text) {
    return {
      valid: false,
      error: "Informe um texto para gerar tarefas.",
    };
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return {
      valid: false,
      error: `O texto deve ter no máximo ${MAX_TEXT_LENGTH} caracteres.`,
    };
  }

  return { valid: true, text };
}
