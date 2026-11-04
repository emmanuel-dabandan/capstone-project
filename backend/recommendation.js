// recommendation.js  (put it next to server.js)
//
// Picks which SUBJECT (ai_lessons.title) to recommend, using only real data:
//   - the student's quiz grades, if they have any
//   - otherwise the subject with the least progress in ai_lessons
// No hardcoded subject names anywhere.

// Same normalization the app uses to group weeks into one subject
export const subjectKey = (title) =>
  String(title || '').trim().replace(/\s+/g, ' ').toLowerCase();

// ai_lessons rows are weeks; group them into one entry per subject
export function groupSubjects(lessonRows) {
  const subjects = new Map();
  (lessonRows || []).forEach((row) => {
    const name = String(row.title || '').trim();
    if (!name) return;
    const key = subjectKey(name);
    const entry = subjects.get(key) || { name, totalProgress: 0, weeks: 0 };
    entry.totalProgress += Number(row.progress) || 0;
    entry.weeks += 1;
    subjects.set(key, entry);
  });
  return subjects;
}

// lessonRows: [{ title, progress }]   grades: [{ module_title, score, total_items }] newest first
// Returns null when there are no lessons, otherwise:
//   { target_module, facts, fallbackRationale }
export function pickRecommendationTarget(lessonRows, grades) {
  const subjects = groupSubjects(lessonRows);
  if (subjects.size === 0) return null;

  // Latest valid grade for each subject that really exists in the database
  const latest = new Map();
  (grades || []).forEach((g) => {
    const key = subjectKey(g.module_title);
    const total = Number(g.total_items);
    if (!subjects.has(key) || latest.has(key) || !(total > 0)) return;
    const score = Number(g.score) || 0;
    latest.set(key, { score, total, percent: Math.round((score / total) * 100) });
  });

  // 1) The student has grades: recommend the subject they scored lowest in
  if (latest.size > 0) {
    let lowestKey = null;
    latest.forEach((g, key) => {
      if (lowestKey === null || g.percent < latest.get(lowestKey).percent) lowestKey = key;
    });
    const g = latest.get(lowestKey);
    const name = subjects.get(lowestKey).name;
    return {
      target_module: name,
      facts: `The student's latest assessment in "${name}" scored ${g.score} out of ${g.total} (${g.percent}%), which is their lowest result.`,
      fallbackRationale: `You scored ${g.percent}% on your last assessment here, so a quick review will help it stick.`,
    };
  }

  // 2) No grades yet: recommend the subject with the least progress
  let lowest = null;
  subjects.forEach((s) => {
    const avg = Math.round(s.totalProgress / s.weeks);
    if (!lowest || avg < lowest.avg) lowest = { name: s.name, avg };
  });

  return {
    target_module: lowest.name,
    facts:
      lowest.avg > 0
        ? `The student is ${lowest.avg}% of the way through "${lowest.name}", the subject they have made the least progress in.`
        : `The student has not started "${lowest.name}" yet.`,
    fallbackRationale:
      lowest.avg > 0
        ? `You're ${lowest.avg}% through this subject. Keep going to finish it.`
        : 'Start your first lesson here and build your learning streak.',
  };
}