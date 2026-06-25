import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useBranding } from '@/hooks/useBranding';

interface BrandLogoProps {
  className?: string;
  imgClassName?: string;
  alt?: string;
  fallbackClassName?: string;
}

export function BrandLogo({
  className,
  imgClassName,
  alt,
  fallbackClassName,
}: BrandLogoProps) {
  const { companyName, companyShortName, customLogoSrc, fallbackLogoSrc } = useBranding();
  const [src, setSrc] = useState(customLogoSrc || fallbackLogoSrc);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    setSrc(customLogoSrc || fallbackLogoSrc);
    setShowFallback(false);
  }, [customLogoSrc, fallbackLogoSrc]);

  return (
    <div className={cn('flex items-center justify-center overflow-hidden', className)}>
      {!showFallback ? (
        <img
          src={src}
          alt={alt || companyName}
          className={cn('h-full w-full object-contain', imgClassName)}
          onError={() => {
            if (src !== fallbackLogoSrc) {
              setSrc(fallbackLogoSrc);
              return;
            }
            setShowFallback(true);
          }}
        />
      ) : (
        <span
          className={cn(
            'flex h-full w-full items-center justify-center rounded-[inherit] bg-primary/10 text-xs font-bold uppercase text-primary',
            fallbackClassName,
          )}
        >
          {companyShortName}
        </span>
      )}
    </div>
  );
}
