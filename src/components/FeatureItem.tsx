import HeroVideo from './HeroVideo';

interface FeatureItemProps {
  tag: string;
  description: string;
  videoUrl: string;
  reversed?: boolean;
}

export default function FeatureItem({ tag, description, videoUrl, reversed }: FeatureItemProps) {
  return (
    <div className={`flex flex-col ${reversed ? 'md:flex-row-reverse' : 'md:flex-row'} gap-8 md:gap-12 items-center`}>
      {/* Description */}
      <div className="flex-[0.8] space-y-4">
        <h3 className="text-2xl md:text-3xl font-semibold text-primary">{tag}</h3>
        <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">{description}</p>
      </div>
      
      {/* Video */}
      <div className="flex-[1.2] w-full">
        <div className="overflow-hidden shadow-xl border border-border">
          <HeroVideo src={videoUrl} />
        </div>
      </div>
    </div>
  );
}