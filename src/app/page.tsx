import { createServerSupabaseClient } from '@/lib/supabase-server';
import Image from 'next/image';
import Link from 'next/link';
import LogoutButton from '@/components/LogoutButton';
import { Button } from '@/components/ui/button';
import { LayoutDashboard } from 'lucide-react';
import HeroVideo from '@/components/HeroVideo';

export default async function Home() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-sm">
        <div className="container mx-auto max-w-5xl px-6 py-4">
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
      <div className="flex flex-col items-center justify-center flex-1 px-8 pt-16">
        <h1 className="text-8xl font-light mb-6 text-center font-[family-name:var(--font-playfair)]">
          LaTeX, made easy
        </h1>
        <p className="text-2xl text-muted-foreground font-light max-w-2xl text-center mb-12">
          Instantly generate, format, and fix beautiful documents
        </p>
        
        {/* Hero Video */}
        <div className="w-full max-w-5xl px-6">
          <HeroVideo src="https://pveeygclczayjwqdxven.supabase.co/storage/v1/object/public/public-assets/landing-hero-social.mp4" />
        </div>
        
        {/* CTA */}
        <Link 
          href={user ? "/documents" : "/login"} 
          className="group mt-8 text-lg relative inline-flex items-center gap-1 transition-all"
        >
          <span className="relative inline-flex items-center gap-1">
            Try it now
            <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
            <span className="absolute bottom-0 left-0 w-0 h-[1px] bg-primary transition-all duration-300 group-hover:w-full" />
          </span>
        </Link>
      </div>

      {/* Footer */}
      <footer className="border-t bg-card/50 mt-20">
        <div className="container mx-auto max-w-5xl px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} AI Leaf. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              
              <Link href="/login" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Login
              </Link>
              <Link href="/documents" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Documents
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}