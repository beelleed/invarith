import {createHash} from 'node:crypto';
import {AppError,validateSubmission} from './verification.mjs';
import {validateCustomCases} from './practice-custom-tests.mjs';
export function exportCustomTests(session,body,now=()=>Date.now()){
  const group=session.customTests,run=group?.lastRun;
  if(!run||body.revision!==group.revision||body.runId!==run.id||body.code!==run.code||run.functionName!==session.functionName||run.revision!==group.revision)throw new AppError(409,'Run your saved custom tests on this code before exporting them.');
  const cases=validateCustomCases(group.cases);validateSubmission({code:run.code,functionName:session.functionName,cases});
  const filename='invarith-custom-tests-'+session.id.slice(0,8)+'.py';
  const snapshot={format:'invarith-runnable-custom-tests',version:1,practiceId:session.id,title:session.title,contract:session.contract,functionName:session.functionName,code:run.code,codeSha256:createHash('sha256').update(run.code).digest('hex'),cases,sourceRunId:run.id,sourceRunCreatedAt:run.createdAt,savedResults:run.results,exportedAt:new Date(now()).toISOString(),scope:'learner_cases',expectationSource:'learner'};
  // Embed data as an escaped string, never as executable Python expressions.
  const payload=JSON.stringify(JSON.stringify(snapshot));
  const source=`# Invarith: reproducible custom tests. Python 3.12; standard library only.
# Run: python ${filename}
# This file executes saved source code. Use an isolated Python environment.
# Expectations were supplied by the learner, not an independent correctness oracle.
# This replay does not reproduce Invarith's execution limits or trace capture.
import contextlib
import copy
import io
import json
import unittest

SNAPSHOT = json.loads(${payload})

def same_json(actual, expected):
    if type(actual) is not type(expected):
        if type(actual) not in (int, float) or type(expected) not in (int, float):
            return False
    if isinstance(actual, dict):
        return actual.keys() == expected.keys() and all(same_json(actual[key], expected[key]) for key in actual)
    if isinstance(actual, list):
        return len(actual) == len(expected) and all(same_json(a, b) for a, b in zip(actual, expected))
    return actual == expected

class SavedCustomTests(unittest.TestCase):
    pass

def make_test(case):
    def test(self):
        # Each case gets fresh globals and arguments, as in the original runner.
        namespace = {"__name__": "submission"}
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            exec(compile(SNAPSHOT["code"], "submission.py", "exec"), namespace)
            function = namespace.get(SNAPSHOT["functionName"])
            if not callable(function):
                raise ValueError("Callable function not found: " + SNAPSHOT["functionName"])
            actual = function(*copy.deepcopy(case["args"]), **copy.deepcopy(case["kwargs"]))
            actual = json.loads(json.dumps(actual, allow_nan=False))
        self.assertTrue(same_json(actual, case["expected"]),
                        msg="Expected " + repr(case["expected"]) + "; actual " + repr(actual))
    test.__doc__ = case["label"] or "Learner custom case"
    return test

for index, case in enumerate(SNAPSHOT["cases"], start=1):
    setattr(SavedCustomTests, "test_case_%02d" % index, make_test(case))

if __name__ == "__main__":
    unittest.main(verbosity=2)

# Readable copy of the exact saved source (the data snapshot above is executed):
${run.code.split(/\r\n|\r|\n/).map(line=>'# | '+line).join('\n')}
`;
  return {filename,source,caseCount:cases.length,sourceRunId:run.id,scope:'learner_cases',expectationSource:'learner'};
}
