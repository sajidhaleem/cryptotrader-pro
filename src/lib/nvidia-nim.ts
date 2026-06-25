// NVIDIA NIM API client — OpenAI-compatible hosted inference
// Endpoint: https://integrate.api.nvidia.com/v1
// Requires: NVIDIA_API_KEY env var (get free credits at build.nvidia.com)
import axios from "axios";

const NIM_BASE = "https://integrate.api.nvidia.com/v1";

export const NIM_MODELS = [
  { id: "nvidia/llama-3.1-nemotron-70b-instruct", label: "Nemotron 70B",    badge: "NVIDIA Featured" },
  { id: "meta/llama-3.3-70b-instruct",             label: "Llama 3.3 70B",  badge: "Meta"            },
  { id: "meta/llama-3.1-70b-instruct",             label: "Llama 3.1 70B",  badge: "Meta"            },
  { id: "mistralai/mistral-large-2-instruct",      label: "Mistral Large 2", badge: "Mistral"         },
] as const;

export type NimModelId = (typeof NIM_MODELS)[number]["id"];
export const DEFAULT_NIM_MODEL: NimModelId = "nvidia/llama-3.1-nemotron-70b-instruct";

interface NimResponse {
  choices: { message: { content: string } }[];
  model: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

export async function callNIM(
  systemPrompt: string,
  userMessage: string,
  model: NimModelId = DEFAULT_NIM_MODEL,
  maxTokens = 1024,
): Promise<string> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_API_KEY not configured — get free credits at build.nvidia.com and add the key to environment variables");

  const { data } = await axios.post<NimResponse>(
    `${NIM_BASE}/chat/completions`,
    {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userMessage  },
      ],
      max_tokens:  maxTokens,
      temperature: 0.1,
      stream:      false,
    },
    {
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 30_000,
    },
  );

  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("NVIDIA NIM returned an empty response");
  return text.trim();
}
