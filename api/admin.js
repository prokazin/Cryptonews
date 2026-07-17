import { getStats, getRecent } from '../utils/db.js';

export default function handler(req, res) {
  const stats = getStats();
  const recent = getRecent(10);
  res.json({ stats, recent });
}
