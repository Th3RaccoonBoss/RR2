// Offline-only schema-shape helper. No network, environment, credentials, IDs or
// values are returned. Unknown keys are counted, not echoed. No recursive data.
const allowed = ['id', 'name', 'label', 'description', 'contactTypeId', 'leadSourceId'];
const kind = value => value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
export function summarizeReferenceShape(raw) {
  const object = raw !== null && typeof raw === 'object' && !Array.isArray(raw);
  const envelope = Array.isArray(raw) ? 'array' : object && Array.isArray(raw.items) ? 'items' : object && Array.isArray(raw.data) ? 'data' : 'unsupported';
  const records = envelope === 'array' ? raw : envelope === 'unsupported' ? [] : raw[envelope];
  const types = Object.fromEntries(allowed.map(key => [key, new Set()]));
  let unknownFieldCount = 0, invalidRecordCount = 0;
  for (const record of records.slice(0, 25)) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) { invalidRecordCount++; continue; }
    for (const key of Object.keys(record)) {
      if (allowed.includes(key)) types[key].add(kind(record[key]));
      else unknownFieldCount++;
    }
  }
  return { envelope, sampledRecords: Math.min(records.length, 25), sampleLimit: 25,
    invalidRecordCount, unknownFieldCount,
    fields: Object.fromEntries(allowed.filter(key => types[key].size).map(key => [key, [...types[key]].sort()])),
    completeDatasetVerified: false, liveAclRead: false };
}
