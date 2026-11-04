"""Only edits this isolated checkout; never calls GitHub or deployment."""
from pathlib import Path
root=Path(__file__).resolve().parents[2]
(root/'.github/workflows/deploy.yml').write_text((root/'infra/production/deploy.backend-only.yml').read_text(),encoding='utf-8')
ci=root/'.github/workflows/ci.yml'
s=ci.read_text(encoding='utf-8')
start=s.index('  deploy-staging:') if '  deploy-staging:' in s else s.index('  deploy-backend:')
s=s[:start]+'''  deploy-backend:
    name: Deploy explicitly approved Main backend
    if: github.event_name == 'push' && github.ref == 'refs/heads/main' && vars.PRODUCTION_BACKEND_ENABLED == 'true' && vars.PRODUCTION_BACKEND_APPROVED_SHA == github.sha
    needs: [backend]
    uses: ./.github/workflows/deploy.yml
    secrets: inherit
'''
ci.write_text(s,encoding='utf-8')
