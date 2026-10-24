import json,pathlib,subprocess,tempfile,unittest

OPERATOR=pathlib.Path(__file__).resolve().parents[1]/'scripts/pdc-webhook-readiness/signal-operator.py'
class SignalApprovalGuards(unittest.TestCase):
    def call(self,mode,directory,approved=None):
        args=['python3','-I','-B',str(OPERATOR),mode,str(directory)]
        if approved:args+=['--approved',approved]
        return subprocess.run(args,capture_output=True,text=True,timeout=5)
    def test_wrong_approval_does_not_reach_ssh(self):
        with tempfile.TemporaryDirectory() as name:
            d=pathlib.Path(name);(d/'signal-plan.json').write_text(json.dumps({'seal':'a'*64}))
            self.assertNotEqual(self.call('apply',d,'b'*64).returncode,0);self.assertEqual(len(list(d.iterdir())),1)
    def test_consumed_signal_does_not_reach_ssh(self):
        with tempfile.TemporaryDirectory() as name:
            d=pathlib.Path(name);(d/'signal-plan.json').write_text(json.dumps({'seal':'a'*64}));(d/'signal-execution-intent.json').write_text('{}')
            self.assertNotEqual(self.call('apply',d,'a'*64).returncode,0);self.assertEqual(len(list(d.iterdir())),2)
    def test_changed_plan_does_not_reach_ssh(self):
        with tempfile.TemporaryDirectory() as name:
            d=pathlib.Path(name);(d/'signal-plan.json').write_text(json.dumps({'seal':'a'*64,'signals':2}))
            self.assertNotEqual(self.call('check',d).returncode,0);self.assertEqual(len(list(d.iterdir())),1)

if __name__=='__main__':unittest.main()
