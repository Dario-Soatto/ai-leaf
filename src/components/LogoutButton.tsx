'use client';

import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export default function LogoutButton() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <Button
      onClick={handleLogout}
      disabled={isLoading}
      variant="ghost"
      size="default"
      className="gap-2"
    >
      <LogOut className="h-4 w-4" />
      {isLoading ? 'Logging out...' : 'Logout'}
    </Button>
  );
}