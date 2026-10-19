# SL03 — Range, zero, span, and engineering units
> **DRAFT — TECHNICAL REVIEW REQUIRED.** This lesson is original educational draft content and has not been technically validated. Do not publish, sell, or use it as approved training until a qualified instrumentation and controls reviewer verifies the technical details, answer key, and safety language.

**Objective:** Distinguish lower range value, upper range value, and span, then convert a percent-of-span reading.

## Audio script

An instrument range connects a signal to engineering units. The lower range value is the measurement represented at the low end of the output. The upper range value is the measurement represented at the high end. Span is the difference between them.

[PAUSE 3 SECONDS]

Suppose a level transmitter is ranged from 10 to 50 feet. The lower value is 10 feet. The upper value is 50 feet. Span is 40 feet. At 25 percent of span, add ten feet to one quarter of forty feet. The result is twenty feet.

[PAUSE 3 SECONDS]

Notice that zero percent of span is not always zero engineering units. In this example, zero percent corresponds to ten feet. This is why “zero” can mean different things in casual conversation. Be precise: say lower range value, upper range value, or zero percent of span.

[PAUSE 3 SECONDS]

Before troubleshooting a mismatch, compare the configured range in the instrument with the range configured in the control system. If one side expects 10 to 50 feet and the other expects 0 to 50 feet, the displayed value can be wrong even when the signal itself is stable.

[PAUSE 3 SECONDS]

Use the approved configuration record and loop documentation. Do not change range settings just to make an indication look right; record and authorize changes according to site practice.

## Recall check
1. If the range is 10 to 50 feet, what is the span?
2. What engineering value is 25% of that span?
3. Why can different ranges in the instrument and control system cause a bad display?

## Scenario
A transmitter is set for 0 to 300 gallons per minute. The control system is set for 0 to 200. The signal is at 50% of the transmitter span. What value would each configuration imply?

## Answer key
1. 40 feet.
2. 10 + (0.25 × 40) = 20 feet.
3. The same signal fraction is converted using different endpoints.

**Scenario answer:** The transmitter range implies 150 gallons per minute; the control-system scaling implies 100.
