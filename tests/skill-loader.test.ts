import assert from 'node:assert/strict';
import test from 'node:test';
import { SkillLoader } from '@/skills/SkillLoader';

test('SkillLoader loads skills from .agents/skills without parse errors', () => {
  const loader = new SkillLoader();
  const skills = loader.fetchSkills();

  assert.ok(skills.length > 0, 'expected at least one loaded skill');
  assert.ok(skills.some((skill) => skill.metadata.name === 'meeting-intelligence'));
  assert.ok(skills.some((skill) => skill.metadata.name === 'so-expert'));
});

test('SkillLoader does not load duplicate skill names', () => {
  const loader = new SkillLoader();
  const skills = loader.fetchSkills();
  const names = skills.map((skill) => skill.metadata.name);
  const uniqueNames = new Set(names);

  assert.equal(uniqueNames.size, names.length);
});
