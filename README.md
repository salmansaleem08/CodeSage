# CodeSage

A personalised coding education platform that adapts to how you learn. CodeSage gives learners a full programming environment with intelligent guidance built directly into the editor — so instead of switching between a problem statement, a forum, and a blank IDE, everything you need is in one focused workspace.

---

## What it does

CodeSage gives every learner a three-panel workspace: problem statement on the left, code editor in the centre, and output on the right. You load a problem, write code, and the platform guides you through it in the style that suits you best.

The platform has three distinct learning modes, each designed for a different stage of a learner's journey:

**SEED — Step-by-step teaching**
For learners who are just starting out. The platform reads the problem and builds a custom teaching plan — a structured sequence of conceptual steps that leads from understanding the problem to producing a working solution. Each step appears as ghost text in the editor, similar to how code completion works in a professional IDE. You press Tab to accept a step, write code that reflects it, and only then does the next step appear. Progress is persistent across sessions.

**FOCUS — Logic-first mentoring**
For students who know how to write code but get stuck on the reasoning. Clicking the Hint button in FOCUS mode delivers a targeted hint calibrated to your current code, any errors you have, and the depth level you have selected — from a vague conceptual nudge all the way to a near-direct explanation. The hint adapts to where you actually are in the problem, not just the problem description.

**SHADOW — Minimal intervention**
For exam practice or competitive programming preparation. The platform stays silent until you ask. Each click reveals a single nudge, the depth escalates across clicks, and the platform steps back immediately after. The goal is to replicate the feeling of solving a problem independently while having a safety net.

---

## Problem workflow

**Import any problem.** Paste problem text directly or upload a plain-text file. The platform extracts the title, description, constraints, input/output format, and examples automatically.

**Test cases included.** When you import a problem, click Auto to generate test cases that cover typical inputs, boundary values, and edge cases. Every generated test case is fully editable — you can adjust, delete, or add your own before running anything.

**Run and Submit.** The Run button executes your code against the stdin you provide and shows output immediately. The Submit button runs your code against all configured test cases and displays a detailed results panel: how many passed, which ones failed, what the expected versus actual output was, and any compile or runtime errors per case.

**Real progress tracking.** Every submission is recorded. Your dashboard reflects accurate statistics — problems solved, accuracy rate, hint usage, topic distribution, and a daily activity streak — all calculated from your actual submission history.

---

## Learning settings

The platform gives you fine-grained control over how guidance is delivered:

- **Hint depth** — a five-level slider from conceptual nudge to near-direct code. Applies to all modes.
- **Code in hints** — choose whether hints may include short code fragments or stay text-only, so you can practise writing syntax independently.
- **Hint delivery** — in SEED mode, steps can either appear automatically after a short typing pause, or only when you explicitly ask for them.

---

## Social and progress features

**Friend network.** Connect with classmates, send friend requests by email, and see their solved problem counts. A shared activity feed shows recent coding activity across your network.

**Dashboard.** Your personal analytics panel shows accuracy trend over the last seven days, topic distribution, hint usage per problem, and an insight summary derived from your submission history.

**Student profiles.** View the public profile of any connected student to see their progress.

---

## Language support

All problems can be solved in either **C++** or **Python**. Switching language resets the editor to the appropriate starter template. Both languages have dedicated runtime configurations optimised for correctness.

---

## Designed for learning, not competition

CodeSage is not a leaderboard platform. There are no arbitrary scoring formulas, no IQ metrics, no star ratings. Every number shown on the platform comes directly from what you have actually done — problems attempted, problems solved, hints used, accuracy over time. The goal is to make your learning progress legible to you, not to rank you against others.

---

## Getting started

1. Create an account and sign in.
2. Open the editor from the navigation bar.
3. Paste or upload a problem statement.
4. Choose a learning mode, adjust your settings, and start coding.
5. Use Run to test your logic and Submit to validate against all test cases.
6. Check your dashboard to see how your skills are developing over time.
