const fs=require('fs'); const p='routes/masters.js';
let s=fs.readFileSync(p,'utf8');
const must=(c,m)=>{ if(!c) { console.error('MISS: '+m); process.exit(1) } };

const old=`/** One actionable message for every unmapped faculty number, not one per row. */
function unknownFacultyError(res, unknown) {
  const list = [...unknown].sort((a, b) => a - b)
  return res.status(422).json({
    success: false,
    message: \`Unknown faculty number\${list.length > 1 ? 's' : ''}: \${list.join(', ')}. \`
           + 'Set "Univ. Faculty No" on the matching programs in Program Master first.',
    unknown_faculty_codes: list,
  })
}`;

const neu=`/**
 * These files are written by the university and span every faculty it runs, so
 * a file naming a faculty this college does not offer is NORMAL — those rows
 * are skipped, not fatal. faculty_master holds only the programs one college
 * offers, unlike a university-wide master where an unmatched number would be a
 * genuine error.
 *
 * The exception is nothing matching at all, which almost always means
 * university_faculty_no has not been filled in yet.
 */
function skippedFacultyNote(unknown, rows) {
  const list = [...unknown].sort((a, b) => a - b)
  return \`\${rows} row\${rows === 1 ? '' : 's'} skipped for faculty number\${list.length > 1 ? 's' : ''} \`
       + \`\${list.join(', ')} — no program in this college has that Univ. Faculty No. \`
       + 'Set it in Program Master if one of these should have been imported.'
}

function noFacultyMatchedError(res, unknown) {
  const list = [...unknown].sort((a, b) => a - b)
  return res.status(422).json({
    success: false,
    message: 'Nothing could be imported: no program in this college matches any faculty number in the file '
           + \`(\${list.join(', ')}). Open Program Master and set "Univ. Faculty No" on each program to the \`
           + 'number the university uses for it, then try again.',
    unknown_faculty_codes: list,
  })
}`;

must(s.includes(old),'helper'); s=s.replace(old,neu);

must(s.split('  const unknownFaculty = new Set()').length-1===2,'unknownFaculty x2');
s=s.split('  const unknownFaculty = new Set()').join('  const unknownFaculty = new Set()\n  let skippedRows = 0');

const hit='    if (!program) { unknownFaculty.add(Number(facultyNo)); continue }';
must(s.split(hit).length-1===2,'!program x2');
s=s.split(hit).join('    if (!program) { unknownFaculty.add(Number(facultyNo)); skippedRows++; continue }');

for (const noun of ['subject','group']) {
  const og=`  if (unknownFaculty.size) return unknownFacultyError(res, unknownFaculty)
  if (errors.length) return res.status(422).json({ success: false, errors })
  if (!staged.length) return res.status(422).json({ success: false, message: 'The sheet has no ${noun} rows.' })`;
  const ng=`  if (errors.length) return res.status(422).json({ success: false, errors })
  // Unmatched faculties only fail the import when they leave nothing to do.
  if (!staged.length && unknownFaculty.size) return noFacultyMatchedError(res, unknownFaculty)
  if (!staged.length) return res.status(422).json({ success: false, message: 'The sheet has no ${noun} rows.' })
  if (unknownFaculty.size) warnings.push(skippedFacultyNote(unknownFaculty, skippedRows))`;
  must(s.includes(og),'gate '+noun); s=s.replace(og,ng);
}
fs.writeFileSync(p,s); console.log('patched');
