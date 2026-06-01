'use client';

import type { EmbedPreset } from '@pinguin/shared';

interface EmbedPreviewProps {
  embed: EmbedPreset;
}

export default function EmbedPreview({ embed }: EmbedPreviewProps) {
  const formatTimestamp = () => {
    return new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      className="rounded-[var(--radius-sm)] p-4 bg-[#2b2d31] border-l-4"
      style={{ borderColor: embed.color }}
    >
      {/* Author */}
      {embed.authorName && (
        <div className="flex items-center gap-2 mb-3">
          {embed.authorIcon && (
            <img
              src={embed.authorIcon}
              alt=""
              className="w-6 h-6 rounded-full"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {embed.authorName}
          </span>
        </div>
      )}

      {/* Title */}
      {embed.title && (
        <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">
          {embed.title}
        </h3>
      )}

      {/* Description */}
      {embed.description && (
        <p className="text-sm text-[#dcddde] mb-3 whitespace-pre-wrap">
          {embed.description}
        </p>
      )}

      {/* Fields */}
      {embed.fields.length > 0 && (
        <div className="mb-3">
          <div className="flex flex-wrap gap-y-2">
            {embed.fields.map((field, index) => (
              <div
                key={index}
                className={field.inline ? 'w-1/2 min-w-[150px] pr-2' : 'w-full'}
              >
                <div className="bg-[#2b2d31] rounded-[var(--radius-sm)] p-2">
                  <span className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                    {field.name}
                  </span>
                  <p className="text-xs text-[#dcddde] whitespace-pre-wrap">
                    {field.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Image */}
      {embed.image && (
        <div className="mb-3">
          <img
            src={embed.image}
            alt=""
            className="max-w-full rounded-[var(--radius-sm)]"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Thumbnail */}
      {embed.thumbnail && (
        <div className="mb-3">
          <img
            src={embed.thumbnail}
            alt=""
            className="w-20 h-20 rounded-[var(--radius-sm)] object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Footer */}
      {(embed.footer || embed.timestamp) && (
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-[#3f4147]">
          {embed.footer && (
            <span className="text-xs text-[#dcddde]">{embed.footer}</span>
          )}
          {embed.timestamp && (
            <span className="text-xs text-[#dcddde] ml-auto">
              {formatTimestamp()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
