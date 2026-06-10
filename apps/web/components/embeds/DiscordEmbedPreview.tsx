'use client';

import type { EmbedData } from '@pinguin/db';

const VARIABLE_EXAMPLES: Record<string, string> = {
  '{{user}}': 'Jean Dupont',
  '{{server}}': 'Mon Serveur',
  '{{date}}': '10/06/2026',
  '{{memberCount}}': '1 234',
  '{{channel}}': '#général',
};

function replaceVariables(text: string): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match) => VARIABLE_EXAMPLES[match] ?? match);
}

interface DiscordEmbedPreviewProps {
  data: EmbedData;
}

export default function DiscordEmbedPreview({ data }: DiscordEmbedPreviewProps) {
  const formatTimestamp = () => {
    return new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const hasThumbnail = !!data.thumbnail;

  return (
    <div className="rounded-md overflow-hidden" style={{ backgroundColor: '#2f3136' }}>
      <div className="flex">
        <div
          className="w-1 flex-shrink-0 rounded-l-md"
          style={{ backgroundColor: data.color || '#5865F2' }}
        />
        <div className="flex-1 p-3" style={{ backgroundColor: '#36393f' }}>
          {/* Header with optional thumbnail */}
          <div className="flex gap-4">
            <div className="flex-1 min-w-0">
              {data.authorName && (
                <div className="flex items-center gap-2 mb-2">
                  {data.authorIcon && (
                    <img
                      src={data.authorIcon}
                      alt=""
                      className="w-5 h-5 rounded-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  <span className="text-sm font-medium" style={{ color: '#dcddde' }}>
                    {replaceVariables(data.authorName)}
                  </span>
                </div>
              )}

              {data.title && (
                <h3 className="text-base font-semibold mb-1" style={{ color: '#f2f3f5' }}>
                  {replaceVariables(data.title)}
                </h3>
              )}

              {data.description && (
                <p className="text-sm whitespace-pre-wrap mb-3" style={{ color: '#dcddde' }}>
                  {replaceVariables(data.description)}
                </p>
              )}
            </div>

            {hasThumbnail && (
              <img
                src={data.thumbnail!}
                alt=""
                className="w-16 h-16 rounded-md object-cover flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
          </div>

          {/* Fields */}
          {data.fields.length > 0 && (
            <div className="grid grid-cols-3 gap-x-2 gap-y-1 mb-3">
              {data.fields.map((field, i) => (
                <div key={i} className={field.inline ? 'col-span-1' : 'col-span-3'}>
                  <span className="text-xs font-semibold block mb-0.5" style={{ color: '#f2f3f5' }}>
                    {replaceVariables(field.name)}
                  </span>
                  <p className="text-xs whitespace-pre-wrap" style={{ color: '#dcddde' }}>
                    {replaceVariables(field.value)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Image */}
          {data.image && (
            <div className="mb-3">
              <img
                src={data.image}
                alt=""
                className="max-w-full rounded-md"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}

          {/* Footer + Timestamp */}
          {(data.footer || data.timestamp) && (
            <div className="flex items-center gap-2 mt-1 pt-2 border-t" style={{ borderColor: '#3f4147' }}>
              {data.footer && (
                <span className="text-xs" style={{ color: '#dcddde' }}>
                  {replaceVariables(data.footer)}
                </span>
              )}
              {data.timestamp && (
                <span className="text-xs ml-auto" style={{ color: '#dcddde' }}>
                  {formatTimestamp()}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
