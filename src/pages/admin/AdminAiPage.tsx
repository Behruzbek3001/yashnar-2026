import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { apiRequest, formatTashkentDateTime } from '../../lib/api';
import { Button, Card, ErrorAlert, Textarea } from '../../components/ui/Primitives';

interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  meta?: {
    timeRange: string;
    dataFreshness: string;
    provider: string;
  };
}

const SUGGESTED_QUESTIONS = [
  'Qaysi MFYda chiqindi hajmi tez oshmoqda?',
  'Oxirgi 7 kunda qancha chiqindi yig‘ildi?',
  'Kechikayotgan murojaatlar qayerda ko‘p?',
];

const renderInlineBold = (text: string): React.ReactNode => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={idx} className="font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <React.Fragment key={idx}>{part}</React.Fragment>
    )
  );
};

const FormattedAiText: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');
  return (
    <div className="space-y-[6px]">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-[4px]" />;
        if (/^[*-]\s+/.test(trimmed)) {
          return (
            <div key={i} className="flex items-start gap-[8px] pl-[4px]">
              <span className="mt-[8px] w-[5px] h-[5px] rounded-full bg-[#059669] shrink-0" />
              <span>{renderInlineBold(trimmed.replace(/^[*-]\s+/, ''))}</span>
            </div>
          );
        }
        return <p key={i}>{renderInlineBold(trimmed)}</p>;
      })}
    </div>
  );
};

export const AdminAiPage: React.FC = () => {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);

  const askMutation = useMutation({
    mutationFn: (q: string) =>
      apiRequest<{
        answer: string;
        meta: {
          timeRange: string;
          dataFreshness: string;
          provider: string;
        };
      }>('/api/admin/ai', {
        method: 'POST',
        body: JSON.stringify({ question: q }),
      }),
    onSuccess: (res) => {
      setErrorText(null);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: res.answer,
          meta: res.meta,
        },
      ]);
    },
    onError: (err) => {
      setErrorText(
        err instanceof Error
          ? err.message
          : 'YASHNAR AI tahlilida xatolik yuz berdi.'
      );
    },
  });

  const submitQuestion = (rawQ: string) => {
    const trimmed = rawQ.trim();
    if (trimmed.length < 3 || askMutation.isPending) return;
    setErrorText(null);
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', content: trimmed },
    ]);
    setQuestion('');
    askMutation.mutate(trimmed);
  };

  return (
    <div className="max-w-[900px] mx-auto space-y-[24px]">
      {/* Header: 48x48 emerald icon, title YASHNAR AI, subtitle */}
      <div className="flex items-center gap-[16px]">
        <div className="w-[48px] h-[48px] rounded-[14px] bg-[#064E3B] text-[#34D399] flex items-center justify-center shrink-0">
          <Sparkles className="w-[24px] h-[24px]" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-[24px] leading-[32px] font-bold text-[#0F172A] dark:text-[#F1F5F9]">
            YASHNAR AI
          </h1>
          <p className="mt-[2px] text-[14px] leading-[22px] text-[#64748B] dark:text-[#A7B8AE]">
            Haqiqiy ma’lumotlarga asoslangan operatsion tahlil.
          </p>
        </div>
      </div>

      {/* 3 Suggested Questions (min-h 40px) */}
      <div className="flex flex-wrap gap-[10px]">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            disabled={askMutation.isPending}
            onClick={() => submitQuestion(q)}
            className="min-h-[40px] px-[14px] py-[8px] rounded-[10px] text-left text-[13px] font-medium bg-white dark:bg-[#13231D] border border-[var(--border-default)] text-[#0F172A] dark:text-[#F1F5F9] hover:border-[#059669] hover:text-[#047857] dark:hover:text-[#34D399] transition-colors cursor-pointer disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Messages Container */}
      <Card className="min-h-[300px] flex flex-col justify-between gap-[20px]">
        <div className="space-y-[16px]">
          {messages.length === 0 ? (
            <div className="py-[32px] text-center text-[14px] text-[#64748B] dark:text-[#A7B8AE]">
              Yuqoridagi tavsiya etilgan savollardan birini tanlang yoki o‘z savolingizni kiriting.
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] p-[16px] rounded-[16px] text-[14px] leading-[22px] ${
                    msg.role === 'user'
                      ? 'bg-[#047857] text-white whitespace-pre-wrap'
                      : 'bg-[#F8FAFC] dark:bg-[#0F1D17] border border-[var(--border-default)] text-[#0F172A] dark:text-[#F1F5F9]'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <div>{msg.content}</div>
                  ) : (
                    <FormattedAiText content={msg.content} />
                  )}
                  {msg.meta && (
                    <div className="mt-[10px] pt-[8px] border-t border-[var(--border-default)] text-[11px] text-[#64748B] dark:text-[#A7B8AE] tabular-nums">
                      Oraliq: {msg.meta.timeRange} · Yangiligi: {formatTashkentDateTime(msg.meta.dataFreshness)}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {askMutation.isPending && (
            <div className="flex justify-start">
              <div className="max-w-[85%] p-[16px] rounded-[16px] bg-[#F8FAFC] dark:bg-[#0F1D17] border border-[var(--border-default)] text-[14px] text-[#64748B]">
                Haqiqiy baza ko‘rsatkichlari tahlil qilinmoqda...
              </div>
            </div>
          )}
        </div>

        {errorText && <ErrorAlert message={errorText} />}

        {/* Input Form: min-h 96px, max 1000 chars, submit "Tahlil qilish" */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitQuestion(question);
          }}
          className="space-y-[12px] pt-[12px] border-t border-[var(--border-default)]"
        >
          <Textarea
            aria-label="YASHNAR AI uchun savol"
            placeholder="Operatsion tahlil bo‘yicha savolingizni yozing..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={1000}
            className="min-h-[96px]"
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={question.trim().length < 3}
              loading={askMutation.isPending}
              loadingLabel="Tahlil qilinmoqda..."
            >
              Tahlil qilish
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
