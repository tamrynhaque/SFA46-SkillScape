// Consultant dashboard: "Where am I now, and what do I need to do to get to the next level?"

document.addEventListener("DOMContentLoaded", async () => {
    const session = requireLogin();
    if (!session) return;
    if (session.isAdmin) {
        // Admins can still use the consultant view; give them a way back.
        document.querySelector("nav").insertAdjacentHTML("afterbegin", `<a href="admin.html" class="nav-link">Admin</a>`);
    }

    const pathEl = document.getElementById("learning-path");
    const skillsEl = document.getElementById("skills-summary");
    const targetsEl = document.getElementById("targets");
    const otherRolesEl = document.getElementById("other-roles");

    document.getElementById("user-display-name").textContent = session.name;
    document.getElementById("user-display-email").textContent = session.email;

    let me, roles, roleSkills, skills, progress, targets;
    try {
        [me, roles, roleSkills, skills, progress, targets] = await Promise.all([
            Store.user(session.id), Store.roles(), Store.roleSkillMap(), Store.allSkills(),
            Store.progress(session.id), Store.targets(session.id)
        ]);
    } catch (err) {
        pathEl.innerHTML = `<p class="error">Could not load your dashboard: ${escapeHtml(err.message)}</p>`;
        return;
    }
    if (!me) { Session.clear(); window.location.href = "login.html"; return; }

    const skillById = Object.fromEntries(skills.map(s => [s.id, s]));
    const skillsFor = roleId => (roleSkills[roleId] || []).map(id => skillById[id]).filter(Boolean)
        .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    const myRole = roles.find(r => r.id === me.role_id);

    // --- Current learning path ---
    function renderPath() {
        if (!myRole) {
            pathEl.innerHTML = `
                <h3>No role selected yet</h3>
                <p>Pick the role you're working towards to see your skills matrix.</p>
                <a href="roles.html" class="btn-primary" style="align-self: flex-start;">Choose a role</a>`;
            return;
        }
        const roleSkillList = skillsFor(myRole.id);
        const s = summarise(roleSkillList, progress);
        const nextGap = roleSkillList.find(sk => progress[sk.id] === STATUS.IN_PROGRESS)
            || roleSkillList.find(sk => progress[sk.id] !== STATUS.COMPLETE);
        const currentLevel = [1, 2, 3].find(l => s.byLevel[l].complete < s.byLevel[l].total);

        pathEl.innerHTML = `
            <h3>${escapeHtml(myRole.name)}</h3>
            <p>${currentLevel ? `Working on <strong>Level ${currentLevel}: ${LEVELS[currentLevel]}</strong>` : `<strong>All levels complete!</strong>`}</p>
            ${progressBar(s.pct)}
            <p class="progress-caption mono">${s.pct}% COMPLETE · ${s.complete}/${s.total} SKILLS</p>
            <div class="level-bars">
                ${[1, 2, 3].map(l => {
                    const lv = s.byLevel[l];
                    const pct = percent(lv.complete, lv.total);
                    return `<div class="role-completion-bar">
                        <label>L${l} ${LEVELS[l]} <span>${lv.total ? pct + "%" : "–"}</span></label>
                        ${progressBar(pct)}
                    </div>`;
                }).join("")}
            </div>
            ${nextGap ? `
                <div class="next-up">
                    <span class="muted">Next up:</span> <strong>${escapeHtml(nextGap.name)}</strong>
                    <span class="muted">(Level ${nextGap.level})</span>
                    <button id="next-smart" class="btn-secondary">Generate SMART goal</button>
                </div>` : ""}
            <a href="role-detail.html?id=${myRole.id}" class="btn-primary" style="align-self: flex-start; margin-top: 1rem;">Open Skills Matrix</a>`;

        document.getElementById("next-smart")?.addEventListener("click", () => openSmartModal({
            skill: nextGap, roleName: myRole.name, userId: session.id,
            onSaved: async () => { targets = await Store.targets(session.id); renderTargets(); }
        }));
    }

    // --- My skills (complete + in progress) ---
    function renderSkills() {
        const complete = skills.filter(s => progress[s.id] === STATUS.COMPLETE);
        const inProgress = skills.filter(s => progress[s.id] === STATUS.IN_PROGRESS);
        const tag = s => `<div class="skill-tag">${escapeHtml(s.name)} <span>L${s.level}</span></div>`;
        skillsEl.innerHTML = `
            <h3 class="sub-heading">✓ Attained (${complete.length})</h3>
            <div class="skills-grid">${complete.length ? complete.map(tag).join("") : `<p class="muted">No completed skills yet - mark skills Complete in your matrix.</p>`}</div>
            <h3 class="sub-heading">⏳ In progress (${inProgress.length})</h3>
            <div class="skills-grid">${inProgress.length ? inProgress.map(tag).join("") : `<p class="muted">Nothing in progress.</p>`}</div>`;
    }

    // --- SMART targets ---
    function renderTargets() {
        if (targets.length === 0) {
            targetsEl.innerHTML = `<p class="muted">No SMART targets yet. Open your skills matrix and click <strong>Generate SMART goal</strong> on a skill gap.</p>`;
            return;
        }
        targetsEl.innerHTML = targets.map(t => {
            const skill = skillById[t.skill_id];
            const done = progress[t.skill_id] === STATUS.COMPLETE;
            return `
                <div class="target-card${done ? " target-done" : ""}">
                    <div class="skill-card-head">
                        <h4>${escapeHtml(skill ? skill.name : "Skill")}</h4>
                        <span class="status-pill ${done ? "pill-complete" : "pill-in-progress"}">${done ? "Achieved" : "Active"}</span>
                    </div>
                    ${renderTargetText(t.target_text)}
                    <p class="muted small">Set ${formatDate(t.created_at)}</p>
                </div>`;
        }).join("");
    }

    // --- Other roles (completion if you switched) ---
    function renderOtherRoles() {
        const others = roles.filter(r => r.id !== me.role_id && (roleSkills[r.id] || []).length);
        otherRolesEl.innerHTML = others.map(r => {
            const s = summarise(skillsFor(r.id), progress);
            return `
                <a class="role-card" href="role-detail.html?id=${r.id}">
                    <h3>${escapeHtml(r.name)}</h3>
                    <p class="role-meta">Completion: ${s.pct}% (${s.complete}/${s.total} complete)</p>
                    ${progressBar(s.pct)}
                    <span class="btn-secondary" style="margin-top: 1rem;">Analyse gaps</span>
                </a>`;
        }).join("") || `<p class="muted">No other roles available.</p>`;
    }

    renderPath();
    renderSkills();
    renderTargets();
    renderOtherRoles();
});
