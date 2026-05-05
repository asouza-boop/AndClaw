import { TelegramInputHandler } from './TelegramInputHandler';
import assert from 'assert';

async function testTypingIndicators() {
    console.log('Running TelegramInputHandler typing indicator tests...');

    let chatActionCalled = false;
    let intervalStarted = false;
    let intervalCleared = false;

    // Mock Context
    const mockCtx: any = {
        from: { id: 12345 },
        message: { text: 'test' },
        replyWithChatAction: async (action: string) => {
            if (action === 'typing') chatActionCalled = true;
            return true;
        },
        reply: async () => true
    };

    // Mock Bot
    const mockBot: any = {
        use: () => {},
        on: () => {},
        catch: () => {}
    };

    // Mock setInterval/clearInterval
    const originalSetInterval = global.setInterval;
    const originalClearInterval = global.clearInterval;

    (global as any).setInterval = (fn: any, ms: number) => {
        intervalStarted = true;
        return 123 as any;
    };
    (global as any).clearInterval = (id: any) => {
        if (id === 123) intervalCleared = true;
    };

    const handler = new TelegramInputHandler(mockBot);

    // Test 6-9: Typing indicators in handleInput
    // We need to mock AgentController to control timing
    (handler as any).controller = {
        processInput: async () => {
            assert.strictEqual(chatActionCalled, true, 'sendChatAction should be called before processing');
            assert.strictEqual(intervalStarted, true, 'setInterval should be started');
            return 'response';
        }
    };

    await (handler as any).handleInput(mockCtx, 'test');

    assert.strictEqual(intervalCleared, true, 'clearInterval should be called after response');

    // Reset and test error case
    chatActionCalled = false;
    intervalStarted = false;
    intervalCleared = false;

    (handler as any).controller.processInput = async () => {
        throw new Error('test error');
    };

    try {
        await (handler as any).handleInput(mockCtx, 'test');
    } catch (e) {}

    assert.strictEqual(intervalCleared, true, 'clearInterval should be called on error (finally block)');

    // Restore
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;

    console.log('✅ TelegramInputHandler typing indicator tests passed');
}

testTypingIndicators().catch(e => {
    console.error('❌ TelegramInputHandler tests failed:', e);
    process.exit(1);
});
