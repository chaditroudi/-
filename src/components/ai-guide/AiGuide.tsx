import { Bot, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAiGuideUi } from "@/contexts/AiGuideContext";
import { isRTL } from "@/i18n";
import { aiGuideApi, type AiGuideReply, type AiGuideStatus } from "@/lib/api/ai-guide";
import { getSseConnection } from "@/lib/sseClient";
import { cn } from "@/lib/utils";

const QUICK_KEYS = ["now", "blocked", "how", "explain"] as const;
const SSE_REASK_MS = 10_000;

export const AiGuide = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const ui = useAiGuideUi();
  const uiRef = useRef(ui);
  uiRef.current = ui;
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);
  openRef.current = open;
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [reply, setReply] = useState<AiGuideReply | null>(null);
  const [history, setHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [status, setStatus] = useState<AiGuideStatus | null>(null);
  const lastQuestionRef = useRef<string | null>(null);
  const lastAskAtRef = useRef(0);
  const pendingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const historyRef = useRef(history);
  historyRef.current = history;
  const rtl = isRTL(i18n.language);

  useEffect(() => {
    pendingRef.current = false;
    setPending(false);
  }, []);

  const contextLabel = useMemo(() => {
    const parts = [ui.screen, ui.entityId].filter(Boolean);
    return parts.join(" · ") || t("aiGuide.noContext");
  }, [ui.screen, ui.entityId, t]);

  const stopPending = () => {
    pendingRef.current = false;
    setPending(false);
  };

  const ask = useCallback(async (
    text: string,
    extra: { element?: string | null; reasonCode?: string | null } = {},
  ) => {
    const trimmed = text.trim();
    if (!trimmed || pendingRef.current) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    pendingRef.current = true;
    lastQuestionRef.current = trimmed;
    lastAskAtRef.current = Date.now();
    setPending(true);
    const ctx = uiRef.current;
    try {
      const { data } = await aiGuideApi.ask({
        screen: ctx.screen,
        entityType: ctx.entityId ? "LOT" : null,
        entityId: ctx.entityId,
        element: extra.element ?? ctx.element,
        question: trimmed,
        language: i18n.language,
        reasonCode: extra.reasonCode ?? ctx.reasonCode,
        history: historyRef.current,
      }, ac.signal);
      if (ac.signal.aborted || !openRef.current) return;
      setReply(data);
      setHistory((prev) => {
        const next: typeof prev = [...prev, { role: "user", content: trimmed }, { role: "assistant", content: data.message }];
        return next.slice(-6);
      });
      setQuestion("");
    } catch {
      if (ac.signal.aborted || !openRef.current) return;
      setReply({
        message: t("aiGuide.unavailable"),
        intent: "GENERAL_HELP",
        language: i18n.language,
        fallbackUsed: true,
        source: "deterministic",
      });
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      stopPending();
    }
  }, [i18n.language, t]);

  useEffect(() => {
    if (!open) return;
    void aiGuideApi.status()
      .then(({ data }) => setStatus(data))
      .catch(() => setStatus(null));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const sse = getSseConnection();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = sse.subscribe((msg) => {
      if (msg.eventName !== "db_change") return;
      if (!uiRef.current.entityId) return;
      const previous = lastQuestionRef.current;
      if (!previous || pendingRef.current) return;
      if (Date.now() - lastAskAtRef.current < SSE_REASK_MS) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (pendingRef.current || !openRef.current) return;
        void ask(previous);
      }, 400);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [open, ask]);

  const quickQuestion = (key: (typeof QUICK_KEYS)[number]) => {
    if (key === "explain") return ask(t("aiGuide.qExplain"), { element: ui.element || ui.screen });
    if (key === "blocked") return ask(t("aiGuide.qBlocked"), { reasonCode: ui.reasonCode });
    return ask(t(`aiGuide.q${key === "now" ? "Now" : "How"}`));
  };

  const follow = (target: string) => {
    setOpen(false);
    navigate(target);
  };

  const onOpenChange = (next: boolean) => {
    if (!next) {
      abortRef.current?.abort();
      abortRef.current = null;
      stopPending();
    }
    setOpen(next);
  };

  const modeLabel = reply
    ? (reply.source === "llm" ? t("aiGuide.live") : t("aiGuide.fallback"))
    : status?.enabled
      ? t("aiGuide.live")
      : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title={t("aiGuide.title")}
          className="h-9 w-9 rounded-[9px] text-muted-foreground/70 hover:bg-card hover:text-foreground hover:shadow-xs"
        >
          <Bot className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side={rtl ? "left" : "right"}
        className="flex w-full flex-col gap-3 sm:max-w-sm"
        dir={rtl ? "rtl" : "ltr"}
      >
        <SheetHeader className="text-start">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4 text-primary" />
            {t("aiGuide.title")}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {contextLabel}
            <span className="mt-1 block text-xs text-muted-foreground">
              {modeLabel}
              {status?.model ? ` · ${status.model}` : ""}
            </span>
          </SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-2 gap-1.5">
          {QUICK_KEYS.map((key) => (
            <Button
              key={key}
              type="button"
              variant="outline"
              size="sm"
              className="h-auto justify-start whitespace-normal px-2 py-1.5 text-start text-xs leading-snug"
              disabled={pending}
              onClick={() => void quickQuestion(key)}
            >
              {t(`aiGuide.quick.${key}`)}
            </Button>
          ))}
        </div>

        <div className="min-h-[7rem] flex-1 overflow-y-auto rounded-md border border-border/60 bg-muted/30 p-3 text-sm leading-relaxed">
          {pending ? t("aiGuide.thinking") : reply?.message || t("aiGuide.placeholder")}
          {reply?.fallbackUsed && !pending && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("aiGuide.fallback")}
            </p>
          )}
        </div>

        {reply?.nextAction?.target && !pending && (
          <Button type="button" size="sm" onClick={() => follow(reply.nextAction!.target)}>
            {reply.nextAction.label}
          </Button>
        )}

        <form
          className="flex gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            void ask(question);
          }}
        >
          <Input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={t("aiGuide.ask")}
            className="h-9 text-sm"
            disabled={pending}
          />
          <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={pending || !question.trim()}>
            <Send className={cn("h-3.5 w-3.5", rtl && "rotate-180")} />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
};
