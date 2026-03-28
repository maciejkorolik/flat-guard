/**
 * Append to system prompts so assistant output stays English regardless of listing/source language.
 */
export const RESPOND_IN_ENGLISH_RULE = `
LANGUAGE: Always write your assistant replies in English, even when listing titles, descriptions, addresses, or the user's message are in Polish or another language. When you quote or summarize non-English text, translate or paraphrase it in English.
`.trim();
