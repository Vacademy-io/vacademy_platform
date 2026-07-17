#!/usr/bin/env python3
"""Validate a guided-demo JSON file against the widget-kit contract.
Usage: python3 validate_demo.py <demo.json>   (exit 0 = valid)"""
import json, sys

WIDGETS = {
    'header':  {'req': ['title'], 'opt': ['subtitle', 'actions']},
    'stats':   {'req': ['items'], 'opt': []},          # items: [{label,value,delta?}]
    'table':   {'req': ['columns', 'rows'], 'opt': []},# cells: str | {chip,tone}
    'kanban':  {'req': ['columns'], 'opt': []},        # [{title,cards:[{title,sub}]}]
    'cards':   {'req': ['items'], 'opt': []},          # [{title,sub?,chip?,tone?}]
    'chat':    {'req': ['messages'], 'opt': ['composer']},  # [{from:user|ai|agent|system,text}]
    'form':    {'req': ['fields'], 'opt': ['title', 'submit']},  # [{label,value?,type:text|select|toggle}]
    'player':  {'req': ['outline', 'slide'], 'opt': []},  # outline:[{title,items:[{t,on?,done?}]}], slide:{title,body}
    'video':   {'req': ['title'], 'opt': ['time']},
    'funnel':  {'req': ['stages'], 'opt': []},         # [{label,value:number}]
    'chart':   {'req': ['kind'], 'opt': ['label', 'values']},  # kind: bars|line
    'list':    {'req': ['items'], 'opt': []},          # [{title,sub?,right?,chip?,tone?}]
    'invoice': {'req': ['to', 'rows', 'total'], 'opt': ['no']},
    'call':    {'req': ['name'], 'opt': ['number', 'status', 'time', 'lines']},
    'tree':    {'req': ['nodes'], 'opt': []},          # [{label,children?}]
    'builder': {'req': ['canvas'], 'opt': ['tray']},
    'whiteboard': {'req': [], 'opt': ['title']},
    'notify':  {'req': ['items'], 'opt': []},          # [{channel,text}]
    'wizard':  {'req': ['steps'], 'opt': ['active']},
}
TONES = {'orange', 'green', 'blue', 'red', 'purple', 'gray'}

errors = []
def err(msg): errors.append(msg)

def check_widget(w, sid, path):
    if 'cols' in w:
        if not isinstance(w['cols'], list) or not (2 <= len(w['cols']) <= 3):
            err(f'{path}: cols must be a list of 2-3 widgets')
        else:
            for i, c in enumerate(w['cols']):
                check_widget(c, sid, f'{path}.cols[{i}]')
        return
    t = w.get('type')
    if t not in WIDGETS:
        err(f'{path}: unknown widget type {t!r}'); return
    for r in WIDGETS[t]['req']:
        if r not in w:
            err(f'{path} ({t}): missing required prop {r!r}')
    if t == 'chart' and w.get('kind') not in ('bars', 'line'):
        err(f'{path}: chart.kind must be bars|line')
    if t == 'chat':
        for m in w.get('messages', []):
            if m.get('from') not in ('user', 'ai', 'agent', 'system'):
                err(f'{path}: chat message from must be user|ai|agent|system')
    if t == 'funnel':
        for s in w.get('stages', []):
            if not isinstance(s.get('value'), (int, float)):
                err(f'{path}: funnel stage value must be a number')

def collect_ids(widgets, acc):
    for w in widgets:
        if 'cols' in w:
            collect_ids(w['cols'], acc)
        elif w.get('id'):
            acc.add(w['id'])

def main():
    d = json.load(open(sys.argv[1]))
    demo = d.get('demo', d)
    if not isinstance(demo.get('intro'), str) or not demo['intro']:
        err('demo.intro (string) required')
    screens = demo.get('screens', [])
    steps = demo.get('steps', [])
    if not (1 <= len(screens) <= 5): err(f'need 1-5 screens, got {len(screens)}')
    if not (5 <= len(steps) <= 12): err(f'need 5-12 steps, got {len(steps)}')
    sids, wids = {}, {}
    for i, s in enumerate(screens):
        sid = s.get('id')
        if not sid: err(f'screens[{i}]: missing id'); continue
        if sid in sids: err(f'duplicate screen id {sid!r}')
        sids[sid] = s
        if s.get('device') not in ('desktop', 'phone'):
            err(f'screen {sid}: device must be desktop|phone')
        if not isinstance(s.get('title'), str): err(f'screen {sid}: title required')
        nav = s.get('nav', [])
        if nav and sum(1 for n in nav if n.endswith('*')) != 1:
            err(f'screen {sid}: exactly one nav item must end with * (active)')
        ws = s.get('widgets', [])
        if not (1 <= len(ws) <= 7): err(f'screen {sid}: 1-7 widgets, got {len(ws)}')
        for j, w in enumerate(ws):
            check_widget(w, sid, f'screen {sid}.widgets[{j}]')
        acc = set(); collect_ids(ws, acc); wids[sid] = acc
    for i, st in enumerate(steps):
        if st.get('screen') not in sids:
            err(f'steps[{i}]: unknown screen {st.get("screen")!r}'); continue
        tgt = st.get('target')
        if tgt is not None and tgt not in wids[st['screen']]:
            err(f'steps[{i}]: target {tgt!r} not a widget id on screen {st["screen"]!r}')
        if not st.get('title') or not st.get('text'):
            err(f'steps[{i}]: title and text required')
        if len(st.get('text', '')) > 260:
            err(f'steps[{i}]: text too long (max 260 chars)')
    if steps and steps[0].get('target') is not None:
        pass  # first step may target or not — both fine
    if errors:
        print('INVALID:'); [print(' -', e) for e in errors]; sys.exit(1)
    print(f'VALID: {len(screens)} screens, {len(steps)} steps')

if __name__ == '__main__':
    main()
