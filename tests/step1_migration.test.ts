import assert from 'node:assert/strict';
import test from 'node:test';
import { query } from '../src/db/postgres';

test('Step 1 Migration: Unique constraint on title + meeting_id', async (t) => {
    // Cleanup
    await query("DELETE FROM tasks WHERE title LIKE 'Step 1 Test%'");

    await t.test('Same title + same meeting_id should fail on second insert', async () => {
        const title = 'Step 1 Test: Duplicate';
        const metadata = JSON.stringify({ meeting_id: 123 });
        
        await query('INSERT INTO tasks (title, metadata) VALUES ($1, $2)', [title, metadata]);
        
        await assert.rejects(
            () => query('INSERT INTO tasks (title, metadata) VALUES ($1, $2)', [title, metadata]),
            { name: 'error', code: '23505' } // unique_violation
        );
    });

    await t.test('Same title + different meeting_id should succeed', async () => {
        const title = 'Step 1 Test: Different Meetings';
        await query('INSERT INTO tasks (title, metadata) VALUES ($1, $2)', [title, JSON.stringify({ meeting_id: 1 })]);
        await assert.doesNotReject(
            () => query('INSERT INTO tasks (title, metadata) VALUES ($1, $2)', [title, JSON.stringify({ meeting_id: 2 })])
        );
    });

    await t.test('Same title + null meeting_id should succeed (partial index)', async () => {
        const title = 'Step 1 Test: Null Meeting';
        await query('INSERT INTO tasks (title, metadata) VALUES ($1, $2)', [title, JSON.stringify({})]);
        await assert.doesNotReject(
            () => query('INSERT INTO tasks (title, metadata) VALUES ($1, $2)', [title, JSON.stringify({})])
        );
        await assert.doesNotReject(
            () => query('INSERT INTO tasks (title, metadata) VALUES ($1, NULL)', [title])
        );
    });

    // Cleanup
    await query("DELETE FROM tasks WHERE title LIKE 'Step 1 Test%'");
});
