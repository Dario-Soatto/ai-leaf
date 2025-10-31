'use client';

import { useRef } from 'react';

interface HeroVideoProps {
  src: string;
}

export default function HeroVideo({ src }: HeroVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleEnded = () => {
    const video = videoRef.current;
    if (video) {
      setTimeout(() => {
        video.currentTime = 0;
        video.play();
      }, 5000); // 5 second pause
    }
  };

  return (
    <div className="overflow-hidden">
      <video 
        ref={videoRef}
        autoPlay 
        muted 
        playsInline
        onEnded={handleEnded}
        className="w-full h-auto shadow-2xl border border-border"
        style={{
          transform: 'scale(1.015)',
          transformOrigin: 'center'
        }}
      >
        <source src={src} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>
  );
}