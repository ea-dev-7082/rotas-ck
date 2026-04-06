import React, { useEffect, useRef } from "react";

export default function InfiniteScrollSentinel({ onLoadMore, hasMore, isLoading }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!hasMore || isLoading || !ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: "120px" }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [hasMore, isLoading, onLoadMore]);

  return <div ref={ref} className="h-8 w-full" />;
}