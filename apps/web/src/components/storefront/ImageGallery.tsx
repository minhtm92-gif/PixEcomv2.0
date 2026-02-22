'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageGalleryProps {
  images: string[];
  thumbnails: string[];
  name: string;
}

export function ImageGallery({ images, thumbnails, name }: ImageGalleryProps) {
  const [active, setActive] = useState(0);

  function prev() {
    setActive(i => (i > 0 ? i - 1 : images.length - 1));
  }

  function next() {
    setActive(i => (i < images.length - 1 ? i + 1 : 0));
  }

  return (
    <div className="flex flex-col gap-3 select-none">
      {/* Main image */}
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 group">
        <img
          key={images[active]}
          src={images[active]}
          alt={`${name} — photo ${active + 1}`}
          className="w-full h-full object-cover transition-opacity duration-300"
          onError={e => {
            (e.target as HTMLImageElement).src = `https://picsum.photos/seed/fallback${active}/800/800`;
          }}
        />

        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft size={18} className="text-gray-700" />
            </button>
            <button
              onClick={next}
              aria-label="Next image"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight size={18} className="text-gray-700" />
            </button>
          </>
        )}

        {/* Dot indicators */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                aria-label={`Go to photo ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === active ? 'w-4 bg-purple-600' : 'w-1.5 bg-white/70'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {thumbnails.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {thumbnails.map((thumb, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              aria-label={`View photo ${i + 1}`}
              className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                i === active
                  ? 'border-purple-500 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <img
                src={thumb}
                alt={`Thumbnail ${i + 1}`}
                className="w-full h-full object-cover"
                onError={e => {
                  (e.target as HTMLImageElement).src = `https://picsum.photos/seed/thumb${i}/200/200`;
                }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
