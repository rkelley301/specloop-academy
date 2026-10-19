# SL05 — RTD versus thermocouple
> **DRAFT — TECHNICAL REVIEW REQUIRED.** This lesson is original educational draft content and has not been technically validated. Do not publish, sell, or use it as approved training until a qualified instrumentation and controls reviewer verifies the technical details, answer key, and safety language.

**Objective:** Describe the basic signal behavior of an RTD and thermocouple and why wiring details matter.

## Audio script

RTDs and thermocouples both measure temperature, but they produce different electrical behavior. An RTD changes electrical resistance as temperature changes. A transmitter or measurement circuit uses that resistance relationship to calculate temperature.

[PAUSE 3 SECONDS]

A thermocouple uses two dissimilar conductors joined together. A temperature difference creates a small voltage. The measurement system uses that voltage, along with reference-junction compensation, to estimate temperature.

[PAUSE 3 SECONDS]

The practical difference is that an RTD is fundamentally a resistance measurement, while a thermocouple is fundamentally a small-voltage measurement. Lead-wire arrangement, sensor type, polarity, extension wire, and input configuration matter. Exact details depend on the sensor and instrument model.

[PAUSE 3 SECONDS]

If a temperature value is noisy or implausible, compare the installed sensor type with the configured input type. Then check drawings, terminations, and approved diagnostics. Do not assume a sensor is defective just because the display is wrong; configuration and wiring can create similar symptoms.

[PAUSE 3 SECONDS]

For this lesson, remember the core distinction: RTD means changing resistance; thermocouple means a small voltage related to temperature difference. Use the manufacturer’s documentation for sensor curves, wire colors, and terminal details.

## Recall check
1. What electrical property does an RTD change with temperature?
2. What kind of signal does a thermocouple produce?
3. Name two setup details that should match the installed sensor.

## Scenario
A temperature input reads far outside the expected range immediately after a sensor replacement. What configuration and installation details should be checked before replacing the new sensor?

## Answer key
1. Resistance.
2. A small voltage based on the temperature difference at the thermocouple junctions.
3. Sensor type, lead arrangement, polarity where applicable, extension wire, or input configuration.

**Scenario answer:** Confirm sensor type and wiring arrangement against the input configuration and drawing; then follow approved diagnostic procedures and device documentation.
