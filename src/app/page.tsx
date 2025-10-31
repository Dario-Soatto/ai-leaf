import { createServerSupabaseClient } from '@/lib/supabase-server';
import Image from 'next/image';
import Link from 'next/link';
import LogoutButton from '@/components/LogoutButton';
import { Button } from '@/components/ui/button';
import { LayoutDashboard } from 'lucide-react';

export default async function Home() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-sm">
        <div className="container mx-auto max-w-4xl px-6 py-4">
          <div className="flex items-center justify-between">
            <Image 
              src="/AILeaf.png" 
              alt="AI Leaf" 
              width={160} 
              height={48}
              className="h-12 w-auto"
              priority
            />
            <div className="flex items-center gap-2">
              <Button asChild className="gap-2">
                <Link href={user ? "/documents" : "/login"}>
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
              {user ? (
                <LogoutButton />
              ) : (
                <Button asChild variant="outline">
                  <Link href="/login">Login</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero section */}
      <div className="flex flex-col items-center justify-center flex-1 px-8">
        <h1 className="text-8xl font-light mb-6 text-center font-[family-name:var(--font-playfair)]">
          LaTeX, made easy
        </h1>
        <p className="text-2xl text-muted-foreground font-light max-w-2xl text-center mb-12">
          Instantly generate, format, and fix beautiful documents
        </p>
        
        {/* Hero Image */}
        <div className="w-full max-w-5xl">
          <img 
            src="/hero-image.png" 
            alt="LaTeX Editor Preview" 
            className="w-full h-auto rounded-lg shadow-2xl border border-border"
          />
        </div>
      </div>
    </div>
  );
}