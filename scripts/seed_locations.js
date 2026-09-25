/**
 * seed_locations.js — Load India State / District / Taluka master from LGD.
 *
 * Usage:
 *   node scripts/seed_locations.js
 *
 * Authoritative source: Local Government Directory (LGD), Govt. of India.
 * Dataset: data.gov.in "Local Government Directory (LGD) - Sub-Districts"
 *   https://www.data.gov.in/resource/local-government-directory-lgd-sub-districts
 *   Every record carries its full state → district → sub-district chain.
 *   Needs DATA_GOV_API_KEY in .env (free key from data.gov.in → My Account).
 *
 * scripts/data/lgd_state_district.csv (same LGD columns) is loaded first so
 * newly created districts that have no talukas in LGD yet still exist.
 *
 * Idempotent: rows are upserted by LGD code in one transaction. Rows that
 * disappear from LGD are marked is_active = 0, never deleted, so anything
 * referencing an old code keeps working. Re-run any time to refresh.
 */

'use strict';

require('dotenv').config();
const mssql = require('mssql');
const XLSX  = require('xlsx');
const fs    = require('fs');
const path  = require('path');

const config = {
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server:   process.env.DB_SERVER.trim(),
  database: process.env.DB_NAME,
  port:     parseInt(process.env.DB_PORT) || 1433,
  options:  { encrypt: true, trustServerCertificate: true },
  requestTimeout: 120000,
};

const RESOURCE_URL = 'https://api.data.gov.in/resource/6be51a29-876a-403a-a6da-42fde795e751';
const PAGE = 1000;

// LGD's "local name" is sometimes just the English name upper-cased and space-padded
const local = (v, en) => { v = String(v ?? '').trim(); return v && v.toUpperCase() !== en.toUpperCase() ? v : null }
// Census codes: 'NA' / all-zeros mean "not in Census 2011"
const census = v => { v = String(v ?? '').trim(); return /^[1-9]|^0*[1-9]/.test(v) ? v : null }

async function fetchSubDistricts() {
  const key = process.env.DATA_GOV_API_KEY;
  if (!key) throw new Error('DATA_GOV_API_KEY is not set in .env');
  const all = [];
  for (let offset = 0; ; offset += PAGE) {
    const res = await fetch(`${RESOURCE_URL}?api-key=${key}&format=json&limit=${PAGE}&offset=${offset}`,
      { signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(`data.gov.in HTTP ${res.status}`);
    const j = await res.json();
    if (j.status !== 'ok') throw new Error(`data.gov.in: ${j.message || j.status}`);
    all.push(...j.records);
    if (j.records.length < PAGE || all.length >= j.total) {
      // The public sample key silently caps results at 10 — refuse a partial import
      if (all.length < j.total) throw new Error(`data.gov.in returned ${all.length} of ${j.total} records — use a personal API key`);
      return all;
    }
  }
}

async function load() {
  const states = new Map(), districts = new Map(), talukas = new Map();
  const addParents = r => {
    const sName = String(r.state_name_english).trim(), dName = String(r.district_name_english).trim();
    states.set(+r.state_code, [+r.state_code, sName, local(r.state_name_local, sName), census(r.state_census2011_code)]);
    districts.set(+r.district_code, [+r.district_code, +r.state_code, dName, local(r.district_name_local, dName), census(r.district_census2011_code)]);
  };

  const wb = XLSX.read(fs.readFileSync(path.join(__dirname, 'data', 'lgd_state_district.csv'), 'utf8'), { type: 'string', raw: true });
  XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: false, defval: '' }).forEach(addParents);

  const records = await fetchSubDistricts();
  for (const r of records) {
    addParents(r);   // API is fresher than the CSV — it wins on conflicts
    const name = String(r.subdistrict_name_english).trim();
    talukas.set(+r.subdistrict_code, [+r.subdistrict_code, +r.district_code, name, local(r.subdistrict_name_local, name), census(r.subdistrict_census2011_code)]);
  }
  return { states: [...states.values()], districts: [...districts.values()], talukas: [...talukas.values()] };
}

// Bulk-load rows into a #temp table, then MERGE into the target by id.
async function upsert(tx, table, parentCol, rows) {
  const tmp = `#${table}`;
  const t = new mssql.Table(tmp);
  t.create = true;   // bulk() creates the #temp on this connection
  t.columns.add('id', mssql.Int, { nullable: false, primary: true });
  if (parentCol) t.columns.add(parentCol, mssql.Int, { nullable: false });
  t.columns.add('name', mssql.NVarChar(100), { nullable: false });
  t.columns.add('name_local', mssql.NVarChar(100), { nullable: true });
  t.columns.add('census_code', mssql.VarChar(10), { nullable: true });
  rows.forEach(r => t.rows.add(...r));
  await new mssql.Request(tx).bulk(t);

  const p = parentCol ? `${parentCol}, ` : '';
  const r = await new mssql.Request(tx).query(`
    MERGE ${table} AS t USING ${tmp} AS s ON t.id = s.id
    WHEN MATCHED THEN UPDATE SET ${parentCol ? `${parentCol} = s.${parentCol},` : ''}
      name = s.name, name_local = s.name_local, census_code = s.census_code, is_active = 1
    WHEN NOT MATCHED BY TARGET THEN INSERT (id, ${p}name, name_local, census_code)
      VALUES (s.id, ${parentCol ? `s.${parentCol}, ` : ''}s.name, s.name_local, s.census_code)
    WHEN NOT MATCHED BY SOURCE AND t.is_active = 1 THEN UPDATE SET is_active = 0;
    DROP TABLE ${tmp};`);
  console.log(`[seed-locations] ${table}: ${rows.length} rows (${r.rowsAffected[0]} upserted/deactivated)`);
}

async function main() {
  const data = await load();
  console.log(`[seed-locations] fetched ${data.talukas.length} talukas from data.gov.in`);
  const pool = await new mssql.ConnectionPool(config).connect();
  const tx = new mssql.Transaction(pool);
  await tx.begin();
  try {
    // Parents first so FK checks pass on insert
    await upsert(tx, 'state_master', null, data.states);
    await upsert(tx, 'district_master', 'state_id', data.districts);
    await upsert(tx, 'taluka_master', 'district_id', data.talukas);
    await tx.commit();
    console.log('[seed-locations] ✓ done');
  } catch (err) {
    await tx.rollback();
    console.error('[seed-locations] ✗ rolled back:', err.message, err.precedingErrors?.map(e => e.message) || err);
    process.exitCode = 1;
  } finally {
    await pool.close();
  }
}

main().catch(err => { console.error("[seed-locations] ✗", err.message); process.exitCode = 1 });
