export interface WeatherInfo {
  text: string;
  tempC: number;
  phrase: string;
}

export async function fetchWeather(city: string): Promise<WeatherInfo | null> {
  try {
    const q = encodeURIComponent(city || "Beijing");
    const res = await fetch(`https://wttr.in/${q}?format=j1`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      current_condition?: Array<{ weatherDesc?: Array<{ value?: string }>; temp_C?: string }>;
    };
    const cur = data.current_condition?.[0];
    const text = cur?.weatherDesc?.[0]?.value || "晴";
    const tempC = Number(cur?.temp_C || 20);
    let phrase = `今天${text}，${tempC}°C`;
    if (text.includes("Rain") || text.includes("雨")) phrase += "，记得带伞哦";
    if (tempC < 10) phrase += "，多穿点~";
    return { text, tempC, phrase };
  } catch {
    return null;
  }
}
