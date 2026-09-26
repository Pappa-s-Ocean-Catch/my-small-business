import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { buildCatalogSnapshot } from '@my-small-business/pos-domain';
import { PosWorkspace } from './PosWorkspace';

describe('PosWorkspace', () => {
  it('shows an explicit empty catalogue state', () => {
    const snapshot = { ...buildCatalogSnapshot({ categories: [], products: [] }), customizations: new Map() } as any;
    render(<PosWorkspace snapshot={snapshot} onRefresh={() => {}} refreshing={false} />);
    expect(screen.getByText('No active products are available.')).toBeVisible();
  });
});
