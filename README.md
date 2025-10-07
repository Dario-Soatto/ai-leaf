# AI LaTeX Editor

A modern, AI-powered LaTeX editor built with Next.js. Create beautiful documents with real-time PDF preview and intelligent AI assistance.

## Features

- 🤖 **AI-Powered Editing**: Two editing modes - Complete Rewrite and Morph Diff
- 📄 **Real-time PDF Preview**: See your changes instantly
- 💾 **Auto-save**: Your work is automatically saved
- 📚 **Version History**: Track and restore previous versions
- ✨ **Syntax Highlighting**: Monaco editor with LaTeX support
- 🎨 **Beautiful UI**: Built with shadcn/ui components
- 🌙 **Dark Mode**: Automatic theme support
- ⌨️ **Keyboard Shortcuts**: Cmd/Ctrl+Enter to compile

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **UI**: shadcn/ui + Tailwind CSS
- **Editor**: Monaco Editor
- **AI**: Anthropic Claude (via AI SDK)
- **Database**: Supabase
- **Authentication**: Supabase Auth

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm/yarn/pnpm
- Supabase account
- Anthropic API key

### Installation

1. Clone the repository
```bash
git clone <your-repo-url>
cd ai-leaf-3
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables

Create a `.env.local` file:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

4. Run the development server
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Usage

### Demo Mode
Try the editor without signing up at `/demo`

### Authenticated Features
- Create and manage multiple documents
- Version history and restore
- Auto-save functionality

### Keyboard Shortcuts
- `Cmd/Ctrl + Enter`: Compile LaTeX to PDF

## Project Structure
