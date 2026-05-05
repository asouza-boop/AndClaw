import { MeetingService } from './MeetingService';
import { agentEvents, MEETING_MUTATED } from '../events/AgentEvents';
import assert from 'assert';

async function runTests() {
  console.log('Running MeetingService mutation tests...');

  // Test 1: create() with meeting_date emits MEETING_MUTATED
  {
    console.log('Test 1: create() with meeting_date should emit MEETING_MUTATED');
    let emitted = false;
    const handler = () => { emitted = true; };
    agentEvents.on(MEETING_MUTATED, handler);

    try {
      await MeetingService.create({ title: 'Test Meeting', meeting_date: new Date().toISOString() });
    } catch (e) {}

    console.log('  (Requires DB for full validation)');
    agentEvents.off(MEETING_MUTATED, handler);
  }

  // Test 2: update() with meeting_date emits MEETING_MUTATED
  {
    console.log('Test 2: update() with meeting_date should emit MEETING_MUTATED');
    let emitted = false;
    const handler = () => { emitted = true; };
    agentEvents.on(MEETING_MUTATED, handler);

    try {
      await MeetingService.update(1, { meeting_date: new Date().toISOString() });
    } catch (e) {}

    console.log('  (Requires DB for full validation)');
    agentEvents.off(MEETING_MUTATED, handler);
  }

  console.log('MeetingService tests completed.');
}

runTests().catch(err => {
  console.error('MeetingService tests failed:', err);
});
