// One-click comments for the admin "Request changes" box. Kept free of server
// imports so the admin dashboard can use it. Wording follows the "Accuracy and
// Verification" section of the editorial policy.
export const FEEDBACK_PRESETS: { label: string; text: string }[] = [
  {
    label: 'Add sources and citations',
    text: 'Please add named sources or citations for your factual claims, with links where possible. Factual claims must be supported by named sources, official documents, or on-record reporting.',
  },
  {
    label: 'Attribute quotes and statistics',
    text: 'Please attribute every quote, figure and statistic to a named source, and say where and when it was published.',
  },
  {
    label: 'Two sources for contested claims',
    text: 'Where a claim is contested, please give at least two independent sources. If a claim rests on a single source, say so clearly in the text.',
  },
  {
    label: 'Link primary documents',
    text: 'Please link to the primary documents you rely on, such as official statements, reports or datasets, rather than only to commentary about them.',
  },
];

export const FEEDBACK_MAX_ITEMS = 10;
export const FEEDBACK_MAX_ITEM_LENGTH = 1000;
export const FEEDBACK_MAX_NOTE_LENGTH = 1000;
