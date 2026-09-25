/**
 * paginate.js — Shared offset pagination helper.
 *
 * Usage in a route:
 *   const { parsePage, paginateQuery, paginatedResponse } = require('../middleware/paginate');
 *
 *   const { page, limit, offset } = parsePage(req.query);
 *
 *   // Add to your SQL:
 *   const countResult = await req2.query(`SELECT COUNT(*) AS total FROM ... WHERE ...`);
 *   const dataResult  = await req2.query(`SELECT ... FROM ... WHERE ... ORDER BY ... ${paginateQuery(offset, limit)}`);
 *
 *   return res.json(paginatedResponse(dataResult.recordset, countResult.recordset[0].total, page, limit));
 */

const DEFAULT_LIMIT = 20;
const MAX_LIMIT     = 100;

/**
 * Parse ?page and ?limit from query string.
 * @returns {{ page: number, limit: number, offset: number }}
 */
function parsePage(query) {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit) || DEFAULT_LIMIT));
  return { page, limit, offset: (page - 1) * limit };
}

/**
 * Returns the MSSQL OFFSET/FETCH clause string.
 * Must come AFTER an ORDER BY clause in your query.
 */
function paginateQuery(offset, limit) {
  return `OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
}

/**
 * Wraps data in a standard paginated response envelope.
 */
function paginatedResponse(data, total, page, limit) {
  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

module.exports = { parsePage, paginateQuery, paginatedResponse };
