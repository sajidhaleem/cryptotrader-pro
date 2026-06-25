import axios from "axios";

const KIMI_BASE = "https://api.moonshot.cn/v1";

export const KIMI_MODELS = [
  { id: "kimi-k2-instruct",    label: "Kimi K2",         badge: "Moonshot Featured" },
  { id: "moonshot-v1-128k",   label: "Moonshot 128k",   badge: "Moonshot"          },
  { id: "moonshot-v1-32k",    label: "Moonshot 32k",    badge: "Moonshot"          },
  { id: "moonshot-v1-8k",     label: "Moonshot 8k",     badge: "Moonshot"          },
] as const;

export type KimiModelId = (typeof KIMI_MODELS)[number]["id"];
export const DEFAULT_KIMI_MODEL: KimiModelId = "kimi-k2-instruct";

interface ChatChoice {
  message: { content: string };
}
interface ChatResponse {
  choices: ChatChoice[];
}

export async function callKimi(
  systemPrompt: string,
  userMessage: string,
  model: KimiModelId = DEFAULT_KIMI_MODEL,
  maxTokens = 1024,
): Promise<string> {
  const apiKey = process.env.MOONSHOT_API_KEY;
  if (!apiKey) throw new Error("MOONSHOT_API_KEY not configured — get free credits at platform.moonshot.cn and add it to environment variables");

  const { data } = await axios.post<ChatResponse>(
    `${KIMI_BASE}/chat/completions`,
    {
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userMessage  },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 60_000,
    },
  );

  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Kimi returned empty response");
  return content.trim();
}
