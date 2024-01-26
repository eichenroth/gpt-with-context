type Options = {
  apiKey: string;
  completionParams: { model: string; temperature?: number; top_p?: number; max_tokens?: number; };
};
type SendOptions = { onProgress: (answer: Answer) => void; };
type Message = { content: string; role: 'user' | 'system'; };
type Answer = { id: string; text: string; };

export const chatgpt = (opts: Options) => {
  const { apiKey, completionParams } = opts;

  const send = async (content: string, opts: SendOptions): Promise<Answer> => {
    const { onProgress } = opts;

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };
    const message: Message = { content, role: 'user' };
    const body = {
      ...completionParams,
      messages: [message],
      stream: true
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    let id = '';
    let text = '';
    const parser = (await import('eventsource-parser')).createParser((event) => {
      if (event.type === 'event') {
        if (event.data === '[DONE]') { return; } // TODO: promisify and resolve here
        try {
          const obj = JSON.parse(event.data);

          id = obj.id;
          text += obj.choices[0]?.delta.content || '';
          onProgress({ id, text });
        } catch {
          console.log(event.data); // TODO: promisify and reject here
        }
      }
    });
    const reader = response.body?.getReader();
    if (!reader) { throw new Error('No reader'); }

    try {
      while(true) {
        const { done, value } = await reader.read();
        if (done) { break; }
        const str = new TextDecoder().decode(value);
        parser.feed(str);
      }
    } finally { reader.releaseLock(); }

    return { id, text };
  };

  return { send };
};
