const { stripTargetFlag } = require('../targets/target-resolver');

process.env.CCS_INTERNAL_ENTRY_TARGET = 'codex';

// ccsxp is an opinionated shortcut for the built-in Codex-on-Codex route.
// Strip user-supplied target overrides before forcing the shortcut target.
const forwardedArgs = stripTargetFlag(process.argv.slice(2));
process.argv.splice(2, process.argv.length - 2, 'codex', '--target', 'codex', ...forwardedArgs);
require('../ccs');
