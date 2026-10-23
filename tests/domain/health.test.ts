import { additiveCode, healthVerdict, NOVA_LABELS } from '@/domain/health';

test('the verdict follows the Nutri-Score, pulled down by ultra-processing', () => {
  expect(healthVerdict({ nutriscore: 'a', nova: 1, additives: [] })).toMatchObject({ verdict: 'good' });
  expect(healthVerdict({ nutriscore: 'b', nova: 3, additives: [] })).toMatchObject({ verdict: 'good' });
  expect(healthVerdict({ nutriscore: 'a', nova: 4, additives: ['E322'] })).toMatchObject({ verdict: 'okay' });
  expect(healthVerdict({ nutriscore: 'c', nova: 3, additives: [] })).toMatchObject({ verdict: 'okay' });
  expect(healthVerdict({ nutriscore: 'd', nova: 4, additives: [] })).toMatchObject({ verdict: 'poor' });
  expect(healthVerdict({ nutriscore: 'e', nova: null, additives: [] })).toMatchObject({ verdict: 'poor' });
});

test('every verdict says why, in plain words', () => {
  expect(healthVerdict({ nutriscore: 'a', nova: 4, additives: ['E322', 'E476'] })!.reasons).toEqual([
    'Nutri-Score A: a good nutritional balance',
    'Ultra-processed (NOVA 4)',
    '2 additives',
  ]);
});

test('without a Nutri-Score there is no verdict, only what is known', () => {
  expect(healthVerdict({ nutriscore: null, nova: 4, additives: [] })).toBeNull();
});

test('additive tags read as E-numbers', () => {
  expect(additiveCode('en:e322i')).toBe('E322i');
  expect(additiveCode('en:e150d')).toBe('E150d');
  expect(additiveCode('fr:something')).toBeNull();
  expect(NOVA_LABELS[4]).toBe('Ultra-processed');
});
