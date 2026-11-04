"""Only test the new production-qualified SMS delta, in private Windows shared-memory MySQL."""
import argparse,importlib.util,json,os,re,subprocess,time,uuid
from pathlib import Path

def main():
    p=argparse.ArgumentParser();p.add_argument('--mysql-bin',required=True,type=Path);p.add_argument('--work-dir',required=True,type=Path);a=p.parse_args()
    if os.name!='nt':raise RuntimeError('Private Windows shared-memory fixture required')
    work=a.work_dir.resolve();work.mkdir(parents=True,exist_ok=False)
    fixture='portra_sms_delta_'+uuid.uuid4().hex
    env=dict(os.environ)
    for key in ('MYSQL_PWD','MYSQL_HOST','MYSQL_TCP_PORT','MYSQL_UNIX_PORT'):env.pop(key,None)
    env['MYSQL_TEST_LOGIN_FILE']=str(work/'no-login-file')
    flags=subprocess.CREATE_NO_WINDOW
    cli=[str(a.mysql_bin/'mysql.exe'),'--no-defaults','--protocol=MEMORY','--shared-memory-base-name='+fixture,'--user=root','--batch','--raw','--skip-column-names']
    def query(sql,ok=True):
        r=subprocess.run(cli,input=sql.encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env,creationflags=flags,timeout=30)
        if ok and r.returncode:raise RuntimeError(r.stderr.decode(errors='replace'))
        return r
    here=Path(__file__).resolve().parent;root=here.parents[1]
    original=root/'backend/src/main/resources/db/migration/V20261103__sms_challenge_binding.sql'
    sql=(here/'sms-challenge-portra-staging.sql').read_text()
    statements=lambda s:re.sub(r'\s+',' ',re.sub(r'--[^\n]*','',s)).strip()
    assert statements(sql)==statements(original.read_text().replace('portra_integration','portra_staging'))
    passed=['DDL identical to validated migration except database qualifier']
    spec=importlib.util.spec_from_file_location('gate',here/'check-sms-migration.py');gate=importlib.util.module_from_spec(spec);spec.loader.exec_module(gate)
    with (work/'server.log').open('wb') as log:
        subprocess.run([str(a.mysql_bin/'mysqld.exe'),'--no-defaults','--initialize-insecure','--datadir='+str(work/'data')],stdout=log,stderr=log,env=env,creationflags=flags,check=True,timeout=120)
        server=subprocess.Popen([str(a.mysql_bin/'mysqld.exe'),'--no-defaults','--datadir='+str(work/'data'),'--skip-networking','--mysqlx=OFF','--skip-log-bin','--shared-memory','--shared-memory-base-name='+fixture],stdout=log,stderr=log,env=env,creationflags=flags)
        try:
            for _ in range(60):
                if query('SELECT 1',False).returncode==0:break
                if server.poll() is not None:raise RuntimeError('Fixture failed to start')
                time.sleep(.5)
            else:raise RuntimeError('Fixture startup timeout')
            query('CREATE DATABASE portra_staging CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;')
            baseline=(root/'backend/src/main/resources/db/migration/add_phone_auth_sessions.sql').read_text()
            create=re.search(r'CREATE TABLE IF NOT EXISTS sms_challenges \(.*?;',baseline,re.S).group()
            query('USE portra_staging;'+create)
            insert="INSERT INTO portra_staging.sms_challenges(phone_hash,purpose,code_hash,expires_at) VALUES(REPEAT('a',64),'LOGIN','fixture-hash',NOW(6));"
            query(insert)
            def rows(s):return [line.split('\t') for line in query('USE portra_staging;'+s).stdout.decode().splitlines()]
            before=gate.collect(rows);gate.validate(before,'before');passed.append('fresh absent-delta preflight passes')
            query(sql);after=gate.collect(rows);gate.validate(after,'after');passed.append('nullable/default/length/InnoDB/complete unique indexes match')
            assert before['legacyRows']==after['legacyRows']
            assert rows('SELECT COUNT(*) FROM sms_challenges WHERE challenge_id IS NULL AND owner_user_id IS NULL AND owner_session_id IS NULL AND operation IS NULL AND invalidated_at IS NULL AND code_hash=\'fixture-hash\'')==[['1']]
            passed.append('legacy row and NULL challenge binding preserved')
            try:gate.validate(after,'before')
            except RuntimeError:passed.append('already-applied preflight stops')
            else:raise AssertionError('repeat preflight incorrectly passed')
            assert query(sql,False).returncode!=0;passed.append('repeat DDL fails instead of hiding partial migration')
            query("INSERT INTO portra_staging.sms_challenge_locks VALUES ('lock-test');")
            assert query("INSERT INTO portra_staging.sms_challenge_locks VALUES ('lock-test');",False).returncode!=0
            passed.append('lock primary key rejects duplicates')
            query(insert)
            query("UPDATE portra_staging.sms_challenges SET challenge_id='12345678-1234-1234-1234-123456789abc' WHERE id=2;")
            assert query("UPDATE portra_staging.sms_challenges SET challenge_id='12345678-1234-1234-1234-123456789abc' WHERE id=1;",False).returncode!=0
            passed.append('challenge unique index rejects duplicate non-NULL values')
            partial=dict(after);partial['columns']=after['columns'][:-1]
            try:gate.validate(partial,'after')
            except RuntimeError:passed.append('partial column metadata fails verification')
            else:raise AssertionError('partial schema passed')
            result={'mysqlVersion':rows('SELECT VERSION()')[0][0],'passed':passed,'failed':0,'productionTouched':False}
            (work/'result.json').write_text(json.dumps(result,indent=2)+'\n')
            print(json.dumps(result,indent=2))
        finally:
            server.terminate()
            try:server.wait(timeout=30)
            except subprocess.TimeoutExpired:server.kill();server.wait()

if __name__=='__main__':main()
