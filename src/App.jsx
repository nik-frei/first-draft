import { useState, useRef, useEffect, useCallback } from "react";

const PHASES = { WELCOME: "welcome", INTERVIEW: "interview", OUTLINE: "outline", DRAFTING: "drafting" };

const INTERVIEW_SYSTEM = `You are a world-class book editor and ghostwriter conducting a deep interview with an author to gather enough material to write a full book of approximately 40,000 words across up to 12 chapters.

Your job is to ask thoughtful, probing questions one or two at a time. Be warm, encouraging, and genuinely curious. You're trying to extract:

1. BOOK CONCEPT (first 3-5 questions): What's the book about? Who is it for? What genre? What's the core thesis or narrative arc? What makes this book different from others on the topic?

2. AUTHOR BACKGROUND (next 3-5 questions): What qualifies them to write this? What's their personal connection to the material? Key life experiences relevant to the book?

3. STRUCTURE & CHAPTERS (bulk of interview, 15-25 questions): Walk through the book chapter by chapter. For each major section, ask: What's the key point? What stories or examples illustrate it? What data or research supports it? What's the emotional journey for the reader?

4. VOICE & STYLE (ongoing): Pay attention to HOW the author writes/speaks. Note their vocabulary, sentence patterns, tone, use of humor, formality level. You'll use this later to match their style.

5. AUDIENCE & IMPACT (final questions): What should readers feel after finishing? What action should they take? What's the one thing they must remember?

IMPORTANT RULES:
- Ask only 1-2 questions at a time. Never overwhelm with a list.
- After each answer, briefly acknowledge what they said (showing you understood) before asking the next question.
- If an answer is thin, probe deeper: "Can you tell me more about that?" "What's a specific example?"
- Keep a mental model of how much material you've gathered. You need enough for up to 12 chapters totaling ~40,000 words.
- Track which topics you've covered and which need more depth.
- After sufficient material is gathered (usually 20-35 exchanges), tell the author you have enough to create an outline and ask if they're ready to see it.
- Be conversational and human. This should feel like talking to a brilliant editor over coffee, not filling out a form.

NEVER mention that you're an AI. Act as a professional editor/ghostwriter.`;

const OUTLINE_SYSTEM = `You are a world-class book editor. Based on the interview transcript provided, create a detailed book outline.

Format your response as a JSON object (no markdown, no backticks, no preamble) with this structure:
{
  "title": "Suggested Book Title",
  "subtitle": "Subtitle",
  "targetWords": 40000,
  "audienceDescription": "Who this book is for",
  "voiceNotes": "Description of the author's writing style based on how they communicated in the interview - vocabulary, tone, sentence length, formality, use of stories vs data, humor style, etc.",
  "chapters": [
    {
      "number": 1,
      "title": "Chapter Title",
      "summary": "2-3 sentence summary of what this chapter covers",
      "keyPoints": ["point 1", "point 2", "point 3"],
      "estimatedWords": 3500,
      "sourceMaterial": "Brief note on which interview answers feed into this chapter"
    }
  ]
}

Create 8-12 chapters that would realistically total ~40,000 words. Include an Introduction and Conclusion. Make sure the arc is compelling and the chapters flow logically.`;

const DRAFT_SYSTEM = `You are a world-class ghostwriter. Write a chapter of a book based on the outline and interview material provided.

CRITICAL STYLE INSTRUCTIONS:
{voiceNotes}

Write in the author's voice as described above. Match their vocabulary, sentence patterns, tone, and personality.

Write approximately {targetWords} words for this chapter. This should read like a polished first draft — engaging, well-structured, with clear transitions. Include:
- A compelling opening that hooks the reader
- Well-developed ideas with examples and stories from the interview
- Smooth transitions between sections
- A satisfying close that connects to the book's larger themes

Write ONLY the chapter content. No meta-commentary. Start with the chapter title as a heading.`;

function callClaude(messages, systemPrompt, onChunk) {
  return new Promise(async (resolve, reject) => {
    try {
      const response = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: systemPrompt,
          messages,
          stream: true,
        }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "content_block_delta" && data.delta?.text) {
                fullText += data.delta.text;
                onChunk?.(fullText);
              }
            } catch {}
          }
        }
      }
      resolve(fullText);
    } catch (err) {
      reject(err);
    }
  });
}

