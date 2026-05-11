export type ChatMessage = {
  id: string;
  text: string;
  sourceLang: string;
  name: string;
  ts: number;
  mine: boolean;
  translated?: string;
  translating?: boolean;
  translationError?: boolean;
};
