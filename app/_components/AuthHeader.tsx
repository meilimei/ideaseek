'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseBrowserClient';

export default function AuthHeader() {
  const [user, setUser] = useState<unknown | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(({ data }) => {
        setUser(data.user ?? null);
      })
      .catch((err) => {
        console.error('Failed to load user', err);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.reload();
  };

  const handleGithubSignIn = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });
  };

  const handleMagicLink = async () => {
    const supabase = createClient();
    const email = window.prompt('Enter your email for magic link sign-in:');
    if (!email) return;
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      alert(`Failed to send magic link: ${error.message}`);
      return;
    }
    alert('Check your email for the magic link.');
  };

  return (
    <div className="w-full flex justify-end p-3 text-sm text-gray-700 gap-2">
      {loading ? (
        <span>Loading...</span>
      ) : user ? (
        <div className="flex items-center gap-2">
          <span className="text-gray-800">
            {user.user_metadata?.full_name || user.email || 'Signed in'}
          </span>
          {process.env.NODE_ENV !== 'production' && user.id && (
            <span className="rounded-full border px-2 py-0.5 text-[11px] text-gray-600 bg-gray-50">
              id: {user.id}
            </span>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className="px-3 py-1 rounded-md border text-xs hover:bg-gray-100"
          >
            Sign out
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleGithubSignIn}
            className="px-3 py-1 rounded-md border text-xs hover:bg-gray-100"
          >
            Sign in with GitHub
          </button>
          <button
            type="button"
            onClick={handleMagicLink}
            className="px-3 py-1 rounded-md border text-xs hover:bg-gray-100"
          >
            Sign in with magic link
          </button>
        </div>
      )}
    </div>
  );
}
