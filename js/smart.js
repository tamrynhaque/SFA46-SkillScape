// SMART Targeter: turns a skill gap into a Specific, Measurable, Achievable, Relevant, Time-bound goal.
// Rule-based generator - the course length and chosen weekly hours drive the deadline.

const LEVEL_OUTCOME = {
    1: skill => `pass a self-check quiz on ${skill} (80%+) and write up 3 key takeaways`,
    2: skill => `apply ${skill} in a small hands-on exercise committed to a Git repo`,
    3: skill => `build a proof-of-concept using ${skill} and demo it to a peer or the Academy Lead`
};

// Next Friday on/after the given date - deadlines land at the end of a working week.
function endOfWeek(date) {
    const d = new Date(date);
    d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7));
    return d;
}

function generateSmartTarget({ skill, roleName, course, hoursPerWeek }) {
    const level = skill.level || 1;
    const courseWeeks = Math.ceil(course.duration_hours / hoursPerWeek);
    const practiceWeeks = level >= 3 ? 1 : 0; // expert skills get an extra week to build something
    const weeks = Math.max(1, courseWeeks + practiceWeeks);

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + weeks * 7);
    const due = endOfWeek(deadline);
    const dueText = formatDate(due);
    const outcome = LEVEL_OUTCOME[level] ? LEVEL_OUTCOME[level](skill.name) : LEVEL_OUTCOME[1](skill.name);

    return {
        goal: `Complete "${course.title}" on ${course.provider} and ${outcome} by ${dueText}.`,
        specific: `Close my Level ${level} (${LEVELS[level] || "Foundational"}) gap in ${skill.name} by working through "${course.title}".`,
        measurable: `Course 100% complete (~${course.duration_hours}h) and I ${outcome}; then mark ${skill.name} as Complete in SkillScape.`,
        achievable: `${hoursPerWeek}h per week over ${weeks} week${weeks > 1 ? "s" : ""} - fits alongside project work.`,
        relevant: `${skill.name} is a required Level ${level} skill for the ${roleName} role.`,
        timeBound: `Deadline: ${dueText}. Weekly check-in every Friday.`,
        deadline: due.toISOString().slice(0, 10)
    };
}

// Stored as plain text in smart_targets.target_text so it's readable in the admin view and the DB.
function smartToText(t) {
    return [
        `GOAL: ${t.goal}`,
        `Specific: ${t.specific}`,
        `Measurable: ${t.measurable}`,
        `Achievable: ${t.achievable}`,
        `Relevant: ${t.relevant}`,
        `Time-bound: ${t.timeBound}`
    ].join("\n");
}

// Renders stored target text back into a card body.
function renderTargetText(text) {
    const lines = String(text || "").split("\n");
    const goalLine = lines.find(l => l.startsWith("GOAL:"));
    const goal = goalLine ? goalLine.slice(5).trim() : lines[0];
    const parts = lines.filter(l => l !== goalLine && l.includes(":")).map(l => {
        const i = l.indexOf(":");
        return `<li><strong>${escapeHtml(l.slice(0, i))}:</strong> ${escapeHtml(l.slice(i + 1).trim())}</li>`;
    });
    return `<p class="target-goal">${escapeHtml(goal)}</p>${parts.length ? `<ul class="smart-list">${parts.join("")}</ul>` : ""}`;
}

// Modal: pick a course + weekly hours, preview the SMART goal, save it to smart_targets.
async function openSmartModal({ skill, roleName, userId, onSaved }) {
    const courses = await CoursesApi.forSkill(skill);
    document.getElementById("smart-modal")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "smart-modal";
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="smart-title">
            <button class="modal-close" aria-label="Close">&times;</button>
            <span class="role-badge">Level ${skill.level} · ${escapeHtml(LEVELS[skill.level] || "")}</span>
            <h3 id="smart-title">SMART Target: ${escapeHtml(skill.name)}</h3>
            <div class="modal-controls">
                <label>Learning resource
                    <select id="smart-course">
                        ${courses.map((c, i) => `<option value="${i}">${escapeHtml(c.provider)} - ${escapeHtml(c.title)} (~${c.duration_hours}h)</option>`).join("")}
                    </select>
                </label>
                <label>Time I can commit
                    <select id="smart-hours">
                        <option value="1">1 hour / week</option>
                        <option value="2" selected>2 hours / week</option>
                        <option value="3">3 hours / week</option>
                        <option value="5">5 hours / week</option>
                    </select>
                </label>
            </div>
            <div id="smart-preview" class="smart-preview"></div>
            <div class="modal-actions">
                <a id="smart-open-course" class="btn-secondary" target="_blank" rel="noopener">Open resource</a>
                <button id="smart-save" class="btn-primary">Save target</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    const courseSelect = overlay.querySelector("#smart-course");
    const hoursSelect = overlay.querySelector("#smart-hours");
    const preview = overlay.querySelector("#smart-preview");
    const openLink = overlay.querySelector("#smart-open-course");
    let current;

    function refresh() {
        const course = courses[Number(courseSelect.value)];
        current = generateSmartTarget({ skill, roleName, course, hoursPerWeek: Number(hoursSelect.value) });
        preview.innerHTML = renderTargetText(smartToText(current));
        openLink.href = course.url;
    }

    function close() {
        overlay.remove();
        document.removeEventListener("keydown", onKey);
    }
    function onKey(e) { if (e.key === "Escape") close(); }

    courseSelect.addEventListener("change", refresh);
    hoursSelect.addEventListener("change", refresh);
    overlay.querySelector(".modal-close").addEventListener("click", close);
    overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", onKey);

    overlay.querySelector("#smart-save").addEventListener("click", async e => {
        e.target.disabled = true;
        try {
            await Store.saveTarget(userId, skill.id, smartToText(current));
            toast(`SMART target saved for ${skill.name}`);
            close();
            if (onSaved) onSaved();
        } catch (err) {
            toast("Could not save target: " + err.message, "error");
            e.target.disabled = false;
        }
    });

    refresh();
}
