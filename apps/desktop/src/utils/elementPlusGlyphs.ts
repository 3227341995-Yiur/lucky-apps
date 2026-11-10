/**
 * 画布左侧 Element Plus 组件图标（自绘线性 SVG，形状对应真实组件）
 */
const G = {
  button: '<rect x="3.5" y="7" width="17" height="10" rx="3"/><path d="M8 12h8"/>',
  buttonGroup: '<rect x="2.5" y="7" width="8" height="10" rx="2"/><rect x="13.5" y="7" width="8" height="10" rx="2"/>',
  input: '<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 10v4M10 12h7"/>',
  number: '<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 9v6M4.5 12h5M14 12h5"/>',
  textarea: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h10M7 12h8M7 15h5"/>',
  select: '<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M13.5 10.5l2.5 2.5 2.5-2.5"/>',
  date: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h3M14 14h3M7 18h3"/>',
  time: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
  color: '<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><circle cx="8" cy="17" r="3"/><circle cx="16" cy="17" r="3"/>',
  switch: '<rect x="3" y="8" width="18" height="8" rx="4"/><circle cx="16" cy="12" r="2.5"/>',
  slider: '<path d="M3 12h18"/><circle cx="9" cy="12" r="3"/>',
  rate: '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.2 1 5.9-5.2-2.7-5.2 2.7 1-5.9L3.5 9.2l5.9-.9z"/>',
  tag: '<path d="M3 12l8-8h8v8l-8 8z"/><circle cx="16" cy="8" r="1.5"/>',
  progress: '<rect x="3" y="9" width="18" height="6" rx="3"/><path d="M3 12h11"/>',
  alert: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M12 8v5M12 16h.01"/>',
  card: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/>',
  divider: '<path d="M3 12h6M15 12h6"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11M15 9v11M3 15h18"/>',
  avatar: '<circle cx="12" cy="9" r="4"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  badge: '<circle cx="12" cy="12" r="8"/><circle cx="17" cy="7" r="2.5"/>',
  tabs: '<path d="M3 8h6v4H3zM9 8h6v4H9zM15 8h6v4h-6z"/><path d="M3 12h18v8H3z"/>',
  menu: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/>',
  breadcrumb: '<path d="M3 8h5l3 4-3 4H3zM12 8h5l3 4-3 4h-5z"/>',
  steps: '<circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><path d="M7 12h3M14 12h3"/>',
  timeline: '<path d="M6 4v16"/><circle cx="6" cy="7" r="2"/><circle cx="6" cy="13" r="2"/><circle cx="6" cy="19" r="2"/><path d="M10 7h9M10 13h7M10 19h9"/>',
  collapse: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/>',
  descriptions: '<path d="M3 6h7M3 12h7M3 18h7M13 6h8M13 12h8M13 18h8"/>',
  row: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="9.5" y="4" width="5" height="16" rx="1"/><rect x="16" y="4" width="5" height="16" rx="1"/>',
  space: '<rect x="3" y="8" width="5" height="8" rx="1"/><rect x="9.5" y="8" width="5" height="8" rx="1"/><rect x="16" y="8" width="5" height="8" rx="1"/>',
  form: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h4M13 8h4M7 12h10M7 16h6"/>',
  pagination: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><path d="M8 8l-3 4 3 4M16 8l3 4-3 4"/>',
  result: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  empty: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>',
  statistic: '<path d="M4 20V10M10 20V4M16 20V13M22 20V7"/>',
  skeleton: '<rect x="3" y="5" width="18" height="5" rx="2"/><rect x="3" y="14" width="12" height="5" rx="2"/>',
  tree: '<path d="M5 4v16M5 8h5M5 14h5"/><rect x="10" y="6" width="9" height="4" rx="1"/><rect x="10" y="12" width="9" height="4" rx="1"/>',
  transfer: '<rect x="3" y="5" width="6" height="14" rx="1"/><rect x="15" y="5" width="6" height="14" rx="1"/><path d="M10 10h4M10 14h4M13 8l2 2-2 2M13 12l2 2-2 2"/>',
  upload: '<path d="M4 16v3h16v-3"/><path d="M12 4v10M8 8l4-4 4 4"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="2"/><path d="M4 18l5-5 4 4 3-3 4 4"/>',
  default: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
}

export function getElGlyph(name) {
  const n = String(name || '')
  if (n.includes('button-group')) return G.buttonGroup
  if (n.includes('button')) return G.button
  if (n.includes('input-number')) return G.number
  if (n.includes('textarea')) return G.textarea
  if (n.includes('input')) return G.input
  if (n.includes('select') || n.includes('cascader')) return G.select
  if (n.includes('date') || n.includes('calendar')) return G.date
  if (n.includes('time')) return G.time
  if (n.includes('color')) return G.color
  if (n.includes('switch')) return G.switch
  if (n.includes('slider')) return G.slider
  if (n.includes('rate')) return G.rate
  if (n.includes('tag')) return G.tag
  if (n.includes('progress')) return G.progress
  if (n.includes('alert')) return G.alert
  if (n.includes('card')) return G.card
  if (n.includes('divider')) return G.divider
  if (n.includes('table')) return G.table
  if (n.includes('avatar')) return G.avatar
  if (n.includes('badge')) return G.badge
  if (n.includes('tabs')) return G.tabs
  if (n.includes('menu')) return G.menu
  if (n.includes('breadcrumb')) return G.breadcrumb
  if (n.includes('steps')) return G.steps
  if (n.includes('timeline')) return G.timeline
  if (n.includes('collapse')) return G.collapse
  if (n.includes('descriptions')) return G.descriptions
  if (n.includes('row') || n.includes('col')) return G.row
  if (n.includes('space')) return G.space
  if (n.includes('form')) return G.form
  if (n.includes('pagination')) return G.pagination
  if (n.includes('result')) return G.result
  if (n.includes('empty')) return G.empty
  if (n.includes('statistic')) return G.statistic
  if (n.includes('skeleton')) return G.skeleton
  if (n.includes('tree')) return G.tree
  if (n.includes('transfer')) return G.transfer
  if (n.includes('upload')) return G.upload
  if (n.includes('image')) return G.image
  return G.default
}
