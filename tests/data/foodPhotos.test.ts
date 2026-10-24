import { BUILT_IN_PHOTOS, photoFor } from '@/data/foodPhotos';
import { COMMON_FOODS } from '@/domain/commonFoods';

test('a pack’s own picture wins', () => {
  expect(photoFor({ imageUrl: 'https://images.openfoodfacts.org/x.jpg', presetId: 'banana' })).toBe(
    'https://images.openfoodfacts.org/x.jpg',
  );
});

test('a built-in food uses its ingredient picture', () => {
  expect(photoFor({ imageUrl: null, presetId: 'chicken-breast' })).toBe(
    'https://www.themealdb.com/images/ingredients/Chicken%20Breast-Small.png',
  );
});

test('no picture: none, for a letter tile', () => {
  expect(photoFor({ imageUrl: null, presetId: null })).toBeNull();
  expect(photoFor({ imageUrl: null, presetId: 'latte' })).toBeNull();
});

test('every built-in food has an entry', () => {
  expect(Object.keys(BUILT_IN_PHOTOS).sort()).toEqual(COMMON_FOODS.map((f) => f.id).sort());
});
