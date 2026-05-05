import { sanitizeMarkdownV2 } from './telegramMarkdown';
import assert from 'assert';

function testSanitizer() {
    console.log('Running sanitizeMarkdownV2 tests...');

    // 1. Special chars are escaped
    assert.strictEqual(sanitizeMarkdownV2('.'), '\\.', 'Dot should be escaped');
    assert.strictEqual(sanitizeMarkdownV2('!'), '\\!', 'Exclamation should be escaped');
    assert.strictEqual(sanitizeMarkdownV2('-'), '\\-', 'Dash should be escaped');
    assert.strictEqual(sanitizeMarkdownV2('()'), '\\(\\)', 'Parentheses should be escaped');

    // 2. Bold syntax preserved
    assert.strictEqual(sanitizeMarkdownV2('*bold*'), '*bold*', 'Bold with single star should be preserved');
    assert.strictEqual(sanitizeMarkdownV2('**bold**'), '**bold**', 'Bold with double stars should be preserved');

    // 3. Code syntax preserved
    assert.strictEqual(sanitizeMarkdownV2('`code`'), '`code`', 'Inline code should be preserved');
    assert.strictEqual(sanitizeMarkdownV2('```\npre\n```'), '```\npre\n```', 'Code block should be preserved');

    // 4. URL in link not escaped
    assert.strictEqual(sanitizeMarkdownV2('[text](https://example.com)'), '[text](https://example.com)', 'Link should be preserved');

    // 5. Mixed content
    const mixed = 'Hello! *bold* text with a dot. And a [link](http://test.com)';
    const expected = 'Hello\\! *bold* text with a dot\\. And a [link](http://test.com)';
    assert.strictEqual(sanitizeMarkdownV2(mixed), expected, 'Mixed content should be correctly handled');

    console.log('✅ sanitizeMarkdownV2 tests passed');
}

try {
    testSanitizer();
} catch (e) {
    console.error('❌ sanitizeMarkdownV2 tests failed:', e);
    process.exit(1);
}
