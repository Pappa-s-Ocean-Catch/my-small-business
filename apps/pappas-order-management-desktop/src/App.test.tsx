import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('desktop POS entry point', () => {
  it('renders the staff sign-in entry point', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Staff sign in' })).toBeVisible();
  });
});
