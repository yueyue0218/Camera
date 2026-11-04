"""Local Windows MySQL fixture only: private shared memory, no TCP or existing server.

Usage: python test-integration-migration.py --mysql-bin <bin> --work-dir <new-dir>
Leaves evidence/data in the new directory; never deletes an existing directory.
"""
import argparse
import os
from pathlib import Path
import re
import subprocess
import time
import uuid


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--mysql-bin', required=True, type=Path)
    parser.add_argument('--work-dir', required=True, type=Path)
    args = parser.parse_args()
    if os.name != 'nt':
        raise SystemExit('Windows shared-memory fixture required')
    work = args.work_dir.resolve()
    work.mkdir(parents=True, exist_ok=False)
    data = work / 'data'
    name = 'portra_fixture_' + uuid.uuid4().hex
    env = dict(os.environ)
    for key in ('MYSQL_PWD', 'MYSQL_HOST', 'MYSQL_TCP_PORT', 'MYSQL_UNIX_PORT'):
        env.pop(key, None)
    env['MYSQL_TEST_LOGIN_FILE'] = str(work / 'absent-login-file')
    flags = subprocess.CREATE_NO_WINDOW
    server = str(args.mysql_bin / 'mysqld.exe')
    client = [str(args.mysql_bin / 'mysql.exe'), '--no-defaults', '--protocol=MEMORY',
              '--shared-memory-base-name=' + name, '--user=root', '--batch', '--raw',
              '--skip-column-names', '--default-character-set=utf8mb4']

    def query(sql, database=None, expected=True):
        cmd = client + (['--database=' + database] if database else [])
        result = subprocess.run(cmd, input=sql.encode('utf8'), stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, env=env, creationflags=flags, timeout=60)
        if expected and result.returncode:
            # Only local synthetic data is used; retain diagnostics in fixture directory.
            (work / 'last-error.txt').write_bytes(result.stderr)
            raise RuntimeError('fixture query failed; inspect local last-error.txt')
        return result

    with (work / 'server.log').open('wb') as log:
        subprocess.run([server, '--no-defaults', '--initialize-insecure', '--datadir=' + str(data)],
                       stdout=log, stderr=log, check=True, env=env, creationflags=flags, timeout=120)
        process = subprocess.Popen([server, '--no-defaults', '--datadir=' + str(data),
                                    '--skip-networking', '--mysqlx=OFF', '--skip-log-bin',
                                    '--shared-memory', '--shared-memory-base-name=' + name],
                                   stdout=log, stderr=log, env=env, creationflags=flags)
        try:
            for attempt in range(60):
                if query('SELECT 1;', expected=False).returncode == 0:
                    break
                if process.poll() is not None:
                    raise RuntimeError('private fixture server exited')
                time.sleep(0.5)
            else:
                raise RuntimeError('private fixture server unavailable')
            print('MYSQL_VERSION=' + query('SELECT VERSION();').stdout.decode().strip(), flush=True)
            query('CREATE DATABASE portra_integration CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;')
            db = Path(__file__).resolve().parents[1] / 'src/main/resources/db'
            readme = (db / 'README_EXECUTION_ORDER.md').read_text(encoding='utf8')
            section = readme.split('## 路径 A：')[1].split('## 路径 B：')[0]
            scripts = re.findall(r'^\| \d+ \| `([^`]+)`', section, re.M)
            scripts += ['migration/add_privacy_rights_and_consent.sql',
                        'migration/add_demand_interest_targets.sql', 'migration/add_report_result_feedback.sql']
            for script in scripts:
                query((db / script).read_text(encoding='utf8'), 'portra_integration')
            tables = lambda: query("SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema='portra_integration' AND table_type='BASE TABLE' ORDER BY TABLE_NAME;").stdout.decode().splitlines()
            before = tables()
            assert len(before) == 43, len(before)
            (work / 'tables-before.txt').write_text('\n'.join(before), encoding='utf8')
            # Canary proves existing records survive additive migration; entirely synthetic.
            query("INSERT INTO users (id,nickname,current_role,status) VALUES (900001,'migration-fixture','CUSTOMER','ACTIVE');", 'portra_integration')
            migration = (db / 'migration/V20261103__sms_challenge_binding.sql').read_text(encoding='utf8')
            query(migration, 'portra_integration')
            after = tables()
            assert len(after) == 44 and set(after) - set(before) == {'sms_challenge_locks'}
            assert query("SELECT nickname FROM users WHERE id=900001;", 'portra_integration').stdout.strip() == b'migration-fixture'
            shape = query("SELECT COLUMN_NAME,IS_NULLABLE FROM information_schema.columns WHERE table_schema='portra_integration' AND table_name='sms_challenges' AND column_name IN ('challenge_id','owner_user_id','owner_session_id','operation','invalidated_at');").stdout.decode().splitlines()
            assert len(shape) == 5 and all(row.endswith('\tYES') for row in shape)
            assert query("SELECT NON_UNIQUE,COLUMN_NAME FROM information_schema.statistics WHERE table_schema='portra_integration' AND table_name='sms_challenges' AND index_name='uk_sms_challenge_id';").stdout.strip() == b'0\tchallenge_id'
            query("INSERT INTO sms_challenge_locks VALUES ('fixture-lock');", 'portra_integration')
            assert query("INSERT INTO sms_challenge_locks VALUES ('fixture-lock');", 'portra_integration', False).returncode != 0
            assert query(migration, 'portra_integration', False).returncode != 0
            assert tables() == after
            assert query("SELECT nickname FROM users WHERE id=900001;", 'portra_integration').stdout.strip() == b'migration-fixture'
            # Duplicate application is expected to fail, not an idempotence claim.
            print('PASS: fresh 43-table baseline; additive 44-table result; existing row retained; five nullable columns; unique index; lock uniqueness; repeat rejected without losing fixture', flush=True)
        finally:
            try:
                query('SHUTDOWN;', expected=False)
                process.wait(timeout=15)
            finally:
                if process.poll() is None:
                    process.terminate()
                    process.wait(timeout=15)
            print('PRIVATE_FIXTURE_STOPPED', flush=True)


if __name__ == '__main__':
    main()
