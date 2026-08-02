# Marketplace “No …” Option Matching Design

## Goal

Import marketplace options such as `No Salt` as an existing POS add-on when
that add-on is available, while preserving the current ingredient-removal
behaviour for requests such as `No Tomato`.

## Current behaviour

The marketplace importer normalizes option names before comparisons, removing
leading/trailing whitespace and collapsing punctuation and whitespace into a
single space. Therefore whitespace is not the cause of `No Salt` failing.

Before looking for add-ons, the importer treats every option beginning with
`No`, `Without`, `Remove`, or `Minus` as an ingredient removal. `No Salt` is
therefore converted to `salt`; a POS add-on named `No Salt` is never checked.

## Approved design

For each marketplace option, the importer will:

1. Resolve an exact active add-on mapping for the complete normalized option
   name, when one exists.
2. Otherwise, look for an exact normalized POS add-on with the complete option
   name. This step makes whitespace variants such as `  No   Salt ` equivalent
   to `No Salt`.
3. If neither exact add-on match is available, process the option with the
   existing removal logic. This retains `No Tomato` → remove `Tomato`.
4. If no removal applies, use the existing fuzzy add-on matching and unmatched
   option recording path.

Mappings remain authoritative: an add-on mapping for `No Salt` wins over a
same-named automatic candidate. Ingredient mappings continue to be applied
only on the removal path.

## Validation

Add regression coverage in the marketplace POS order service tests:

- A whitespace-variant `No Salt` imports the POS `No Salt` add-on rather than
  being reported as an unmatched ingredient.
- `No Tomato` continues to populate `removed_ingredients` when there is no
  `No Tomato` POS add-on.
- An explicit `No Salt` add-on mapping is honoured before removal handling.

No database migration or UI change is required.
