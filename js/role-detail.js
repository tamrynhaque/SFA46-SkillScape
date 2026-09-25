// Role detail: Level 1-3 skills matrix with persistent checkboxes, progress bar,
// learning resources per skill, and the SMART Targeter for gaps.

document.addEventListener("DOMContentLoaded", async () => {
    const session = requireLogin();
    if (!session) return;

    const roleId = Number(new URLSearchParams(window.location.search).get("id"));
    if (!roleId) { window.location.href = "roles.html"; return; }

    const matrixEl = document.getElementById("matrix");
    const targetsEl = document.getElementById("targets");
    const setRoleBtn = document.getElementById("set-role-btn");

    let role, skills, progress, targets, me;
    const resources = {}; // skillId -> courses

    try {
        [role, skills, progress, targets, me] = await Promise.all([
            Store.role(roleId), Store.skillsForRole(roleId), Store.progress(session.id),
            Store.targets(session.id), Store.user(session.id)
        ]);
    } catch (err) {
        matrixEl.innerHTML = `<p class="error">Could not load this role: ${escapeHtml(err.message)}</p>`;
        return;
    }
    if (!role) { window.location.href = "roles.html"; return; }

    document.title = `${role.name} - SkillScape`;
    document.getElementById("role-name").textContent = role.name;
    await Promise.all(skills.map(async s => { resources[s.id] = await CoursesApi.forSkill(s); }));

    // --- "Make this my role" ---
    function renderRoleButton() {
        const isMine = me && me.role_id === role.id;
        setRoleBtn.hidden = false;
        setRoleBtn.disabled = isMine;
        setRoleBtn.textContent = isMine ? "✓ My current role" : "Make this my role";
    }
    setRoleBtn.addEventListener("click", async () => {
        try {
            await Store.updateUser(session.id, { role_id: role.id });
            me.role_id = role.id;
            renderRoleButton();
            toast(`${role.name} is now your role path`);
        } catch (err) {
            toast("Could not update role: " + err.message, "error");
        }
    });
    renderRoleButton();

    // --- Progress bar ---
    function renderProgress() {
        const s = summarise(skills, progress);
        document.getElementById("progress-fill").style.width = `${s.pct}%`;
        document.getElementById("progress-text").textContent = `${s.pct}% (${s.complete}/${s.total} complete)`;
        document.getElementById("role-summary").textContent =
            `${s.total} skills · ${s.complete} complete · ${s.inProgress} in progress · ${s.total - s.complete - s.inProgress} gaps`;
    }

    // --- Matrix ---
    function skillCard(skill) {
        const status = progress[skill.id] || STATUS.NOT_STARTED;
        const statusClass = status.toLowerCase().replace(/\s+/g, "-");
        const links = (resources[skill.id] || []).slice(0, 2).map(courseLink).join("");
        const hasTarget = targets.some(t => t.skill_id === skill.id);

        return `
            <div class="skill-card status-${statusClass}" data-skill="${skill.id}">
                <div class="skill-card-head">
                    <h4>${escapeHtml(skill.name)}</h4>
                    <span class="status-pill pill-${statusClass}">${status}</span>
                </div>
                <div class="skill-checks">
                    <label><input type="checkbox" data-status="${STATUS.IN_PROGRESS}" ${status === STATUS.IN_PROGRESS ? "checked" : ""}> In progress</label>
                    <label><input type="checkbox" data-status="${STATUS.COMPLETE}" ${status === STATUS.COMPLETE ? "checked" : ""}> Complete</label>
                </div>
                <div class="resources">
                    <span class="resources-label">Learning Bridge</span>
                    ${links}
                </div>
                ${status !== STATUS.COMPLETE ? `
                    <button class="btn-secondary smart-btn" data-skill="${skill.id}">
                        ${hasTarget ? "Generate another SMART goal" : "Generate SMART goal"}
                    </button>` : ""}
            </div>`;
    }

    function renderMatrix() {
        if (skills.length === 0) {
            matrixEl.innerHTML = `<p class="muted">No skills are mapped to this role yet.</p>`;
            return;
        }
        matrixEl.innerHTML = [1, 2, 3].map(level => {
            const levelSkills = skills.filter(s => s.level === level);
            const done = levelSkills.filter(s => progress[s.id] === STATUS.COMPLETE).length;
            return `
                <div class="matrix-column">
                    <div class="matrix-level">
                        <span class="level-num">Level ${level}</span>
                        <span class="level-name">${LEVELS[level]}</span>
                        <span class="level-count mono">${done}/${levelSkills.length}</span>
                    </div>
                    ${levelSkills.length ? levelSkills.map(skillCard).join("") : `<p class="muted small">No Level ${level} skills for this role.</p>`}
                </div>`;
        }).join("");
        renderProgress();
    }

    // Checkbox clicks: the two boxes act as one 3-state control (Not Started / In Progress / Complete).
    matrixEl.addEventListener("change", async e => {
        const box = e.target;
        if (box.type !== "checkbox") return;
        const skillId = Number(box.closest(".skill-card").dataset.skill);
        const previous = progress[skillId] || STATUS.NOT_STARTED;
        const newStatus = box.checked ? box.dataset.status : STATUS.NOT_STARTED;

        progress[skillId] = newStatus;
        renderMatrix();
        try {
            await Store.setStatus(session.id, skillId, newStatus);
        } catch (err) {
            // Still saved in localStorage by Store.setStatus, so it survives a refresh.
            toast("Saved on this device - cloud sync failed: " + err.message, "error");
            return;
        }
        if (newStatus === STATUS.COMPLETE && previous !== STATUS.COMPLETE) {
            toast("Skill complete - nice work! 🎉");
        }
    });

    matrixEl.addEventListener("click", e => {
        const btn = e.target.closest(".smart-btn");
        if (!btn) return;
        const skill = skills.find(s => s.id === Number(btn.dataset.skill));
        openSmartModal({
            skill, roleName: role.name, userId: session.id,
            onSaved: async () => { targets = await Store.targets(session.id); renderMatrix(); renderTargets(); }
        });
    });

    // --- Saved SMART targets for this role's skills ---
    function renderTargets() {
        const skillIds = new Set(skills.map(s => s.id));
        const mine = targets.filter(t => skillIds.has(t.skill_id));
        if (mine.length === 0) {
            targetsEl.innerHTML = `<p class="muted">No SMART targets set for this role yet.</p>`;
            return;
        }
        targetsEl.innerHTML = mine.map(t => {
            const skill = skills.find(s => s.id === t.skill_id);
            const done = progress[t.skill_id] === STATUS.COMPLETE;
            return `
                <div class="target-card${done ? " target-done" : ""}">
                    <div class="skill-card-head">
                        <h4>${escapeHtml(skill ? skill.name : "Skill")}</h4>
                        ${done ? `<span class="status-pill pill-complete">Achieved</span>` : ""}
                    </div>
                    ${renderTargetText(t.target_text)}
                    <div class="target-foot">
                        <span class="muted small">Set ${formatDate(t.created_at)}</span>
                        <button class="link-btn delete-target" data-id="${t.id}">Remove</button>
                    </div>
                </div>`;
        }).join("");
    }

    targetsEl.addEventListener("click", async e => {
        const btn = e.target.closest(".delete-target");
        if (!btn || !confirm("Remove this SMART target?")) return;
        try {
            await Store.deleteTarget(btn.dataset.id);
            targets = targets.filter(t => String(t.id) !== btn.dataset.id);
            renderTargets();
            renderMatrix();
        } catch (err) {
            toast("Could not remove target: " + err.message, "error");
        }
    });

    renderMatrix();
    renderTargets();
});
