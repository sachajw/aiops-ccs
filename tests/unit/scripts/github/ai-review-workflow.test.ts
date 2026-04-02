import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';

function loadWorkflow() {
  const workflowPath = path.resolve(import.meta.dir, '../../../../.github/workflows/ai-review.yml');
  return yaml.load(fs.readFileSync(workflowPath, 'utf8')) as {
    jobs: {
      review: {
        steps: Array<Record<string, any>>;
      };
    };
  };
}

describe('ai-review workflow', () => {
  test('pins automatic review helpers to trusted base-branch assets', () => {
    const workflow = loadWorkflow();
    const steps = workflow.jobs.review.steps;

    const promptStep = steps.find((step) => step.id === 'review-prompt');
    expect(promptStep).toBeDefined();
    expect(promptStep?.run).toContain('build-ai-review-packet.mjs');
    expect(promptStep?.run).toContain('run-ai-review-direct.mjs');
    expect(promptStep?.run).not.toContain('bootstrapping from checked-out internal branch asset');
    expect(promptStep?.run).toContain('using minimal packet builder');
    expect(promptStep?.run).toContain('using incomplete-review fallback');

    const reviewScopeStep = steps.find((step) => step.id === 'review-scope');
    expect(reviewScopeStep).toBeDefined();
    expect(reviewScopeStep?.env?.AI_REVIEW_PR_SIZE_CLASS).toBe('${{ needs.prepare.outputs.pr_size_class }}');

    const packetStep = steps.find((step) => step.id === 'review-packet');
    expect(packetStep).toBeDefined();
    expect(packetStep?.run).toContain('node "$AI_REVIEW_PACKET_SCRIPT"');
    expect(packetStep?.env?.AI_REVIEW_PACKET_FILE).toBe('${{ env.REVIEW_PACKET_FILE }}');
    expect(packetStep?.env?.AI_REVIEW_PACKET_INCLUDED_MANIFEST_FILE).toBe(
      '${{ env.REVIEW_PACKET_INCLUDED_MANIFEST_FILE }}'
    );

    const directReviewStep = steps.find((step) => step.id === 'direct-review');
    expect(directReviewStep).toBeDefined();
    expect(directReviewStep?.uses).toBeUndefined();
    expect(directReviewStep?.run).toContain('node "$AI_REVIEW_DIRECT_REVIEW_SCRIPT"');
    expect(directReviewStep?.['continue-on-error']).toBe(true);
    expect(directReviewStep?.env?.AI_REVIEW_PROMPT).toBe('${{ steps.review-prompt.outputs.content }}');
    expect(directReviewStep?.env?.AI_REVIEW_PACKET_INCLUDED_MANIFEST_FILE).toBe(
      '${{ steps.review-packet.outputs.packet_included_manifest_file }}'
    );
    expect(directReviewStep?.env?.AI_REVIEW_PACKET_INCLUDED_FILES).toBe(
      '${{ steps.review-packet.outputs.packet_included_files }}'
    );
    expect(directReviewStep?.env?.AI_REVIEW_REQUEST_BUFFER_MS).toBe(45000);

    const publishStep = steps.find((step) => step.name === 'Publish review comment');
    expect(publishStep).toBeDefined();
    expect(String(publishStep?.env?.REVIEW_MARKER)).toContain('pr:${{ needs.prepare.outputs.pr_number }}');
    expect(String(publishStep?.env?.REVIEW_MARKER)).toContain('sha:${{ needs.prepare.outputs.head_sha }}');
    expect(String(publishStep?.env?.REVIEW_MARKER)).not.toContain('run:${{ github.run_id }}');
  });
});
