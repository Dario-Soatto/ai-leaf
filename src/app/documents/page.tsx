import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import Link from 'next/link';
import LogoutButton from '@/components/LogoutButton';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText } from 'lucide-react';

export default async function DocumentsPage() {
  const supabase = await createServerSupabaseClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  const { data: documents, error } = await supabase
    .from('documents')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching documents:', error);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b bg-white shadow-sm">
        <div className="container mx-auto max-w-5xl px-6 py-4">
          <div className="flex items-center justify-between h-12">
            <div className="flex flex-col justify-center h-full">
              <h1 className="text-xl font-bold tracking-tight leading-tight">
                My Documents
              </h1>
              {user.email && (
                <p className="text-xs text-muted-foreground leading-tight">
                  {user.email}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <form action="/api/documents/create" method="POST">
                <Button type="submit" size="default" className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Document
                </Button>
              </form>
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      {/* Documents List - add padding-top to account for fixed header */}
      <main className="container mx-auto max-w-5xl px-6 py-8 pt-24">
        {!documents || documents.length === 0 ? (
          <Card className="mx-auto max-w-md text-center">
            <CardHeader>
              <CardTitle>No documents yet</CardTitle>
              <CardDescription>
                Create your first LaTeX document to get started!
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="divide-y divide-border">
            {documents.map((doc) => (
              <Link 
                key={doc.id} 
                href={`/editor/${doc.id}`}
                className="flex items-center gap-4 py-3 hover:text-primary transition-colors group"
              >
                <span className="flex-1 font-medium truncate">
                  {doc.title}
                </span>
                <span className="text-sm text-muted-foreground flex-shrink-0">
                  {new Date(doc.updated_at).toLocaleDateString()}
                </span>
                <Badge variant="outline" className="flex-shrink-0">
                  LaTeX
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
