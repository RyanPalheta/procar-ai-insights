import { useRef, useState, useEffect } from 'react';
import { GlobalSpotlight } from './global-spotlight';
import { cn } from '@/lib/utils';

const MOBILE_BREAKPOINT = 768;

interface MagicBentoGridProps {
  children: React.ReactNode;
  className?: string;
  enableSpotlight?: boolean;
  spotlightRadius?: number;
  glowColor?: string;
  disableAnimations?: boolean;
}

export function MagicBentoGrid({
  children,
  className,
  enableSpotlight = true,
  spotlightRadius = 300,
  glowColor = '132, 0, 255',
  disableAnimations = false,
}: MagicBentoGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const shouldDisableAnimations = disableAnimations || isMobile;

  return (
    <div ref={gridRef} className={cn('magic-bento-grid relative', className)}>
      {enableSpotlight && !shouldDisableAnimations && (
        <GlobalSpotlight
          containerRef={gridRef}
          enabled={enableSpotlight}
          spotlightRadius={spotlightRadius}
          glowColor={glowColor}
          disableAnimations={shouldDisableAnimations}
        />
      )}
      {children}
    </div>
  );
}
