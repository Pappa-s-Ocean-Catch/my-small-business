# Take Order v3 — immediate add, optional update, compact search

This revision supersedes the earlier delayed-add design.

1. Choose a group.
2. Tap a product: **it is immediately added to the cart**.
3. If add-ons exist, open **Update item** for that already-added line. Choices update it immediately. **Continue** returns to products in the same group.

If no add-ons exist, stay on products/Quick List with the item already added. Back from add-ons keeps the item. Removal remains explicit. Editing an existing cart line changes that line, never inserts a duplicate. Preserve the current app’s merge/default/required-choice rules.

The default group/product/add-on screens have **no search bar**. A magnifier in the header opens a search overlay/sheet only when needed. Group and product results retain context; closing search returns to the same browsing level. Search results use the same immediate-add behaviour.

Review source 010 (groups), 118 (products), 018 (Update item), 011 (search open), and P01 (full cart). Start at 010, choose Sides, tap Potato Cake, and inspect the cart before selecting an add-on. The local preview demonstrates the cart changing without any second Add action.

The existing Live / On the way / Completed tabs and conditional Pre-orders tab are preserved from v2.
