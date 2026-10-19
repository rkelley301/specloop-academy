# SL07 — Troubleshoot from symptom to cause
> **DRAFT — TECHNICAL REVIEW REQUIRED.** This lesson is original educational draft content and has not been technically validated. Do not publish, sell, or use it as approved training until a qualified instrumentation and controls reviewer verifies the technical details, answer key, and safety language.

**Objective:** Use a structured evidence path to separate likely sensor, wiring, input, scaling, and display problems.

## Audio script

Good troubleshooting starts with a clear symptom. Write down what is wrong: no reading, frozen value, intermittent signal, noisy reading, or a value that is consistently offset. “The instrument is bad” is a conclusion, not a symptom.

[PAUSE 3 SECONDS]

Next, compare evidence along the signal path. Check the process condition and local indication if available. Review the transmitter output using the approved method. Compare it with the control-system input indication. Then confirm input-channel health, configured range, units, and display scaling.

[PAUSE 3 SECONDS]

Each comparison narrows the fault. If the transmitter output changes but the input value does not, investigate the path between them and the input channel. If the input value is reasonable but the display is wrong, scaling, tag selection, or display configuration becomes more likely.

[PAUSE 3 SECONDS]

Keep observations separate from hypotheses. Record the time, operating condition, observed values, and the test point. Change one thing at a time when the approved procedure allows it, and compare the result.

[PAUSE 3 SECONDS]

This is a reasoning framework, not permission to test energized equipment. Use the required permits, isolation, PPE, and qualified supervision for the actual task.

## Recall check
1. Give one example of a symptom and one example of a conclusion.
2. If the input value is reasonable but the operator display is wrong, what areas become more likely?
3. Why compare the transmitter output with the input value?

## Scenario
A transmitter’s local value changes with process conditions. The control-system input stays flat. What fault region should be investigated next, and what site documents help?

## Answer key
1. Symptom: value frozen. Conclusion: transmitter failed.
2. Input scaling, units, tag selection, or display configuration.
3. To determine whether the problem is before the input channel or inside/downstream of it.

**Scenario answer:** The signal path between the transmitter and the input channel, including field wiring and terminations, plus the input channel. Use the loop drawing, I/O records, and approved procedures.
