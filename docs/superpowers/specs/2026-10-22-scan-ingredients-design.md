# RepFuel: scan ingredients into a meal

Status: agreed with the owner in conversation, 2026-10-22 ("Sounds good. Proceed to build this.") · small change

## Why

The owner cooks their own meals (tuna pasta often, sweet chilli salmon and couscous sometimes) and scans the packets
to get the real macros. Building a meal by scanning each ingredient and choosing how much went in ("2 servings",
"150 g of a 300 g bag") would be a game changer. Their meals are often the same but sometimes something is added or
changed, so a saved meal's ingredients must be easy to add, change and remove, and its portions changeable.

This is part A. Part B (a Gousto-like recipe browser with pictures, method and times, choosing which meals to cook)
comes later; the owner's own scanned meals will sit in it.

## What changes

1. **Scan inside Build a meal and Edit recipe.** Next to Add ingredient, a **Scan** button opens the camera. A found
   product (calories and protein known) is saved like any scanned food and comes straight back to the meal with its
   amount sheet open. A product missing calories or protein, or not found, goes through the usual check-the-label
   screen first, then comes back to the meal.
2. **Choosing how much, the same way as logging a food.** The ingredient amount sheet uses the product screen's
   controls: the food's sizes (a serving, a cup, a can…, and now **1 pack** when the pack size is known), the
   ¼…2 shortcuts, How many, and the amount in g or ml. With a known pack it says e.g. "150 g of a 300 g pack".
3. **Pack size.** Scanned and searched products remember their pack size from Open Food Facts (e.g. 300 g). Logging
   from the product screen offers 1 pack too (half a bag of crisps). Foods saved before this get it the next time
   they're scanned. Unknown stays unknown (null).
4. **Built-in everyday foods in the ingredient picker** (loose peppers, an onion, a banana), as well as saved foods and
   meals, since loose vegetables have no barcode.
5. **Edit an ingredient:** tap it to change the amount (Update), or remove it. Works in Build a meal and saved meals.
6. **Portions in Build a meal:** "Makes N portions" (tuna pasta for 3); logging adds 1 portion; Save to My meals keeps
   the meal with its portions so the rest log in one tap later.
7. **Saved meals:** hold a meal to edit it (tap still logs it).

## Decided

- Approach: reuse what exists (Build a meal, the scan screen, the product screen's amount controls) rather than a new
  meal builder. The scan screen gets an "ingredient" mode that hands the food back to the meal.
- No shop search in the ingredient picker yet (scan covers packets; built-in foods cover loose items).

## Left to the builder

How the scan hands the food back, the migration, component boundaries, tests.
