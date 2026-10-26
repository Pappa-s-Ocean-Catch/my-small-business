import { ChoiceTabs } from './ChoiceTabs';

export type CatalogueTab = 'products' | 'categories' | 'addons';

export function CatalogueTabs({ value, onValueChange, compact }: {
  value: CatalogueTab;
  onValueChange: (value: CatalogueTab) => void;
  compact: boolean;
}) {
  return <ChoiceTabs
    value={value}
    onValueChange={(next) => onValueChange(next as CatalogueTab)}
    style={{ marginHorizontal: compact ? 12 : 16, paddingTop: 20 }}
    buttons={[
      { value: 'products', label: 'Products' },
      { value: 'categories', label: 'Categories' },
      { value: 'addons', label: 'Add-on groups' },
    ]}
  />;
}
