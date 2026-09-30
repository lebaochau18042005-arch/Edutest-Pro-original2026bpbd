/** Bound waiting even if the transport ignores abort. */
export async function withGradingTimeout<T>(request: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error("AI phản hồi quá chậm. Vui lòng thử chấm lại bài này hoặc chọn model Flash trong Cài đặt."));
          controller.abort();
        }, Math.max(0, timeoutMs));
      }),
      Promise.resolve().then(() => request(controller.signal)),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
