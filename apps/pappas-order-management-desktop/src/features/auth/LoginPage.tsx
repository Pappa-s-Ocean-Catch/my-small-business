import { FormEvent, useState } from 'react';

export type LoginResult = { ok: true } | { ok: false; message: string };

export function LoginPage({ onSubmit, loading }: { onSubmit: (email: string, password: string) => Promise<LoginResult>; loading: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const result = await onSubmit(email.trim(), password);
    if (!result.ok) setError(result.message);
  };

  return <main className="login-shell"><form className="login-card" onSubmit={submit}>
    <p className="eyebrow">PAPPAS POS</p><h1>Staff sign in</h1><p className="muted">Use your existing POS staff account.</p>
    <label>Email<input aria-label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
    <label>Password<input aria-label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" /></label>
    {error && <p role="alert" className="error">{error}</p>}
    <button type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
  </form></main>;
}
