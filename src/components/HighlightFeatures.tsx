import { Monitor, GitBranch, Image } from 'lucide-react';

const highlights = [
  {
    icon: Monitor,
    title: "Real-Time Preview",
    description: "View, annotate, and export your LaTeX documents as PDFs with ease"
  },
  {
    icon: GitBranch,
    title: "Version Control",
    description: "Save a new snapshot every time you click 'Compile'"
  },
  {
    icon: Image,
    title: "Image Handling",
    description: "Drag and drop images directly into your editor with automatic LaTeX integration"
  }
];

export default function HighlightFeatures() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
      {highlights.map((feature) => {
        const Icon = feature.icon;
        return (
          <div key={feature.title} className="text-center space-y-4">
            <div className="flex justify-center">
              <Icon className="h-12 w-12 text-primary" strokeWidth={1.5} />
            </div>
            <h3 className="text-sm uppercase tracking-wide font-medium">
              {feature.title}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {feature.description}
            </p>
          </div>
        );
      })}
    </div>
  );
}