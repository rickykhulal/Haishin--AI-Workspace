"use client";

import { Sparkles, Code, Globe, BookOpen } from "lucide-react";

interface WelcomeScreenProps {
  onSendPrompt: (prompt: string) => void;
}

const SUGGESTED_PROMPTS = [
  {
    icon: Sparkles,
    label: "Explain something",
    prompt: "Explain how transformer models work in simple terms",
  },
  {
    icon: Code,
    label: "Write code",
    prompt: "Write a Python function that sorts a list using merge sort",
  },
  {
    icon: Globe,
    label: "Translate text",
    prompt: "Translate 'Hello, how are you?' into Nepali",
  },
  {
    icon: BookOpen,
    label: "Summarize",
    prompt: "Summarize the key ideas behind attention mechanisms in neural networks",
  },
];

export function WelcomeScreen({ onSendPrompt }: WelcomeScreenProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="mx-auto max-w-2xl text-center">
        {/* Logo */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8AB4F8] to-[#5B8DEF] shadow-lg shadow-[#8AB4F8]/20">
          <span className="text-2xl font-bold text-[#0B0D12]">H</span>
        </div>

        <h1 className="text-2xl font-semibold text-[#F3F5F9]">
          Welcome to Haishin
        </h1>
        <p className="mt-2 text-sm text-[#9AA6B8]">
          AI workspace by Haitian. Currently running in{" "}
          <span className="font-medium text-amber-400">demo mode</span> — responses
          are pre-written examples, not from a trained model.
        </p>

        {/* Suggested prompts */}
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {SUGGESTED_PROMPTS.map((item) => (
            <button
              key={item.label}
              onClick={() => onSendPrompt(item.prompt)}
              className="group flex items-start gap-3 rounded-xl border border-[#273040] bg-[#151A23] p-4 text-left transition-colors hover:border-[#8AB4F8]/20 hover:bg-[#1a2235] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8AB4F8]"
            >
              <item.icon
                className="mt-0.5 h-4 w-4 shrink-0 text-[#8AB4F8] opacity-60 group-hover:opacity-100"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-medium text-[#F3F5F9]">{item.label}</p>
                <p className="mt-0.5 text-xs text-[#9AA6B8]">{item.prompt}</p>
              </div>
            </button>
          ))}
        </div>

        <p className="mt-8 text-xs text-[#9AA6B8]/40">
          Start a conversation by typing a message or selecting a prompt above
        </p>
      </div>
    </div>
  );
}
