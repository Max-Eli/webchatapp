// Wire format for chat messages sent over the LiveKit data channel.
export type ChatPayload = {
  id: string;
  text: string;
  lang: string;
  name: string;
  ts: number;
};

// UI-side representation including translation state.
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
