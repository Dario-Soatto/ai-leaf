import { createServerSupabaseClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';

const DEFAULT_LATEX = `\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{amsfonts}

\\begin{document}

\\title{Untitled Document}
\\author{Your Name}
\\date{\\today}
\\maketitle

\\section{Introduction}
Start writing here...

\\end{document}`;

export async function POST() {
  const supabase = await createServerSupabaseClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  // Create a new document
  const { data: document, error } = await supabase
    .from('documents')
    .insert({
      user_id: user.id,
      title: 'Untitled Document',
      current_latex: DEFAULT_LATEX,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating document:', error);
    redirect('/documents');
  }

  // Redirect to the editor for this new document
  redirect(`/editor/${document.id}`);
}
