import * as React from 'react';
import { cn } from '@/lib/utils';
import { getInitials } from '@/lib/helpers';

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-7 w-7 text-2xs',
  md: 'h-9 w-9 text-xs',
  lg: 'h-11 w-11 text-sm',
};

function Avatar({ src, alt, fallback, size = 'md', className, ...props }: AvatarProps) {
  const [imgError, setImgError] = React.useState(false);
  const initials = fallback ? getInitials(fallback) : alt ? getInitials(alt) : '?';

  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-full overflow-hidden',
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {src && !imgError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt || ''}
          className="aspect-square h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-full border border-border bg-accent text-accent-foreground font-medium">
          {initials}
        </div>
      )}
    </div>
  );
}

export { Avatar };
