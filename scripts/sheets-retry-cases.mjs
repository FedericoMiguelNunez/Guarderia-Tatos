import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { validateLeadPayload } from '../server/lead-validation.mjs';

export function normalizedFingerprint(input) {
  const lead = validateLeadPayload(input);
  return crypto.createHash('sha256').update(JSON.stringify({ name: lead.name, catName: lead.catName, phone: lead.phone, attribution: lead.attribution, consentKnown: lead.consentKnown })).digest('hex');
}
export async function runSheetsRetryCases({ base, readValues, before, stateRoot, requestAudit }) {
  const run = crypto.randomUUID().replaceAll('-', '_');
  const make = (catName, suffix) => ({ name: 'PRUEBA AUDITORÍA REINTENTO', catName, phone: '+12025550124', website: '', idempotencyKey: `retry_${run}_${suffix}`, consentKnown: false, attribution: { gclid: 'PRUEBA_REINTENTO_NO_CONVERSION', utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'PRUEBA_IDEMPOTENCIA', entryPath: '/', capturedAt: new Date().toISOString() } });
  const sequential = make('Nube Ficticia', 'sequential');
  const concurrent = make('Luna Ficticia', 'concurrent');
  const bodies = { sequential: JSON.stringify(sequential), concurrent: JSON.stringify(concurrent) };
  await writeFile(path.join(stateRoot, 'retry-fixture.json'), JSON.stringify({ sequential, concurrent }, null, 2));
  const post = async body => {
    const response = await fetch(`${base}/.netlify/functions/create-lead`, { method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body });
    return { status: response.status, ...await response.json() };
  };
  const header = before[0]; const idCol = header.indexOf('ID de consulta'); const nameCol = header.indexOf('Nombre');
  const countOwn = rows => rows.slice(1).filter(row => row[nameCol] === sequential.name).length;
  const beforeCount = countOwn(before);
  const readRecord = (rows, id) => {
    const matches = rows.map((row, i) => ({ row, rowNumber: i + 1 })).filter(x => x.row[idCol] === id);
    assert.equal(matches.length, 1, 'EXPECTED_EXACTLY_ONE_SHEET_ROW_FOR_ID');
    const record = Object.fromEntries(header.map((h, i) => [h, matches[0].row[i] ?? '']));
    return { rowNumber: matches[0].rowNumber, leadId: id, record };
  };
  const evidence = { sequentialKey: sequential.idempotencyKey, concurrentKey: concurrent.idempotencyKey, sequentialBodySHA256: crypto.createHash('sha256').update(bodies.sequential).digest('hex'), concurrentBodySHA256: crypto.createHash('sha256').update(bodies.concurrent).digest('hex') };
  const checkpoint = () => writeFile(path.join(stateRoot, 'retry-results.json'), JSON.stringify(evidence, null, 2));
  evidence.first = await post(bodies.sequential); await checkpoint();
  assert.equal(evidence.first.status, 201); assert.equal(evidence.first.saved, true);
  let rows = await readValues(); assert.equal(countOwn(rows), beforeCount + 1);
  evidence.firstRow = readRecord(rows, evidence.first.leadId); await checkpoint();
  evidence.identicalRetry = await post(bodies.sequential); await checkpoint();
  assert.equal(evidence.identicalRetry.status, 200); assert.equal(evidence.identicalRetry.replayed, true); assert.equal(evidence.identicalRetry.leadId, evidence.first.leadId);
  rows = await readValues(); assert.equal(countOwn(rows), beforeCount + 1); assert.deepEqual(readRecord(rows, evidence.first.leadId), evidence.firstRow);
  evidence.conflict = await post(JSON.stringify({ ...sequential, catName: 'Dato cambiado: no guardar' })); await checkpoint();
  assert.equal(evidence.conflict.status, 409); assert.equal(evidence.conflict.error, 'IDEMPOTENCY_CONFLICT');
  rows = await readValues(); assert.equal(countOwn(rows), beforeCount + 1); assert.deepEqual(readRecord(rows, evidence.first.leadId), evidence.firstRow);

  evidence.simultaneous = await Promise.all([post(bodies.concurrent), post(bodies.concurrent)]); await checkpoint();
  const saved = evidence.simultaneous.filter(r => r.saved === true); const ids = [...new Set(saved.map(r => r.leadId))];
  assert.equal(ids.length, 1, 'CONCURRENT_REQUESTS_RETURNED_DIFFERENT_IDS');
  assert.equal(evidence.simultaneous.filter(r => r.status === 201).length, 1, 'CONCURRENT_REQUESTS_CREATED_MULTIPLE_OPERATIONS');
  for (const r of evidence.simultaneous) assert.ok(r.saved === true || (r.status === 409 && r.error === 'REQUEST_IN_PROGRESS'), 'UNEXPECTED_CONCURRENT_RESPONSE');
  rows = await readValues(); assert.equal(countOwn(rows), beforeCount + 2);
  evidence.concurrentRow = readRecord(rows, ids[0]); await checkpoint();
  evidence.concurrentRetry = await post(bodies.concurrent); assert.equal(evidence.concurrentRetry.status, 200); assert.equal(evidence.concurrentRetry.replayed, true); assert.equal(evidence.concurrentRetry.leadId, ids[0]);
  const after = await readValues(); assert.equal(countOwn(after), beforeCount + 2); assert.deepEqual(readRecord(after, ids[0]), evidence.concurrentRow);
  const writtenRows = new Set([evidence.firstRow.rowNumber, evidence.concurrentRow.rowNumber]);
  for (let r = 0; r < before.length; r++) for (let c = 0; c < before[r].length; c++) {
    // New lead values may populate previously empty cells of template rows.
    if (writtenRows.has(r + 1) && (before[r][c] ?? '') === '') continue;
    assert.deepEqual(after[r]?.[c] ?? '', before[r][c] ?? '', 'PREEXISTING_SHEET_CELL_CHANGED');
  }
  for (const [fixture, raw, expectedCount] of [[sequential, bodies.sequential, 2], [concurrent, bodies.concurrent, 3]]) {
    const exact = requestAudit.filter(r => r.key === fixture.idempotencyKey && r.sha256 === crypto.createHash('sha256').update(raw).digest('hex'));
    assert.equal(exact.length, expectedCount, 'IDEMPOTENCY_KEY_OR_RAW_BODY_CHANGED');
  }
  evidence.identicalRawBodiesConfirmed = true;
  evidence.previousRowsUnchanged = true;
  evidence.additionalRows = 2;
  await checkpoint();
  return evidence;
}

