// Generates assets/activity.svg: a black-and-white GitHub activity card matching the README's classic cards.
// Runs in GitHub Actions (Node 20+, no dependencies). Env: GH_TOKEN, LOGIN.
import { writeFileSync, mkdirSync } from 'node:fs';

const LOGIN = process.env.LOGIN;
const TOKEN = process.env.GH_TOKEN;
if (!LOGIN || !TOKEN) { console.error('LOGIN and GH_TOKEN are required'); process.exit(1); }

const query = `query($login:String!){user(login:$login){
  repositories(ownerAffiliations:OWNER, privacy:PUBLIC, first:100){totalCount nodes{stargazerCount}}
  contributionsCollection{
    totalCommitContributions totalPullRequestContributions
    contributionCalendar{totalContributions weeks{contributionDays{date contributionCount}}}
  }}}`;

const res = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: { Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'readme-activity-card' },
  body: JSON.stringify({ query, variables: { login: LOGIN } }),
});
const json = await res.json();
if (!json.data?.user) { console.error(JSON.stringify(json)); process.exit(1); }
const u = json.data.user;
const cal = u.contributionsCollection.contributionCalendar;
const days = cal.weeks.flatMap(w => w.contributionDays);
const stars = u.repositories.nodes.reduce((a, r) => a + r.stargazerCount, 0);

let longest = 0, run = 0;
for (const d of days) { run = d.contributionCount > 0 ? run + 1 : 0; longest = Math.max(longest, run); }
let current = 0, i = days.length - 1;
if (i >= 0 && days[i].contributionCount === 0) i--;
for (; i >= 0 && days[i].contributionCount > 0; i--) current++;

const MONO = `font-family="'JetBrains Mono','SFMono-Regular',Menlo,Consolas,monospace"`;
const SANS = `font-family="'Segoe UI',Helvetica,Arial,sans-serif"`;
const fmt = n => Number(n).toLocaleString('en-US');

const W = 1200, H = 360;
let b = `<rect width="${W}" height="${H}" rx="16" fill="#0d0d0d"/><rect x="0.5" y="0.5" width="${W-1}" height="${H-1}" rx="15.5" fill="none" stroke="#353535"/>`;
b += `<rect x="0" y="0" width="6" height="${H}" rx="3" fill="#ffffff"/>`;
b += `<text x="48" y="58" ${MONO} font-size="13" fill="#ffffff" letter-spacing="2">ACTIVITY · LAST 12 MONTHS</text>`;
b += `<text x="48" y="96" ${SANS} font-size="30" font-weight="700" fill="#ffffff">${fmt(cal.totalContributions)} <tspan font-size="18" font-weight="400" fill="#939393">contributions</tspan></text>`;

// heatmap
const max = Math.max(1, ...days.map(d => d.contributionCount));
const shades = ['#1a1a1a', '#3d3d3d', '#6b6b6b', '#a8a8a8', '#ffffff'];
const shade = n => n === 0 ? shades[0] : shades[Math.min(4, 1 + Math.floor((n / max) * 3.999))];
const cell = 13, gap = 4, gx = 48, gy = 124;
cal.weeks.forEach((w, wi) => w.contributionDays.forEach(d => {
  const dow = new Date(d.date + 'T00:00:00Z').getUTCDay();
  b += `<rect x="${gx + wi*(cell+gap)}" y="${gy + dow*(cell+gap)}" width="${cell}" height="${cell}" rx="3" fill="${shade(d.contributionCount)}"/>`;
}));
const lx = gx + 53*(cell+gap) - 5*(cell+gap) - 70;
b += `<text x="${lx}" y="${gy + 7*(cell+gap) + 22}" ${MONO} font-size="11" fill="#939393">less</text>`;
shades.forEach((c, k) => b += `<rect x="${lx + 34 + k*(cell+gap)}" y="${gy + 7*(cell+gap) + 11}" width="${cell}" height="${cell}" rx="3" fill="${c}"/>`);
b += `<text x="${lx + 34 + 5*(cell+gap) + 4}" y="${gy + 7*(cell+gap) + 22}" ${MONO} font-size="11" fill="#939393">more</text>`;

// stats panel: 2 columns x 3 rows
const stats = [
  ['Streak', `${current}d`], ['Best', `${longest}d`],
  ['Commits', fmt(u.contributionsCollection.totalCommitContributions)], ['PRs', fmt(u.contributionsCollection.totalPullRequestContributions)],
  ['Repos', fmt(u.repositories.totalCount)], ['Stars', fmt(stars)],
];
const px = 966, py = 40, pw = W - px - 20, ph = H - 80;
b += `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="12" fill="#000000" stroke="#252525"/>`;
stats.forEach(([k, v], n) => {
  const x = px + 22 + (n % 2) * 104, y = py + 44 + Math.floor(n / 2) * 88;
  b += `<text x="${x}" y="${y}" ${SANS} font-size="13" fill="#939393">${k}</text>`;
  b += `<text x="${x}" y="${y + 30}" ${SANS} font-size="26" font-weight="700" fill="#ffffff">${v}</text>`;
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="GitHub activity: ${cal.totalContributions} contributions in the last year, current streak ${current} days, longest ${longest} days">${b}</svg>\n`;
mkdirSync('assets', { recursive: true });
writeFileSync('assets/activity.svg', svg);
console.log(`activity.svg: ${cal.totalContributions} contributions, streak ${current}, best ${longest}`);