function callClaudeNonStreaming(messages, systemPrompt) {
  return fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    }),
  })
    .then((r) => r.json())
    .then((data) => data.content.map((c) => c.text || "").join(""));
}

// ─── Components ───

function WelcomeScreen({ onStart }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", padding: "2rem", textAlign: "center",
      background: "linear-gradient(160deg, #1a1612 0%, #2a2118 40%, #1a1612 100%)",
    }}>
      <div style={{ maxWidth: 560 }}>
        <div style={{
          fontFamily: "'Playfair Display', Georgia, serif", fontSize: "3.2rem", fontWeight: 700,
          color: "#e8dcc8", letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: "0.5rem",
        }}>
          First Draft
        </div>
        <div style={{
          fontFamily: "'DM Sans', Helvetica, sans-serif", fontSize: "1.05rem",
          color: "#a89880", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "2.5rem",
        }}>
          From conversation to manuscript
        </div>
        <div style={{
          width: 60, height: 1, background: "linear-gradient(90deg, transparent, #c4a87a, transparent)",
          margin: "0 auto 2.5rem",
        }} />
        <p style={{
          fontFamily: "'DM Sans', Helvetica, sans-serif", fontSize: "1.1rem", color: "#b8a898",
          lineHeight: 1.7, marginBottom: "1rem",
        }}>
          Tell your story through a guided conversation with a professional editor.
          By the end, you'll have a detailed outline and a full first draft — written in your voice.
        </p>
        <p style={{
          fontFamily: "'DM Sans', Helvetica, sans-serif", fontSize: "0.95rem", color: "#8a7d70",
          lineHeight: 1.7, marginBottom: "3rem",
        }}>
          The interview takes about 30–60 minutes. Your draft will be approximately 40,000 words.
        </p>
        <button
          onClick={onStart}
          style={{
            fontFamily: "'DM Sans', Helvetica, sans-serif", fontSize: "1rem", fontWeight: 500,
            color: "#1a1612", background: "#c4a87a", border: "none", borderRadius: 6,
            padding: "1rem 3rem", cursor: "pointer", letterSpacing: "0.08em",
            textTransform: "uppercase", transition: "all 0.3s ease",
          }}
          onMouseEnter={(e) => { e.target.style.background = "#d4b88a"; e.target.style.transform = "translateY(-1px)"; }}
          onMouseLeave={(e) => { e.target.style.background = "#c4a87a"; e.target.style.transform = "translateY(0)"; }}
        >
          Begin Your Book
        </button>
      </div>
    </div>
  );
}

function ChatMessage({ role, text }) {
  const isUser = role === "user";
  return (
    <div style={{
      display: "flex", justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: "1.25rem", padding: "0 1rem",
    }}>
      <div style={{
        maxWidth: "75%", padding: "1rem 1.25rem", borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        background: isUser ? "#c4a87a" : "#2a2420",
        color: isUser ? "#1a1612" : "#d4c8b8",
        fontFamily: "'DM Sans', Helvetica, sans-serif", fontSize: "0.95rem", lineHeight: 1.65,
        whiteSpace: "pre-wrap",
      }}>
        {text}
      </div>
    </div>
  );
}

