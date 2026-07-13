import assert from 'node:assert/strict';
import test from 'node:test';
import { query } from '../src/db/postgres';
import { MeetingService } from '../src/core/agent/MeetingService';

test('Step 2 Batch: MeetingService batch insert behavior', async (t) => {
    // Mock agent
    const mockAgent = {
        processInput: async () => JSON.stringify({
            tasks_immediate: [
                { title: 'Task A', priority: 'high' },
                { title: 'Task B', priority: 'low' }
            ],
            tasks_future: [],
            key_points: [],
            alerts: [],
            ideas: [],
            decisions: [],
            memory_highlights: [],
            participants_identified: []
        })
    };

    const meetingId = 999;

    // Cleanup
    await query("DELETE FROM tasks WHERE metadata->>'meeting_id' = '999'");

    await t.test('Batch insert should insert all items correctly', async () => {
        await MeetingService.processIntelligence(meetingId, 'transcript', mockAgent);
        
        const rows = await query("SELECT title FROM tasks WHERE metadata->>'meeting_id' = '999' ORDER BY title ASC");
        assert.strictEqual(rows.length, 2);
        assert.strictEqual(rows[0].title, 'Task A');
        assert.strictEqual(rows[1].title, 'Task B');
    });

    await t.test('Duplicate items should be silently skipped', async () => {
        // Run again with one new task and one duplicate
        const mockAgent2 = {
            processInput: async () => JSON.stringify({
                tasks_immediate: [
                    { title: 'Task A', priority: 'high' }, // Duplicate
                    { title: 'Task C', priority: 'medium' } // New
                ],
                tasks_future: [],
                key_points: [],
                alerts: [],
                ideas: [],
                decisions: [],
                memory_highlights: [],
                participants_identified: []
            })
        };

        await MeetingService.processIntelligence(meetingId, 'transcript', mockAgent2);
        
        const rows = await query("SELECT title FROM tasks WHERE metadata->>'meeting_id' = '999' ORDER BY title ASC");
        assert.strictEqual(rows.length, 3);
        assert.strictEqual(rows[0].title, 'Task A');
        assert.strictEqual(rows[1].title, 'Task B');
        assert.strictEqual(rows[2].title, 'Task C');
    });

    await t.test('Transaction rollback on mid-batch error', async () => {
        // We can't easily mock query inside MeetingService without more complex setup
        // But we can test it by manually running a failing batch if we wanted to be sure
        // For this test, I'll assume the transaction logic is correct if I can't mock easily.
        // Wait, I can mock the query function by replacing it temporarily.
        
        // Let's skip the hard mock and just verify the common cases pass.
        // If I must test rollback, I'll need a way to make the INSERT fail.
        // For example, a null title (if it's NOT NULL).
        
        const mockAgentFail = {
            processInput: async () => JSON.stringify({
                tasks_immediate: [
                    { title: null, priority: 'high' } // Should fail DB constraint
                ],
                tasks_future: [],
                key_points: [],
                alerts: [],
                ideas: [],
                decisions: [],
                memory_highlights: [],
                participants_identified: []
            })
        };

        await assert.rejects(
            () => MeetingService.processIntelligence(meetingId, 'transcript', mockAgentFail)
        );

        // Check that no partial data was committed (though in this case it's just one row)
        // Let's try with one good, one bad.
        const mockAgentPartialFail = {
            processInput: async () => JSON.stringify({
                tasks_immediate: [
                    { title: 'Task D', priority: 'high' },
                    { title: null, priority: 'low' }
                ],
                tasks_future: [],
                key_points: [],
                alerts: [],
                ideas: [],
                decisions: [],
                memory_highlights: [],
                participants_identified: []
            })
        };

        await assert.rejects(
            () => MeetingService.processIntelligence(meetingId, 'transcript', mockAgentPartialFail)
        );

        const rows = await query("SELECT title FROM tasks WHERE title = 'Task D'");
        assert.strictEqual(rows.length, 0, 'Task D should have been rolled back');
    });

    // Cleanup
    await query("DELETE FROM tasks WHERE metadata->>'meeting_id' = '999'");
});
