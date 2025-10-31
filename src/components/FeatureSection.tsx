'use client';

import { useState } from 'react';
import HeroVideo from './HeroVideo';

const features = [
    {
    id: 1,
      tag: "One Click Error Fixing",
      description: "No more grappling with compilation errors. Just click 'Fix In Chat'",
      videoUrl: "https://pveeygclczayjwqdxven.supabase.co/storage/v1/object/public/public-assets/edits-social.mp4"
    },
    {
        id: 2,
      tag: "Autonomous Formatting",
      description: "Automatically format data and generate visualizations from raw numbers",
      videoUrl: "https://pveeygclczayjwqdxven.supabase.co/storage/v1/object/public/public-assets/format-social.mp4"
    },
    {
        id: 3,
      tag: "Templates On Demand",
      description: "Instantly generate sophisticated LaTeX templates for your work",
      videoUrl: "https://pveeygclczayjwqdxven.supabase.co/storage/v1/object/public/public-assets/templates-social.mp4"
    },
    {
        id: 4,
      tag: "Instant Citations",
      description: "Let AI generate citations and place them in your work for you",
      videoUrl: "https://pveeygclczayjwqdxven.supabase.co/storage/v1/object/public/public-assets/citations-social.mp4"
    },
  ];

export default function FeatureSection() {
  const [selectedFeature, setSelectedFeature] = useState(features[0]);

  return (
    <div className="flex flex-col md:flex-row gap-8 items-start">
      {/* Left Side: Features List + Description */}
      <div className="flex-[0.7] space-y-6">
        {/* Feature List with Lines */}
        <div className="space-y-3">
          {features.map((feature) => (
            <button
              key={feature.id}
              onClick={() => setSelectedFeature(feature)}
              className={`w-full text-left group`}
            >
              <div className={`text-sm uppercase tracking-wide transition-colors pb-3 border-b ${
                selectedFeature.id === feature.id
                  ? 'text-primary border-primary'
                  : 'text-muted-foreground border-border'
              }`}>
                {feature.tag}
              </div>
            </button>
          ))}
        </div>

        {/* Description Text */}
        <div className="pt-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {selectedFeature.description}
          </p>
        </div>
      </div>

      {/* Right Side: Video */}
      <div className="flex-[1.3] w-full">
        <div className="overflow-hidden shadow-xl border border-border">
          <HeroVideo key={selectedFeature.id} src={selectedFeature.videoUrl} />
        </div>
      </div>
    </div>
  );
}