import { CLASS_EFFORT, durationLabel, effortLabel } from '@/domain/classes';

test('every effort level from 1 to 10 has a label and a description', () => {
  for (let e = 1; e <= 10; e++) {
    expect(CLASS_EFFORT[e].label).toBeTruthy();
    expect(CLASS_EFFORT[e].description).toBeTruthy();
  }
  expect(CLASS_EFFORT[9]).toEqual({ label: 'Very, very hard', description: 'Could barely speak' });
  expect(CLASS_EFFORT[1].label).toBe('Very easy');
  expect(CLASS_EFFORT[10]).toEqual({ label: 'Maximal', description: 'Nothing left' });
  expect(effortLabel(5)).toBe('Hard');
});

test('durations read naturally', () => {
  expect(durationLabel(60)).toBe('60 min');
  expect(durationLabel(45)).toBe('45 min');
  expect(durationLabel(90)).toBe('1 h 30 min');
  expect(durationLabel(120)).toBe('2 h');
});
