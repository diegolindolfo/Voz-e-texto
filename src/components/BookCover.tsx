import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';

interface BookCoverProps {
  src: string;
  title: string;
  author: string;
  className?: string;
}

export function BookCover({ src, title, author, className = '' }: BookCoverProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed || !src) {
    return (
      <div
        className={`relative aspect-[3/4] overflow-hidden rounded-xl bg-gradient-to-br from-[#ECEEEB] to-[#DDE3EB] dark:from-[#1B2028] dark:to-[#141820] border border-neutral-200/80 dark:border-neutral-800 flex flex-col justify-between p-2 ${className}`}
        aria-label={`Capa de ${title}`}
      >
        <BookOpen className="w-3.5 h-3.5 text-[#1E3A5F] dark:text-[#7FA6D6] shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-editorial text-[10px] font-semibold leading-tight text-[#14171F] dark:text-[#EAECEF] line-clamp-2 break-words">
            {title}
          </p>
          <p className="text-[9px] text-[#5A6474] dark:text-[#9AA4B2] mt-0.5 truncate">
            {author}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative aspect-[3/4] overflow-hidden rounded-xl bg-[#EAEAE6] dark:bg-[#181B21] border border-neutral-200/80 dark:border-neutral-800 ${className}`}
    >
      <img
        src={src}
        alt={`Ilustração editorial de capa para ${title}, de ${author}`}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover"
      />
    </div>
  );
}
