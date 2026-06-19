import { Suspense } from 'react';
import GalleryPageContent from './GalleryPageContent';

function GalleryFallback() {
  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="h-8 w-48 bg-gray-100 rounded animate-pulse mb-4" />
      <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
    </div>
  );
}

export default function GalleryPage() {
  return (
    <Suspense fallback={<GalleryFallback />}>
      <GalleryPageContent />
    </Suspense>
  );
}
