import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import LaTeXEditor from '@/components/LaTeXEditor';

export default async function EditorPage({ 
  params 
}: { 
  params: Promise<{ documentId: string }> 
}) {
  const { documentId } = await params;
  const supabase = await createServerSupabaseClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  // Fetch the document
  const { data: document, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .single();

  if (error || !document) {
    console.error('Error fetching document:', error);
    redirect('/documents');
  }

  return <LaTeXEditor document={document} />;
}
