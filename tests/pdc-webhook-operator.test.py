import json,pathlib,subprocess,tempfile,unittest

OPERATOR=pathlib.Path(__file__).resolve().parents[1]/'scripts/pdc-webhook-readiness/operator.py'
class ApprovalGuards(unittest.TestCase):
    def call(self,mode,directory,approved=None):
        args=['python3','-I','-B',str(OPERATOR),mode,str(directory)]
        if approved: args+=['--approved',approved]
        return subprocess.run(args,capture_output=True,text=True,timeout=5)
    def test_wrong_approval_stops_before_ssh_or_new_file(self):
        with tempfile.TemporaryDirectory() as name:
            d=pathlib.Path(name);(d/'ingress-plan.json').write_text(json.dumps({'seal':'a'*64}))
            self.assertNotEqual(self.call('apply',d,'b'*64).returncode,0)
            self.assertEqual(sorted(p.name for p in d.iterdir()),['ingress-plan.json'])
    def test_consumed_attempt_stops_before_ssh_or_new_file(self):
        with tempfile.TemporaryDirectory() as name:
            d=pathlib.Path(name);(d/'ingress-plan.json').write_text(json.dumps({'seal':'a'*64}));(d/'ingress-execution-intent.json').write_text('{}')
            self.assertNotEqual(self.call('apply',d,'a'*64).returncode,0)
            self.assertEqual(len(list(d.iterdir())),2)
    def test_changed_plan_stops_before_target_access(self):
        with tempfile.TemporaryDirectory() as name:
            d=pathlib.Path(name);(d/'ingress-plan.json').write_text(json.dumps({'seal':'a'*64,'runtime_changes':True}))
            self.assertNotEqual(self.call('check',d).returncode,0)
            self.assertEqual(sorted(p.name for p in d.iterdir()),['ingress-plan.json'])

if __name__=='__main__':unittest.main()
