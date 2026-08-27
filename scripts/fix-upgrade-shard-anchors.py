from pathlib import Path

p = Path('src/app/upgrade/page.tsx')
s = p.read_text()

old = '''    top: "50%",
    width: "min(100%, 180px)",'''
new = '''    top: "calc(50% - 34px)",
    width: "min(100%, 180px)",'''
if old not in s:
    raise SystemExit('shard pack anchor block not found')
s = s.replace(old, new, 1)

old = '''        0%{left:calc(100% + 50%);top:50%}
        100%{left:50%;top:50%}'''
new = '''        0%{left:calc(288.888% + 16px);top:calc(50% - 34px)}
        100%{left:50%;top:calc(50% - 34px)}'''
if old not in s:
    raise SystemExit('gather travel keyframes not found')
s = s.replace(old, new, 1)

p.write_text(s)
print('exact left-slot anchor corrected')
