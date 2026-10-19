# SL08 — Control valve position and feedback
> **DRAFT — TECHNICAL REVIEW REQUIRED.** This lesson is original educational draft content and has not been technically validated. Do not publish, sell, or use it as approved training until a qualified instrumentation and controls reviewer verifies the technical details, answer key, and safety language.

**Objective:** Distinguish a controller command from actual valve position and recognize why they can differ.

## Audio script

A control valve changes flow or pressure by moving a mechanical element in response to a control demand. The control system sends a command to the valve assembly. A positioner may compare that command with feedback about actual stem or shaft position and drive the actuator to reduce the difference.

[PAUSE 3 SECONDS]

Command and position are not the same fact. A command can change while the valve is stuck. The valve may move while the feedback signal is faulty. A display might show demand, feedback, or both, so confirm which tag you are viewing.

[PAUSE 3 SECONDS]

If command and feedback disagree, possible areas include the signal path, positioner configuration, actuator supply, mechanical friction, linkage, or feedback setup. These are possibilities to investigate, not diagnoses. Actual valve design and safe test methods vary.

[PAUSE 3 SECONDS]

A useful first question is: what changed, and what did not? Compare demand, indicated position, process response, and any available diagnostics under the approved procedure. Do not force a valve or defeat an interlock to prove a theory.

[PAUSE 3 SECONDS]

Remember: controller command is the requested action. Position feedback is evidence of motion or position. Process response tells you what the system did. Those three views help separate control demand, valve movement, and process behavior.

## Recall check
1. What is the difference between command and position feedback?
2. Name two broad fault areas that could cause them to disagree.
3. Why should you confirm which tag the display shows?

## Scenario
The command rises, but feedback remains steady and the process flow does not change. Name three categories of evidence to compare before assigning a cause.

## Answer key
1. Command is the requested action; feedback reports sensed valve position.
2. Signal/configuration, actuator supply, mechanical/linkage, or feedback fault.
3. A display may show demand, feedback, or another derived value.

**Scenario answer:** Compare command, position feedback, and process response; then use device diagnostics and approved checks for signal, actuator, and mechanical condition.
