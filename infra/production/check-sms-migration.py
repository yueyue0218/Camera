"""Only read the two SMS structures. Does not migrate or inspect unrelated tables."""
import argparse,json,subprocess

DATABASE='portra_staging'
EXPECTED={'challenge_id':'varchar(36)','owner_user_id':'bigint','owner_session_id':'varchar(128)',
          'operation':'varchar(32)','invalidated_at':'datetime(6)'}

def collect(query):
    return {
      'identity':query('SELECT DATABASE(),@@server_uuid,VERSION()'),
      'columns':query("SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,IFNULL(COLUMN_DEFAULT,'<NULL>') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='portra_staging' AND ((TABLE_NAME='sms_challenges' AND COLUMN_NAME IN ('challenge_id','owner_user_id','owner_session_id','operation','invalidated_at')) OR TABLE_NAME='sms_challenge_locks') ORDER BY TABLE_NAME,ORDINAL_POSITION"),
      'indexes':query("SELECT TABLE_NAME,INDEX_NAME,NON_UNIQUE,SEQ_IN_INDEX,COLUMN_NAME,INDEX_TYPE,IFNULL(SUB_PART,0) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='portra_staging' AND ((TABLE_NAME='sms_challenges' AND INDEX_NAME='uk_sms_challenge_id') OR TABLE_NAME='sms_challenge_locks') ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX"),
      'tables':query("SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA='portra_staging' AND TABLE_NAME IN ('sms_challenges','sms_challenge_locks') ORDER BY TABLE_NAME"),
      'legacyRows':query('SELECT COUNT(*) FROM portra_staging.sms_challenges')}

def validate(data,phase):
    if not data['identity'] or data['identity'][0][0]!=DATABASE:raise RuntimeError('Wrong database')
    if phase=='before':
        if data['columns'] or data['indexes'] or data['tables']!=[['sms_challenges','InnoDB']]:
            raise RuntimeError('STOP: already/partially applied or unexpected schema; never rerun blindly')
    else:
        expected=[['sms_challenges',name,typ,'YES','<NULL>'] for name,typ in EXPECTED.items()]
        expected += [['sms_challenge_locks','lock_key','varchar(64)','NO','<NULL>']]
        actual=[row[:] for row in data['columns']]
        for row in actual:
            if row[2]=='bigint(20)':row[2]='bigint'
        if sorted(actual)!=sorted(expected):raise RuntimeError('STOP: column definition differs')
        indexes=[['sms_challenges','uk_sms_challenge_id','0','1','challenge_id','BTREE','0'],
                 ['sms_challenge_locks','PRIMARY','0','1','lock_key','BTREE','0']]
        if sorted(data['indexes'])!=sorted(indexes):raise RuntimeError('STOP: index definition differs')
        if sorted(data['tables'])!=sorted([['sms_challenges','InnoDB'],['sms_challenge_locks','InnoDB']]):
            raise RuntimeError('STOP: expected InnoDB tables missing')

def main():
    p=argparse.ArgumentParser();p.add_argument('--defaults-file',required=True);p.add_argument('--phase',choices=['before','after'],required=True)
    p.add_argument('--before-report');args=p.parse_args()
    def query(sql):
        result=subprocess.run(['mysql','--defaults-file='+args.defaults_file,'--no-login-paths',
          '--database='+DATABASE,'--batch','--raw','--skip-column-names','--skip-force','--skip-reconnect','--local-infile=0','--init-command=',
          '--execute=START TRANSACTION READ ONLY; '+sql+'; COMMIT;'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,universal_newlines=True,timeout=60)
        if result.returncode:raise RuntimeError('Read-only MySQL query failed; inspect securely, do not print credentials')
        return [line.split('\t') for line in result.stdout.splitlines()]
    data=collect(query);validate(data,args.phase)
    if args.phase=='after':
        if not args.before_report:raise RuntimeError('Before report required to verify legacy row preservation')
        with open(args.before_report) as stream:before=json.load(stream)
        if data['identity']!=before['identity'] or data['legacyRows']!=before['legacyRows']:
            raise RuntimeError('STOP: database identity or legacy row count changed')
    print(json.dumps(data,indent=2))

if __name__=='__main__':main()
