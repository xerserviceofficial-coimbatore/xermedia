'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { UsersRound } from 'lucide-react';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const linkError = searchParams.get('error');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(
    linkError === 'link_expired'
      ? 'This sign-in link has expired.'
      : linkError === 'link_invalid'
        ? 'This sign-in link is invalid.'
        : null,
  );
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await createClient().auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    window.location.href = inviteToken
      ? `/join/${encodeURIComponent(inviteToken)}`
      : '/dashboard';
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-black/10">
            {inviteToken ? (
              <UsersRound className="h-6 w-6 text-primary" />
            ) : (
              <Image
                src="/xermedia-logo.png"
                alt="XerMedia logo"
                width={40}
                height={40}
                className="h-10 w-10 object-contain"
                priority
              />
            )}
          </div>
          <CardTitle className="text-xl text-foreground">
            {inviteToken ? 'Accept XerMedia invite' : 'Welcome to XerMedia'}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {inviteToken
              ? 'Sign in to accept this team invitation.'
              : 'Sign in to the receive-only WhatsApp inbox.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {error ? (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary hover:text-primary/80"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            <Button type="submit" disabled={loading} className="mt-2 h-10 w-full">
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          {inviteToken ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              New team member?{' '}
              <Link
                href={`/signup?invite=${encodeURIComponent(inviteToken)}`}
                className="text-primary hover:text-primary/80"
              >
                Create invited account
              </Link>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
