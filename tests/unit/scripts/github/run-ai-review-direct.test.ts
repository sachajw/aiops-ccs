import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const directReview = await import('../../../../scripts/github/run-ai-review-direct.mjs');

function withTempDir(prefix: string, run: (tempDir: string) => Promise<void> | void) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return Promise.resolve()
    .then(() => run(tempDir))
    .finally(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });
}

function createResponse(text: string) {
  return {
    ok: true,
    async json() {
      return {
        content: [{ type: 'text', text }],
      };
    },
  };
}

describe('run-ai-review-direct', () => {
  test('reserves the tail of the step budget for deterministic fallback publication', () => {
    const window = directReview.resolveAttemptWindow({
      timeoutMinutes: 8,
      configuredTimeoutMs: 240000,
      requestBufferMs: 45000,
      minAttemptMs: 20000,
      startedAt: 0,
      now: 420001,
    });

    expect(window.canAttempt).toBe(false);
    expect(window.timeoutMs).toBeNull();
  });

  test('extracts json candidates from fenced or chatty model replies', () => {
    expect(directReview.extractJsonCandidate('```json\n{"ok":true}\n```')).toBe('{"ok":true}');
    expect(directReview.extractJsonCandidate('Here is the result:\n{"ok":true}\nThanks')).toBe('{"ok":true}');
  });

  test('uses the included-manifest files for fallback coverage instead of assuming a prefix slice', async () => {
    await withTempDir('ai-review-direct-', async (tempDir) => {
      const outputFile = path.join(tempDir, 'review.md');
      const logFile = path.join(tempDir, 'attempts.json');
      const packetFile = path.join(tempDir, 'packet.md');
      const manifestFile = path.join(tempDir, 'selected-files.txt');
      const includedManifestFile = path.join(tempDir, 'included-files.txt');
      fs.writeFileSync(packetFile, '# AI Review Packet\n\npacket body\n');
      fs.writeFileSync(manifestFile, 'src/large.ts\nsrc/small.ts\n');
      fs.writeFileSync(includedManifestFile, 'src/small.ts\n');

      const result = await directReview.writeDirectReviewFromEnv(
        {
          ANTHROPIC_BASE_URL: 'https://api.z.ai/api/anthropic',
          ANTHROPIC_AUTH_TOKEN: 'test-token',
          REVIEW_MODEL: 'glm-5-turbo',
          GITHUB_REPOSITORY: 'kaitranntt/ccs',
          AI_REVIEW_PROMPT: 'You are a reviewer.',
          AI_REVIEW_PACKET_FILE: packetFile,
          AI_REVIEW_SCOPE_MANIFEST_FILE: manifestFile,
          AI_REVIEW_PACKET_INCLUDED_MANIFEST_FILE: includedManifestFile,
          AI_REVIEW_OUTPUT_FILE: outputFile,
          AI_REVIEW_LOG_FILE: logFile,
          AI_REVIEW_RUN_URL: 'https://github.com/kaitranntt/ccs/actions/runs/1',
          AI_REVIEW_MODE: 'triage',
          AI_REVIEW_SELECTED_FILES: '2',
          AI_REVIEW_REVIEWABLE_FILES: '4',
          AI_REVIEW_SELECTED_CHANGES: '120',
          AI_REVIEW_REVIEWABLE_CHANGES: '220',
          AI_REVIEW_SCOPE_LABEL: 'reviewable files',
          AI_REVIEW_PACKET_INCLUDED_FILES: '1',
          AI_REVIEW_PACKET_TOTAL_FILES: '2',
          AI_REVIEW_PACKET_OMITTED_FILES: '1',
          AI_REVIEW_TIMEOUT_MINUTES: '8',
          AI_REVIEW_REQUEST_TIMEOUT_MS: '50',
          AI_REVIEW_MAX_ATTEMPTS: '1',
          AI_REVIEW_PR_NUMBER: '888',
        },
        async () => {
          throw new Error('forced direct review failure');
        }
      );

      expect(result.usedFallback).toBe(true);
      const markdown = fs.readFileSync(outputFile, 'utf8');
      expect(markdown).toContain('`src/small.ts`');
      expect(markdown).not.toContain('`src/large.ts`');
    });
  });

  test('writes the structured review markdown when the first response validates', async () => {
    await withTempDir('ai-review-direct-', async (tempDir) => {
      const outputFile = path.join(tempDir, 'review.md');
      const logFile = path.join(tempDir, 'attempts.json');
      const packetFile = path.join(tempDir, 'packet.md');
      const manifestFile = path.join(tempDir, 'selected-files.txt');
      const includedManifestFile = path.join(tempDir, 'included-files.txt');
      fs.writeFileSync(packetFile, '# AI Review Packet\n\npacket body\n');
      fs.writeFileSync(manifestFile, 'src/example.ts\n');
      fs.writeFileSync(includedManifestFile, 'src/example.ts\n');

      const result = await directReview.writeDirectReviewFromEnv(
        {
          ANTHROPIC_BASE_URL: 'https://api.z.ai/api/anthropic',
          ANTHROPIC_AUTH_TOKEN: 'test-token',
          REVIEW_MODEL: 'glm-5-turbo',
          GITHUB_REPOSITORY: 'kaitranntt/ccs',
          AI_REVIEW_PROMPT: 'You are a reviewer.',
          AI_REVIEW_PACKET_FILE: packetFile,
          AI_REVIEW_SCOPE_MANIFEST_FILE: manifestFile,
          AI_REVIEW_PACKET_INCLUDED_MANIFEST_FILE: includedManifestFile,
          AI_REVIEW_OUTPUT_FILE: outputFile,
          AI_REVIEW_LOG_FILE: logFile,
          AI_REVIEW_RUN_URL: 'https://github.com/kaitranntt/ccs/actions/runs/1',
          AI_REVIEW_MODE: 'fast',
          AI_REVIEW_SELECTED_FILES: '1',
          AI_REVIEW_REVIEWABLE_FILES: '1',
          AI_REVIEW_SELECTED_CHANGES: '18',
          AI_REVIEW_REVIEWABLE_CHANGES: '18',
          AI_REVIEW_SCOPE_LABEL: 'reviewable files',
          AI_REVIEW_PACKET_INCLUDED_FILES: '1',
          AI_REVIEW_PACKET_TOTAL_FILES: '1',
          AI_REVIEW_PACKET_OMITTED_FILES: '0',
          AI_REVIEW_TIMEOUT_MINUTES: '8',
          AI_REVIEW_PR_NUMBER: '888',
        },
        async () =>
          createResponse(
            JSON.stringify({
              summary: 'The PR looks correct.',
              findings: [],
              securityChecklist: [{ check: 'Injection safety', status: 'pass', notes: 'Covered.' }],
              ccsCompliance: [{ rule: 'ASCII-only CLI output', status: 'na', notes: 'No CLI changes.' }],
              informational: ['The packet covered the selected file.'],
              strengths: ['The response validated on the first attempt.'],
              overallAssessment: 'approved',
              overallRationale: 'No confirmed regressions remain.',
            })
          )
      );

      expect(result.usedFallback).toBe(false);
      expect(fs.readFileSync(outputFile, 'utf8')).toContain('### Verdict');
      expect(fs.readFileSync(outputFile, 'utf8')).toContain('**✅ APPROVED**');
      expect(fs.readFileSync(outputFile, 'utf8')).toContain('packet 1/1');
      expect(JSON.parse(fs.readFileSync(logFile, 'utf8')).attempts).toHaveLength(1);
    });
  });

  test('renders finding snippets from the validated direct review response', async () => {
    await withTempDir('ai-review-direct-', async (tempDir) => {
      const outputFile = path.join(tempDir, 'review.md');
      const logFile = path.join(tempDir, 'attempts.json');
      const packetFile = path.join(tempDir, 'packet.md');
      const manifestFile = path.join(tempDir, 'selected-files.txt');
      const includedManifestFile = path.join(tempDir, 'included-files.txt');
      fs.writeFileSync(packetFile, '# AI Review Packet\n\npacket body\n');
      fs.writeFileSync(manifestFile, '.github/workflows/ai-review.yml\n');
      fs.writeFileSync(includedManifestFile, '.github/workflows/ai-review.yml\n');

      const result = await directReview.writeDirectReviewFromEnv(
        {
          ANTHROPIC_BASE_URL: 'https://api.z.ai/api/anthropic',
          ANTHROPIC_AUTH_TOKEN: 'test-token',
          REVIEW_MODEL: 'glm-5-turbo',
          GITHUB_REPOSITORY: 'kaitranntt/ccs',
          AI_REVIEW_PROMPT: 'You are a reviewer.',
          AI_REVIEW_PACKET_FILE: packetFile,
          AI_REVIEW_SCOPE_MANIFEST_FILE: manifestFile,
          AI_REVIEW_PACKET_INCLUDED_MANIFEST_FILE: includedManifestFile,
          AI_REVIEW_OUTPUT_FILE: outputFile,
          AI_REVIEW_LOG_FILE: logFile,
          AI_REVIEW_RUN_URL: 'https://github.com/kaitranntt/ccs/actions/runs/1',
          AI_REVIEW_MODE: 'fast',
          AI_REVIEW_SELECTED_FILES: '1',
          AI_REVIEW_REVIEWABLE_FILES: '1',
          AI_REVIEW_SELECTED_CHANGES: '24',
          AI_REVIEW_REVIEWABLE_CHANGES: '24',
          AI_REVIEW_SCOPE_LABEL: 'reviewable files',
          AI_REVIEW_PACKET_INCLUDED_FILES: '1',
          AI_REVIEW_PACKET_TOTAL_FILES: '1',
          AI_REVIEW_PACKET_OMITTED_FILES: '0',
          AI_REVIEW_TIMEOUT_MINUTES: '8',
          AI_REVIEW_PR_NUMBER: '888',
        },
        async () =>
          createResponse(
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
                      code: 'marker_file=\"$RUNNER_TEMP/.ai-review-marker\"\nprintf \"%s\\n\" \"$REVIEW_MARKER\" > \"$marker_file\"',
                    },
                  ],
                },
              ],
              securityChecklist: [{ check: 'Injection safety', status: 'pass', notes: 'Covered.' }],
              ccsCompliance: [{ rule: 'Renderer-owned markdown', status: 'pass', notes: 'Covered.' }],
              informational: [],
              strengths: ['The response validated on the first attempt.'],
              overallAssessment: 'approved_with_notes',
              overallRationale: 'The remaining change is formatter polish only.',
            })
          )
      );

      expect(result.usedFallback).toBe(false);
      const markdown = fs.readFileSync(outputFile, 'utf8');
      expect(markdown).toContain('Evidence: Current branch body');
      expect(markdown).toContain('```bash');
      expect(markdown).toContain('marker_file="$RUNNER_TEMP/.ai-review-marker"');
    });
  });

  test('retries with a repair attempt when the first response is invalid', async () => {
    await withTempDir('ai-review-direct-', async (tempDir) => {
      const outputFile = path.join(tempDir, 'review.md');
      const logFile = path.join(tempDir, 'attempts.json');
      const packetFile = path.join(tempDir, 'packet.md');
      const manifestFile = path.join(tempDir, 'selected-files.txt');
      const includedManifestFile = path.join(tempDir, 'included-files.txt');
      fs.writeFileSync(packetFile, '# AI Review Packet\n\npacket body\n');
      fs.writeFileSync(manifestFile, 'src/example.ts\n');
      fs.writeFileSync(includedManifestFile, 'src/example.ts\n');

      const responses = [
        createResponse('{"summary":"missing required fields"}'),
        createResponse(
          JSON.stringify({
            summary: 'The PR needs a small follow-up only.',
            findings: [],
            securityChecklist: [{ check: 'Injection safety', status: 'pass', notes: 'Covered.' }],
            ccsCompliance: [{ rule: 'ASCII-only CLI output', status: 'na', notes: 'No CLI changes.' }],
            informational: [],
            strengths: ['The repair path returned valid JSON.'],
            overallAssessment: 'approved_with_notes',
            overallRationale: 'No blocking issues remain after the repair pass.',
          })
        ),
      ];

      const result = await directReview.writeDirectReviewFromEnv(
        {
          ANTHROPIC_BASE_URL: 'https://api.z.ai/api/anthropic',
          ANTHROPIC_AUTH_TOKEN: 'test-token',
          REVIEW_MODEL: 'glm-5-turbo',
          GITHUB_REPOSITORY: 'kaitranntt/ccs',
          AI_REVIEW_PROMPT: 'You are a reviewer.',
          AI_REVIEW_PACKET_FILE: packetFile,
          AI_REVIEW_SCOPE_MANIFEST_FILE: manifestFile,
          AI_REVIEW_PACKET_INCLUDED_MANIFEST_FILE: includedManifestFile,
          AI_REVIEW_OUTPUT_FILE: outputFile,
          AI_REVIEW_LOG_FILE: logFile,
          AI_REVIEW_RUN_URL: 'https://github.com/kaitranntt/ccs/actions/runs/1',
          AI_REVIEW_MODE: 'triage',
          AI_REVIEW_SELECTED_FILES: '3',
          AI_REVIEW_REVIEWABLE_FILES: '5',
          AI_REVIEW_SELECTED_CHANGES: '140',
          AI_REVIEW_REVIEWABLE_CHANGES: '180',
          AI_REVIEW_SCOPE_LABEL: 'reviewable files',
          AI_REVIEW_PACKET_INCLUDED_FILES: '2',
          AI_REVIEW_PACKET_TOTAL_FILES: '3',
          AI_REVIEW_PACKET_OMITTED_FILES: '1',
          AI_REVIEW_TIMEOUT_MINUTES: '10',
          AI_REVIEW_PR_NUMBER: '888',
        },
        async () => responses.shift() as ReturnType<typeof createResponse>
      );

      expect(result.usedFallback).toBe(false);
      expect(fs.readFileSync(outputFile, 'utf8')).toContain('**⚠️ APPROVED WITH NOTES**');
      expect(fs.readFileSync(outputFile, 'utf8')).toContain('packet 2/3');
      expect(JSON.parse(fs.readFileSync(logFile, 'utf8')).attempts).toHaveLength(2);
    });
  });
});
