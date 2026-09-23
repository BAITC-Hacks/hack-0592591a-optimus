"""Acceptance checks for the shipped control set; no API keys or model calls."""
import json
import re
import sys


def checks(d):
    findings = d.get('findings', [])
    units = {u['unit_id']: u for u in d.get('units', [])}
    clauses = {(doc['doc_id'], c['clause_id']): (doc['side'], c) for doc in d.get('documents', []) for c in doc['clauses']}
    changes = d.get('unit_changes', [])
    label = lambda key: units.get(key, {}).get('abbr') or units.get(key, {}).get('name', '')
    created = {label(c['after']) for c in changes if c['status'] == 'created'}
    kept = {label(c['after']) for c in changes if c['status'] == 'kept'}
    reorg = any(c['status'] == 'reorganized' and 'внутренн' in units.get(c['before'], {}).get('name', '').lower() and 'аудит' in units.get(c['before'], {}).get('name', '').lower() and {'ДИТААД', 'ДОА'} <= {label(k) for k in c['successors']} for c in changes)
    normalize = lambda s: ' '.join(str(s).split())
    def valid(c):
        source = clauses.get((c.get('doc_id'), c.get('clause_id')))
        return bool(source and source[0] == c.get('side') and normalize(c.get('quote', '')) and normalize(c['quote']) in normalize(source[1]['text']))
    loss = any(f['type'] == 'POTENTIAL_LOSS' and any(c['doc_id'] == 'before_1' and c['clause_id'] == '5.6.2' and c['side'] == 'before' and c['quote'].startswith('формировать группы контроля качества') for c in f['citations']) for f in findings)
    dup = any(f['type'] == 'POTENTIAL_DUPLICATION' and {(c['doc_id'], c['side'], c['clause_id']) for c in f['citations']} == {('after_1', 'after', '5.4.3'), ('after_1', 'after', '5.5.8')} for f in findings)
    conflict = any(f['type'] == 'POTENTIAL_CONFLICT' and 'ДККМ' in f['units'] and any(c['doc_id'] == 'after_1' and c['side'] == 'after' and c['clause_id'] == '5.5.2' for c in f['citations']) for f in findings)
    md = d.get('conclusion_md', '').replace('\\_', '_')
    refs = re.findall(r'\[(до|после) · (\w+) · п\. ([^\]]+)\]', md)
    references_ok = bool(refs) and all(clauses.get((doc, clause), (None,))[0] == ('before' if side == 'до' else 'after') for side, doc, clause in refs)
    s = d.get('stats', {})
    regulatory = d.get('regulatory', [])
    return {
        'created': {'ДИТААД', 'ДОА'} <= created,
        'kept': {'ДНМ', 'ДККМ'} <= kept,
        'reorganized': reorg,
        'loss': loss, 'dup': dup, 'conflict': conflict,
        'quotes': bool(findings) and all(f['citations'] and all(valid(c) for c in f['citations']) for f in findings) and s.get('dropped_unverified') == 0,
        'unit_sources': bool(units) and all(clauses.get((u['doc_id'], u['source_clause']), (None,))[0] == u['side'] for u in units.values()),
        'counts': all(s.get(key) == sum(f['type'] == kind for f in findings) for key, kind in [('potential_loss', 'POTENTIAL_LOSS'), ('potential_duplication', 'POTENTIAL_DUPLICATION'), ('potential_conflict', 'POTENTIAL_CONFLICT'), ('overlap', 'OVERLAP'), ('moved', 'MOVED')]),
        'conclusion': s.get('conclusion') == 'verified' and references_ok and all(f['finding_id'] in md for f in findings) and 'рекомендательный характер' in md and '## Исходные документы' in md,
        'regulatory': s.get('regulatory_status') == 'ok' and s.get('regulatory_norms') == 477 and all(all(valid(c) for c in f['citations']) and f['norm'].get('quote') and (f['norm']['origin'] != 'corpus' or f['norm']['source_url'].startswith('https://adilet.zan.kz/')) for f in regulatory),
    }


if __name__ == '__main__':
    for key, passed in checks(json.load(sys.stdin)).items():
        print(key, 'ok' if passed else 'FAIL')
