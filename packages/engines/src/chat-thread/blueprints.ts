// chat-thread starter blueprints.
import type {
  BlueprintExports,
  BlueprintFieldSpec,
  BlueprintRecord,
  GimmickBlueprint,
} from '@kn/core/gimmicks';
import { base, opts, sound, text } from '../frame-hud/bp-kit.ts';

const MESSAGE_COLUMNS = [
  { key: 'sender', label: 'Sender', type: 'text' as const },
  { key: 'text', label: 'Message', type: 'text' as const },
  {
    key: 'side',
    label: 'Side',
    type: 'select' as const,
    options: opts('left', 'right', 'system'),
    optional: true,
  },
  { key: 'time', label: 'Time', type: 'text' as const, optional: true },
];
const CHAT_FIELDS: BlueprintFieldSpec[] = [
  text('channel', 'Channel'),
  {
    key: 'encryption',
    label: 'Encryption',
    type: 'select',
    options: [
      { value: 'aes-q', label: 'AES-Q encrypted' },
      { value: 'open', label: 'Open channel' },
      { value: 'spoofed', label: 'Spoofed' },
    ],
  },
  {
    key: 'messages',
    label: 'Messages',
    type: 'records',
    columns: MESSAGE_COLUMNS,
    itemLabel: 'Message',
    minItems: 1,
    maxItems: 12,
  },
  {
    key: 'lineDelay',
    label: 'Seconds between lines',
    type: 'number',
    min: 0.4,
    max: 4,
    step: 0.1,
    unit: 's',
  },
  sound,
];
const chatExports: BlueprintExports = {
  transcript: '[{{channel}}]\n{{#each messages}}{{sender}}: {{text}}\n{{/each}}',
  summary: 'Thread on {{channel}}',
  epubXhtml:
    '<section class="kn-chat" role="log"><p><strong>{{channel}}</strong></p><ul>{{#each messages}}<li><strong>{{sender}}</strong> {{text}}</li>{{/each}}</ul></section>',
  royalRoadHtml:
    '<blockquote><p><b>{{channel}}</b></p>{{#each messages}}<p><b>{{sender}}:</b> {{text}}</p>{{/each}}</blockquote>',
};
const msgs = (...rows: [string, string, string?, string?][]): BlueprintRecord[] =>
  rows.map(([sender, body, side, time]) => ({
    sender,
    text: body,
    ...(side ? { side } : {}),
    ...(time ? { time } : {}),
  }));

export const CHAT_THREAD_BLUEPRINTS: GimmickBlueprint[] = [
  {
    ...base,
    id: 'cyberbrain-link',
    engine: 'chat-thread',
    genre: 'cyberpunk',
    subgenre: 'neural-link',
    mood: ['cold', 'urgent'],
    tags: ['chat', 'encrypted', 'hacker'],
    name: 'Cyberbrain Link',
    tagline: 'An encrypted neural channel that decodes line by line.',
    fields: CHAT_FIELDS,
    defaultProps: {
      channel: 'KESTREL-9',
      encryption: 'aes-q',
      messages: msgs(
        ['KESTREL-9', 'You are not alone in here.'],
        ['KESTREL-9', 'Do not trust the second voice.'],
      ),
      lineDelay: 1.2,
      sound: true,
    },
    sampleProps: {
      channel: 'NULL-SPACE',
      encryption: 'spoofed',
      messages: msgs(
        ['GHOST', 'Your signature is cloned.'],
        ['GHOST', 'Cut the link. Now.'],
        ['SYSTEM', 'Link terminated.', 'system'],
      ),
      lineDelay: 1.6,
    },
    visual: {
      layout: 'cyber-link',
      ornament: 'inherit',
      surface: 'crt-glass',
      accentRole: 'primary',
      borderStyle: 'hairline',
      motionPreset: 'decrypt',
    },
    sound: { patch: 'chime', gain: 0.4 },
    haptics: 'tap',
    exports: chatExports,
  },
  {
    ...base,
    id: 'sms-intercept',
    engine: 'chat-thread',
    genre: 'thriller',
    subgenre: 'surveillance',
    mood: ['tense', 'intimate'],
    tags: ['sms', 'text-messages', 'intercept'],
    name: 'SMS Intercept',
    tagline: 'Intercepted text messages with typing dots between replies.',
    fields: CHAT_FIELDS,
    defaultProps: {
      channel: 'Unknown number',
      encryption: 'open',
      messages: msgs(
        ['Unknown', 'I know what you saw.', 'left', '23:14'],
        ['You', 'Who is this?', 'right', '23:14'],
        ['Unknown', 'Check your window.', 'left', '23:15'],
      ),
      lineDelay: 1.4,
      sound: true,
    },
    sampleProps: {
      channel: 'Mum',
      encryption: 'open',
      messages: msgs(['Mum', 'Are you home yet?', 'left'], ['You', 'Almost. Why?', 'right']),
      lineDelay: 1.2,
    },
    visual: {
      layout: 'sms',
      ornament: 'inherit',
      accentRole: 'secondary',
      borderStyle: 'none',
      motionPreset: 'rise',
    },
    sound: { patch: 'click', gain: 0.4 },
    haptics: 'tap',
    exports: chatExports,
  },
];
