"""Validate the skill package, referenced resources and shared version metadata."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
VERSION = 'v1.3.3'


def main():
    errors = []
    required = ['SKILL.md', 'agents/openai.yaml', 'templates/magazine-card.html', 'scripts/check_card.mjs', 'scripts/compose_sheet.py', 'scripts/export_for_video.py', 'references/layout-skeleton.md', 'references/contact-sheet.md']
    for relative in required:
        if not (ROOT / relative).is_file():
            errors.append(f'Missing: {relative}')
    skill = (ROOT / 'SKILL.md').read_text(encoding='utf-8')
    if not skill.startswith('---\nname: text-image-notes\n'):
        errors.append('Skill identity/frontmatter mismatch')
    for relative in ['SKILL.md', 'agents/openai.yaml', 'VERSION.md', 'README.md', 'CHANGELOG.md', 'RELEASE_REPORT.md']:
        if VERSION not in (ROOT / relative).read_text(encoding='utf-8'):
            errors.append(f'Version mismatch: {relative}')
    for reference in re.findall(r'`((?:references|templates|scripts)/[\w./-]+)`', skill):
        if not (ROOT / reference).is_file():
            errors.append(f'Broken reference: {reference}')
    for path in ROOT.rglob('*'):
        # Git checkouts and local render dependencies are not release contents.
        if path.relative_to(ROOT).parts[0] in ('.git', 'node_modules', '__pycache__'):
            continue
        if any(part in ('__pycache__', 'node_modules', '.git', '__MACOSX') for part in path.parts):
            errors.append(f'Unexpected packaged path: {path}')
    if errors:
        print('\n'.join(errors))
        return 1
    print(f'VALIDATION PASSED: {ROOT.name} {VERSION}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
