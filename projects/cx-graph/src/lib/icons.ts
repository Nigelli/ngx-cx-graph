/**
 * Built-in icons: SVG path data on a 24 by 24 grid, drawn with a 2px
 * round stroke. Add your own through `provideCxGraph({ icons })`, or
 * render icons from your design system with a `cxIcon` template.
 */
export const CX_ICONS: Record<string, string> = {
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  gear: 'M16 12a4 4 0 1 1-8 0a4 4 0 1 1 8 0M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
  doc: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z',
  flag: 'M5 21V4M5 4h12l-2.5 4 2.5 4H5',
  layers: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5',
  circle: 'M20 12a8 8 0 1 1-16 0a8 8 0 1 1 16 0',
  box: 'M4 7.5l8-4.5 8 4.5v9L12 21l-8-4.5zM4 7.5l8 4.5 8-4.5M12 12v9',
  server: 'M4 4h16v7H4zM4 13h16v7H4zM7.5 7.5h.01M7.5 16.5h.01',
  database: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  user: 'M16 8a4 4 0 1 1-8 0a4 4 0 1 1 8 0M4 21c0-4 3.6-7 8-7s8 3 8 7',
  shield: 'M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z',
  key: 'M11 15a4 4 0 1 1-8 0a4 4 0 1 1 8 0M10 12.5L20 3M16 7l3 3M13.5 9.5l2 2',
  globe: 'M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9S14.5 18.3 12 21c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  bug: 'M8 9a4 4 0 0 1 8 0v6a4 4 0 0 1-8 0zM9 5L7.5 3M15 5l1.5-2M8 11H4M8 15H4M20 11h-4M20 15h-4M12 9v10',
  target: 'M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0M16 12a4 4 0 1 1-8 0a4 4 0 1 1 8 0M12 11.5v1',
  alert: 'M12 3l10 17H2zM12 10v4M12 17h.01',
  question: 'M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01',
  check: 'M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0M8 12.5l3 3 5-6',
  search: 'M18 11a7 7 0 1 1-14 0a7 7 0 1 1 14 0M20 20l-4-4',
  plus: 'M5 12h14M12 5v14',
  minus: 'M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-right': 'M9 6l6 6-6 6',
  'arrow-right': 'M5 12h14M13 6l6 6-6 6',
};
