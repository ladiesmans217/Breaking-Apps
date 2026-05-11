import { configure } from "passmark";

type EmailProvider = {
  domain: string;
  extractContent: (params: { email: string; prompt: string }) => Promise<string>;
};

async function waitForEmail(baseURL: string, email: string): Promise<string> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${baseURL}/api/emails?email=${encodeURIComponent(email)}`);
    const data = (await response.json()) as { messages: { text: string }[] };
    const latest = data.messages.at(-1);
    if (latest) {
      return latest.text;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No ReceiptRipper email found for ${email}`);
}

export function localInboxProvider(baseURL: string): EmailProvider {
  return {
    domain: "receiptripper.test",
    extractContent: async ({ email, prompt }) => {
      const text = await waitForEmail(baseURL, email);
      const lowerPrompt = prompt.toLowerCase();

      if (lowerPrompt.includes("total")) {
        const match = text.match(/Total:\s*([₹\d,.]+)/);
        if (match) return match[1];
      }

      if (lowerPrompt.includes("order")) {
        const match = text.match(/Order:\s*(\S+)/);
        if (match) return match[1];
      }

      return text;
    },
  };
}

export function configurePassmark(baseURL: string): void {
  configure({
    ai: {
      gateway: "openrouter",
      mode: "snapshot",
      models: {
        stepExecution: "google/gemini-2.0-flash-lite-001",
        assertionPrimary: "google/gemini-2.0-flash-lite-001",
        assertionSecondary: "google/gemini-2.0-flash-lite-001",
        assertionArbiter: "google/gemini-2.0-flash-lite-001",
        utility: "google/gemini-2.0-flash-lite-001",
      },
    },
    email: localInboxProvider(baseURL),
  });
}

export function shouldUsePassmarkAI(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY) && process.env.PASSMARK_SHOP_ALL === "on";
}
