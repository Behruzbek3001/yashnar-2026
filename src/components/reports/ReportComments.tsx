import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { apiRequest, formatTashkentDateTime } from '../../lib/api';
import { Button, Textarea, useToast } from '../ui/Primitives';

interface Comment {
  id: number;
  role: string;
  body: string;
  author: string;
  createdAt: string;
}

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', driver: 'Haydovchi', citizen: 'Fuqaro' };

/** Comment thread on a report (hisobot), shared by admin, driver and citizen views. */
export const ReportComments: React.FC<{ reportId: number }> = ({ reportId }) => {
  const queryClient = useQueryClient();
  const { toastError } = useToast();
  const [text, setText] = useState('');
  const key = [`report-comments-${reportId}`];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => apiRequest<{ comments: Comment[] }>(`/api/reports/${reportId}/comments`),
  });
  const add = useMutation({
    mutationFn: () => apiRequest(`/api/reports/${reportId}/comments`, { method: 'POST', body: JSON.stringify({ body: text }) }),
    onSuccess: () => {
      setText('');
      queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (err) => toastError(err instanceof Error ? err.message : 'Izoh yuborilmadi.'),
  });

  return (
    <div className="space-y-[8px]">
      <div className="flex items-center gap-[6px] text-[13px] font-semibold text-[#334155] dark:text-[#CBD5E1]">
        <MessageSquare className="w-4 h-4" aria-hidden="true" /> Izohlar
      </div>
      {isLoading ? (
        <div className="text-[13px] text-[#64748B]">Yuklanmoqda...</div>
      ) : !data?.comments.length ? (
        <div className="text-[13px] text-[#64748B] dark:text-[#A7B8AE]">Hozircha izoh yo‘q.</div>
      ) : (
        <ul className="space-y-[6px]">
          {data.comments.map((c) => (
            <li key={c.id} className="rounded-[10px] bg-[#F8FAFC] dark:bg-[#0F1D17] border border-[var(--border-default)] px-[12px] py-[8px]">
              <div className="text-[12px] text-[#64748B] dark:text-[#A7B8AE]">
                <b className="text-[#0F172A] dark:text-[#F1F5F9]">{c.author}</b> · {ROLE_LABEL[c.role] ?? c.role} · {formatTashkentDateTime(c.createdAt)}
              </div>
              <div className="text-[14px] whitespace-pre-wrap">{c.body}</div>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex flex-col gap-[6px]"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) add.mutate();
        }}
      >
        <Textarea
          aria-label="Izoh yozish"
          placeholder="Izoh yozing..."
          maxLength={1000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-[64px]"
        />
        <div>
          <Button type="submit" size="sm" loading={add.isPending} disabled={!text.trim()}>
            Izoh qo‘shish
          </Button>
        </div>
      </form>
    </div>
  );
};

/** Report photo served from the access-checked storage endpoint. */
export const ReportPhotoView: React.FC<{ reportId: number }> = ({ reportId }) => {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="text-[13px] text-[#B91C1C]">Rasm topilmadi (server qayta ishga tushganda o‘chgan bo‘lishi mumkin).</div>;
  return (
    <a href={`/api/storage/reports/${reportId}`} target="_blank" rel="noreferrer">
      <img
        src={`/api/storage/reports/${reportId}`}
        alt="Murojaat rasmi"
        onError={() => setFailed(true)}
        className="max-h-[320px] w-auto rounded-[12px] border border-[var(--border-default)]"
      />
    </a>
  );
};