// Resume saved evidence after a harness assertion fails; never generate fresh keys.
export async function finishSheetsRetryCases({ base, readValues, stateRoot }) {
  const fixture = JSON.parse(await readFile(path.join(stateRoot, 'retry-fixture.json'), 'utf8'));
  const evidence = JSON.parse(await readFile(path.join(stateRoot, 'retry-results.json'), 'utf8'));
  const historical = JSON.parse(await readFile(path.join(stateRoot, 'readback.json'), 'utf8'));
  const audit = (await readFile(path.join(stateRoot, 'request-hashes.jsonl'), 'utf8')).trim().split(/\r?\n|\\n/).filter(Boolean).map(line => JSON.parse(line));
  assert.equal(evidence.first.status, 201); assert.equal(evidence.identicalRetry.status, 200); assert.equal(evidence.identicalRetry.leadId, evidence.first.leadId);
  assert.equal(evidence.conflict.status, 409); assert.equal(evidence.conflict.error, 'IDEMPOTENCY_CONFLICT');
  assert.equal(evidence.simultaneous.filter(r => r.status === 201).length, 1);
  assert.ok(evidence.simultaneous.every(r => r.saved === true || (r.status === 409 && r.error === 'REQUEST_IN_PROGRESS')));
  for (const [payload, hash, expectedCount] of [[fixture.sequential, evidence.sequentialBodySHA256, 2], [fixture.concurrent, evidence.concurrentBodySHA256, 3]]) {
    assert.equal(crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex'), hash);
    const sameKey = audit.filter(row => row.key === payload.idempotencyKey);
    assert.ok(sameKey.filter(row => row.sha256 === hash).length >= expectedCount, 'MISSING_ORIGINAL_IDENTICAL_ATTEMPTS');
    if (payload === fixture.sequential) {
      const conflictHash = crypto.createHash('sha256').update(JSON.stringify({ ...payload, catName: 'Dato cambiado: no guardar' })).digest('hex');
      assert.equal(sameKey.filter(row => row.sha256 !== hash).length, 1);
      assert.ok(sameKey.every(row => row.sha256 === hash || row.sha256 === conflictHash), 'UNEXPECTED_BODY_CHANGE');
    } else assert.ok(sameKey.every(row => row.sha256 === hash), 'CONCURRENT_BODY_CHANGED');
  }
  const before = await readValues(); const headers = before[0]; const idIndex = headers.indexOf('ID de consulta');
  const ownRows = rows => rows.filter(row => row[headers.indexOf('Nombre')] === 'PRUEBA AUDITORÍA REINTENTO');
  assert.equal(ownRows(before).length, 2);
  for (const expected of [evidence.firstRow, evidence.concurrentRow]) {
    assert.equal(before.filter(row => row[idIndex] === expected.leadId).length, 1);
    assert.deepEqual(Object.fromEntries(headers.map((h, i) => [h, before[expected.rowNumber - 1][i] ?? ''])), expected.record);
  }
  for (const item of historical.auditRows) assert.deepEqual(Object.fromEntries(headers.map((h, i) => [h, before[item.rowNumber - 1][i] ?? ''])), item.record, 'HISTORICAL_EVIDENCE_CHANGED');
  const post = async body => {
    const response = await fetch(`${base}/.netlify/functions/create-lead`, { method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body });
    return { status: response.status, ...await response.json() };
  };
  evidence.finalReplay = [];
  for (const [payload, expected] of [[fixture.sequential, evidence.firstRow], [fixture.concurrent, evidence.concurrentRow]]) {
    const replay = await post(JSON.stringify(payload));
    assert.equal(replay.status, 200); assert.equal(replay.replayed, true); assert.equal(replay.leadId, expected.leadId);
    evidence.finalReplay.push(replay);
  }
  const after = await readValues(); assert.deepEqual(after, before, 'REPLAY_MODIFIED_SHEET');
  evidence.identicalRawBodiesConfirmed = true; evidence.previousRowsUnchanged = true; evidence.additionalRows = 2;
  evidence.resumedWithoutCreatingNewOperations = true;
  await writeFile(path.join(stateRoot, 'retry-results.json'), JSON.stringify(evidence, null, 2));
  return evidence;
}