import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LoginPage } from './LoginPage';

describe('LoginPage', () => {
  it('submits staff credentials and reports an authentication error', async () => {
    const submit = vi.fn().mockResolvedValue({ ok: false, message: 'Incorrect email or password.' });
    render(<LoginPage onSubmit={submit} loading={false} />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'staff@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(submit).toHaveBeenCalledWith('staff@example.com', 'wrong');
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
  });
});
