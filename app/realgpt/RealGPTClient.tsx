"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { RealGPTMarkdown } from "./components/RealGPTMarkdown";
import DashboardCrumb from "@/components/DashboardCrumb";

type Message = { role: string; content: string };

const LOADING_STATUS = [
  "Thinking through this...",
  "Planning the response...",
  "Working through the details...",
  "Putting it together...",
  "Almost there...",
];

const palette = {
  ink: "#1F2933",
  slate: "#5B6775",
  muted: "#8B95A1",
  line: "#ECEFF2",
  surface: "#FFFFFF",
  assistant: "#F6F7F8",
  user: "#E8EBEE",
  input: "#F7F8F9",
  accent: "#2C3E50",
  accentHover: "#1F2D3A",
  danger: "#9C3B3B",
  font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif',
};

export default function RealGPTClient() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStatusIndex, setLoadingStatusIndex] = useState(0);
  const [sendHovered, setSendHovered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSend = Boolean(input.trim()) && !loading;

  useEffect(() => {
    if (!loading) return;
    const id = window.setInterval(() => {
      setLoadingStatusIndex((index) => (index + 1) % LOADING_STATUS.length);
    }, 3000);
    return () => window.clearInterval(id);
  }, [loading]);

  async function send() {
    const content = input.trim();
    if (!content || loading) return;

    const nextMessages = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setLoadingStatusIndex(0);
    setLoading(true);

    try {
      const response = await fetch("/api/realgpt/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(180000),
        body: JSON.stringify({ messages: nextMessages }),
      });
      let data: { reply?: string; error?: string } = {};
      try {
        data = await response.json();
      } catch {
        setError("Something went wrong — try again.");
        return;
      }
      if (!response.ok || data.error) {
        setError("Something went wrong — try again.");
        return;
      }
      const reply = typeof data.reply === "string" ? data.reply.trim() : "";
      if (!reply) {
        setError("Something went wrong — try again.");
        return;
      }
      setMessages([
        ...nextMessages,
        { role: "assistant", content: reply },
      ]);
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      const timedOut = name === "TimeoutError" || name === "AbortError";
      setError(timedOut ? "Timed out — try again." : "Something went wrong — try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing || event.key === "Process") return;
    if (event.key !== "Enter" || event.shiftKey) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches
    ) {
      return;
    }
    event.preventDefault();
    void send();
  }

  return (
    <div style={styles.page}>
      <DashboardCrumb />
      <header style={styles.header}>
        <h1 style={styles.title}>RealGPT</h1>
        <p style={styles.subtitle}>
          Your AI real estate copilot.
        </p>
      </header>

      <div style={styles.thread}>
        {messages.length === 0 && !loading ? (
          <p style={styles.empty}>
            Ask anything — strategy, markets, negotiation, or day-to-day real estate questions
          </p>
        ) : null}

        {messages.map((message, index) =>
          message.role === "assistant" ? (
            <div key={index} style={styles.outputCard}>
              <RealGPTMarkdown>{message.content}</RealGPTMarkdown>
            </div>
          ) : (
            <div key={index} style={styles.userBlock}>
              <div style={styles.userLabel}>You</div>
              <div style={styles.userText}>{message.content}</div>
            </div>
          )
        )}

        {loading ? (
          <div style={styles.status}>{LOADING_STATUS[loadingStatusIndex]}</div>
        ) : null}
        {error ? <div style={styles.error}>{error}</div> : null}
      </div>

      <div style={styles.composer}>
        <div style={styles.composerInner}>
          <textarea
            style={styles.textarea}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            rows={4}
            placeholder="Message RealGPT…"
          />
          <div style={styles.actions}>
            <button
              style={{
                ...styles.primaryButton,
                ...(sendHovered && canSend ? styles.primaryButtonHover : {}),
                ...(!canSend ? styles.primaryButtonDisabled : {}),
              }}
              type="button"
              onClick={send}
              disabled={!canSend}
              onMouseEnter={() => setSendHovered(true)}
              onMouseLeave={() => setSendHovered(false)}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    maxWidth: "760px",
    margin: "0 auto",
    padding: "2.25rem 1.75rem 3rem",
    fontFamily: palette.font,
    color: palette.ink,
    lineHeight: 1.65,
    background: palette.surface,
    minHeight: "100%",
  },
  header: {
    marginBottom: "2rem",
    paddingBottom: "1.25rem",
    borderBottom: `1px solid ${palette.line}`,
  },
  title: {
    fontSize: "1.55rem",
    fontWeight: 620,
    margin: 0,
    color: palette.accent,
    letterSpacing: "-0.02em",
  },
  subtitle: {
    margin: "0.45rem 0 0",
    color: palette.slate,
    fontSize: "0.95rem",
    lineHeight: 1.6,
  },
  thread: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "1.5rem",
    minHeight: "55vh",
    marginBottom: "2rem",
    padding: 0,
    background: palette.surface,
  },
  empty: {
    margin: "auto 0",
    color: palette.muted,
    fontSize: "1rem",
    lineHeight: 1.7,
    fontStyle: "italic" as const,
    textAlign: "center" as const,
    padding: "3.5rem 0.5rem",
  },
  outputCard: {
    width: "100%",
    border: "none",
    borderRadius: "8px",
    background: palette.assistant,
    padding: "0.95rem 1.05rem",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    lineHeight: 1.7,
    fontSize: "1.02rem",
  },
  userBlock: {
    width: "100%",
  },
  userLabel: {
    marginBottom: "0.4rem",
    fontSize: "0.7rem",
    fontWeight: 650,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    color: palette.muted,
  },
  userText: {
    whiteSpace: "pre-wrap" as const,
    color: palette.ink,
    fontSize: "1.02rem",
    lineHeight: 1.68,
    background: palette.user,
    borderRadius: "8px",
    padding: "0.8rem 1rem",
    border: "none",
  },
  status: {
    color: palette.slate,
    fontSize: "0.9rem",
    padding: 0,
  },
  error: {
    color: palette.danger,
    fontSize: "0.9rem",
    padding: 0,
  },
  composer: {
    paddingTop: "0.5rem",
  },
  composerInner: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.75rem",
    background: palette.surface,
    padding: 0,
  },
  textarea: {
    display: "block",
    width: "100%",
    minHeight: "120px",
    padding: "0.9rem 1rem",
    fontSize: "1.02rem",
    border: "none",
    borderRadius: "8px",
    boxSizing: "border-box" as const,
    fontFamily: palette.font,
    color: palette.ink,
    lineHeight: 1.65,
    resize: "vertical" as const,
    background: palette.input,
    outline: "none",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
  },
  primaryButton: {
    background: palette.accent,
    color: "white",
    fontSize: "0.88rem",
    fontWeight: 600,
    padding: "0.55rem 1.1rem",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    transition: "background 0.12s ease",
    fontFamily: palette.font,
    boxShadow: "none",
  },
  primaryButtonHover: {
    background: palette.accentHover,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
    cursor: "not-allowed",
  },
};
