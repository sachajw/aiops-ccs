import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const reviewOutput = await import('../../../../scripts/github/normalize-ai-review-output.mjs');
const { marked } = await import('marked');

function withTempDir(prefix: string, run: (tempDir: string) => void) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  try {
    run(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

describe('normalize-ai-review-output', () => {
  test('renders validated structured output into stable markdown', () => {
    const validation = reviewOutput.normalizeStructuredOutput(
      JSON.stringify({
        summary: 'The PR is mostly correct, but one blocking regression remains.',
        findings: [
          {
            severity: 'high',
            title: 'Ambiguous account lookup drops valid matches',
            file: 'src/cliproxy/accounts/query.ts',
            line: 61,
            what: 'Exact email matches can return null when duplicate accounts exist.',
            why: 'That breaks normal selection flows for users with multiple Codex sessions.',
            fix: 'Match by stable account identity first and keep ambiguous email lookups out of exact-match paths.',
          },
        ],
        securityChecklist: [
          {
            check: 'Injection safety',
            status: 'pass',
            notes: 'No user-controlled input reaches a shell, SQL, or HTML boundary in this diff.',
          },
        ],
        ccsCompliance: [
          {
            rule: 'No emojis in CLI',
            status: 'na',
            notes: 'This change affects GitHub PR comments only, not CLI stdout.',
          },
        ],
        informational: ['The renderer still escapes markdown before publishing comment content.'],
        strengths: ['The formatter owns the output shape instead of trusting the model to author markdown.'],
        overallAssessment: 'changes_requested',
        overallRationale: 'The blocking lookup regression should be fixed before merge.',
      })
    );

    expect(validation.ok).toBe(true);
    const markdown = reviewOutput.renderStructuredReview(validation.value, { model: 'glm-5-turbo' });

    expect(markdown).toContain('### Verdict');
    expect(markdown).toContain('### Top Findings');
    expect(markdown).toContain('- 🔴 High `src/cliproxy/accounts/query.ts:61` — Ambiguous account lookup drops valid matches');
    expect(markdown).toContain('### Detailed Findings (1)');
    expect(markdown).toContain('#### 1. Ambiguous account lookup drops valid matches');
    expect(markdown).toContain('- Location: `src/cliproxy/accounts/query.ts:61`');
    expect(markdown).toContain('### Security Checklist (1)');
    expect(markdown).toContain('| Injection safety | ✅ | No user-controlled input reaches a shell, SQL, or HTML boundary in this diff. |');
    expect(markdown).toContain('### CCS Compliance (1)');
    expect(markdown).toContain('| No emojis in CLI | N/A | This change affects GitHub PR comments only, not CLI stdout. |');
    expect(markdown).toContain('### Informational (1)');
    expect(markdown).toContain("### What's Done Well (1)");
    expect(markdown).toContain('**❌ CHANGES REQUESTED**');
    expect(markdown).toContain('Impact: That breaks normal selection flows for users with multiple Codex sessions.');
    expect(markdown).toContain('> 🤖 Reviewed by `glm-5-turbo`');
  });

  test('renders mode-aware review context metadata without changing the structured review contract', () => {
    const validation = reviewOutput.normalizeStructuredOutput(
      JSON.stringify({
        summary: 'The large diff review stayed focused on the riskiest hotspots.',
        findings: [],
        securityChecklist: [
          {
            check: 'Workflow safety',
            status: 'pass',
            notes: 'The review stayed read-only and did not invoke write-capable tools.',
          },
        ],
        ccsCompliance: [
          {
            rule: 'Plain structured output',
            status: 'pass',
            notes: 'The assistant returned data fields only, without layout markdown.',
          },
        ],
        informational: [],
        strengths: [],
        overallAssessment: 'approved_with_notes',
        overallRationale: 'The review stayed bounded and did not surface blocking regressions.',
      })
    );

    expect(validation.ok).toBe(true);
    const markdown = reviewOutput.renderStructuredReview(validation.value, {
      model: 'glm-5-turbo',
      rendering: {
        mode: 'triage',
        selectedFiles: 8,
        reviewableFiles: 34,
        selectedChanges: 620,
        reviewableChanges: 2140,
        packetIncludedFiles: 6,
        packetTotalFiles: 8,
        packetOmittedFiles: 2,
        maxTurns: 6,
        timeoutMinutes: 5,
      },
    });

    expect(markdown).toContain(
      '> 🧭 `triage` • 8/34 files • 620/2140 lines • packet 6/8 • 6 turns / 5 minutes'
    );
    expect(markdown).toContain('**⚠️ APPROVED WITH NOTES**');
  });

  test('auto-formats code-like tokens while keeping markdown structure renderer-owned', () => {
    const validation = reviewOutput.normalizeStructuredOutput(
      JSON.stringify({
        summary:
          'buildReviewScope(files, mode) now feeds .github/workflows/ai-review.yml through workflow_dispatch with AI_REVIEW_PACKET_FILE and --max-turns coverage.',
        findings: [
          {
            severity: 'medium',
            title: 'pull_request_target fallback still references old_marker_path',
            file: '.github/workflows/ai-review.yml',
            line: 181,
            what: 'The workflow_dispatch smoke test still leaves old_marker_path in one branch.',
            why: 'That makes pull_request_target reruns harder to reason about for maintainers.',
            fix: 'Rename old_marker_path and keep workflow_dispatch aligned with AI_REVIEW_PACKET_FILE.',
          },
        ],
        securityChecklist: [
          {
            check: 'workflow_dispatch safety',
            status: 'pass',
            notes: 'workflow_dispatch stays scoped to .github/workflows/ai-review.yml only.',
          },
        ],
        ccsCompliance: [
          {
            rule: 'Renderer-owned markdown',
            status: 'pass',
            notes: 'The normalizer still owns headings, tables, and code fences.',
          },
        ],
        informational: ['Use --max-turns only for legacy fallbacks.'],
        strengths: ['AI_REVIEW_PACKET_FILE now renders as code.'],
        overallAssessment: 'approved_with_notes',
        overallRationale:
          'The renderer can format buildReviewScope(files, mode) and .github/workflows/ai-review.yml safely.',
      })
    );

    expect(validation.ok).toBe(true);
    const markdown = reviewOutput.renderStructuredReview(validation.value, { model: 'glm-5-turbo' });

    expect(markdown).toContain('`buildReviewScope(files, mode)`');
    expect(markdown).toContain('`.github/workflows/ai-review.yml`');
    expect(markdown).toContain('`workflow_dispatch`');
    expect(markdown).toContain('`AI_REVIEW_PACKET_FILE`');
    expect(markdown).toContain('`--max-turns`');
    expect(markdown).toContain('`pull_request_target`');
    expect(markdown).toContain('`old_marker_path`');
  });

  test('renders finding snippets as renderer-owned fenced code blocks', () => {
    const validation = reviewOutput.normalizeStructuredOutput(
      JSON.stringify({
        summary: 'One workflow branch still uses the stale marker path.',
        findings: [
          {
            severity: 'medium',
            title: 'Fallback branch still writes the stale marker file',
            file: '.github/workflows/ai-review.yml',
            line: 181,
            what: 'One branch still writes the old marker file path.',
            why: 'That can leave duplicate bot comments on reruns for the same PR SHA.',
            fix: 'Keep the rerun marker keyed to PR plus head SHA in every publish branch.',
            snippets: [
              {
                label: 'Current publish branch',
                language: 'bash',
                code: 'marker_file=\"$RUNNER_TEMP/.ai-review-marker\"\nprintf \"%s\\n\" \"$REVIEW_MARKER\" > \"$marker_file\"',
              },
            ],
          },
        ],
        securityChecklist: [{ check: 'Workflow safety', status: 'pass', notes: 'Covered.' }],
        ccsCompliance: [{ rule: 'Renderer-owned markdown', status: 'pass', notes: 'Covered.' }],
        informational: [],
        strengths: [],
        overallAssessment: 'approved_with_notes',
        overallRationale: 'This is a deterministic formatting-only follow-up.',
      })
    );

    expect(validation.ok).toBe(true);
    const markdown = reviewOutput.renderStructuredReview(validation.value, { model: 'glm-5-turbo' });

    expect(markdown).toContain('Evidence: Current publish branch');
    expect(markdown).toContain('```bash');
    expect(markdown).toContain('marker_file="$RUNNER_TEMP/.ai-review-marker"');
    expect(markdown).toContain('printf "%s\\n" "$REVIEW_MARKER" > "$marker_file"');
    expect(markdown).toContain('```');
  });

  test('renders finding evidence as a standalone block after the fix bullet in markdown', async () => {
    const validation = reviewOutput.normalizeStructuredOutput(
      JSON.stringify({
        summary: 'One non-blocking follow-up remains.',
        findings: [
          {
            severity: 'low',
            title: 'Marker write path still has one stale branch',
            file: '.github/workflows/ai-review.yml',
            line: 181,
            what: 'One branch still writes the stale marker file path.',
            why: 'That can make rerun behavior harder to reason about.',
            fix: 'Keep every publish branch aligned on the PR plus SHA marker.',
            snippets: [
              {
                label: 'Current branch body',
                language: 'bash',
                code: 'marker_file="$RUNNER_TEMP/.ai-review-marker"\nprintf "%s\\n" "$REVIEW_MARKER" > "$marker_file"',
              },
            ],
          },
        ],
        securityChecklist: [{ check: 'Injection safety', status: 'pass', notes: 'Covered.' }],
        ccsCompliance: [{ rule: 'Renderer-owned markdown', status: 'pass', notes: 'Covered.' }],
        informational: [],
        strengths: [],
        overallAssessment: 'approved_with_notes',
        overallRationale: 'The remaining change is formatter polish only.',
      })
    );

    expect(validation.ok).toBe(true);
    const markdown = reviewOutput.renderStructuredReview(validation.value, { model: 'glm-5-turbo' });
    const html = await marked.parse(markdown);

    expect(html).toContain('<li>Fix: Keep every publish branch aligned on the PR plus SHA marker.</li>');
    expect(html).toContain('<p>Evidence: Current branch body</p>');
    expect(html).toContain('<pre><code class="language-bash">');
    expect(html).not.toContain('Fix: Keep every publish branch aligned on the PR plus SHA marker.\nEvidence:');
  });

  test('preserves leading indentation inside literal finding snippets', () => {
    const validation = reviewOutput.normalizeStructuredOutput(
      JSON.stringify({
        summary: 'Indented snippets must stay literal.',
        findings: [
          {
            severity: 'low',
            title: 'Indentation-sensitive example',
            file: 'examples/sample.py',
            line: 7,
            what: 'The snippet must preserve its leading spaces.',
            why: 'Python, YAML, and shell examples break when the renderer trims indentation.',
            fix: 'Normalize newlines without trimming leading spaces from the first line.',
            snippets: [
              {
                language: 'python',
                code: '    if value:\n        print(value)',
              },
            ],
          },
        ],
        securityChecklist: [{ check: 'Injection safety', status: 'pass', notes: 'Covered.' }],
        ccsCompliance: [{ rule: 'Renderer-owned markdown', status: 'pass', notes: 'Covered.' }],
        informational: [],
        strengths: [],
        overallAssessment: 'approved_with_notes',
        overallRationale: 'This keeps literal evidence stable.',
      })
    );

    expect(validation.ok).toBe(true);
    expect(validation.value.findings[0].snippets[0].code).toBe('    if value:\n        print(value)');

    const markdown = reviewOutput.renderStructuredReview(validation.value, { model: 'glm-5-turbo' });
    expect(markdown).toContain('    if value:');
    expect(markdown).toContain('        print(value)');
  });

  test('normalizes optional rendering metadata when present in structured output', () => {
    const validation = reviewOutput.normalizeStructuredOutput(
      JSON.stringify({
        summary: 'The maintainer review inspected surrounding code paths before approving.',
        findings: [],
        securityChecklist: [{ check: 'Injection safety', status: 'pass', notes: 'Covered.' }],
        ccsCompliance: [{ rule: 'ASCII-only CLI output', status: 'pass', notes: 'Unaffected.' }],
        informational: [],
        strengths: [],
        overallAssessment: 'approved',
        overallRationale: 'No confirmed regressions remain.',
        rendering: {
          mode: 'deep',
          maxTurns: 40,
          timeoutSeconds: 120,
          ignored: 'value',
        },
      })
    );

    expect(validation.ok).toBe(true);
    expect(validation.value.rendering).toEqual({
      mode: 'deep',
      maxTurns: 40,
      timeoutSeconds: 120,
    });
  });

  test('writes a safe incomplete comment with mode and runtime context instead of leaking raw assistant text', () => {
    withTempDir('ai-review-', (tempDir) => {
      const executionFile = path.join(tempDir, 'claude-execution-output.json');
      const manifestFile = path.join(tempDir, 'selected-files.txt');
      const outputFile = path.join(tempDir, 'pr_review.md');

      fs.writeFileSync(
        executionFile,
        JSON.stringify([
          { type: 'system', subtype: 'init', tools: ['Bash', 'Edit', 'Read'] },
          {
            type: 'result',
            subtype: 'success',
            num_turns: 25,
            result: 'Now let me verify the findings before I finalize the review...',
          },
        ])
      );
      fs.writeFileSync(
        manifestFile,
        ['.github/workflows/ai-review.yml', 'scripts/github/prepare-ai-review-scope.mjs', 'src/ccs.ts'].join('\n')
      );

      const result = reviewOutput.writeReviewFromEnv({
        AI_REVIEW_EXECUTION_FILE: executionFile,
        AI_REVIEW_MODEL: 'glm-5-turbo',
        AI_REVIEW_MODE: 'triage',
        AI_REVIEW_SELECTED_FILES: '10',
        AI_REVIEW_REVIEWABLE_FILES: '46',
        AI_REVIEW_SELECTED_CHANGES: '700',
        AI_REVIEW_REVIEWABLE_CHANGES: '2310',
        AI_REVIEW_PACKET_INCLUDED_FILES: '7',
        AI_REVIEW_PACKET_TOTAL_FILES: '10',
        AI_REVIEW_PACKET_OMITTED_FILES: '3',
        AI_REVIEW_MAX_TURNS: '25',
        AI_REVIEW_TIMEOUT_MINUTES: '5',
        AI_REVIEW_OUTPUT_FILE: outputFile,
        AI_REVIEW_RUN_URL: 'https://github.com/kaitranntt/ccs/actions/runs/23758377592',
        AI_REVIEW_SCOPE_MANIFEST_FILE: manifestFile,
        AI_REVIEW_STRUCTURED_OUTPUT: '',
      });

      expect(result.usedFallback).toBe(true);

      const markdown = fs.readFileSync(outputFile, 'utf8');
      expect(markdown).toContain('### ⚠️ AI Review Incomplete');
      expect(markdown).toContain(
        'The `triage` review reached its 25-turn runtime budget before it produced validated structured output.'
      );
      expect(markdown).toContain('- Review mode: `triage` (expanded packaged review with broader coverage)');
      expect(markdown).toContain('- Review scope: 10/46 reviewable files; 700/2310 reviewable changed lines');
      expect(markdown).toContain(
        '- Packet coverage: 7/10 selected files included in the final review packet; 3 selected files omitted for packet budget'
      );
      expect(markdown).toContain('- Runtime budget: 25 turns / 5 minutes');
      expect(markdown).toContain(
        '- Hotspot files in this pass: `.github/workflows/ai-review.yml`, `scripts/github/prepare-ai-review-scope.mjs`, `src/ccs.ts`'
      );
      expect(markdown).toContain('- Remaining reviewable scope not fully covered: 39 files');
      expect(markdown).toContain('- Manual follow-up: Focus manual review on the selected files above');
      expect(markdown).toContain('Runtime tools: `Bash`, `Edit`, `Read`');
      expect(markdown).toContain('Turns used: 25');
      expect(markdown).not.toContain('Now let me verify the findings');
    });
  });

  test('uses a timeout-safe fallback message when the bounded review hits the workflow cap', () => {
    withTempDir('ai-review-', (tempDir) => {
      const executionFile = path.join(tempDir, 'claude-execution-output.json');
      const manifestFile = path.join(tempDir, 'selected-files.txt');
      const outputFile = path.join(tempDir, 'pr_review.md');

      fs.writeFileSync(
        executionFile,
        JSON.stringify([
          { type: 'system', subtype: 'init', tools: ['Read'] },
          {
            type: 'result',
            subtype: 'success',
            num_turns: 7,
            result: 'Partial draft that should never reach the published markdown.',
          },
        ])
      );
      fs.writeFileSync(manifestFile, ['src/commands/help-command.ts', 'src/ccs.ts'].join('\n'));

      const result = reviewOutput.writeReviewFromEnv({
        AI_REVIEW_EXECUTION_FILE: executionFile,
        AI_REVIEW_MODEL: 'glm-5-turbo',
        AI_REVIEW_MODE: 'fast',
        AI_REVIEW_SELECTED_FILES: '6',
        AI_REVIEW_REVIEWABLE_FILES: '52',
        AI_REVIEW_SELECTED_CHANGES: '640',
        AI_REVIEW_REVIEWABLE_CHANGES: '2480',
        AI_REVIEW_PACKET_INCLUDED_FILES: '5',
        AI_REVIEW_PACKET_TOTAL_FILES: '6',
        AI_REVIEW_PACKET_OMITTED_FILES: '1',
        AI_REVIEW_MAX_TURNS: '5',
        AI_REVIEW_TIMEOUT_MINUTES: '5',
        AI_REVIEW_STATUS: 'cancelled',
        AI_REVIEW_OUTPUT_FILE: outputFile,
        AI_REVIEW_RUN_URL: 'https://github.com/kaitranntt/ccs/actions/runs/23758377592',
        AI_REVIEW_SCOPE_MANIFEST_FILE: manifestFile,
        AI_REVIEW_STRUCTURED_OUTPUT: '',
      });

      expect(result.usedFallback).toBe(true);

      const markdown = fs.readFileSync(outputFile, 'utf8');
      expect(markdown).toContain(
        'The `fast` review hit the workflow runtime cap before it produced validated structured output. The run stayed bounded to 5 minutes.'
      );
      expect(markdown).toContain('- Review mode: `fast` (selected-file packaged review)');
      expect(markdown).toContain('- Review scope: 6/52 reviewable files; 640/2480 reviewable changed lines');
      expect(markdown).toContain(
        '- Packet coverage: 5/6 selected files included in the final review packet; 1 selected file omitted for packet budget'
      );
      expect(markdown).toContain('- Runtime budget: 5 turns / 5 minutes');
      expect(markdown).toContain(
        '- Hotspot files in this pass: `src/commands/help-command.ts`, `src/ccs.ts`'
      );
      expect(markdown).toContain('- Remaining reviewable scope not fully covered: 47 files');
      expect(markdown).not.toContain('Partial draft that should never reach the published markdown.');
    });
  });

  test('escapes markdown-looking content and ignores malformed execution metadata', () => {
    withTempDir('ai-review-', (tempDir) => {
      const executionFile = path.join(tempDir, 'claude-execution-output.json');
      const outputFile = path.join(tempDir, 'pr_review.md');

      fs.writeFileSync(executionFile, '{not valid json');

      const result = reviewOutput.writeReviewFromEnv({
        AI_REVIEW_EXECUTION_FILE: executionFile,
        AI_REVIEW_MODEL: 'glm-5-turbo',
        AI_REVIEW_OUTPUT_FILE: outputFile,
        AI_REVIEW_RUN_URL: 'https://github.com/kaitranntt/ccs/actions/runs/1',
        AI_REVIEW_STRUCTURED_OUTPUT: JSON.stringify({
          summary: 'Summary with `code` and ## heading markers.',
          findings: [
            {
              severity: 'low',
              title: 'Title with `ticks`',
              file: 'src/example.ts',
              line: 9,
              what: 'Problem text uses **bold** markers.',
              why: 'Why text uses [link] syntax.',
              fix: 'Fix text uses <html> markers.',
            },
          ],
          securityChecklist: [
            {
              check: 'Injection safety',
              status: 'pass',
              notes: 'Notes with a pipe | still render safely in table cells.',
            },
          ],
          ccsCompliance: [
            {
              rule: 'Cross-platform',
              status: 'pass',
              notes: 'Applies equally across macOS, Linux, and Windows.',
            },
          ],
          informational: ['Informational item with `inline code`.'],
          strengths: ['Strength with **bold** markers.'],
          overallAssessment: 'approved_with_notes',
          overallRationale: 'Rationale keeps `_formatting_` stable.',
        }),
      });

      expect(result.usedFallback).toBe(false);

      const markdown = fs.readFileSync(outputFile, 'utf8');
      expect(markdown).toContain('Summary with \\`code\\` and ## heading markers.');
      expect(markdown).toContain('#### 1. Title with \\`ticks\\`');
      expect(markdown).toContain('- Location: `src/example.ts:9`');
      expect(markdown).toContain('Problem: Problem text uses \\*\\*bold\\*\\* markers.');
      expect(markdown).toContain('Impact: Why text uses \\[link\\] syntax.');
      expect(markdown).toContain('Fix: Fix text uses \\<html\\> markers.');
      expect(markdown).toContain('Notes with a pipe \\| still render safely in table cells.');
      expect(markdown).toContain('- Informational item with \\`inline code\\`.');
      expect(markdown).toContain('- Strength with \\*\\*bold\\*\\* markers.');
      expect(markdown).toContain('**⚠️ APPROVED WITH NOTES** — Rationale keeps \\`\\_formatting\\_\\` stable.');
    });
  });

  test('rejects ad hoc layout markup inside structured fields', () => {
    const validation = reviewOutput.normalizeStructuredOutput(
      JSON.stringify({
        summary: '# PR #860 Review',
        findings: [],
        securityChecklist: [{ check: 'Injection safety', status: 'pass', notes: 'Covered.' }],
        ccsCompliance: [{ rule: 'ASCII-only CLI output', status: 'pass', notes: 'Unaffected.' }],
        informational: [],
        strengths: [],
        overallAssessment: 'approved_with_notes',
        overallRationale: 'The review is otherwise valid.',
      })
    );

    expect(validation.ok).toBe(false);
    expect(validation.reason).toContain('summary contains');
  });

  test('renders approved reviews with substantive checklist rows when optional arrays are empty', () => {
    const validation = reviewOutput.normalizeStructuredOutput(
      JSON.stringify({
        summary: 'The diff is ready to merge as-is.',
        findings: [],
        securityChecklist: [
          {
            check: 'Injection safety',
            status: 'pass',
            notes: 'No user-controlled data crosses a risky boundary in the reviewed diff.',
          },
        ],
        ccsCompliance: [
          {
            rule: 'Help/docs alignment',
            status: 'na',
            notes: 'No CLI behavior changed, so there was nothing to update.',
          },
        ],
        informational: [],
        strengths: [],
        overallAssessment: 'approved',
        overallRationale: 'No confirmed regressions or missing verification remain.',
      })
    );

    expect(validation.ok).toBe(true);
    const markdown = reviewOutput.renderStructuredReview(validation.value, { model: 'glm-5-turbo' });

    expect(markdown).toContain('### Top Findings');
    expect(markdown).toContain('No confirmed issues found after reviewing the diff and surrounding code.');
    expect(markdown).toContain('### Security Checklist (1)');
    expect(markdown).toContain(
      '| Injection safety | ✅ | No user-controlled data crosses a risky boundary in the reviewed diff. |'
    );
    expect(markdown).toContain('### CCS Compliance (1)');
    expect(markdown).toContain('| Help/docs alignment | N/A | No CLI behavior changed, so there was nothing to update. |');
    expect(markdown).toContain('**✅ APPROVED** — No confirmed regressions or missing verification remain.');
  });

  test('summarizes overflow findings in top findings when the detail list is longer than the summary limit', () => {
    const validation = reviewOutput.normalizeStructuredOutput(
      JSON.stringify({
        summary: 'Several follow-ups remain.',
        findings: [
          {
            severity: 'high',
            title: 'High severity finding',
            file: 'src/high.ts',
            line: 10,
            what: 'High severity problem.',
            why: 'High severity impact.',
            fix: 'High severity fix.',
          },
          {
            severity: 'medium',
            title: 'First medium finding',
            file: 'src/medium-a.ts',
            line: 20,
            what: 'Medium severity problem A.',
            why: 'Medium severity impact A.',
            fix: 'Medium severity fix A.',
          },
          {
            severity: 'medium',
            title: 'Second medium finding',
            file: 'src/medium-b.ts',
            line: 30,
            what: 'Medium severity problem B.',
            why: 'Medium severity impact B.',
            fix: 'Medium severity fix B.',
          },
          {
            severity: 'low',
            title: 'Low severity finding',
            file: 'src/low.ts',
            line: 40,
            what: 'Low severity problem.',
            why: 'Low severity impact.',
            fix: 'Low severity fix.',
          },
        ],
        securityChecklist: [{ check: 'Injection safety', status: 'pass', notes: 'Covered.' }],
        ccsCompliance: [{ rule: 'Renderer-owned markdown', status: 'pass', notes: 'Covered.' }],
        informational: [],
        strengths: [],
        overallAssessment: 'changes_requested',
        overallRationale: 'Multiple findings remain before merge.',
      })
    );

    expect(validation.ok).toBe(true);
    const markdown = reviewOutput.renderStructuredReview(validation.value, { model: 'glm-5-turbo' });

    expect(markdown).toContain('- 🔴 High `src/high.ts:10` — High severity finding');
    expect(markdown).toContain('- 🟡 Medium `src/medium-a.ts:20` — First medium finding');
    expect(markdown).toContain('- 🟡 Medium `src/medium-b.ts:30` — Second medium finding');
    expect(markdown).toContain('- 1 more finding in the details below.');
  });

  test('renders findings without line numbers using the file path only', () => {
    const validation = reviewOutput.normalizeStructuredOutput(
      JSON.stringify({
        summary: 'One follow-up remains.',
        findings: [
          {
            severity: 'medium',
            title: 'Missing empty-state coverage',
            file: 'tests/unit/scripts/github/normalize-ai-review-output.test.ts',
            line: null,
            what: 'The empty-findings branch is not covered by a regression test.',
            why: 'That leaves the highest-frequency render path vulnerable to silent regressions.',
            fix: 'Add a test that passes an approved review with an empty findings array.',
          },
        ],
        securityChecklist: [{ check: 'Injection safety', status: 'pass', notes: 'Covered.' }],
        ccsCompliance: [{ rule: 'ASCII-only CLI output', status: 'pass', notes: 'Unaffected.' }],
        informational: [],
        strengths: [],
        overallAssessment: 'approved_with_notes',
        overallRationale: 'The remaining gap is test coverage only.',
      })
    );

    expect(validation.ok).toBe(true);
    const markdown = reviewOutput.renderStructuredReview(validation.value, { model: 'glm-5-turbo' });

    expect(markdown).toContain('#### 1. Missing empty-state coverage');
    expect(markdown).toContain('- Location: `tests/unit/scripts/github/normalize-ai-review-output.test.ts`');
    expect(markdown).not.toContain('normalize-ai-review-output.test.ts:`');
  });

  test('renders inline code safely when the location includes backticks', () => {
    const markdown = reviewOutput.renderStructuredReview(
      {
        summary: 'Rendering stays stable.',
        findings: [
          {
            severity: 'low',
            title: 'Backtick-safe locations stay readable',
            file: 'src/weird`path.ts',
            line: null,
            what: 'Location formatting needs a longer fence when input contains backticks.',
            why: 'Otherwise GitHub markdown can break the inline code span.',
            fix: 'Pick a fence one tick longer than the longest run in the input.',
          },
        ],
        securityChecklist: [{ check: 'Injection safety', status: 'pass', notes: 'Covered.' }],
        ccsCompliance: [{ rule: 'ASCII-only CLI output', status: 'pass', notes: 'Unaffected.' }],
        informational: [],
        strengths: [],
        overallAssessment: 'approved_with_notes',
        overallRationale: 'This is a formatting-only follow-up.',
      },
      { model: 'glm-5-turbo' }
    );

    expect(markdown).toContain('- Location: ``src/weird`path.ts``');
  });

  test('rejects empty checklist sections instead of synthesizing placeholder rows', () => {
    const validation = reviewOutput.normalizeStructuredOutput(
      JSON.stringify({
        summary: 'The diff is ready to merge as-is.',
        findings: [],
        securityChecklist: [],
        ccsCompliance: [],
        informational: [],
        strengths: [],
        overallAssessment: 'approved',
        overallRationale: 'No confirmed regressions remain.',
      })
    );

    expect(validation.ok).toBe(false);
    expect(validation.reason).toContain('securityChecklist must contain at least 1 item');
  });

  test('rejects finding snippets that exceed the renderer snippet budget', () => {
    const validation = reviewOutput.normalizeStructuredOutput(
      JSON.stringify({
        summary: 'The renderer should reject oversized snippet payloads.',
        findings: [
          {
            severity: 'low',
            title: 'Oversized snippet',
            file: 'scripts/github/normalize-ai-review-output.mjs',
            line: 1,
            what: 'The example snippet is intentionally too long.',
            why: 'Oversized snippets would bloat the published review comment.',
            fix: 'Keep snippets short and renderer-owned.',
            snippets: [
              {
                label: 'Too long',
                language: 'txt',
                code: Array.from({ length: 21 }, (_, index) => `line ${index + 1}`).join('\n'),
              },
            ],
          },
        ],
        securityChecklist: [{ check: 'Injection safety', status: 'pass', notes: 'Covered.' }],
        ccsCompliance: [{ rule: 'Renderer-owned markdown', status: 'pass', notes: 'Covered.' }],
        informational: [],
        strengths: [],
        overallAssessment: 'approved_with_notes',
        overallRationale: 'Oversized snippets should fail validation.',
      })
    );

    expect(validation.ok).toBe(false);
    expect(validation.reason).toContain('findings[0].snippets[0].code exceeds 20 lines');
  });

  test('allows plain prose that references section labels without starting with them', () => {
    const validation = reviewOutput.normalizeStructuredOutput(
      JSON.stringify({
        summary: 'The Security Checklist: row is now required, but the prose summary remains valid.',
        findings: [],
        securityChecklist: [{ check: 'Injection safety', status: 'pass', notes: 'Covered.' }],
        ccsCompliance: [{ rule: 'ASCII-only CLI output', status: 'pass', notes: 'Unaffected.' }],
        informational: ['PR #860 review logic is unchanged after this formatter-only update.'],
        strengths: [],
        overallAssessment: 'approved_with_notes',
        overallRationale: 'The renderer still blocks actual ad hoc headings.',
      })
    );

    expect(validation.ok).toBe(true);
  });

  test('allows plain prose that starts with natural language label phrases', () => {
    const validation = reviewOutput.normalizeStructuredOutput(
      JSON.stringify({
        summary: 'Overall assessment: ready to merge after the renderer applies the shared layout.',
        findings: [],
        securityChecklist: [{ check: 'Injection safety', status: 'pass', notes: 'Covered.' }],
        ccsCompliance: [{ rule: 'ASCII-only CLI output', status: 'pass', notes: 'Unaffected.' }],
        informational: ['Security Checklist: rows still escape pipes safely in markdown tables.'],
        strengths: [],
        overallAssessment: 'approved_with_notes',
        overallRationale: 'The prose can mention those phrases without becoming layout markup.',
      })
    );

    expect(validation.ok).toBe(true);
  });

  test('rejects invalid non-null finding line numbers', () => {
    const validation = reviewOutput.normalizeStructuredOutput(
      JSON.stringify({
        summary: 'One finding remains.',
        findings: [
          {
            severity: 'medium',
            title: 'Location data must stay valid',
            file: 'src/example.ts',
            line: 0,
            what: 'The location line number is not a positive integer.',
            why: 'Bad location data weakens the review signal and can hide where the issue lives.',
            fix: 'Reject malformed non-null line values during normalization.',
          },
        ],
        securityChecklist: [{ check: 'Injection safety', status: 'pass', notes: 'Covered.' }],
        ccsCompliance: [{ rule: 'ASCII-only CLI output', status: 'pass', notes: 'Unaffected.' }],
        informational: [],
        strengths: [],
        overallAssessment: 'changes_requested',
        overallRationale: 'Malformed location data should not pass validation.',
      })
    );

    expect(validation.ok).toBe(false);
    expect(validation.reason).toContain('findings[0].line is invalid');
  });
});
