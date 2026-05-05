/**
 * Sanitizes text for Telegram MarkdownV2.
 * Escapes special characters: _ * [ ] ( ) ~ ` > # + - = | { } . !
 * 
 * Strategy:
 * 1. Escape all occurrences of special characters.
 * 2. Un-escape characters that are part of valid MarkdownV2 formatting constructs
 *    to preserve intentional formatting (bold, italic, code, links).
 */
export function sanitizeMarkdownV2(text: string): string {
    if (!text) return '';

    // First, escape all characters that have special meaning in MarkdownV2
    // Characters to escape: _ * [ ] ( ) ~ ` > # + - = | { } . !
    let escaped = text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');

    // Restore bold: \*text\* -> *text* or \*\*text\*\* -> **text**
    escaped = escaped.replace(/\\(\*\*?)(.*?)\\(\1)/g, '$1$2$3');

    // Restore italic: \_text\_ -> _text_
    escaped = escaped.replace(/\\_(.*?)\\_/g, '_$1_');

    // Restore pre-formatted blocks: \`\`\`text\`\`\`
    escaped = escaped.replace(/\\`\\`\\`([\s\S]*?)\\`\\`\\`/g, '```$1```');

    // Restore code: \`text\` -> `text`
    escaped = escaped.replace(/\\`(.*?)\\`/g, '`$1`');

    // Restore inline links: \[text\]\(url\)
    // In the URL part, we un-escape most characters as they are not needed there
    escaped = escaped.replace(/\\\[(.*?)\\\]\\\((.*?)\\\)/g, (_match, text, url) => {
        const cleanUrl = url.replace(/\\([_*[\]()~`>#+\-=|{}.!])/g, (m, c) => {
            return (c === ')' || c === '\\') ? m : c;
        });
        return `[${text}](${cleanUrl})`;
    });

    return escaped;
}
