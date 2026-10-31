# Direct-add category regression

The existing `showProductsOnTopLevel` layout preference still flattened group navigation, but the redesigned `quickAddProduct` no longer used it before opening the add-on editor. Product taps now resolve the originating visible layout group (including virtual groups, search and Quick list origins) and skip automatic customization when this preference is enabled. A customized copy already in the cart cannot override that preference. Existing cart-line merge rules and direct cart editing remain intact.

The layout checkbox helper now explains direct-add behavior and how staff can edit add-ons from the cart. No saved category settings or live orders were changed.

Validation: 389 unit tests passed. Tests execute the actual quick-add and cart-edit handlers for Sides/Seafood Sides fixtures, customized-copy isolation and normal category customization; navigation tests cover unrelated selected groups, virtual groups and normal Drinks behavior. Diff check passed. Full TypeScript check retains 13 pre-existing receipt/caller-ID errors. Native verification was unavailable: the visible simulator was an iPhone running another project (Aqua Air), so it was left unchanged.
