'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    router.push('/dashboard');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xl mb-4">
            P
          </div>
          <h1 className="text-xl font-bold text-foreground">PixEcom</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your seller portal</p>
        </div>

        {/* Form */}
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seller@pixecom.com"
                  defaultValue="demo@pixecom.com"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  defaultValue="demo1234"
                />
              </div>

              <Button type="submit" variant="primary" size="lg" className="w-full mt-2">
                Sign In
              </Button>
            </form>

            <div className="mt-4 text-center">
              <p className="text-xs text-muted-foreground">
                Preview mode &mdash; click Sign In to enter
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
