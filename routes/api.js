'use strict';

const express = require('express');
const router = express.Router();

// ── POST /api/verify/:flagId ──────────────────────────────────────────────────
// Body: { value: "..." }
// Returns: { correct: true|false }
// Never echoes the flag value back.
router.post('/verify/:flagId', (req, res) => {
  const { flagId } = req.params;
  const { challengeMap, challengeIds } = req.app.locals;

  const challenge = challengeMap.get(flagId);
  if (!challenge) {
    return res.status(404).json({ error: 'Unknown flag ID' });
  }

  const submitted = (req.body.value || '').trim();
  if (!submitted) {
    return res.status(400).json({ error: 'No value submitted' });
  }

  // Server-side exact comparison — flag value is never sent to client
  const correct = submitted === challenge.flag;

  if (correct) {
    // Initialise solved map if first correct answer
    if (!req.session.solved) {
      req.session.solved = {};
    }
    req.session.solved[flagId] = true;
    // Force cookie-session to write the updated session
    req.session.solved = Object.assign({}, req.session.solved);
  }

  // Return ONLY correctness — never the flag string
  return res.json({ correct });
});

// ── GET /api/status ───────────────────────────────────────────────────────────
// Returns which flag IDs are solved according to the signed session cookie.
// Used on page-load to restore UI state without re-solving.
// Returns: { solved: { flagId: bool, ... }, solvedCount: N, total: N }
router.get('/status', (req, res) => {
  const { challengeIds } = req.app.locals;
  const sessionSolved = req.session.solved || {};

  const solved = {};
  let solvedCount = 0;
  for (const id of challengeIds) {
    solved[id] = sessionSolved[id] === true;
    if (solved[id]) solvedCount++;
  }

  return res.json({ solved, solvedCount, total: challengeIds.length });
});

// ── GET /api/master-flag ──────────────────────────────────────────────────────
// Returns the master flag ONLY if ALL challenges are solved in the signed
// session cookie. Never trusts the client's UI state alone.
router.get('/master-flag', (req, res) => {
  const { challengeIds, config } = req.app.locals;
  const sessionSolved = req.session.solved || {};

  const allSolved = challengeIds.every(id => sessionSolved[id] === true);

  if (!allSolved) {
    return res.status(403).json({ error: 'Not all flags have been captured yet.' });
  }

  return res.json({
    masterFlag: config.master_flag,
    revealMessage: config.master_flag_reveal_message,
  });
});

module.exports = router;
