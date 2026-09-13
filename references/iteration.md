# Verified iteration protocol

The owner requested continual improvement after each conversion. This is a per-task workflow, not a background scheduler or permission to modify unrelated tools/repositories.

1. Compare the completed run with `lessons.json`. Identify a new reproducible issue, corrected assumption or reusable improvement. Keep hypotheses and raw diagnostics in the local task output.
2. Record what happened, the model/feature scope, the narrow fix, actual verification and remaining limitations. Strip machine paths, credentials, model assets and copied third-party instructions. Preserve source license text with the model instead of promoting it to skill policy.
3. Fix the appropriate shared script or reference. Do not add character-name branches to the converter. Generalize only as far as the evidence supports; known model-specific behavior belongs in a scoped lesson or local profile.
4. Add an observable regression test when shared code changes. Use synthetic data when possible. For Blender/rendering behavior that needs licensed assets, describe the local replay and its outcome without committing those assets. Re-run affected checks and `npm test`; validate SKILL.md metadata when it changes.
5. Write a verified JSON entry through `scripts/record_lesson.mjs --entry /local/lesson.json`. Reusing an identical id/content is a no-op; a changed existing lesson requires `--replace` after reviewing the old entry. Update concise entrypoint guidance only if the lesson changes future routing/decisions.
6. Inspect the scoped Git diff and staged filenames. In the owner-authorized maintenance repository, confirm the origin is the intended private repository, commit the verified skill changes, push, and verify the remote commit plus private visibility. Do not force-push or alter other repositories. When sync is not authorized or unavailable, keep the verified local improvement and state that remote sync remains outstanding.
7. In the task delivery, state whether the skill changed, summarize the new learning, and provide the synced commit when applicable. If no reusable new evidence appeared, say no skill update was needed only when useful; never create empty update commits.

## Entry shape

An entry has `id` (stable lowercase hyphenated key), `status: "verified"`, `date`, `scope`, `observation`, `resolution`, `evidence` (nonempty array of observed results), `regression` (automated command or meaningful manual replay), and `limitations`. The recorder validates completeness and obvious machine paths; it cannot establish truth. The agent must actually perform the cited verification before recording it.

The Git history preserves revisions to scripts and lessons. Corrections should narrow or replace inaccurate guidance, rather than endlessly appending contradictory rules.
