export async function fetchLmStudioPhrase(
  baseUrl: string,
  petName: string
): Promise<string | null> {
  const url = `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({
        model: "local-model",
        messages: [
          {
            role: "system",
            content: "你是桌面宠物助手，只输出一句简短中文台词，不超过20字，不要引号。",
          },
          {
            role: "user",
            content: `宠物叫${petName}，生成一句可爱待机台词`,
          },
        ],
        max_tokens: 40,
        temperature: 0.9,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    return text ? text.replace(/^["'「]|["'」]$/g, "") : null;
  } catch {
    return null;
  }
}
