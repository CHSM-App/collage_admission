/**
 * Newline-delimited JSON progress for the bulk importers.
 *
 * The writes are one statement per table, so there is no per-row progress to
 * report — but each phase can take seconds and a bar that never moves reads as
 * a hang. Every line is one JSON object: `{ phases: n }` first, then
 * `{ phase, step }` per stage, and last the payload the client would have got
 * from res.json().
 *
 * Streaming starts only once the sheet has parsed and validated, so every
 * rejection before that is still an ordinary JSON body with its real status
 * code. A failure after that point comes back as the last line with a `status`
 * on it, because the 200 has already gone out.
 */
function startStream(res, phases) {
  res.setHeader('Content-Type', 'application/x-ndjson')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Accel-Buffering', 'no') // no proxy may hold the lines back
  res.write(JSON.stringify({ phases }) + '\n')

  const started = Date.now()
  const timings = []
  let step = 0
  let last = started

  const close = () => {
    if (timings.length) timings[timings.length - 1].ms = Date.now() - last
  }

  return {
    phase(label) {
      close()
      last = Date.now()
      timings.push({ label, ms: null })
      res.write(JSON.stringify({ phase: label, step: ++step }) + '\n')
    },
    /** Final line: the result, plus where the time actually went. */
    done(payload) {
      close()
      res.end(JSON.stringify({ ...payload, timings, total_ms: Date.now() - started }) + '\n')
    },
    fail(status, payload) {
      close()
      res.end(JSON.stringify({ ...payload, status }) + '\n')
    },
  }
}

module.exports = { startStream }