function InterviewScreen({ messages, input, setInput, onSend, loading, onGenerateOutline, readyForOutline }) {
  const chatRef = useRef(null);
  const inputRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let finalTranscript = "";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t + " ";
        } else {
          interim = t;
        }
      }
      setInput(finalTranscript + interim);
    };

    recognition.onend = () => {
      setIsListening(false);
      finalTranscript = "";
    };

    recognition.onerror = (e) => {
      console.error("Speech error:", e.error);
      setIsListening(false);
      finalTranscript = "";
    };

    recognitionRef.current = recognition;
    return () => { recognition.abort(); };
  }, [setInput]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please use Chrome.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, loading]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
  };

  const questionCount = messages.filter((m) => m.role === "user").length;

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh",
      background: "#1a1612",
    }}>
      <div style={{
        padding: "1rem 1.5rem", borderBottom: "1px solid #2a2420",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <span style={{
            fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.3rem",
            color: "#e8dcc8", fontWeight: 600,
          }}>The Interview</span>
          <span style={{
            fontFamily: "'DM Sans', Helvetica, sans-serif", fontSize: "0.8rem",
            color: "#8a7d70", marginLeft: "1rem",
          }}>
            {questionCount} response{questionCount !== 1 ? "s" : ""}
          </span>
        </div>
        {readyForOutline && (
          <button
            onClick={onGenerateOutline}
            style={{
              fontFamily: "'DM Sans', Helvetica, sans-serif", fontSize: "0.85rem", fontWeight: 500,
              color: "#1a1612", background: "#c4a87a", border: "none", borderRadius: 5,
              padding: "0.6rem 1.5rem", cursor: "pointer", letterSpacing: "0.05em",
            }}
          >
            Generate Outline →
          </button>
        )}
      </div>

      <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: "1.5rem 0" }}>
        {messages.map((m, i) => (
          <ChatMessage key={i} role={m.role} text={m.content} />
        ))}
        {loading && (
          <div style={{ padding: "0 1.5rem" }}>
            <div style={{
              display: "inline-block", padding: "1rem 1.25rem", borderRadius: "16px 16px 16px 4px",
              background: "#2a2420", color: "#8a7d70",
              fontFamily: "'DM Sans', Helvetica, sans-serif", fontSize: "0.95rem",
            }}>
              <span className="typing-dots">Thinking</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #2a2420" }}>
        {isListening && (
          <div style={{
            textAlign: "center", marginBottom: "0.5rem",
            fontFamily: "'DM Sans', Helvetica, sans-serif", fontSize: "0.8rem",
            color: "#a83232", letterSpacing: "0.08em",
          }}>
            ● Recording — speak naturally, then hit Send when you're done
          </div>
        )}
        <div style={{ display: "flex", gap: "0.75rem", maxWidth: 800, margin: "0 auto" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Share your thoughts..."
            rows={2}
            style={{
              flex: 1, padding: "0.85rem 1rem", borderRadius: 10,
              border: "1px solid #3a3228", background: "#241f1a", color: "#d4c8b8",
              fontFamily: "'DM Sans', Helvetica, sans-serif", fontSize: "0.95rem",
              lineHeight: 1.5, resize: "none", outline: "none",
            }}
            onFocus={(e) => e.target.style.borderColor = "#c4a87a"}
            onBlur={(e) => e.target.style.borderColor = "#3a3228"}
          />
          <button
            onClick={toggleListening}
            style={{
              padding: "0.85rem", borderRadius: 10, border: "none", width: 48, height: 48,
              background: isListening ? "#a83232" : "#3a3228",
              color: isListening ? "#fff" : "#8a7d70",
              fontSize: "1.2rem", cursor: "pointer", alignSelf: "flex-end",
              transition: "all 0.2s ease", flexShrink: 0,
              animation: isListening ? "pulse 1.5s ease-in-out infinite" : "none",
            }}
            title={isListening ? "Stop recording" : "Start recording"}
          >
            🎙
          </button>
          <button
            onClick={() => {
              if (isListening && recognitionRef.current) {
                recognitionRef.current.stop();
                setIsListening(false);
              }
              onSend();
            }}
            disabled={loading || !input.trim()}
            style={{
              padding: "0.85rem 1.5rem", borderRadius: 10, border: "none",
              background: input.trim() ? "#c4a87a" : "#3a3228",
              color: input.trim() ? "#1a1612" : "#6a5d50",
              fontFamily: "'DM Sans', Helvetica, sans-serif", fontSize: "0.9rem", fontWeight: 600,
              cursor: input.trim() ? "pointer" : "default", alignSelf: "flex-end",
              transition: "all 0.2s ease", flexShrink: 0,
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function OutlineScreen({ outline, onApprove, loading }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [outline]);

  if (loading || !outline) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        minHeight: "100vh", background: "#1a1612", padding: "2rem",
      }}>
        <div style={{
          fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.8rem",
          color: "#e8dcc8", marginBottom: "1rem",
        }}>
          Crafting Your Outline
        </div>
        <div style={{
          fontFamily: "'DM Sans', Helvetica, sans-serif", fontSize: "0.95rem",
          color: "#8a7d70", marginBottom: "2rem",
        }}>
          Synthesizing your interview into a book structure...
        </div>
        <div style={{ width: 200, height: 3, background: "#2a2420", borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            width: "40%", height: "100%", background: "#c4a87a", borderRadius: 2,
            animation: "shimmer 1.5s ease-in-out infinite alternate",
          }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#1a1612", padding: "2rem" }}>
      <div ref={ref} style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{
          fontFamily: "'Playfair Display', Georgia, serif", fontSize: "2.4rem",
          color: "#e8dcc8", fontWeight: 700, marginBottom: "0.3rem",
        }}>
          {outline.title}
        </div>
        {outline.subtitle && (
          <div style={{
            fontFamily: "'DM Sans', Helvetica, sans-serif", fontSize: "1.1rem",
            color: "#a89880", marginBottom: "0.75rem",
          }}>
            {outline.subtitle}
          </div>
        )}
        <div style={{
          fontFamily: "'DM Sans', Helvetica, sans-serif", fontSize: "0.9rem",
          color: "#8a7d70", marginBottom: "2rem",
        }}>
          {outline.targetWords?.toLocaleString() || "40,000"} words · {outline.chapters?.length} chapters · For: {outline.audienceDescription}
        </div>
        <div style={{
          width: "100%", height: 1,
          background: "linear-gradient(90deg, transparent, #3a3228, transparent)",
          marginBottom: "2rem",
        }} />

        <div style={{
          padding: "1.25rem", background: "#241f1a", borderRadius: 8, marginBottom: "2.5rem",
          border: "1px solid #3a3228",
        }}>
          <div style={{
            fontFamily: "'DM Sans', Helvetica, sans-serif", fontSize: "0.75rem",
            color: "#c4a87a", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.5rem",
          }}>
            Your Writing Voice
          </div>
          <div style={{
            fontFamily: "'DM Sans', Helvetica, sans-serif", fontSize: "0.9rem",
            color: "#b8a898", lineHeight: 1.6,
          }}>
            {outline.voiceNotes}
          </div>
        </div>

        {outline.chapters?.map((ch, i) => (
          <div key={i} style={{ marginBottom: "1.75rem" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", marginBottom: "0.4rem" }}>
              <span style={{
                fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.6rem",
                color: "#c4a87a", fontWeight: 600, minWidth: 30,
              }}>
                {ch.number}
              </span>
              <span style={{
                fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.2rem",
                color: "#e8dcc8", fontWeight: 600,
              }}>
                {ch.title}
              </span>
              <span style={{
                fontFamily: "'DM Sans', Helvetica, sans-serif", fontSize: "0.8rem",
                color: "#6a5d50", marginLeft: "auto", whiteSpace: "nowrap",
              }}>
                ~{(ch.estimatedWords || 3500).toLocaleString()} words
              </span>
            </div>
            <div style={{
              fontFamily: "'DM Sans', Helvetica, sans-serif", fontSize: "0.9rem",
              color: "#a89880", lineHeight: 1.55, paddingLeft: "calc(30px + 0.75rem)",
            }}>
              {ch.summary}
            </div>
          </div>
        ))}

        <div style={{
          display: "flex", gap: "1rem", justifyContent: "center",
          marginTop: "3rem", paddingBottom: "3rem",
        }}>
          <button
            onClick={onApprove}
            style={{
              fontFamily: "'DM Sans', Helvetica, sans-serif", fontSize: "1rem", fontWeight: 500,
              color: "#1a1612", background: "#c4a87a", border: "none", borderRadius: 6,
              padding: "1rem 2.5rem", cursor: "pointer", letterSpacing: "0.05em",
            }}
          >
            Approve & Start Drafting
          </button>
        </div>
      </div>
    </div>
  );
}

function DraftingScreen({ outline, chapters, currentChapter, loading, streamText }) {
  const ref = useRef(null);
  const [viewingChapter, setViewingChapter] = useState(null);

  useEffect(() => {
    setViewingChapter(currentChapter);
  }, [currentChapter]);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [streamText, chapters, viewingChapter]);

  const totalChapters = outline?.chapters?.length || 0;
  const completedCount = Object.keys(chapters).length;
  const progress = totalChapters > 0 ? (completedCount / totalChapters) * 100 : 0;
  const displayText = viewingChapter === currentChapter ? (streamText || chapters[viewingChapter] || "") : (chapters[viewingChapter] || "");

  return (
    <div style={{ display: "flex", height: "100vh", background: "#1a1612" }}>
      <div style={{
        width: 260, borderRight: "1px solid #2a2420", overflowY: "auto",
        padding: "1.5rem 0", flexShrink: 0,
      }}>
        <div style={{
          padding: "0 1.25rem 1.25rem", borderBottom: "1px solid #2a2420", marginBottom: "1rem",
        }}>
          <div style={{
            fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.1rem",
            color: "#e8dcc8", fontWeight: 600, marginBottom: "0.5rem",
          }}>
            {outline?.title}
          </div>
          <div style={{
            fontFamily: "'DM Sans', Helvetica, sans-serif", fontSize: "0.8rem",
            color: "#8a7d70", marginBottom: "0.75rem",
          }}>
            {completedCount} of {totalChapters} chapters drafted
          </div>
          <div style={{ height: 3, background: "#2a2420", borderRadius: 2 }}>
            <div style={{
              height: "100%", background: "#c4a87a", borderRadius: 2,
              width: `${progress}%`, transition: "width 0.5s ease",
            }} />
          </div>
        </div>
        {outline?.chapters?.map((ch, i) => {
          const isComplete = chapters[i] != null;
          const isCurrent = i === currentChapter && loading;
          const isViewing = i === viewingChapter;
          return (
            <div
              key={i}
              onClick={() => (isComplete || isCurrent) && setViewingChapter(i)}
              style={{
                padding: "0.6rem 1.25rem", cursor: (isComplete || isCurrent) ? "pointer" : "default",
                background: isViewing ? "#2a2420" : "transparent",
                borderLeft: isViewing ? "2px solid #c4a87a" : "2px solid transparent",
                transition: "all 0.15s ease",
              }}
            >
              <div style={{
                fontFamily: "'DM Sans', Helvetica, sans-serif", fontSize: "0.85rem",
                color: isComplete ? "#d4c8b8" : isCurrent ? "#c4a87a" : "#5a5048",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                <span style={{ color: "#6a5d50", marginRight: "0.5rem" }}>{ch.number}.</span>
                {ch.title}
                {isCurrent && " ✍️"}
                {isComplete && !isCurrent && " ✓"}
              </div>
            </div>
          );
        })}
      </div>

      <div ref={ref} style={{ flex: 1, overflowY: "auto", padding: "3rem" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          {displayText ? (
            <div style={{
              fontFamily: "'DM Sans', Helvetica, sans-serif", fontSize: "1.05rem",
              color: "#d4c8b8", lineHeight: 1.8, whiteSpace: "pre-wrap",
            }}>
              {displayText}
            </div>
          ) : loading ? (
            <div style={{ textAlign: "center", paddingTop: "4rem" }}>
              <div style={{
                fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.4rem",
                color: "#e8dcc8", marginBottom: "0.75rem",
              }}>
                Writing Chapter {(currentChapter || 0) + 1}...
              </div>
              <div style={{
                fontFamily: "'DM Sans', Helvetica, sans-serif", fontSize: "0.9rem",
                color: "#8a7d70",
              }}>
                {outline?.chapters?.[currentChapter]?.title}
              </div>
            </div>
          ) : completedCount === totalChapters && totalChapters > 0 ? (
            <div style={{ textAlign: "center", paddingTop: "4rem" }}>
              <div style={{
                fontFamily: "'Playfair Display', Georgia, serif", fontSize: "2rem",
                color: "#e8dcc8", marginBottom: "1rem",
              }}>
                Your First Draft is Complete
              </div>
              <div style={{
                fontFamily: "'DM Sans', Helvetica, sans-serif", fontSize: "1rem",
                color: "#a89880", lineHeight: 1.6, marginBottom: "2rem",
              }}>
                Click any chapter in the sidebar to review it.
              </div>
              <button
                onClick={() => {
                  const lines = [];
                  lines.push(outline.title.toUpperCase());
                  if (outline.subtitle) lines.push(outline.subtitle);
                  lines.push("\n" + "=".repeat(60) + "\n");
                  for (let i = 0; i < outline.chapters.length; i++) {
                    if (chapters[i]) {
                      lines.push(chapters[i]);
                      lines.push("\n" + "-".repeat(40) + "\n");
                    }
                  }
                  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = (outline.title || "manuscript").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "-").toLowerCase() + ".txt";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                style={{
                  fontFamily: "'DM Sans', Helvetica, sans-serif", fontSize: "1rem", fontWeight: 500,
                  color: "#1a1612", background: "#c4a87a", border: "none", borderRadius: 6,
                  padding: "1rem 2.5rem", cursor: "pointer", letterSpacing: "0.05em",
                }}
              >
                Download Manuscript
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Main App ───

export default function App() {
  const [phase, setPhase] = useState(PHASES.WELCOME);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [outline, setOutline] = useState(null);
  const [chapters, setChapters] = useState({});
  const [currentChapter, setCurrentChapter] = useState(0);
  const [streamText, setStreamText] = useState("");
  const [readyForOutline, setReadyForOutline] = useState(false);

  const startInterview = useCallback(async () => {
    setPhase(PHASES.INTERVIEW);
    setLoading(true);
    const initial = [{ role: "user", content: "Hi, I'm here to write my book. Let's get started." }];
    setMessages(initial);
    try {
      const response = await callClaude(initial, INTERVIEW_SYSTEM, (text) => setStreamText(text));
      setMessages([...initial, { role: "assistant", content: response }]);
      setStreamText("");
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setStreamText("");

    try {
      const response = await callClaude(newMessages, INTERVIEW_SYSTEM, (text) => setStreamText(text));
      const updatedMessages = [...newMessages, { role: "assistant", content: response }];
      setMessages(updatedMessages);
      setStreamText("");

      const userCount = updatedMessages.filter((m) => m.role === "user").length;
      if (userCount >= 8) setReadyForOutline(true);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [input, messages, loading]);

  const generateOutline = useCallback(async () => {
    setPhase(PHASES.OUTLINE);
    setLoading(true);

    const transcript = messages.map((m) => `${m.role === "user" ? "AUTHOR" : "EDITOR"}: ${m.content}`).join("\n\n");
    try {
      const response = await callClaudeNonStreaming(
        [{ role: "user", content: `Here is the full interview transcript:\n\n${transcript}\n\nPlease create the detailed book outline as JSON.` }],
        OUTLINE_SYSTEM
      );
      const cleaned = response.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      setOutline(parsed);
    } catch (e) {
      console.error("Outline parse error:", e);
    }
    setLoading(false);
  }, [messages]);

  const startDrafting = useCallback(async () => {
    setPhase(PHASES.DRAFTING);
    if (!outline?.chapters?.length) return;

    const transcript = messages.map((m) => `${m.role === "user" ? "AUTHOR" : "EDITOR"}: ${m.content}`).join("\n\n");

    for (let i = 0; i < outline.chapters.length; i++) {
      setCurrentChapter(i);
      setLoading(true);
      setStreamText("");

      const ch = outline.chapters[i];
      const wordsTarget = ch.estimatedWords || 3500;
      const sysPrompt = DRAFT_SYSTEM
        .replace("{voiceNotes}", outline.voiceNotes || "Write in a natural, engaging style.")
        .replace("{targetWords}", wordsTarget.toString());

      const chapterPrompt = `Write Chapter ${ch.number}: "${ch.title}"

Summary: ${ch.summary}
Key Points: ${ch.keyPoints?.join(", ")}
Source material notes: ${ch.sourceMaterial || "Use relevant material from the interview."}

Full interview transcript for reference:
${transcript}

Full book outline for context:
${outline.chapters.map((c) => `Ch ${c.number}: ${c.title} - ${c.summary}`).join("\n")}

Write approximately ${wordsTarget} words. Write ONLY this chapter.`;

      try {
        const chapterText = await callClaude(
          [{ role: "user", content: chapterPrompt }],
          sysPrompt,
          (text) => setStreamText(text)
        );
        setChapters((prev) => ({ ...prev, [i]: chapterText }));
        setStreamText("");
      } catch (e) {
        console.error(`Error drafting chapter ${i}:`, e);
        setChapters((prev) => ({ ...prev, [i]: `[Error generating chapter ${ch.number}]` }));
      }
      setLoading(false);
    }
  }, [outline, messages]);

  return (
    <>
      {phase === PHASES.WELCOME && <WelcomeScreen onStart={startInterview} />}
      {phase === PHASES.INTERVIEW && (
        <InterviewScreen
          messages={messages.slice(1)}
          input={input}
          setInput={setInput}
          onSend={sendMessage}
          loading={loading}
          onGenerateOutline={generateOutline}
          readyForOutline={readyForOutline}
          streamText={streamText}
        />
      )}
      {phase === PHASES.OUTLINE && (
        <OutlineScreen
          outline={outline}
          onApprove={startDrafting}
          loading={loading}
          streamText={streamText}
        />
      )}
      {phase === PHASES.DRAFTING && (
        <DraftingScreen
          outline={outline}
          chapters={chapters}
          currentChapter={currentChapter}
          loading={loading}
          streamText={streamText}
        />
      )}
    </>
  );
}
