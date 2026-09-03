/**
 * CULINA — Normalizer unit tests (PRD §26).
 * Fixtures mirror real provider payloads (captured during verification).
 * Core rule under test: unknown → null, never 0, never fabricated.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeMeal,
  normalizeDrink,
  normalizeFruit,
  normalizeBrewery,
  normalizeBeer,
  normalizeCoffee,
  normalizeProduct,
  normalizeIngredientEntry,
  parseInstructions,
  splitTags,
  cleanMachineTag,
  extractIngredients,
} from '../js/api/normalizer.js';

const MEAL_FIXTURE = {
  idMeal: '52772',
  strMeal: 'Teriyaki Chicken Casserole',
  strCategory: 'Chicken',
  strArea: 'Japanese',
  strCountry: 'Japan',
  strTags: 'Meat,Casserole',
  strMealThumb: 'https://www.themealdb.com/images/media/meals/wvpsxx1468256321.jpg',
  strInstructions: 'Preheat oven to 350° F.\r\nCombine the soy sauce and sugar.\nSTEP 3: Bake for 40 minutes.',
  strIngredient1: 'Chicken',
  strMeasure1: '2 breasts',
  strIngredient2: '',
  strMeasure2: ' ',
  strIngredient3: 'Soy Sauce',
  strMeasure3: '1/3 cup',
  strSource: 'https://example.com/recipe',
  strVideo: null,
};

test('normalizeMeal maps TheMealDB payload to the unified Recipe model', () => {
  const recipe = normalizeMeal(MEAL_FIXTURE);
  assert.equal(recipe.id, 'mealdb:52772');
  assert.equal(recipe.source, 'mealdb');
  assert.equal(recipe.title, 'Teriyaki Chicken Casserole');
  assert.equal(recipe.cuisine, 'Japanese');
  assert.equal(recipe.category, 'Chicken');
  assert.deepEqual(recipe.tags, ['Meat', 'Casserole']);
  assert.equal(recipe.imagePreview.endsWith('/preview'), true);
  assert.equal(recipe.image.endsWith('.jpg'), true);
  assert.equal(recipe.ingredients.length, 2);
  assert.deepEqual(recipe.ingredients[1], { name: 'Soy Sauce', measure: '1/3 cup' });
});

test('normalizeMeal never fabricates missing data', () => {
  const recipe = normalizeMeal(MEAL_FIXTURE);
  assert.equal(recipe.description, null);
  assert.equal(recipe.prepTime, null);
  assert.equal(recipe.servings, null);
  assert.equal(recipe.nutrition, null);
  assert.equal(recipe.youtube, null);
});

test('normalizeMeal falls back to strCountry when strArea is absent', () => {
  const recipe = normalizeMeal({ ...MEAL_FIXTURE, strArea: null });
  assert.equal(recipe.cuisine, 'Japan');
});

test('parseInstructions splits lines and strips STEP markers', () => {
  const steps = parseInstructions(MEAL_FIXTURE.strInstructions);
  assert.equal(steps.length, 3);
  assert.deepEqual(steps.map((s) => s.step), [1, 2, 3]);
  assert.equal(steps[2].text, 'Bake for 40 minutes.');
  assert.deepEqual(parseInstructions(''), []);
  assert.deepEqual(parseInstructions(null), []);
});

test('splitTags handles null, empty and whitespace entries', () => {
  assert.deepEqual(splitTags(null), []);
  assert.deepEqual(splitTags(''), []);
  assert.deepEqual(splitTags('Meat,, Casserole ,'), ['Meat', 'Casserole']);
});

test('extractIngredients skips null/blank ingredient slots', () => {
  const list = extractIngredients(MEAL_FIXTURE, 20);
  assert.equal(list.length, 2);
  assert.equal(list[0].name, 'Chicken');
});

const DRINK_FIXTURE = {
  idDrink: '11007',
  strDrink: 'Margarita',
  strCategory: 'Ordinary Drink',
  strIBA: 'Contemporary Classics',
  strAlcoholic: 'Alcoholic',
  strGlass: 'Cocktail glass',
  strInstructions: 'Rub the rim with lime and dip in salt.\nShake with ice.',
  strDrinkThumb: 'https://www.thecocktaildb.com/images/media/drink/wpxpvu1439905379.jpg',
  strIngredient1: 'Tequila',
  strMeasure1: '1 1/2 oz',
  strIngredient2: 'Salt',
  strMeasure2: '',
};

test('normalizeDrink maps TheCocktailDB payload correctly', () => {
  const drink = normalizeDrink(DRINK_FIXTURE);
  assert.equal(drink.id, 'cocktaildb:11007');
  assert.equal(drink.title, 'Margarita');
  assert.equal(drink.iba, 'Contemporary Classics');
  assert.equal(drink.alcoholic, true);
  assert.equal(drink.glass, 'Cocktail glass');
  assert.equal(drink.instructions.length, 2);
  assert.deepEqual(drink.ingredients[0], { name: 'Tequila', measure: '1 1/2 oz' });
});

test('normalizeDrink alcoholic flag is tri-state', () => {
  assert.equal(normalizeDrink({ ...DRINK_FIXTURE, strAlcoholic: 'Non alcoholic' }).alcoholic, false);
  assert.equal(normalizeDrink({ ...DRINK_FIXTURE, strAlcoholic: null }).alcoholic, null);
});

const FRUIT_FIXTURE = {
  id: 6,
  name: 'Apple',
  family: 'Rosaceae',
  genus: 'Malus',
  order: 'Rosales',
  nutritions: { calories: 52, fat: 0.2, sugar: 10.4, carbohydrates: 13.8, protein: 0.3 },
};

test('normalizeFruit maps nutrition with unknowns as null', () => {
  const fruit = normalizeFruit(FRUIT_FIXTURE);
  assert.equal(fruit.id, 'fruityvice:6');
  assert.equal(fruit.name, 'Apple');
  assert.equal(fruit.nutrition.calories, 52);
  assert.equal(fruit.nutrition.sugar, 10.4);
  // Fruityvice provides no fiber/sodium — must be null, never 0.
  assert.equal(fruit.nutrition.fiber, null);
  assert.equal(fruit.nutrition.sodium, null);
  assert.equal(fruit.image, null);
});

const BREWERY_FIXTURE = {
  id: 'madtree-brewing-cincinnati',
  name: 'MadTree Brewing',
  brewery_type: 'large',
  address_1: '5164 Kennedy Ave',
  city: 'Cincinnati',
  state_province: 'Ohio',
  postal_code: '45213',
  country: 'United States',
  phone: '5138368737',
  website_url: 'https://www.madtreebrewing.com',
  latitude: '39.155',
  longitude: '-84.427',
};

test('normalizeBrewery builds address, map URL and numeric coords', () => {
  const brewery = normalizeBrewery(BREWERY_FIXTURE);
  assert.equal(brewery.id, 'obd:madtree-brewing-cincinnati');
  assert.equal(brewery.state, 'Ohio');
  assert.ok(brewery.address.includes('Cincinnati, Ohio'));
  assert.equal(brewery.latitude, 39.155);
  assert.equal(brewery.longitude, -84.427);
  assert.ok(brewery.mapUrl.includes('mlat=39.155'));
});

test('normalizeBrewery without coordinates has no map URL', () => {
  const brewery = normalizeBrewery({ ...BREWERY_FIXTURE, latitude: null, longitude: null });
  assert.equal(brewery.latitude, null);
  assert.equal(brewery.mapUrl, null);
});

test('normalizeBeer handles object and string ratings; "no" image → null', () => {
  const objectRated = normalizeBeer({ id: 1, name: 'Tropicalia', price: '$8.00', rating: { average: 4.5, reviews: 100 } }, 'ale');
  assert.deepEqual(objectRated.rating, { average: 4.5, reviews: 100 });
  const stringRated = normalizeBeer({ id: 2, name: 'Old Rasputin', price: '$5.50', rating: '4.2' }, 'stout');
  assert.deepEqual(stringRated.rating, { average: 4.2, reviews: null });
  const noImage = normalizeBeer({ id: 3, name: 'Ghost Beer', image: 'no', rating: null }, 'ale');
  assert.equal(noImage.image, null);
  assert.equal(noImage.rating, null);
  assert.equal(noImage.abv, null, 'abv must stay null — source does not provide it');
});

test('normalizeCoffee maps guide fields', () => {
  const coffee = normalizeCoffee(
    { id: 1, title: 'Black Coffee', description: 'Base for many drinks.', ingredients: ['Coffee'], image: 'https://api.sampleapis.com/coffee/hot/1.png' },
    'hot',
  );
  assert.equal(coffee.id, 'sampleapis-coffee:hot:1');
  assert.equal(coffee.name, 'Black Coffee');
  assert.deepEqual(coffee.ingredients, ['Coffee']);
});

const PRODUCT_FIXTURE = {
  product_name: 'Nutella',
  brands: 'Ferrero',
  quantity: '350 g',
  image_url: 'https://images.openfoodfacts.org/images/products/3017620422003/front_en.4.400.jpg',
  categories: 'Snacks, Spreads',
  labels_tags: ['en:vegetarian', 'en:palm-oil'],
  nutriscore_grade: 'e',
  nova_group: '4',
  ingredients_text: 'Sugar, palm oil, hazelnuts',
  serving_size: '15 g',
  serving_quantity: '15',
  nutriments: {
    'energy-kcal_100g': 539,
    proteins_100g: 6.3,
    carbohydrates_100g: 57.5,
    fat_100g: 30.9,
    'sugars_100g': 56.3,
    'saturated-fat_100g': 10.6,
    'salt_100g': 0.107,
    'sodium_100g': 0.0425,
    // fiber intentionally absent → must normalize to null
  },
};

test('normalizeProduct maps OFF product with honest nulls', () => {
  const product = normalizeProduct(PRODUCT_FIXTURE, '3017620422003');
  assert.equal(product.id, 'off:3017620422003');
  assert.equal(product.brand, 'Ferrero');
  assert.equal(product.nutriscore, 'e');
  assert.equal(product.nova, 4);
  assert.equal(product.nutrition.calories, 539);
  assert.equal(product.nutrition.fiber, null, 'missing fiber must be null, never 0');
  assert.deepEqual(product.labels, ['Vegetarian', 'Palm Oil']);
  assert.ok(product.sourceUrl.includes('3017620422003'));
});

test('normalizeProduct falls back through name fields', () => {
  assert.equal(normalizeProduct({ generic_name: 'Oat drink' }, 'x').title, 'Oat drink');
  assert.equal(normalizeProduct({}, 'x').title, 'Unnamed product');
});

test('cleanMachineTag strips language prefix', () => {
  assert.equal(cleanMachineTag('en:organic'), 'Organic');
  assert.equal(cleanMachineTag(null), null);
});

test('normalizeIngredientEntry encodes ids and images', () => {
  const entry = normalizeIngredientEntry({ strIngredient: 'Palm Sugar', strDescription: 'Sweetener.', strType: null });
  assert.equal(entry.id, 'mealdb:Palm%20Sugar');
  assert.ok(entry.image.endsWith('/Palm%20Sugar.png'));
  assert.equal(normalizeIngredientEntry({ strIngredient: '' }), null);
});
