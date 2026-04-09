import { SpecService } from './src/core/spec/SpecService';

console.log('--- Testing Spec Governance ---');

const validPlan = [
    { name: 'search_web', arguments: { query: 'React testing' } },
    { name: 'list_dir', arguments: { DirectoryPath: './src' } }
];

console.log('\nInput: Valid Plan');
const validResult = SpecService.validatePlan(validPlan);
console.log(`IsValid: ${validResult.isValid}`);

const invalidStructurePlan = [
    { tool_name: 'search_web' } // missing "name"
];

console.log('\nInput: Invalid Structure Plan');
const structureResult = SpecService.validatePlan(invalidStructurePlan);
console.log(`IsValid: ${structureResult.isValid} -> Reason: ${structureResult.reason}`);

const dangerousPlan = [
    { name: 'run_command', arguments: { CommandLine: 'rm -rf /' } },
    { name: 'run_command', arguments: { CommandLine: 'echo "hello"' } }
];

console.log('\nInput: Dangerous Plan (rm -rf)');
const dangerousResult = SpecService.validatePlan(dangerousPlan);
console.log(`IsValid: ${dangerousResult.isValid} -> Reason: ${dangerousResult.reason}`);

const escalationPlan = [
    { name: 'run_command', arguments: { CommandLine: 'sudo apt get install' } }
];

console.log('\nInput: Privilege Escalation Plan (sudo)');
const escalationResult = SpecService.validatePlan(escalationPlan);
console.log(`IsValid: ${escalationResult.isValid} -> Reason: ${escalationResult.reason}`);
