import { defineModuleSchema } from '@kn/core';

export type Encryption = 'AES-Q' | 'OPEN' | 'SPOOFED';

export interface CyberbrainChatProps {
  senderId: string;
  encryption: Encryption;
  side: 'left' | 'right';
  messages: string[];
  chime: boolean;
  /** Seconds between messages landing. */
  lineDelay: number;
}

export const schema = defineModuleSchema<CyberbrainChatProps>({
  meta: {
    id: 'gits-cyberbrain-chat',
    version: 1,
    name: 'Cyberbrain Thought-Link',
    genre: 'gits',
    icon: '🧠',
    layer: 'inline',
    description: 'An encrypted thought-link thread that decrypts line by line beside the prose.',
  },
  fields: [
    { key: 'senderId', label: 'Sender ID', type: 'text', maxLength: 24, placeholder: 'KESTREL-9' },
    {
      key: 'encryption',
      label: 'Encryption',
      type: 'select',
      options: [
        { value: 'AES-Q', label: 'AES-Q' },
        { value: 'OPEN', label: 'Open' },
        { value: 'SPOOFED', label: 'Spoofed' },
      ],
    },
    {
      key: 'side',
      label: 'Side',
      type: 'select',
      options: [
        { value: 'left', label: 'Left' },
        { value: 'right', label: 'Right' },
      ],
    },
    {
      key: 'messages',
      label: 'Messages',
      type: 'string-list',
      minItems: 1,
      maxItems: 8,
      itemLabel: 'Line',
    },
    { key: 'chime', label: 'Neural chime', type: 'toggle' },
    {
      key: 'lineDelay',
      label: 'Pause between lines',
      type: 'number',
      min: 0.4,
      max: 4,
      step: 0.1,
      unit: 's',
    },
  ],
  defaults: {
    senderId: 'KESTREL-9',
    encryption: 'AES-Q',
    side: 'right',
    messages: ['Link established.', 'Keep your face still. They are reading it.'],
    chime: true,
    lineDelay: 1.2,
  },
  refine: (p) => {
    const errors: string[] = [];
    if (p.senderId.trim() === '') errors.push('senderId: give the sender an ID');
    if (p.messages.some((m) => m.trim() === '')) errors.push('messages: remove empty lines');
    if (p.messages.some((m) => m.length > 160))
      errors.push('messages: keep each line under 160 characters');
    return errors;
  },
});

export const meta = schema.meta;
